// Story checks: places where the founders' plan needs something their own
// history doesn't show they can do. Each check is plain arithmetic on the
// plan and the actuals, so Vicky can show it on a chart.

import { CUSTOMERS_BY_QUARTER, FORECAST_BY_QUARTER, RETENTION, RUNWAY_AFTER_RAISE, SNAPSHOT } from "./facts.ts";
import { INCOME_STATEMENT } from "./incomeStatement.ts";
import type { Metric } from "./metrics.ts";

export interface StoryCheck {
  id: string;
  title: string; // the gap in a few words
  plan: string; // what the plan needs
  history: string; // what Tidewell has actually done
  gap: number; // plan ÷ history, 1 = matches
  severity: "high" | "medium";
  refs: string[];
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const k = (n: number) => `$${Math.round(n / 1000)}K`;
const cmgr = (from: number, to: number, months: number) => (to / from) ** (1 / months) - 1;

export function storyChecks(metrics: Record<string, Metric>): StoryCheck[] {
  const checks: StoryCheck[] = [];
  const g12 = metrics["growth12m"]?.value ?? NaN;
  const g3 = metrics["growth3m"]?.value ?? NaN;

  // 1. Net new customers per quarter: plan vs the best quarter so far.
  const bestNet = Math.max(...CUSTOMERS_BY_QUARTER.map((q) => q.newCustomers - q.churned));
  let prev = SNAPSHOT.customers.value;
  const planNet = FORECAST_BY_QUARTER.map((q) => { const n = q.customers - prev; prev = q.customers; return { quarter: q.quarter, net: n }; });
  const peak = planNet.reduce((a, b) => (b.net > a.net ? b : a));
  checks.push({
    id: "customers",
    title: "The plan adds customers faster than Tidewell ever has",
    plan: `${peak.net} net new customers in ${peak.quarter}`,
    history: `Best quarter so far was ${bestNet} net new`,
    gap: peak.net / bestNet,
    severity: peak.net / bestNet >= 2 ? "high" : "medium",
    refs: ["Plan", "Pack B"],
  });

  // 2. MRR growth implied by the plan, quarter by quarter.
  let mrr = INCOME_STATEMENT.at(-1)!.subscriptionRevenue;
  const implied = FORECAST_BY_QUARTER.map((q) => { const g = cmgr(mrr, q.endingMrr, 3); mrr = q.endingMrr; return { quarter: q.quarter, g }; });
  const fastest = implied.reduce((a, b) => (b.g > a.g ? b : a));
  checks.push({
    id: "growth",
    title: "One quarter of the plan needs growth Tidewell has never had",
    plan: `About ${pct(fastest.g)} a month in ${fastest.quarter}`,
    history: `${pct(g12)} a month over the last year, ${pct(g3)} over the last 3 months`,
    gap: fastest.g / g3,
    severity: fastest.g > g12 ? "high" : "medium",
    refs: ["Plan", "P&L"],
  });

  // 3. Hires and revenue land in the same quarter, but reps take months to ramp.
  const q1 = FORECAST_BY_QUARTER[1]!;
  const q0 = FORECAST_BY_QUARTER[0]!;
  const ramp = RETENTION.aeRampMonths.value;
  checks.push({
    id: "hires",
    title: "Growth arrives before the new hires can produce it",
    plan: `Headcount goes from ${q0.headcount} to ${q1.headcount} in ${q1.quarter}, and MRR jumps from ${k(q0.endingMrr)} to ${k(q1.endingMrr)} in the same quarter`,
    history: `Tidewell's reps took about ${ramp} months to reach full speed`,
    gap: ramp / 1,
    severity: "high",
    refs: ["Plan", "Pack D8"],
  });

  // 4. Spending rises before the money lands.
  checks.push({
    id: "cash-before-raise",
    title: "The plan spends the raise before it arrives",
    plan: `Cash falls to ${k(q0.endingCash)} by December, before a January close`,
    history: `If the round slips to April, the plan runs out of cash by ${RUNWAY_AFTER_RAISE.slipToAprilRunsOutBy === "2027-03" ? "March 2027" : RUNWAY_AFTER_RAISE.slipToAprilRunsOutBy}`,
    gap: SNAPSHOT.cash.value / q0.endingCash,
    severity: "medium",
    refs: ["Plan", "Pack D11"],
  });

  return checks.sort((a, b) => (a.severity === b.severity ? b.gap - a.gap : a.severity === "high" ? -1 : 1));
}
