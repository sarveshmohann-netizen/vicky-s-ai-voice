// The meeting brief: pick an investor and a stage, and Vicky lays out how that
// investor thinks, what to tighten in the forecast first, and the ten
// questions they're most likely to ask with what Tidewell would say today
// next to what the numbers support.

import { PERSONAS, QUESTIONS, STAGES, selectQuestions, type Persona, type PersonaId, type PracticeRecord, type Stage, type StageProfile, type Topic } from "../knowledge.ts";
import { analyzeTidewell, toKnowledgeAnalysis, type TidewellAnalysis } from "./analysis.ts";
import { shortRefs } from "./refs.ts";

export interface TightenItem {
  id: string;
  title: string;
  now: string;
  fix: string;
  severity: "high" | "medium" | "low";
  refs: string[];
}

export interface BriefQuestion {
  id: string;
  question: string;
  whyTheyAsk: string;
  youWouldSay: string; // what the founders' deck and plan say today
  numbersSupport: string; // what the data lets them say
}

export interface MeetingBrief {
  investor: Persona;
  stage: StageProfile;
  headline: string;
  tighten: TightenItem[];
  questions: BriefQuestion[];
  alsoAsk: string[];
}

const CLAIM_TOPIC: Record<string, Topic> = {
  arr: "growth", growth: "growth", "gross-margin": "margin", churn: "churn", nrr: "retention", cac: "cac", tam: "market", ncg: "concentration", runway: "runway",
};
const AUDIT_TOPIC: Record<string, Topic> = {
  churn: "churn", "ae-ramp": "growth", "price-existing": "growth", "price-new": "growth", "ncg-renewal": "concentration", expansion: "retention",
  marketing: "burn", srred: "runway", "cash-method": "runway", cogs: "margin", inbound: "growth", "ae-productivity": "growth", "seats-per-customer": "growth",
};
const PLAN_TITLE: Record<string, string> = {
  churn: "Churn drops to 1% a month", "ae-ramp": "New sales reps ramp in 1 month", expansion: "Seat expansion of 1% a month",
  "price-existing": "20% price rise with no extra churn", "price-new": "List price goes to $54 in January", "ncg-renewal": "Northern Comfort renews at 600 seats",
  marketing: "Marketing spend jumps before the raise", srred: "$240K SR&ED refund in July 2027", "cash-method": "Cash ignores deferred revenue",
  cogs: "Cost of revenue at 12%", inbound: "Inbound grows 3% a month",
};
const SEVERITY_WEIGHT = { high: 3, medium: 2, low: 1 };

export function meetingBrief(personaId: PersonaId, stageId: Stage, history: PracticeRecord[] = [], t: TidewellAnalysis = analyzeTidewell()): MeetingBrief {
  const investor = PERSONAS[personaId];
  const stage = STAGES[stageId];
  const cares = new Set<Topic>([...investor.focus, ...stage.focus]);
  const boost = (topic: Topic | undefined) => (topic && cares.has(topic) ? 2 : 0);

  // Deck claims that need fixing and assumptions the history doesn't support,
  // ranked by severity and by whether this investor cares about the topic.
  const candidates: (TightenItem & { score: number })[] = [
    ...t.claims.filter((c) => c.status !== "Holds").map((c) => {
      const severity = c.status === "Fix" ? "high" as const : c.status === "Show as upside" ? "low" as const : "medium" as const;
      return { id: `claim-${c.id}`, title: `Deck says "${c.claim}"`, now: c.dataShows, fix: c.why, severity, refs: ["Deck", ...c.sources.slice(1).flatMap(shortRefs)].filter((r, i, a) => a.indexOf(r) === i).slice(0, 3), score: SEVERITY_WEIGHT[severity] + boost(CLAIM_TOPIC[c.id]) };
    }),
    ...t.audit.filter((a) => a.verdict !== "supported").map((a) => {
      const severity = a.verdict as "high" | "medium" | "low";
      return { id: `plan-${a.id}`, title: PLAN_TITLE[a.id] ?? a.assumption, now: a.history, fix: a.fix, severity, refs: shortRefs(a.source), score: SEVERITY_WEIGHT[severity] + boost(AUDIT_TOPIC[a.id]) };
    }),
  ];
  const tighten = candidates.sort((a, b) => b.score - a.score).slice(0, 5).map(({ score: _s, ...item }) => item);

  const picked = selectQuestions(toKnowledgeAnalysis(t), history, personaId, 10, stageId);
  // Fill to ten with the pack's own order if the weighting leaves gaps.
  for (const q of QUESTIONS) if (picked.length < 10 && !picked.includes(q)) picked.push(q);
  const questions = picked.map((q) => ({
    id: q.id,
    question: q.question,
    whyTheyAsk: q.testing,
    youWouldSay: q.weakAnswer ?? "",
    numbersSupport: q.strongAnswer,
  }));

  const fixes = t.claims.filter((c) => c.status === "Fix").length;
  const highPlan = t.audit.filter((a) => a.verdict === "high").length;
  const headline = `${fixes} of ${t.claims.length} deck claims would fall apart on the first follow-up question, and ${highPlan} plan assumptions run well ahead of what Tidewell has done so far. The business is stronger than some of those claims make it look, so most of the work is restating numbers the standard way.`;

  return { investor, stage, headline, tighten, questions, alsoAsk: investor.ownQuestions };
}
