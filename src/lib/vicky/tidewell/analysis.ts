// One call that gives Vicky everything she knows about Tidewell: computed
// metrics, deck claims checked, forecast assumptions audited, the readiness
// score, and what the data pack doesn't contain. The UI renders this and the
// language model receives it as COMPANY NUMBERS.

import type { Analysis, KnownMetric, Topic } from "../knowledge.ts";
import { scoreReadiness, type AnswerGrade, type AssumptionFlag, type ConsistencyCheck, type FactCheck, type ReadinessResult } from "../readiness.ts";
import { auditAssumptions, auditFlags, type AuditItem } from "./audit.ts";
import { checkDeckClaims, type ClaimCheck } from "./claims.ts";
import { COMPANY, DATA_GAPS, FORECAST_BY_QUARTER, FORECAST_SOURCE, GAPS_SOURCE, RUNWAY_AFTER_RAISE, SNAPSHOT, USE_OF_FUNDS } from "./facts.ts";
import { checkIncomeStatement, computeMetrics, formatMetric, type ConsistencyResult, type Metric } from "./metrics.ts";

export interface TidewellAnalysis {
  company: typeof COMPANY;
  metrics: Record<string, Metric>;
  incomeStatementChecks: ConsistencyResult[];
  claims: ClaimCheck[];
  audit: AuditItem[];
  flags: AssumptionFlag[];
  readiness: ReadinessResult;
  forecast: { byQuarter: typeof FORECAST_BY_QUARTER; source: string; runwayAfterRaise: typeof RUNWAY_AFTER_RAISE; useOfFunds: typeof USE_OF_FUNDS };
  dataGaps: { items: string[]; source: string };
}

export interface PracticeInput {
  factChecks: FactCheck[];
  answers: AnswerGrade[];
}

export function analyzeTidewell(practice?: PracticeInput): TidewellAnalysis {
  const metrics = computeMetrics();
  const incomeStatementChecks = checkIncomeStatement();
  const claims = checkDeckClaims(metrics);
  const audit = auditAssumptions();
  const flags = auditFlags(audit);

  const consistencyChecks: ConsistencyCheck[] = [
    ...incomeStatementChecks,
    ...claims.map((c) => ({ id: `claim-${c.id}`, passed: c.status === "Holds", detail: `Deck claim "${c.claim}": ${c.status}. Data shows ${c.dataShows}` })),
  ];

  const readiness = scoreReadiness({
    data: {
      present: { revenueHistory: true, costBreakdown: true, cashBalance: true, forecastAssumptions: true, customerMetrics: true, acquisitionCosts: true, useOfFunds: true },
      historicalMonths: 24,
      flags,
      consistencyChecks,
      // The cautious case: growth at the rates actually achieved.
      runwayMonthsAfterRaise: RUNWAY_AFTER_RAISE.historicalDriversMonths.value,
    },
    ...(practice ? { practice } : {}),
  });

  return {
    company: COMPANY,
    metrics,
    incomeStatementChecks,
    claims,
    audit,
    flags,
    readiness,
    forecast: { byQuarter: FORECAST_BY_QUARTER, source: FORECAST_SOURCE, runwayAfterRaise: RUNWAY_AFTER_RAISE, useOfFunds: USE_OF_FUNDS },
    dataGaps: { items: DATA_GAPS, source: GAPS_SOURCE },
  };
}

// The compact form handed to the language model: every figure pre-formatted,
// labelled with its basis and source, so the model never has to calculate.
export function toKnowledgeAnalysis(t: TidewellAnalysis): Analysis {
  return {
    readiness: t.readiness,
    flags: t.flags,
    numbers: {
      company: { name: t.company.name, product: t.company.product, raise: t.company.raise, currency: t.company.currency },
      metrics: Object.values(t.metrics).map((m) => ({ id: m.id, label: m.label, value: formatMetric(m), basis: m.basis, calculation: m.calculation, source: m.source })),
      snapshot: { cash: SNAPSHOT.cash.value, customers: SNAPSHOT.customers.value, seats: SNAPSHOT.seats.value, headcount: SNAPSHOT.headcount.value, asOf: "2026-09-30" },
      deckClaims: t.claims.map(({ claim, status, dataShows, why }) => ({ claim, status, dataShows, why })),
      forecastAssumptions: t.audit.map(({ assumption, foundersValue, history, verdict, fix }) => ({ assumption, foundersValue, history, verdict, fix })),
      forecast: { basis: "forecast", source: t.forecast.source, byQuarter: t.forecast.byQuarter, runwayAfterRaise: t.forecast.runwayAfterRaise, useOfFunds: t.forecast.useOfFunds },
      notInTheData: t.dataGaps.items,
    },
  };
}

// Metrics a founder is likely to say out loud, for fact-checking practice answers.
export function knownMetrics(t: TidewellAnalysis): KnownMetric[] {
  const v = (id: string) => t.metrics[id]?.value ?? NaN;
  return [
    { name: "ARR", value: v("arr"), unit: "usd", aliases: ["arr", "annual recurring"] },
    { name: "MRR", value: v("mrr"), unit: "usd", aliases: ["mrr", "monthly recurring"] },
    { name: "monthly growth", value: v("growth12m"), unit: "pct", aliases: ["growing", "growth", "month over month"] },
    { name: "gross margin", value: v("grossMarginWithSupport"), unit: "pct", aliases: ["gross margin", "margin"] },
    { name: "monthly churn", value: v("logoChurnMonthly12m"), unit: "pct", aliases: ["churn"] },
    { name: "net revenue retention", value: v("nrr"), unit: "pct", aliases: ["nrr", "net revenue retention", "net retention"] },
    { name: "CAC", value: v("cacFullyLoaded"), unit: "usd", aliases: ["cac", "acquisition cost", "cost to acquire"] },
    { name: "CAC payback", value: v("cacPaybackMonths"), unit: "months", aliases: ["payback"] },
    { name: "monthly burn", value: v("monthlyBurn"), unit: "usd", aliases: ["burn"] },
    { name: "runway today", value: v("runwayToday"), unit: "months", aliases: ["runway"] },
    { name: "cash", value: SNAPSHOT.cash.value, unit: "usd", aliases: ["cash", "in the bank"] },
  ];
}

// Topic for each deck claim, used to steer practice questions.
export const CLAIM_TOPIC: Record<string, Topic> = {
  arr: "growth", growth: "growth", "gross-margin": "margin", churn: "churn", nrr: "retention", cac: "cac", tam: "market", ncg: "concentration", runway: "runway",
};
