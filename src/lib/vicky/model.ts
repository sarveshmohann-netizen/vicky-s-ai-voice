// Driver-based cash model behind Vicky's what-if and stress-test tools.
// Pure, deterministic code: the language model turns a founder's question into
// a scenario, and this module does the arithmetic. No dependencies.

export interface Hire {
  month: number; // 1-based month of the projection the hire starts
  count: number;
}

export interface Assumptions {
  startingCash: number;
  startingMRR: number; // monthly recurring revenue in month 0
  monthlyGrowth: number; // gross new MRR growth, 0.06 = 6% a month
  monthlyChurn: number; // share of MRR lost each month, 0.02 = 2%
  grossMargin: number; // 0.75 = 75%
  headcount: number;
  costPerHead: number; // fully loaded monthly cost per employee
  otherOpex: number; // monthly non-headcount operating cost
  hires: Hire[];
  raise?: { amount: number; month: number }; // cash received at the start of that month
  months: number; // projection horizon
}

export interface MonthRow {
  month: number;
  revenue: number;
  grossProfit: number;
  opex: number;
  netBurn: number; // positive = cash going out
  cash: number;
  headcount: number;
}

export interface Summary {
  runwayMonths: number | null; // null = cash never runs out within the horizon
  horizon: number;
  endingMRR: number;
  peakBurn: number;
  breakEvenMonth: number | null;
}

export function project(a: Assumptions): MonthRow[] {
  const rows: MonthRow[] = [];
  let mrr = a.startingMRR;
  let cash = a.startingCash;
  let headcount = a.headcount;
  for (let m = 1; m <= a.months; m++) {
    mrr = mrr * (1 + a.monthlyGrowth - a.monthlyChurn);
    headcount += a.hires.filter((h) => h.month === m).reduce((s, h) => s + h.count, 0);
    if (a.raise && a.raise.month === m) cash += a.raise.amount;
    const grossProfit = mrr * a.grossMargin;
    const opex = headcount * a.costPerHead + a.otherOpex;
    const netBurn = opex - grossProfit;
    cash -= netBurn;
    rows.push({ month: m, revenue: mrr, grossProfit, opex, netBurn, cash, headcount });
  }
  return rows;
}

export function summarize(a: Assumptions, rows = project(a)): Summary {
  // Runway is fractional: the month cash crosses zero, interpolated inside it.
  let runwayMonths: number | null = null;
  let prevCash = a.startingCash;
  for (const r of rows) {
    if (r.cash < 0) {
      const start = prevCash + (a.raise?.month === r.month ? a.raise.amount : 0);
      runwayMonths = r.month - 1 + start / r.netBurn;
      break;
    }
    prevCash = r.cash;
  }
  const breakEven = rows.find((r) => r.netBurn <= 0);
  return {
    runwayMonths: runwayMonths === null ? null : Math.round(runwayMonths * 10) / 10,
    horizon: a.months,
    endingMRR: Math.round(rows.at(-1)?.revenue ?? a.startingMRR),
    peakBurn: Math.round(Math.max(0, ...rows.map((r) => r.netBurn))),
    breakEvenMonth: breakEven ? breakEven.month : null,
  };
}

// --- What-if -----------------------------------------------------------------

export interface WhatIf {
  label: string; // the founder's question in plain words
  changes: Partial<Omit<Assumptions, "hires">>;
  addHires?: Hire[];
}

export function whatIf(base: Assumptions, q: WhatIf) {
  const scenario: Assumptions = { ...base, ...q.changes, hires: [...base.hires, ...(q.addHires ?? [])] };
  const before = summarize(base);
  const after = summarize(scenario);
  return {
    label: q.label,
    before,
    after,
    runwayChange:
      before.runwayMonths !== null && after.runwayMonths !== null
        ? Math.round((after.runwayMonths - before.runwayMonths) * 10) / 10
        : null,
  };
}

// --- Stress test ---------------------------------------------------------------

type Driver = "monthlyGrowth" | "monthlyChurn" | "grossMargin" | "costPerHead" | "otherOpex";

// Direction each driver moves when things go worse than planned.
const WORSE: Record<Driver, { dir: -1 | 1; label: string }> = {
  monthlyGrowth: { dir: -1, label: "revenue growth" },
  monthlyChurn: { dir: 1, label: "churn" },
  grossMargin: { dir: -1, label: "gross margin" },
  costPerHead: { dir: 1, label: "cost per employee" },
  otherOpex: { dir: 1, label: "other operating costs" },
};

const shocked = (a: Assumptions, d: Driver, shock: number): Assumptions => ({
  ...a,
  [d]: a[d] * (1 + WORSE[d].dir * shock),
});

// Runway with "never runs out" counted as the horizon, so scenarios compare.
const runwayOf = (a: Assumptions) => summarize(a).runwayMonths ?? a.months;

export interface StressResult {
  driver: Driver;
  label: string;
  planned: number;
  shockedValue: number;
  runwayMonths: number;
  monthsLost: number;
  // How far this driver alone can slip before runway falls below the target.
  breakingPoint: { value: number; slip: number } | null;
}

export function stressTest(base: Assumptions, shock = 0.2, targetRunway = 18): StressResult[] {
  const baseRunway = runwayOf(base);
  return (Object.keys(WORSE) as Driver[])
    .filter((d) => base[d] !== 0)
    .map((d) => {
      const runway = runwayOf(shocked(base, d, shock));
      return {
        driver: d,
        label: WORSE[d].label,
        planned: base[d],
        shockedValue: shocked(base, d, shock)[d],
        runwayMonths: Math.round(runway * 10) / 10,
        monthsLost: Math.round((baseRunway - runway) * 10) / 10,
        breakingPoint: breakingPoint(base, d, targetRunway),
      };
    })
    .sort((x, y) => y.monthsLost - x.monthsLost);
}

// Bisection on the slip (0 to 100%) where runway first drops below the target.
function breakingPoint(base: Assumptions, d: Driver, target: number) {
  if (runwayOf(base) < target) return { value: base[d], slip: 0 };
  if (runwayOf(shocked(base, d, 1)) >= target) return null;
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (runwayOf(shocked(base, d, mid)) >= target) lo = mid;
    else hi = mid;
  }
  return { value: shocked(base, d, hi)[d], slip: Math.round(hi * 1000) / 1000 };
}
