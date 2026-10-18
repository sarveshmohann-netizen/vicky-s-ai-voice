// Vicky's analysis for any company: metrics from the uploaded P&L plus the few
// numbers a P&L can't hold (cash, customers, churn, the raise, the deck's
// claims). Same metric ids as the Tidewell sample, so every screen and the
// investor lens work for both.

import type { Analysis } from "../knowledge.ts";
import { scoreReadiness, type AssumptionFlag, type ConsistencyCheck, type ReadinessResult } from "../readiness.ts";
import type { ClaimStatus } from "../tidewell/claims.ts";
import { formatMetric, type Metric, type MetricUnit } from "../tidewell/metrics.ts";
import type { MonthRow, ParseResult } from "./parse.ts";

// What the founder types in. Every field is optional; missing ones are shown as gaps.
export interface CompanyProfile {
  name: string;
  currency?: string;
  cash?: number; // cash in the bank at the last month of the P&L
  raiseAmount?: number;
  customers?: number; // paying customers today
  newCustomersL12M?: number;
  logoChurnMonthly?: number; // 0.02 = 2% a month
  nrr?: number; // 0.95 = 95%
  grr?: number;
  largestCustomerShare?: number; // share of MRR
  planMonthlyGrowth?: number; // MRR growth the forecast assumes
  planMonthlySpendAfterRaise?: number; // average monthly net burn the plan expects once the money lands
  deck?: Partial<Record<DeckClaimId, number>>;
}

export type DeckClaimId = "arr" | "growth" | "grossMargin" | "churn" | "nrr" | "cac" | "runwayMonths";

export const DECK_LABELS: Record<DeckClaimId, { label: string; unit: MetricUnit }> = {
  arr: { label: "ARR", unit: "usd" },
  growth: { label: "Monthly growth", unit: "pct" },
  grossMargin: { label: "Gross margin", unit: "pct" },
  churn: { label: "Monthly logo churn", unit: "pct" },
  nrr: { label: "Net revenue retention", unit: "pct" },
  cac: { label: "Customer acquisition cost", unit: "usd" },
  runwayMonths: { label: "Runway after the raise", unit: "months" },
};

export interface CompanyClaim {
  id: DeckClaimId;
  label: string;
  unit: MetricUnit;
  deck: number;
  data: number | null;
  status: ClaimStatus;
  why: string;
}

export interface CompanyStoryCheck {
  id: string;
  title: string;
  plan: string;
  history: string;
  severity: "high" | "medium";
  refs: string[];
}

export interface CompanyCharts {
  mrr: { month: string; actual?: number; atRecentPace?: number; plan?: number }[];
  growth: { month: string; growth: number }[];
  burn: { month: string; operatingLoss: number; otherIncome: number }[];
  margin: { month: string; booked: number; withSupport?: number }[];
  deckVsData: { id: string; label: string; deck: number; data: number; unit: MetricUnit; status: ClaimStatus }[];
  runway: { label: string; months: number }[];
}

export interface CompanyAnalysis {
  company: { name: string; currency: string; from: string; to: string; months: number };
  parse: Pick<ParseResult, "mapping" | "warnings">;
  metrics: Record<string, Metric>;
  claims: CompanyClaim[];
  storyChecks: CompanyStoryCheck[];
  charts: CompanyCharts;
  flags: AssumptionFlag[];
  readiness: ReadinessResult;
  dataGaps: string[];
}

