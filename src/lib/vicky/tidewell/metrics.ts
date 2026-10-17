// Tidewell's investor metrics, computed in code from the income statement CSV
// and the sourced facts in facts.ts. Every metric carries its basis, its
// source and the calculation, so Vicky can show its working.

import { INCOME_STATEMENT, INCOME_STATEMENT_SOURCE, type IncomeStatementMonth } from "./incomeStatement.ts";
import { CASH_HISTORY, CUSTOMERS_BY_QUARTER, CUSTOMERS_SOURCE, NORTHERN_COMFORT, RETENTION, SNAPSHOT, type Basis } from "./facts.ts";

export type MetricUnit = "usd" | "pct" | "months" | "ratio" | "count";

export interface Metric {
  id: string;
  label: string;
  value: number;
  unit: MetricUnit;
  basis: Basis;
  source: string;
  calculation: string;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (n: number, dp = 1) => `${(n * 100).toFixed(dp)}%`;
const sum = (rows: IncomeStatementMonth[], k: keyof Omit<IncomeStatementMonth, "month">) => rows.reduce((s, r) => s + r[k], 0);

export function formatMetric(m: Pick<Metric, "value" | "unit">): string {
  switch (m.unit) {
    case "usd": return usd(m.value);
    case "pct": return pct(m.value);
    case "months": return `${m.value.toFixed(1)} months`;
    case "ratio": return `${m.value.toFixed(2)}x`;
    case "count": return Math.round(m.value).toLocaleString("en-US");
  }
}

export function computeMetrics(rows: IncomeStatementMonth[] = INCOME_STATEMENT): Record<string, Metric> {
  if (rows.length < 13) throw new Error("Need at least 13 months of actuals to compute 12-month metrics");
  const last = rows.at(-1)!;
  const yearAgo = rows.at(-13)!;
  const quarterAgo = rows.at(-4)!;
  const l12 = rows.slice(-12);
  const l6 = rows.slice(-6);
  const src = INCOME_STATEMENT_SOURCE;
  const m: Record<string, Metric> = {};
  const add = (x: Metric) => (m[x.id] = x);

  const mrr = last.subscriptionRevenue;
  add({ id: "mrr", label: `MRR (${last.month})`, value: mrr, unit: "usd", basis: "historical", source: src, calculation: `Subscription revenue in ${last.month}` });
  add({ id: "arr", label: "ARR", value: mrr * 12, unit: "usd", basis: "historical", source: src, calculation: `${usd(mrr)} MRR × 12; one-time onboarding fees excluded` });
  add({ id: "arrIncludingOnboarding", label: "Total revenue × 12 (how the deck got its ARR)", value: last.totalRevenue * 12, unit: "usd", basis: "historical", source: src, calculation: `${usd(last.totalRevenue)} total revenue in ${last.month} × 12, which includes ${usd(last.onboardingServicesRevenue)} of one-time onboarding fees` });

  const rev12 = sum(l12, "totalRevenue");
  const onb12 = sum(l12, "onboardingServicesRevenue");
  add({ id: "revenueL12M", label: "Total revenue, last 12 months", value: rev12, unit: "usd", basis: "historical", source: src, calculation: `Sum of total revenue ${l12[0]!.month} to ${last.month}` });
  add({ id: "onboardingL12M", label: "Onboarding fees, last 12 months", value: onb12, unit: "usd", basis: "historical", source: src, calculation: `Sum of onboarding services revenue ${l12[0]!.month} to ${last.month}` });

  const cmgr = (from: number, to: number, months: number) => (to / from) ** (1 / months) - 1;
  add({ id: "growth12m", label: "MRR growth, compounded monthly, last 12 months", value: cmgr(yearAgo.subscriptionRevenue, mrr, 12), unit: "pct", basis: "historical", source: src, calculation: `(${usd(mrr)} ÷ ${usd(yearAgo.subscriptionRevenue)})^(1/12) − 1, ${yearAgo.month} to ${last.month}` });
  add({ id: "growth3m", label: "MRR growth, compounded monthly, last 3 months", value: cmgr(quarterAgo.subscriptionRevenue, mrr, 3), unit: "pct", basis: "historical", source: src, calculation: `(${usd(mrr)} ÷ ${usd(quarterAgo.subscriptionRevenue)})^(1/3) − 1, ${quarterAgo.month} to ${last.month}` });
  const ncgMrr = NORTHERN_COMFORT.seats * NORTHERN_COMFORT.pricePerSeat;
  add({ id: "growth12mExNcg", label: "MRR growth excluding Northern Comfort Group, last 12 months", value: cmgr(yearAgo.subscriptionRevenue, mrr - ncgMrr, 12), unit: "pct", basis: "historical", source: `${src}; Northern Comfort terms from ${NORTHERN_COMFORT.source}`, calculation: `((${usd(mrr)} − ${usd(ncgMrr)} Northern Comfort MRR) ÷ ${usd(yearAgo.subscriptionRevenue)})^(1/12) − 1` });

  const gp12 = sum(l12, "grossProfit");
  const cs12 = sum(l12, "customerSuccessSalaries");
  add({ id: "grossMarginBooked", label: "Gross margin as booked, last 12 months", value: gp12 / rev12, unit: "pct", basis: "historical", source: src, calculation: `${usd(gp12)} gross profit ÷ ${usd(rev12)} revenue; cost of revenue is hosting, SMS and card fees only` });
  add({ id: "grossMarginWithSupport", label: "Gross margin including customer success, last 12 months", value: (gp12 - cs12) / rev12, unit: "pct", basis: "historical", source: src, calculation: `(${usd(gp12)} gross profit − ${usd(cs12)} customer success salaries) ÷ ${usd(rev12)} revenue` });

  const sm12 = sum(l12, "salesSalaries") + sum(l12, "salesCommissions") + sum(l12, "marketingSalaries") + sum(l12, "marketingPrograms");
  const programs12 = sum(l12, "marketingPrograms");
  const newCustomers12 = CUSTOMERS_BY_QUARTER.slice(-4).reduce((s, q) => s + q.newCustomers, 0);
  add({ id: "newCustomersL12M", label: "New customers, last 12 months", value: newCustomers12, unit: "count", basis: "historical", source: CUSTOMERS_SOURCE, calculation: `Sum of new customers, ${CUSTOMERS_BY_QUARTER.slice(-4).map((q) => `${q.quarter} ${q.newCustomers}`).join(", ")}` });
  const cac = sm12 / newCustomers12;
  add({ id: "cacFullyLoaded", label: "Customer acquisition cost, fully loaded", value: cac, unit: "usd", basis: "historical", source: `${src}; ${CUSTOMERS_SOURCE}`, calculation: `${usd(sm12)} sales and marketing salaries, commissions and programs ÷ ${newCustomers12} new customers, last 12 months` });
  add({ id: "cacProgramsOnly", label: "Customer acquisition cost, marketing programs only", value: programs12 / newCustomers12, unit: "usd", basis: "historical", source: `${src}; ${CUSTOMERS_SOURCE}`, calculation: `${usd(programs12)} marketing programs ÷ ${newCustomers12} new customers; leaves out salaries and commissions` });
  const newMrr = RETENTION.newMrrPerCustomer.value;
  const gmSupport = (gp12 - cs12) / rev12;
  add({ id: "cacPaybackMonths", label: "CAC payback", value: cac / (newMrr * gmSupport), unit: "months", basis: "historical", source: `${RETENTION.newMrrPerCustomer.source}; ${src}`, calculation: `${usd(cac)} CAC ÷ (${usd(newMrr)} MRR per new customer × ${pct(gmSupport)} gross margin including support)` });

  const burn6 = -l6.reduce((s, r) => s + r.operatingIncome, 0) / l6.length;
  add({ id: "monthlyBurn", label: "Monthly burn, last 6 months", value: burn6, unit: "usd", basis: "historical", source: src, calculation: `Average operating loss ${l6[0]!.month} to ${last.month}; the one-time SR&ED refund is excluded` });
  add({ id: "runwayToday", label: "Runway at today's burn, before the raise", value: SNAPSHOT.cash.value / burn6, unit: "months", basis: "historical", source: `${SNAPSHOT.cash.source}; ${src}`, calculation: `${usd(SNAPSHOT.cash.value)} cash ÷ ${usd(burn6)} monthly burn` });

  const netBurn12 = CASH_HISTORY.cashSep2025.value + CASH_HISTORY.safeFeb2026.value - SNAPSHOT.cash.value;
  const netNewArr = (mrr - yearAgo.subscriptionRevenue) * 12;
  add({ id: "netNewArr", label: "Net new ARR, last 12 months", value: netNewArr, unit: "usd", basis: "historical", source: src, calculation: `(${usd(mrr)} − ${usd(yearAgo.subscriptionRevenue)}) MRR × 12` });
  add({ id: "netBurnL12M", label: "Net cash burn, last 12 months", value: netBurn12, unit: "usd", basis: "historical", source: `${CASH_HISTORY.cashSep2025.source}; ${CASH_HISTORY.safeFeb2026.source}; ${SNAPSHOT.cash.source}`, calculation: `${usd(CASH_HISTORY.cashSep2025.value)} cash a year ago + ${usd(CASH_HISTORY.safeFeb2026.value)} SAFE − ${usd(SNAPSHOT.cash.value)} cash today` });
  add({ id: "burnMultiple", label: "Burn multiple", value: netBurn12 / netNewArr, unit: "ratio", basis: "historical", source: "Defined by David Sacks, The Burn Multiple (https://sacks.substack.com/p/the-burn-multiple-51a7e43cb200)", calculation: `${usd(netBurn12)} net burn ÷ ${usd(netNewArr)} net new ARR` });
  const srred = CASH_HISTORY.srAndEdJul2026.value;
  add({ id: "burnMultipleExSrred", label: "Burn multiple without the SR&ED refund", value: (netBurn12 + srred) / netNewArr, unit: "ratio", basis: "historical", source: CASH_HISTORY.srAndEdJul2026.source, calculation: `(${usd(netBurn12)} + ${usd(srred)} SR&ED refund) ÷ ${usd(netNewArr)} net new ARR` });

  add({ id: "netLossL12M", label: "Net loss, last 12 months", value: -sum(l12, "netIncome"), unit: "usd", basis: "historical", source: src, calculation: `Sum of net income ${l12[0]!.month} to ${last.month}, after the ${usd(srred)} SR&ED credit` });
  add({ id: "ncgShareOfMrr", label: "Northern Comfort Group share of MRR", value: ncgMrr / mrr, unit: "pct", basis: "historical", source: `${NORTHERN_COMFORT.source}; ${src}`, calculation: `${NORTHERN_COMFORT.seats} seats × $${NORTHERN_COMFORT.pricePerSeat} = ${usd(ncgMrr)} ÷ ${usd(mrr)} MRR` });

  for (const [id, label] of [["logoChurnMonthly12m", "Monthly logo churn, last 12 months"], ["logoChurnMonthly6m", "Monthly logo churn, last 6 months"], ["nrr", "Net revenue retention"], ["grr", "Gross revenue retention"]] as const) {
    const f = RETENTION[id];
    add({ id, label, value: f.value, unit: "pct", basis: f.basis, source: f.source, calculation: "Reported in the data pack from the customer file, which we have not been given" });
  }
  return m;
}

// Checks that each month's subtotals add up, so Vicky never builds on a broken table.
export interface ConsistencyResult {
  id: string;
  passed: boolean;
  detail: string;
}

export function checkIncomeStatement(rows: IncomeStatementMonth[] = INCOME_STATEMENT): ConsistencyResult[] {
  const tol = 1;
  const bad = (f: (r: IncomeStatementMonth) => number) => rows.filter((r) => Math.abs(f(r)) > tol).map((r) => r.month);
  const checks: [string, string, string[]][] = [
    ["revenue-ties", "Subscription plus onboarding equals total revenue", bad((r) => r.subscriptionRevenue + r.onboardingServicesRevenue - r.totalRevenue)],
    ["cogs-ties", "Cost of revenue lines add up to total cost of revenue", bad((r) => r.cogsHosting + r.cogsSmsTelephony + r.cogsPaymentProcessing - r.totalCogs)],
    ["gross-profit-ties", "Revenue minus cost of revenue equals gross profit", bad((r) => r.totalRevenue - r.totalCogs - r.grossProfit)],
    ["opex-ties", "Operating expense lines add up to total operating expenses", bad((r) => r.rndSalaries + r.salesSalaries + r.salesCommissions + r.marketingSalaries + r.marketingPrograms + r.customerSuccessSalaries + r.gaSalaries + r.gaRent + r.gaSoftware + r.gaProfessionalFees + r.gaBookkeeping + r.gaOther + r.depreciation - r.totalOperatingExpenses)],
    ["operating-income-ties", "Gross profit minus operating expenses equals operating income", bad((r) => r.grossProfit - r.totalOperatingExpenses - r.operatingIncome)],
    ["net-income-ties", "Operating income plus SR&ED credit equals net income", bad((r) => r.operatingIncome + r.otherIncomeSrredCredit - r.netIncome)],
  ];
  return checks.map(([id, label, months]) => ({
    id,
    passed: months.length === 0,
    detail: months.length ? `${label}: fails in ${months.join(", ")}` : `${label}: ties in all ${rows.length} months`,
  }));
}
