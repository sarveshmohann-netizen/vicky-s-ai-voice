// Audits each of the founders' forecast assumptions against Tidewell's own
// history. Severity is set by code from the size of the gap, so Vicky's
// "riskiest assumptions" list is reproducible.

import type { AssumptionFlag, Severity } from "../readiness.ts";
import {
  ASSUMPTIONS_SOURCE, CASH_HISTORY, COMPANY, CUSTOMERS_BY_QUARTER, CUSTOMERS_SOURCE, FOUNDER_ASSUMPTIONS,
  NORTHERN_COMFORT, PRICING, RETENTION, SNAPSHOT, type FounderAssumption,
} from "./facts.ts";
import { INCOME_STATEMENT, INCOME_STATEMENT_SOURCE } from "./incomeStatement.ts";

export type Verdict = Severity | "supported";

export interface AuditItem {
  id: string;
  assumption: string;
  foundersValue: string;
  history: string;
  verdict: Verdict;
  message: string;
  fix: string;
  source: string;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// Over this multiple of history, an assumption is high risk; over the lower one, medium.
export const AUDIT_THRESHOLDS = { high: 1.5, medium: 1.2 };

function byGap(ratio: number): Verdict {
  if (ratio >= AUDIT_THRESHOLDS.high) return "high";
  if (ratio >= AUDIT_THRESHOLDS.medium) return "medium";
  return "supported";
}

export function auditAssumptions(assumptions: FounderAssumption[] = FOUNDER_ASSUMPTIONS): AuditItem[] {
  const last = INCOME_STATEMENT.at(-1)!;
  const c12 = RETENTION.logoChurnMonthly12m.value;
  const c6 = RETENTION.logoChurnMonthly6m.value;
  const seatsPerCustomer = SNAPSHOT.seats.value / SNAPSHOT.customers.value;
  const marketingOct = 32_000;

  const items: Record<string, Omit<AuditItem, "id" | "assumption" | "foundersValue">> = {
    churn: {
      history: `${pct(c12)} a month over 12 months, ${pct(c6)} over the last 6; ${pct(RETENTION.earlyChurnMonthly.value)} in a customer's first six months`,
      verdict: byGap(c6 / 0.01),
      message: `Forecast churn of 1.0% a month is below every period in the data (${pct(c12)} over 12 months, ${pct(c6)} over 6).`,
      fix: "Base case at 2% churn; keep 1% as a target with the onboarding work that gets you there.",
      source: `${ASSUMPTIONS_SOURCE} vs ${RETENTION.logoChurnMonthly12m.source}`,
    },
    "ae-ramp": {
      history: `About ${RETENTION.aeRampMonths.value} months for both current account executives`,
      verdict: byGap(RETENTION.aeRampMonths.value / 1),
      message: `New account executives are assumed to ramp in 1 month; the two current reps took about ${RETENTION.aeRampMonths.value}. The hiring plan's growth depends on this.`,
      fix: "Use a three-month ramp and show the revised plan.",
      source: `${ASSUMPTIONS_SOURCE} vs ${RETENTION.aeRampMonths.source}`,
    },
    "price-existing": {
      history: `${PRICING.legacyCustomers} customers on the legacy $${PRICING.legacyPricePerSeat} price; ${PRICING.annualPlanCustomers} on annual plans that can't be repriced until renewal`,
      verdict: "high",
      message: `A 20% price rise for every customer in January 2027 with no extra churn: ${PRICING.annualPlanCustomers} annual-plan customers can't be repriced before renewal, and ${PRICING.legacyCustomers} legacy customers face a bigger jump.`,
      fix: "Phase the increase in at renewal and model some extra churn.",
      source: `${ASSUMPTIONS_SOURCE} vs ${PRICING.source}`,
    },
    "price-new": {
      history: `List price rose from $${PRICING.legacyPricePerSeat} to $${PRICING.listPricePerSeat} for new customers in July 2025`,
      verdict: "medium",
      message: `A second list price rise, from $${PRICING.listPricePerSeat} to $54 for new customers in January 2027, is untested; the pack has no win/loss data to show how price affects closing.`,
      fix: "Show the plan at today's price as well.",
      source: `${ASSUMPTIONS_SOURCE} vs ${PRICING.source}`,
    },
    "ncg-renewal": {
      history: `${NORTHERN_COMFORT.seats} seats at $${NORTHERN_COMFORT.pricePerSeat}, about ${pct(RETENTION.ncgShareOfMrr.value)} of MRR; nothing signed for 600`,
      verdict: "high",
      message: `Northern Comfort Group is forecast at 600 seats from ${NORTHERN_COMFORT.renews}, but only ${NORTHERN_COMFORT.seats} are under contract. One customer is about ${pct(RETENTION.ncgShareOfMrr.value)} of MRR.`,
      fix: "Keep them at 260 seats in the base case and show the expansion as upside.",
      source: `${ASSUMPTIONS_SOURCE} vs ${NORTHERN_COMFORT.source}`,
    },
    expansion: {
      history: `About ${pct(RETENTION.expansionMonthly.value)} of starting MRR a month; NRR about ${pct(RETENTION.nrr.value)}`,
      verdict: byGap(0.01 / RETENTION.expansionMonthly.value),
      message: `Seat expansion of 1.0% a month is about ${(0.01 / RETENTION.expansionMonthly.value).toFixed(1)}x the ${pct(RETENTION.expansionMonthly.value)} achieved, and retention is below 100%.`,
      fix: "Use the historical expansion rate.",
      source: `${ASSUMPTIONS_SOURCE} vs ${RETENTION.expansionMonthly.source}`,
    },
    marketing: {
      history: `Marketing programs were ${usd(last.marketingPrograms)} in ${last.month}`,
      verdict: byGap(marketingOct / last.marketingPrograms) === "supported" ? "low" : "medium",
      message: `Marketing programs jump to ${usd(marketingOct)} in October 2026 (from ${usd(last.marketingPrograms)}) and grow 8% a month, before the round is expected to close in ${COMPANY.raise.targetClose}. Cash is ${usd(SNAPSHOT.cash.value)}.`,
      fix: "Hold spending at today's level until a term sheet is signed.",
      source: `${ASSUMPTIONS_SOURCE} vs ${INCOME_STATEMENT_SOURCE}`,
    },
    srred: {
      history: `${usd(CASH_HISTORY.srAndEdJul2026.value)} received July 2026; ${usd(CASH_HISTORY.srAndEdTotal.value)} to date`,
      verdict: byGap(240_000 / CASH_HISTORY.srAndEdJul2026.value) === "supported" ? "low" : "medium",
      message: `The forecast counts a ${usd(240_000)} SR&ED refund in July 2027, above the last refund of ${usd(CASH_HISTORY.srAndEdJul2026.value)}. The amount and timing are not certain.`,
      fix: "Use last year's refund and show runway without it.",
      source: `${ASSUMPTIONS_SOURCE} vs ${CASH_HISTORY.srAndEdJul2026.source}`,
    },
    "cash-method": {
      history: `Deferred revenue of ${usd(SNAPSHOT.deferredRevenue.value)} at Sep 30 2026, including ${usd(NORTHERN_COMFORT.unearnedAtSep2026)} from Northern Comfort`,
      verdict: "medium",
      message: `Cash is modelled as net income, so deferred revenue (${usd(SNAPSHOT.deferredRevenue.value)} of annual prepayments already collected) is not modelled. Cash timing around annual renewals will differ from the plan.`,
      fix: "Add receivables, payables and deferred revenue to the cash forecast.",
      source: `${ASSUMPTIONS_SOURCE} vs ${SNAPSHOT.deferredRevenue.source}`,
    },
    cogs: {
      history: `About ${pct(INCOME_STATEMENT.slice(-12).reduce((s, r) => s + r.totalCogs, 0) / INCOME_STATEMENT.slice(-12).reduce((s, r) => s + r.totalRevenue, 0))} of revenue as booked, before customer success salaries`,
      verdict: "low",
      message: "Cost of revenue at 12% is a cushion over what is booked, but still leaves out customer success salaries, which investors usually count.",
      fix: "Move customer success into cost of revenue.",
      source: `${ASSUMPTIONS_SOURCE} vs ${INCOME_STATEMENT_SOURCE}`,
    },
    inbound: {
      history: "No inbound or channel data in the pack",
      verdict: "low",
      message: "Inbound new customers (4 a month, growing 3% a month) can't be checked: the pack has no channel data.",
      fix: "Tag each new customer by channel in a CRM.",
      source: ASSUMPTIONS_SOURCE,
    },
    "ae-productivity": {
      history: "Both current reps reached 4 to 5 new customers a month",
      verdict: "supported",
      message: "Five new customers a month per ramped rep matches the top of what the current reps achieve.",
      fix: "",
      source: `${ASSUMPTIONS_SOURCE} vs ${RETENTION.aeRampMonths.source}`,
    },
    "seats-per-customer": {
      history: `${seatsPerCustomer.toFixed(1)} seats per customer across the base (${SNAPSHOT.seats.value.toLocaleString("en-US")} seats, ${SNAPSHOT.customers.value} customers)`,
      verdict: seatsPerCustomer >= 10 ? "supported" : "medium",
      message: `Ten seats per new customer is at or below today's average of ${seatsPerCustomer.toFixed(1)}.`,
      fix: "",
      source: `${ASSUMPTIONS_SOURCE} vs ${CUSTOMERS_SOURCE}`,
    },
  };

  return assumptions.map((a) => {
    const i = items[a.id] ?? {
      history: "Not checked", verdict: "low" as Verdict, message: `${a.assumption}: Vicky has no history to compare against.`, fix: "", source: ASSUMPTIONS_SOURCE,
    };
    return { id: a.id, assumption: a.assumption, foundersValue: a.foundersValue, ...i };
  });
}

const ORDER: Record<Verdict, number> = { high: 0, medium: 1, low: 2, supported: 3 };

// The audit as readiness flags, riskiest first. Supported assumptions are not flags.
export function auditFlags(items: AuditItem[] = auditAssumptions()): AssumptionFlag[] {
  return items
    .filter((i): i is AuditItem & { verdict: Severity } => i.verdict !== "supported")
    .sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict])
    .map((i) => ({ id: i.id, severity: i.verdict, message: i.message.replace(/\.$/, ""), source: i.source }));
}