const P = "P&L";
const Y = "You";
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const sum = (rows: MonthRow[], k: keyof Omit<MonthRow, "month">) => rows.reduce((s, r) => s + r[k], 0);
const cmgr = (from: number, to: number, months: number) => (from > 0 && to > 0 ? (to / from) ** (1 / months) - 1 : NaN);
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export function companyMetrics(rows: MonthRow[], p: CompanyProfile): Record<string, Metric> {
  const m: Record<string, Metric> = {};
  const add = (id: string, label: string, value: number, unit: MetricUnit, calculation: string, ref = P) => {
    if (Number.isFinite(value)) m[id] = { id, label, value, unit, basis: "historical", source: ref, calculation };
  };
  const last = rows.at(-1);
  if (!last) return m;
  const l12 = rows.slice(-12);
  const l6 = rows.slice(-6);
  const span = `${l12[0]!.month} to ${last.month}`;

  const mrr = last.recurringRevenue;
  add("mrr", `MRR (${last.month})`, mrr, "usd", `Recurring revenue in ${last.month}`);
  add("arr", "ARR", mrr * 12, "usd", `${usd(mrr)} MRR × 12; one-time revenue left out`);
  if (last.otherRevenue) add("arrIncludingOnboarding", "Total revenue × 12", last.totalRevenue * 12, "usd", `${usd(last.totalRevenue)} total revenue × 12, including ${usd(last.otherRevenue)} of one-time revenue`);
  const rev12 = sum(l12, "totalRevenue");
  add("revenueL12M", `Revenue, ${span}`, rev12, "usd", `Sum of total revenue, ${span}`);
  add("onboardingL12M", `One-time revenue, ${span}`, sum(l12, "otherRevenue"), "usd", `Sum of one-time revenue, ${span}`);

  if (rows.length >= 13) {
    const yearAgo = rows.at(-13)!;
    add("growth12m", "MRR growth a month, last 12 months", cmgr(yearAgo.recurringRevenue, mrr, 12), "pct", `(${usd(mrr)} ÷ ${usd(yearAgo.recurringRevenue)})^(1/12) − 1`);
    add("netNewArr", "Net new ARR, last 12 months", (mrr - yearAgo.recurringRevenue) * 12, "usd", `(${usd(mrr)} − ${usd(yearAgo.recurringRevenue)}) × 12`);
  } else if (rows.length >= 2) {
    const first = rows[0]!;
    add("growth12m", `MRR growth a month, ${first.month} to ${last.month}`, cmgr(first.recurringRevenue, mrr, rows.length - 1), "pct", `(${usd(mrr)} ÷ ${usd(first.recurringRevenue)})^(1/${rows.length - 1}) − 1`);
    add("netNewArr", `Net new ARR since ${first.month}`, (mrr - first.recurringRevenue) * 12, "usd", `(${usd(mrr)} − ${usd(first.recurringRevenue)}) × 12`);
  }
  if (rows.length >= 4) {
    const q = rows.at(-4)!;
    add("growth3m", "MRR growth a month, last 3 months", cmgr(q.recurringRevenue, mrr, 3), "pct", `(${usd(mrr)} ÷ ${usd(q.recurringRevenue)})^(1/3) − 1`);
  }

  const gp12 = sum(l12, "grossProfit");
  const cs12 = sum(l12, "support");
  if (sum(l12, "cogs") > 0) add("grossMarginBooked", "Gross margin as booked", gp12 / rev12, "pct", `${usd(gp12)} gross profit ÷ ${usd(rev12)} revenue, ${span}`);
  if (cs12 > 0) add("grossMarginWithSupport", "Gross margin including support", (gp12 - cs12) / rev12, "pct", `(${usd(gp12)} − ${usd(cs12)} support) ÷ ${usd(rev12)}`);

  const burn = -l6.reduce((s, r) => s + r.operatingIncome, 0) / l6.length;
  add("monthlyBurn", "Monthly burn, last 6 months", Math.max(0, burn), "usd", burn > 0 ? `Average operating loss, last ${l6.length} months; other income left out` : "Operating income was positive on average, so there is no burn");
  if (p.cash !== undefined && burn > 0) add("runwayToday", "Runway at today's burn", p.cash / burn, "months", `${usd(p.cash)} cash ÷ ${usd(burn)} a month`, `${Y}; ${P}`);
  if (p.cash !== undefined && p.raiseAmount !== undefined && p.planMonthlySpendAfterRaise) add("runwayAfterRaise", "Runway after the raise", (p.cash + p.raiseAmount) / p.planMonthlySpendAfterRaise, "months", `(${usd(p.cash)} cash + ${usd(p.raiseAmount)} raise) ÷ ${usd(p.planMonthlySpendAfterRaise)} planned monthly burn`, Y);

  const netBurn12 = -sum(l12, "netIncome");
  const nna = m["netNewArr"]?.value;
  if (netBurn12 > 0 && nna && nna > 0) add("burnMultiple", "Burn multiple", netBurn12 / nna, "ratio", `${usd(netBurn12)} net loss ÷ ${usd(nna)} net new ARR, last 12 months (net loss stands in for cash burn)`);

  const sm12 = sum(l12, "salesMarketing");
  if (p.newCustomersL12M && sm12 > 0) {
    const cac = sm12 / p.newCustomersL12M;
    add("cacFullyLoaded", "CAC, fully loaded", cac, "usd", `${usd(sm12)} sales and marketing ÷ ${p.newCustomersL12M} new customers`, `${P}; ${Y}`);
    const programs = sum(l12, "marketingPrograms");
    if (programs > 0) add("cacProgramsOnly", "CAC, marketing programs only", programs / p.newCustomersL12M, "usd", `${usd(programs)} programs ÷ ${p.newCustomersL12M} new customers`, `${P}; ${Y}`);
    const gm = m["grossMarginWithSupport"]?.value ?? m["grossMarginBooked"]?.value;
    if (p.customers && gm) add("cacPaybackMonths", "CAC payback", cac / ((mrr / p.customers) * gm), "months", `${usd(cac)} ÷ (${usd(mrr / p.customers)} average MRR per customer × ${pct(gm)} margin)`, `${P}; ${Y}`);
  }
  if (p.logoChurnMonthly !== undefined) add("logoChurnMonthly12m", "Monthly logo churn", p.logoChurnMonthly, "pct", "Entered by the founder", Y);
  if (p.nrr !== undefined) add("nrr", "Net revenue retention", p.nrr, "pct", "Entered by the founder", Y);
  if (p.grr !== undefined) add("grr", "Gross revenue retention", p.grr, "pct", "Entered by the founder", Y);
  if (p.largestCustomerShare !== undefined) add("largestCustomerShare", "Largest customer's share of MRR", p.largestCustomerShare, "pct", "Entered by the founder", Y);
  return m;
}

