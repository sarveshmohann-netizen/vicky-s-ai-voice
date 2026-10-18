// The meeting brief for an uploaded company: the investor lens, what to
// tighten first, and the ten likely questions with what the numbers let the
// founder say. Every answer line is built from computed metrics; where the
// data is missing, it says what to add.

import { PERSONAS, QUESTIONS, STAGES, selectQuestions, type Persona, type PersonaId, type PracticeRecord, type Stage, type StageProfile, type Topic } from "../knowledge.ts";
import { investorLens, type Lens } from "../lens.ts";
import { formatMetric, type Metric } from "../tidewell/metrics.ts";
import { companyToKnowledge, type CompanyAnalysis, type CompanyProfile } from "./analysis.ts";

export interface CompanyBriefQuestion {
  id: string;
  question: string;
  whyTheyAsk: string;
  youWouldSay: string | null; // the deck's claim, if the founder entered one
  numbersSupport: string;
  refs: string[];
}

export interface CompanyTightenItem {
  id: string;
  title: string;
  now: string;
  fix: string;
  severity: "high" | "medium" | "low";
  refs: string[];
}

export interface CompanyBrief {
  investor: Persona;
  stage: StageProfile;
  lens: Lens;
  tighten: CompanyTightenItem[];
  questions: CompanyBriefQuestion[];
}

const CLAIM_TOPIC: Record<string, Topic> = { arr: "growth", growth: "growth", grossMargin: "margin", churn: "churn", nrr: "retention", cac: "cac", runwayMonths: "runway" };

function answerFromNumbers(id: string, m: Record<string, Metric>, p: CompanyProfile): { text: string; refs: string[] } {
  const f = (k: string) => (m[k] ? formatMetric(m[k]) : null);
  const need = (what: string) => ({ text: `Not in your data yet. Add ${what} so Vicky can build this answer from your numbers.`, refs: [] });
  switch (id) {
    case "arr":
      return { text: `ARR is ${f("arr")} [P&L], which is MRR of ${f("mrr")} × 12.${m["onboardingL12M"]?.value ? ` One-time revenue (${f("onboardingL12M")} over the last 12 months) stays out.` : ""}`, refs: ["P&L"] };
    case "growth":
      return m["growth12m"] ? { text: `MRR grew ${f("growth12m")} a month over the period${m["growth3m"] ? ` and ${f("growth3m")} a month over the last 3 months` : ""} [P&L].`, refs: ["P&L"] } : need("at least two months of revenue");
    case "churn":
      return m["logoChurnMonthly12m"] ? { text: `You lose ${f("logoChurnMonthly12m")} of customers a month [You]. Say what's driving it and what you're doing about it.`, refs: ["You"] } : need("your monthly churn");
    case "nrr":
      return m["nrr"] ? { text: `NRR is ${f("nrr")}${m["grr"] ? `, gross retention ${f("grr")}` : ""} [You].`, refs: ["You"] } : need("net revenue retention");
    case "gross-margin":
      return m["grossMarginBooked"] ? { text: `${f("grossMarginBooked")} as booked${m["grossMarginWithSupport"] ? `, ${f("grossMarginWithSupport")} once support is counted` : ""} [P&L].`, refs: ["P&L"] } : need("cost of revenue in your P&L");
    case "cac":
      return m["cacFullyLoaded"] ? { text: `Fully loaded CAC is ${f("cacFullyLoaded")}${m["cacPaybackMonths"] ? `, paid back in about ${m["cacPaybackMonths"].value.toFixed(1)} months` : ""} [P&L].`, refs: ["P&L", "You"] } : need("new customers won in the last 12 months");
    case "forecast-assumptions":
      return p.planMonthlyGrowth !== undefined && m["growth12m"] ? { text: `Your plan assumes ${(p.planMonthlyGrowth * 100).toFixed(1)}% a month; you've done ${f("growth12m")} over the period${m["growth3m"] ? ` and ${f("growth3m")} recently` : ""} [P&L]. Name what changes to close that gap.`, refs: ["You", "P&L"] } : need("the monthly growth your forecast assumes");
    case "runway":
    case "raise-slips":
      return m["runwayToday"] ? { text: `At ${f("monthlyBurn")} a month, your cash lasts ${f("runwayToday")} without the raise [P&L]${m["runwayAfterRaise"] ? `, and the raise lasts about ${f("runwayAfterRaise")} at your planned spend [You]` : ""}.`, refs: ["P&L", "You"] } : need("your cash balance");
    case "concentration":
      return m["largestCustomerShare"] ? { text: `Your largest customer is ${f("largestCustomerShare")} of MRR [You].`, refs: ["You"] } : need("your largest customer's share of MRR");
    case "ae-ramp":
      return { text: "Your upload doesn't show sales hiring. Know how long your last rep took to close their first deals, and plan new hires on that ramp.", refs: [] };
    case "tam":
      return { text: "Build it bottom-up: the number of businesses that fit, times what each would pay, with a named source for the count.", refs: [] };
    case "competition":
      return { text: "Use real evidence: customers who switched from a competitor and what they told you. Don't claim a better product without it.", refs: [] };
    case "milestones":
      return m["runwayAfterRaise"] ? { text: `The raise lasts about ${f("runwayAfterRaise")} at your planned spend [You]. Name the 2 or 3 numbers the next round will need, and when you'll hit them.`, refs: ["You"] } : need("your raise amount and planned monthly spend after it");
    case "valuation":
      return { text: "Let the lead propose terms. Know your metrics, the round size and any SAFEs that convert. Vicky won't suggest a valuation.", refs: [] };
    default:
      return { text: "", refs: [] };
  }
}

