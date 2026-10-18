// Data for Vicky's charts, ready to hand to Recharts. Every series is computed
// here so the chart and the text always show the same numbers.

import { CUSTOMERS_BY_QUARTER, FORECAST_BY_QUARTER, RUNWAY_AFTER_RAISE } from "./facts.ts";
import { INCOME_STATEMENT } from "./incomeStatement.ts";
import type { ClaimCheck, ClaimStatus } from "./claims.ts";
import type { Metric } from "./metrics.ts";

const QUARTER_END: Record<string, string> = { Q1: "03", Q2: "06", Q3: "09", Q4: "12" };
const quarterEndMonth = (q: string) => { const [p, y] = q.split(" "); return `${y}-${QUARTER_END[p!]}`; };
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export interface MrrPoint { month: string; actual?: number; plan?: number; atRecentPace?: number }

// Monthly MRR actuals, the founders' plan at each quarter end, and where MRR
// goes if growth stays at the last three months' pace.
export function mrrTrend(metrics: Record<string, Metric>): MrrPoint[] {
  const points = new Map<string, MrrPoint>();
  for (const r of INCOME_STATEMENT) points.set(r.month, { month: r.month, actual: r.subscriptionRevenue });
  const last = INCOME_STATEMENT.at(-1)!;
  const start = points.get(last.month)!;
  start.plan = last.subscriptionRevenue;
  start.atRecentPace = last.subscriptionRevenue;
  const g3 = metrics["growth3m"]?.value ?? 0;
  const end = quarterEndMonth(FORECAST_BY_QUARTER.at(-1)!.quarter);
  for (let i = 1, m = addMonths(last.month, 1); m <= end; i++, m = addMonths(m, 1)) {
    points.set(m, { month: m, atRecentPace: Math.round(last.subscriptionRevenue * (1 + g3) ** i) });
  }
  for (const q of FORECAST_BY_QUARTER) {
    const p = points.get(quarterEndMonth(q.quarter));
    if (p) p.plan = q.endingMrr;
  }
  return [...points.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export interface GrowthPoint { month: string; growth: number }

// Month-over-month MRR growth for the last 12 months.
export function monthlyGrowth(): GrowthPoint[] {
  return INCOME_STATEMENT.slice(-13).slice(1).map((r, i) => ({
    month: r.month,
    growth: r.subscriptionRevenue / INCOME_STATEMENT.slice(-13)[i]!.subscriptionRevenue - 1,
  }));
}

export interface CustomerBar { quarter: string; netNew: number; kind: "actual" | "plan" }

// Net new customers each quarter, actual then planned.
export function customersByQuarter(currentCustomers: number): CustomerBar[] {
  const actual = CUSTOMERS_BY_QUARTER.map((q) => ({ quarter: q.quarter, netNew: q.newCustomers - q.churned, kind: "actual" as const }));
  let prev = currentCustomers;
  const plan = FORECAST_BY_QUARTER.map((q) => { const n = q.customers - prev; prev = q.customers; return { quarter: q.quarter, netNew: n, kind: "plan" as const }; });
  return [...actual, ...plan];
}

export interface DeckVsData { id: string; label: string; deck: number; data: number; unit: "usd" | "pct" | "months"; status: ClaimStatus }

// The deck's number next to the computed one, for the claims that have both.
export function deckVsData(claims: ClaimCheck[], metrics: Record<string, Metric>): DeckVsData[] {
  const pick: [string, string, string, DeckVsData["unit"], number?][] = [
    ["arr", "ARR", "arr", "usd", 1_370_000],
    ["growth", "Monthly growth, last 3 months", "growth3m", "pct", 0.1],
    ["gross-margin", "Gross margin with support", "grossMarginWithSupport", "pct", 0.92],
    ["churn", "Monthly logo churn", "logoChurnMonthly12m", "pct", 0.01],
    ["nrr", "Net revenue retention", "nrr", "pct", 1.1],
    ["cac", "CAC, fully loaded", "cacFullyLoaded", "usd", 970],
  ];
  const out: DeckVsData[] = [];
  for (const [id, label, metricId, unit, deck] of pick) {
    const c = claims.find((x) => x.id === id);
    const m = metrics[metricId];
    if (c && m && deck !== undefined) out.push({ id, label, deck, data: m.value, unit, status: c.status });
  }
  const runway = claims.find((x) => x.id === "runway");
  if (runway) out.push({ id: "runway", label: "Runway after the raise", deck: 24, data: RUNWAY_AFTER_RAISE.historicalDriversMonths.value, unit: "months", status: runway.status });
  return out;
}

export interface RunwayBar { label: string; months: number }

export function runwayScenarios(metrics: Record<string, Metric>): RunwayBar[] {
  return [
    { label: "Deck claim", months: 24 },
    { label: "Founders' plan", months: RUNWAY_AFTER_RAISE.foundersPlanMonths.value },
    { label: "At actual growth", months: RUNWAY_AFTER_RAISE.historicalDriversMonths.value },
    { label: "Today, no raise", months: Math.round((metrics["runwayToday"]?.value ?? 0) * 10) / 10 },
  ];
}

export interface BurnPoint { month: string; operatingLoss: number; srAndEd: number }

export function monthlyBurn(): BurnPoint[] {
  return INCOME_STATEMENT.map((r) => ({ month: r.month, operatingLoss: -r.operatingIncome, srAndEd: r.otherIncomeSrredCredit }));
}

export interface TidewellCharts {
  mrr: MrrPoint[];
  growth: GrowthPoint[];
  customers: CustomerBar[];
  deckVsData: DeckVsData[];
  runway: RunwayBar[];
  burn: BurnPoint[];
}

export function buildCharts(claims: ClaimCheck[], metrics: Record<string, Metric>, currentCustomers: number): TidewellCharts {
  return {
    mrr: mrrTrend(metrics),
    growth: monthlyGrowth(),
    customers: customersByQuarter(currentCustomers),
    deckVsData: deckVsData(claims, metrics),
    runway: runwayScenarios(metrics),
    burn: monthlyBurn(),
  };
}