// Each deck claim against the computed figure. Same statuses as the Tidewell checker.
export function compareClaims(deck: CompanyProfile["deck"], m: Record<string, Metric>): CompanyClaim[] {
  const out: CompanyClaim[] = [];
  const v = (id: string) => m[id]?.value ?? null;
  for (const [id, claimed] of Object.entries(deck ?? {}) as [DeckClaimId, number][]) {
    if (claimed === undefined || !Number.isFinite(claimed)) continue;
    const { label, unit } = DECK_LABELS[id];
    const base = { id, label, unit, deck: claimed };
    const off = (actual: number, tol = 0.05) => Math.abs(claimed - actual) / Math.abs(actual) > tol;
    let data: number | null = null;
    let status: ClaimStatus = "Remove or source";
    let why = "Your numbers don't include this, so it can't be checked. Add the data or a source.";
    switch (id) {
      case "arr":
        data = v("arr");
        if (data !== null) {
          status = off(data) ? "Fix" : "Holds";
          const withOther = v("arrIncludingOnboarding");
          why = status === "Holds" ? "Matches MRR × 12." : withOther !== null && !off(withOther) ? "This is total revenue × 12, which counts one-time fees. ARR is recurring revenue × 12." : "Doesn't match MRR × 12.";
        }
        break;
      case "growth": {
        const g12 = v("growth12m"), g3 = v("growth3m");
        data = g3 ?? g12;
        if (g12 !== null) {
          status = claimed > g12 * 1.2 ? "Fix" : g3 !== null && g3 < claimed * 0.75 ? "Reword" : "Holds";
          why = status === "Holds" ? "Matches your growth." : status === "Reword" ? `Close to your 12-month rate (${pct(g12)}), but the last 3 months were ${pct(g3!)}. Give both and explain the change.` : `Higher than your growth in any period: ${pct(g12)} over the year${g3 !== null ? `, ${pct(g3)} recently` : ""}.`;
        }
        break;
      }
      case "grossMargin": {
        const ws = v("grossMarginWithSupport"), bk = v("grossMarginBooked");
        data = ws ?? bk;
        if (data !== null) {
          status = Math.abs(claimed - data) <= 0.02 ? "Holds" : "Fix";
          why = status === "Holds" ? "Matches your margin." : ws !== null && bk !== null && Math.abs(claimed - bk) <= 0.02 ? "This leaves support costs out. Most SaaS investors count support in cost of revenue." : "Doesn't match your P&L.";
        }
        break;
      }
      case "churn":
        data = v("logoChurnMonthly12m");
        if (data !== null) { status = claimed >= data * 0.95 ? "Holds" : "Fix"; why = status === "Holds" ? "Matches the churn you entered." : "Lower than the churn you entered. Use the measured number."; }
        break;
      case "nrr":
        data = v("nrr");
        if (data !== null) { status = claimed <= data * 1.05 ? "Holds" : "Fix"; why = status === "Holds" ? "Matches the retention you entered." : "Higher than the retention you entered."; }
        break;
      case "cac": {
        data = v("cacFullyLoaded");
        if (data !== null) {
          status = off(data) ? "Fix" : "Holds";
          const prog = v("cacProgramsOnly");
          why = status === "Holds" ? "Matches fully loaded CAC." : prog !== null && !off(prog) ? "This counts marketing programs only. Fully loaded CAC adds sales and marketing salaries and commissions." : "Doesn't match fully loaded CAC.";
        }
        break;
      }
      case "runwayMonths":
        data = v("runwayAfterRaise");
        why = "Add how much you plan to spend a month after the raise, so Vicky can check this.";
        if (data !== null) { status = Math.abs(claimed - data) / data <= 0.1 ? "Holds" : claimed > data ? "Fix" : "Holds"; why = status === "Holds" ? "Matches your cash, the raise and your planned spend." : `Your cash, the raise and planned spend give about ${data.toFixed(0)} months.`; }
        break;
    }
    out.push({ ...base, data, status, why });
  }
  return out;
}