export function companyBrief(c: CompanyAnalysis, profile: CompanyProfile, personaId: PersonaId, stageId: Stage, history: PracticeRecord[] = []): CompanyBrief {
  const investor = PERSONAS[personaId];
  const stage = STAGES[stageId];
  const lens = investorLens(c.metrics, personaId, stageId);
  const cares = new Set<Topic>([...investor.focus, ...stage.focus]);

  const candidates = [
    ...c.claims.filter((x) => x.status !== "Holds").map((x) => ({
      id: `claim-${x.id}`, title: `Deck: ${x.label} ${formatMetric({ value: x.deck, unit: x.unit })}`,
      now: x.data === null ? "Not in your data" : `Your numbers: ${formatMetric({ value: x.data, unit: x.unit })}`, fix: x.why,
      severity: x.status === "Fix" ? "high" as const : "medium" as const, refs: ["Deck", "P&L"],
      score: (x.status === "Fix" ? 3 : 2) + (cares.has(CLAIM_TOPIC[x.id] ?? "growth") ? 2 : 0),
    })),
    ...c.storyChecks.map((s) => ({ id: `story-${s.id}`, title: s.title, now: `${s.plan} vs ${s.history}`, fix: "Show the plan at your actual rate too, and say what would have to change to beat it.", severity: s.severity, refs: s.refs, score: s.severity === "high" ? 3 : 2 })),
    ...lens.focus.filter((f) => f.status === "below").map((f) => ({ id: `bar-${f.id}`, title: `${f.label} is below the ${f.bar!.appliesAs.split(",")[0]}`, now: `${f.value} vs ${f.bar!.text}`, fix: "Lead with the trend and the plan to close the gap, rather than the number alone.", severity: "medium" as const, refs: [f.bar!.source.short], score: 2.5 })),
    ...lens.missing.map((w) => ({ id: `missing-${w.id}`, title: `Add ${w.label.toLowerCase()}`, now: "Not in your data", fix: w.why, severity: "low" as const, refs: [], score: 1.5 })),
  ];
  const tighten = candidates.sort((a, b) => b.score - a.score).slice(0, 5).map(({ score: _s, ...rest }) => rest);

  const picked = selectQuestions(companyToKnowledge(c), history, personaId, 10, stageId);
  for (const q of QUESTIONS) if (picked.length < 10 && !picked.includes(q)) picked.push(q);
  const deckFor: Record<string, keyof NonNullable<CompanyProfile["deck"]>> = { arr: "arr", growth: "growth", "gross-margin": "grossMargin", churn: "churn", nrr: "nrr", cac: "cac", runway: "runwayMonths" };
  const questions = picked.map((q) => {
    const a = answerFromNumbers(q.id, c.metrics, profile);
    const claim = c.claims.find((x) => x.id === deckFor[q.id]);
    return {
      id: q.id,
      question: q.genericQuestion ?? q.question,
      whyTheyAsk: q.testing,
      youWouldSay: claim ? `"${claim.label} ${formatMetric({ value: claim.deck, unit: claim.unit })}" (your deck)` : null,
      numbersSupport: a.text,
      refs: a.refs,
    };
  });
  return { investor, stage, lens, tighten, questions };
}
