// Checks each claim in the founders' draft deck against what the data shows.
// The status comes from code comparing numbers, not from the language model,
// so the same data always gives the same verdict.

import { DECK_CLAIMS, DECK_SOURCE, NORTHERN_COMFORT, RUNWAY_AFTER_RAISE, type Basis, type DeckClaim } from "./facts.ts";
import { computeMetrics, formatMetric, type Metric } from "./metrics.ts";

export type ClaimStatus = "Fix" | "Reword" | "Remove or source" | "Show as upside" | "Holds";

export interface ClaimCheck {
  id: string;
  claim: string;
  status: ClaimStatus;
  dataShows: string;
  why: string;
  basis: Basis;
  sources: string[];
}

// A claim within this share of the computed figure is treated as accurate.
export const CLAIM_TOLERANCE = 0.05;

const gap = (claimed: number, actual: number) => Math.abs(claimed - actual) / Math.abs(actual);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function checkDeckClaims(metrics: Record<string, Metric> = computeMetrics(), claims: DeckClaim[] = DECK_CLAIMS): ClaimCheck[] {
  const get = (id: string) => {
    const m = metrics[id];
    if (!m) throw new Error(`Missing metric ${id}`);
    return m;
  };
  const show = (id: string) => formatMetric(get(id));
  const src = (...ids: string[]) => [DECK_SOURCE, ...new Set(ids.map((id) => get(id).source))];

  return claims.map((c): ClaimCheck => {
    const claimed = c.claimed ?? NaN;
    const base = { id: c.id, claim: c.claim, basis: "historical" as Basis };
    switch (c.id) {
      case "arr": {
        const arr = get("arr");
        const ok = gap(claimed, arr.value) <= CLAIM_TOLERANCE;
        const viaOnboarding = gap(claimed, get("arrIncludingOnboarding").value) <= CLAIM_TOLERANCE;
        return { ...base, status: ok ? "Holds" : "Fix", dataShows: show("arr"),
          why: ok ? "Matches MRR × 12." : viaOnboarding ? `The claim is total revenue × 12 (${show("arrIncludingOnboarding")}), which counts one-time onboarding fees. ARR is MRR × 12.` : "Does not match MRR × 12.",
          sources: src("arr", "arrIncludingOnboarding") };
      }
      case "growth": {
        const g12 = get("growth12m").value;
        const g3 = get("growth3m").value;
        const overstated = claimed > g12 * 1.2;
        const slowing = g3 < claimed * 0.75;
        return { ...base, status: overstated ? "Fix" : slowing ? "Reword" : "Holds",
          dataShows: `About ${pct(g12)} a month over 12 months, ${pct(g3)} over the last 3`,
          why: slowing ? `Close to the 12-month rate, but growth has slowed to ${pct(g3)} a month recently. Give both numbers and explain the slowdown. Excluding Northern Comfort Group the 12-month rate is ${show("growth12mExNcg")}.` : overstated ? "Higher than any period in the data." : "Matches the data.",
          sources: src("growth12m", "growth3m", "growth12mExNcg") };
      }
      case "gross-margin": {
        const withSupport = get("grossMarginWithSupport").value;
        const ok = Math.abs(claimed - withSupport) <= 0.02;
        return { ...base, status: ok ? "Holds" : "Fix", dataShows: `${show("grossMarginBooked")} as booked, ${show("grossMarginWithSupport")} including customer success`,
          why: ok ? "Matches margin including support." : "The claim leaves customer success salaries out of cost of revenue. Most SaaS investors include support, which gives the lower figure.",
          sources: src("grossMarginBooked", "grossMarginWithSupport") };
      }
      case "churn": {
        const c12 = get("logoChurnMonthly12m").value;
        const c6 = get("logoChurnMonthly6m").value;
        const ok = claimed >= Math.min(c12, c6) * (1 - CLAIM_TOLERANCE);
        return { ...base, status: ok ? "Holds" : "Fix", dataShows: `${pct(c12)} a month over 12 months, ${pct(c6)} over the last 6`,
          why: ok ? "Matches the data." : "Churn has never been this low. Quote both the 12-month and 6-month numbers; six months is too short to call a trend.",
          sources: src("logoChurnMonthly12m", "logoChurnMonthly6m") };
      }
      case "nrr": {
        const nrr = get("nrr").value;
        const ok = claimed <= nrr * (1 + CLAIM_TOLERANCE);
        return { ...base, status: ok ? "Holds" : "Fix", dataShows: `About ${pct(nrr)} (gross retention ${show("grr")})`,
          why: ok ? "Matches the data." : "Customers active a year ago pay less today than they did then, so NRR is below 100%.",
          sources: src("nrr", "grr") };
      }
      case "cac": {
        const full = get("cacFullyLoaded").value;
        const ok = gap(claimed, full) <= CLAIM_TOLERANCE;
        const programsOnly = gap(claimed, get("cacProgramsOnly").value) <= CLAIM_TOLERANCE;
        const payback = get("cacPaybackMonths").value;
        return { ...base, status: ok ? "Holds" : "Fix", dataShows: `About ${show("cacFullyLoaded")} fully loaded, payback about ${payback.toFixed(1)} months`,
          why: ok ? "Matches fully loaded CAC." : programsOnly ? `The claim divides marketing programs only (${show("cacProgramsOnly")}) by new customers. Fully loaded CAC adds sales and marketing salaries and commissions.` : "Does not match fully loaded CAC.",
          sources: src("cacFullyLoaded", "cacProgramsOnly", "cacPaybackMonths") };
      }
      case "tam":
        return { ...base, status: "Remove or source", basis: "founder-claim", dataShows: "No source given",
          why: "The data pack has no market sizing. Build it bottom-up (trades businesses with 3 to 30 technicians × seats × price) with sourced business counts, or take it off the slide.",
          sources: [DECK_SOURCE] };
      case "ncg":
        return { ...base, status: claimed > NORTHERN_COMFORT.seats ? "Show as upside" : "Holds", basis: "founder-claim",
          dataShows: `${NORTHERN_COMFORT.seats} seats under contract, renewing ${NORTHERN_COMFORT.renews}; the expansion is verbal and nothing is signed`,
          why: "Keep the base case at today's contract and present the expansion as upside until it is signed.",
          sources: [DECK_SOURCE, NORTHERN_COMFORT.source] };
      case "runway": {
        const plan = RUNWAY_AFTER_RAISE.foundersPlanMonths;
        const hist = RUNWAY_AFTER_RAISE.historicalDriversMonths;
        const status: ClaimStatus = claimed <= hist.value ? "Holds" : gap(claimed, plan.value) <= 0.15 ? "Reword" : "Fix";
        return { ...base, status, basis: "forecast", dataShows: `About ${plan.value} months on the founders' own plan, closer to ${hist.value} at growth rates actually achieved`,
          why: "Give the range and the milestones the round must reach, and say where hiring slows if growth comes in at historical rates.",
          sources: [DECK_SOURCE, plan.source, hist.source] };
      }
      default:
        return { ...base, status: "Remove or source", basis: "founder-claim", dataShows: "Vicky has no data to check this claim", why: "Add a source or remove it.", sources: [DECK_SOURCE] };
    }
  });
}