function storyChecks(m: Record<string, Metric>, p: CompanyProfile): CompanyStoryCheck[] {
  const checks: CompanyStoryCheck[] = [];
  const g3 = m["growth3m"]?.value, g12 = m["growth12m"]?.value;
  if (p.planMonthlyGrowth !== undefined && g12 !== undefined) {
    const ref = g3 ?? g12;
    if (p.planMonthlyGrowth > ref * 1.2) checks.push({
      id: "growth", title: "The plan grows faster than you ever have",
      plan: `${pct(p.planMonthlyGrowth)} a month`, history: `${pct(g12)} over the last year${g3 !== undefined ? `, ${pct(g3)} over the last 3 months` : ""}`,
      severity: p.planMonthlyGrowth > ref * 1.5 ? "high" : "medium", refs: [Y, P],
    });
  }
  const rt = m["runwayToday"]?.value;
  if (rt !== undefined && rt < 9) checks.push({
    id: "runway", title: "Not much room if the round takes longer",
    plan: "Close the round before the cash runs out", history: `${rt.toFixed(1)} months of cash at today's burn`,
    severity: rt < 6 ? "high" : "medium", refs: [Y, P],
  });
  const big = p.largestCustomerShare;
  if (big !== undefined && big >= 0.1) checks.push({
    id: "concentration", title: "One customer carries a lot of the revenue",
    plan: "Growth story assumes the base keeps renewing", history: `Your largest customer is ${pct(big)} of MRR`,
    severity: big >= 0.2 ? "high" : "medium", refs: [Y],
  });
  const ws = m["grossMarginWithSupport"]?.value, bk = m["grossMarginBooked"]?.value;
  if (ws !== undefined && bk !== undefined && bk - ws > 0.1) checks.push({
    id: "margin", title: "Margin looks better than it is",
    plan: `${pct(bk)} gross margin as booked`, history: `${pct(ws)} once support is counted`,
    severity: "medium", refs: [P],
  });
  return checks;
}

function charts(rows: MonthRow[], m: Record<string, Metric>, claims: CompanyClaim[], p: CompanyProfile): CompanyCharts {
  const last = rows.at(-1)!;
  const g3 = m["growth3m"]?.value ?? m["growth12m"]?.value ?? 0;
  const mrr: CompanyCharts["mrr"] = rows.map((r) => ({ month: r.month, actual: r.recurringRevenue }));
  mrr[mrr.length - 1] = { ...mrr.at(-1)!, atRecentPace: last.recurringRevenue, ...(p.planMonthlyGrowth !== undefined ? { plan: last.recurringRevenue } : {}) };
  for (let i = 1; i <= 12; i++) {
    mrr.push({ month: addMonths(last.month, i), atRecentPace: Math.round(last.recurringRevenue * (1 + g3) ** i), ...(p.planMonthlyGrowth !== undefined ? { plan: Math.round(last.recurringRevenue * (1 + p.planMonthlyGrowth) ** i) } : {}) });
  }
  const growth = rows.slice(-13).slice(1).map((r, i) => ({ month: r.month, growth: r.recurringRevenue / rows.slice(-13)[i]!.recurringRevenue - 1 }));
  const runway: CompanyCharts["runway"] = [];
  const claimRunway = p.deck?.runwayMonths;
  if (claimRunway !== undefined) runway.push({ label: "Deck claim", months: claimRunway });
  if (m["runwayAfterRaise"]) runway.push({ label: "After the raise, planned spend", months: Math.round(m["runwayAfterRaise"].value * 10) / 10 });
  if (m["runwayToday"]) runway.push({ label: "Today, no raise", months: Math.round(m["runwayToday"].value * 10) / 10 });
  return {
    mrr,
    growth,
    burn: rows.map((r) => ({ month: r.month, operatingLoss: -r.operatingIncome, otherIncome: r.otherIncome })),
    margin: rows.filter((r) => r.totalRevenue > 0).map((r) => ({ month: r.month, booked: r.grossProfit / r.totalRevenue, ...(r.support ? { withSupport: (r.grossProfit - r.support) / r.totalRevenue } : {}) })),
    deckVsData: claims.filter((c) => c.data !== null).map((c) => ({ id: c.id, label: c.label, deck: c.deck, data: c.data!, unit: c.unit, status: c.status })),
    runway,
  };
}

export function analyzeCompany(parsed: ParseResult, profile: CompanyProfile): CompanyAnalysis {
  const rows = parsed.rows;
  if (!rows.length) throw new Error(parsed.warnings.at(-1) ?? "No months found in the file.");
  const metrics = companyMetrics(rows, profile);
  const claims = compareClaims(profile.deck, metrics);
  const story = storyChecks(metrics, profile);

  const flags: AssumptionFlag[] = story.map((s) => ({ id: s.id, severity: s.severity, message: `${s.title}: ${s.plan} vs ${s.history}`, source: s.refs.join(", ") }));
  const ties = (label: string, f: (r: MonthRow) => number): ConsistencyCheck => {
    const bad = rows.filter((r) => Math.abs(f(r)) > 1).map((r) => r.month);
    return { id: label, passed: !bad.length, detail: bad.length ? `${label}: off in ${bad.join(", ")}` : `${label}: ties in all ${rows.length} months` };
  };
  const consistencyChecks: ConsistencyCheck[] = [
    ties("Revenue lines add up", (r) => r.recurringRevenue + r.otherRevenue - r.totalRevenue),
    ties("Gross profit = revenue − cost of revenue", (r) => r.totalRevenue - r.cogs - r.grossProfit),
    ties("Net income = operating income + other income", (r) => r.operatingIncome + r.otherIncome - r.netIncome),
    ...claims.map((c) => ({ id: `claim-${c.id}`, passed: c.status === "Holds", detail: `Deck "${c.label}": ${c.status}` })),
  ];
  const readiness = scoreReadiness({
    data: {
      present: {
        revenueHistory: true,
        costBreakdown: rows.some((r) => r.cogs > 0) && rows.some((r) => r.totalOpex > 0),
        cashBalance: profile.cash !== undefined,
        forecastAssumptions: profile.planMonthlyGrowth !== undefined,
        customerMetrics: profile.customers !== undefined && profile.logoChurnMonthly !== undefined,
        acquisitionCosts: profile.newCustomersL12M !== undefined,
        useOfFunds: profile.raiseAmount !== undefined,
      },
      historicalMonths: rows.length,
      flags,
      consistencyChecks,
      runwayMonthsAfterRaise: metrics["runwayAfterRaise"]?.value ?? null,
    },
  });

  const dataGaps = [
    ...(profile.cash === undefined ? ["Cash in the bank: needed for runway."] : []),
    ...(profile.customers === undefined || profile.newCustomersL12M === undefined ? ["Customer counts: needed for CAC and payback."] : []),
    ...(profile.logoChurnMonthly === undefined ? ["Monthly churn: investors ask in almost every meeting."] : []),
    ...(profile.nrr === undefined ? ["Net revenue retention: shows whether existing customers grow."] : []),
    ...(profile.planMonthlyGrowth === undefined ? ["The growth your forecast assumes: needed to check the plan against history."] : []),
    ...(profile.raiseAmount !== undefined && profile.planMonthlySpendAfterRaise === undefined ? ["Planned monthly spend after the raise: needed to say how long the raise lasts."] : []),
    ...parsed.warnings,
  ];

  return {
    company: { name: profile.name, currency: profile.currency ?? "USD", from: rows[0]!.month, to: rows.at(-1)!.month, months: rows.length },
    parse: { mapping: parsed.mapping, warnings: parsed.warnings },
    metrics, claims, storyChecks: story, charts: charts(rows, metrics, claims, profile), flags, readiness, dataGaps,
  };
}

// The compact payload for the language model, with short source tags.
export function companyToKnowledge(c: CompanyAnalysis): Analysis {
  return {
    readiness: c.readiness,
    flags: c.flags,
    numbers: {
      company: c.company,
      metrics: Object.values(c.metrics).map((m) => ({ id: m.id, label: m.label, value: formatMetric(m), how: m.calculation, cite: m.source.split("; ") })),
      deckClaims: c.claims.map(({ label, status, deck, data, why, unit }) => ({ claim: `${label}: ${formatMetric({ value: deck, unit })}`, dataShows: data === null ? "not in the data" : formatMetric({ value: data, unit }), status, why, cite: ["Deck", P] })),
      storyChecks: c.storyChecks.map(({ title, plan, history, refs }) => ({ title, plan, history, cite: refs })),
      notInTheData: c.dataGaps,
    },
  };
}
