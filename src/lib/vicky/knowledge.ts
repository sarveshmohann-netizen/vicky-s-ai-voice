// Vicky's knowledge and memory layer: what Gemini (or any model) is told
// before each answer. The model is never retrained. Instead, code picks the
// relevant benchmarks, questions, persona, past results and team-written
// lessons, and assembles them into the prompt. Adding a lesson or a benchmark
// changes Vicky's behaviour on the next request.
// Pure, deterministic code with no dependencies.

import type { Summary, StressResult } from "./model.ts";
import type { AnswerGrade, AssumptionFlag, FactCheck, ReadinessResult } from "./readiness.ts";

export type Topic = "growth" | "retention" | "churn" | "cac" | "burn" | "runway" | "margin" | "use-of-funds" | "team" | "market";

// --- Knowledge base ----------------------------------------------------------

export interface Benchmark {
  id: string;
  topic: Topic;
  statement: string;
  source: { name: string; url: string };
}

// Only benchmarks from pages we have opened and checked. Add more with a source link.
const SAASTR = { name: "SaaStr, top metrics Series A investors look at", url: "https://www.saastr.com/dear-saastr-what-are-the-top-10-metrics-series-a-investors-look-at" };
export const BENCHMARKS: Benchmark[] = [
  { id: "arr-growth", topic: "growth", statement: "Series A investors look for 7-15% month-over-month ARR growth; under $1M ARR, show a path to $1M within 12-18 months.", source: SAASTR },
  { id: "ndr", topic: "retention", statement: "Net dollar retention of 120%+ is top tier; at seed, at least 100%.", source: SAASTR },
  { id: "grr", topic: "churn", statement: "Gross retention of 90%+ is ideal; below 80% signals a churn problem.", source: SAASTR },
  { id: "cac-payback", topic: "cac", statement: "CAC payback of 12 months or less.", source: SAASTR },
  { id: "efficiency", topic: "cac", statement: "Sales efficiency: a magic number of 1+ or LTV to CAC of 3:1.", source: SAASTR },
  { id: "burn-multiple", topic: "burn", statement: "Burn multiple of 1-2x is healthy; burning $3M to add $1M ARR (3x) is a red flag.", source: SAASTR },
];

export interface Question {
  id: string;
  topics: Topic[];
  question: string;
  testing: string; // what the investor is really checking
  strongAnswer: string; // the shape of a strong answer, not a script
}

export const QUESTIONS: Question[] = [
  { id: "growth-basis", topics: ["growth"], question: "Your forecast grows faster than your history. What changes to make that happen?", testing: "Whether the forecast is tied to a real driver or is a hopeful line.", strongAnswer: "Names the specific driver (new channel, pricing, sales hire), shows early evidence from your own data, and says what happens if it is slower." },
  { id: "growth-downside", topics: ["growth", "runway"], question: "If growth comes in at half your plan, how long does the money last?", testing: "Whether you know your downside and have a plan B.", strongAnswer: "Gives the runway number under the slower case and the cost levers you would pull, in order." },
  { id: "churn-why", topics: ["churn", "retention"], question: "Why do customers leave, and what are you doing about it?", testing: "Whether you understand retention, the base of every SaaS valuation.", strongAnswer: "Gives the churn rate, the top reasons from real customer conversations, and one fix with early results." },
  { id: "expansion", topics: ["retention"], question: "Do existing customers spend more over time?", testing: "Net retention: whether revenue grows without new customers.", strongAnswer: "States net revenue retention or upsell examples, with numbers." },
  { id: "cac-channel", topics: ["cac"], question: "What does it cost you to win a customer, and how long until you earn it back?", testing: "Unit economics: whether growth gets cheaper or more expensive as you scale.", strongAnswer: "Gives CAC and payback months by channel, and which channel the raise will fund." },
  { id: "burn-efficiency", topics: ["burn"], question: "For every dollar you burn, how much new revenue do you add?", testing: "Capital efficiency, the burn multiple.", strongAnswer: "Gives the ratio, compares it to the 1-2x benchmark, and explains the plan to improve it." },
  { id: "hiring-plan", topics: ["burn", "team"], question: "Your plan adds a lot of people. Why these roles, and when do they pay off?", testing: "Whether headcount is the cost driver and is tied to milestones.", strongAnswer: "Maps each hire to a milestone and shows what happens to runway if hires are delayed." },
  { id: "margin-path", topics: ["margin"], question: "What is your gross margin, and how does it change at scale?", testing: "Whether this is a software-margin business or services in disguise.", strongAnswer: "States the margin, what is in cost of goods, and the specific costs that fall with scale." },
  { id: "runway-milestone", topics: ["runway", "use-of-funds"], question: "What milestones does this round get you to, and is there enough runway to hit them?", testing: "Whether the raise is sized to reach the next round's metrics with buffer.", strongAnswer: "Names the milestones for the next round, the month you expect to hit them, and the months of buffer left." },
  { id: "use-of-funds", topics: ["use-of-funds"], question: "Walk me through how you will spend the money.", testing: "Whether the founders have a plan or just a number.", strongAnswer: "Splits the raise into 3-4 buckets with amounts, each tied to a milestone." },
  { id: "biggest-risk", topics: ["runway", "burn", "growth"], question: "What is the one number in this plan you are least sure about?", testing: "Self-awareness: founders who name their own weak spot earn trust.", strongAnswer: "Names it honestly, explains why, and says how you will know early if it is off." },
  { id: "missing-data", topics: ["cac", "churn"], question: "I don't see this metric in your materials. Do you track it?", testing: "Whether missing data is an oversight or something being hidden.", strongAnswer: "Admits the gap, gives the best available estimate clearly labelled, and a date when it will be tracked." },
];

export type PersonaId = "seed-saas" | "skeptic" | "angel";

export interface Persona {
  id: PersonaId;
  name: string;
  focus: Topic[];
  style: string;
}

export const PERSONAS: Record<PersonaId, Persona> = {
  "seed-saas": { id: "seed-saas", name: "Seed SaaS partner", focus: ["growth", "retention", "cac", "use-of-funds"], style: "Friendly but data-driven. Wants to see the path from this round to Series A metrics." },
  skeptic: { id: "skeptic", name: "Skeptical numbers partner", focus: ["burn", "runway", "margin", "churn"], style: "Direct and probing. Pushes on every flagged assumption and asks for the downside case." },
  angel: { id: "angel", name: "Angel or operator", focus: ["team", "market", "growth"], style: "Conversational. Cares about the founders and the customer pain, and whether they truly understand their numbers." },
};

export const RUBRIC =
  "Grade the answer 0-4 on each criterion. evidence: cites the company's own data. clarity: plain, direct, answers the question asked. accuracy: every number and claim matches the provided data. ownership: acknowledges weaknesses and gives a plan.";

// --- Memory: what Vicky has learned about this founder and from the team ----

export interface PracticeRecord {
  questionId: string;
  topic: Topic;
  grade: AnswerGrade;
  coachingNote: string;
  at: string; // ISO date
}

// A correction written by the team or flagged by a founder ("Vicky got this
// wrong"). Stored in the database and injected into future prompts.
export interface Lesson {
  id: string;
  topics: Topic[] | "all";
  text: string;
  at: string;
}

export interface Analysis {
  summary: Summary;
  stress: StressResult[];
  readiness: ReadinessResult;
  flags: AssumptionFlag[];
}

// --- Selection ------------------------------------------------------------------

const DRIVER_TOPIC: Record<StressResult["driver"], Topic> = {
  monthlyGrowth: "growth", monthlyChurn: "churn", grossMargin: "margin", costPerHead: "burn", otherOpex: "burn",
};

const FLAG_KEYWORDS: [RegExp, Topic][] = [
  [/growth|revenue|arr|mrr/i, "growth"],
  [/churn|retention|cancel/i, "churn"],
  [/margin|cogs|cost of goods/i, "margin"],
  [/hire|headcount|salar|payroll|burn|opex|spend/i, "burn"],
  [/cac|acquisition|payback|marketing/i, "cac"],
  [/runway|cash/i, "runway"],
  [/use of funds|raise/i, "use-of-funds"],
];

export function flagTopics(flag: AssumptionFlag): Topic[] {
  const found = FLAG_KEYWORDS.filter(([re]) => re.test(flag.message)).map(([, t]) => t);
  return found.length ? [...new Set(found)] : ["runway"];
}

const gradeQuality = (g: AnswerGrade) => (g.evidence + g.clarity + g.accuracy + g.ownership) / 16;

// Topic priorities from this company's own analysis and the founder's history.
export function topicWeights(a: Analysis, history: PracticeRecord[] = [], persona?: PersonaId): Map<Topic, number> {
  const w = new Map<Topic, number>();
  const add = (t: Topic, n: number) => w.set(t, (w.get(t) ?? 0) + n);
  for (const f of a.flags) for (const t of flagTopics(f)) add(t, f.severity === "high" ? 3 : f.severity === "medium" ? 2 : 0.5);
  a.stress.filter((s) => s.monthsLost > 0).slice(0, 2).forEach((s, i) => add(DRIVER_TOPIC[s.driver], 2 - i * 0.5));
  if (a.summary.runwayMonths !== null && a.summary.runwayMonths < 18) add("runway", 2);
  for (const t of weakTopics(history)) add(t, 1.5);
  if (persona) for (const t of PERSONAS[persona].focus) add(t, 1);
  return w;
}

// Topics where the founder's average practice grade is below 60%.
export function weakTopics(history: PracticeRecord[]): Topic[] {
  const byTopic = new Map<Topic, number[]>();
  for (const r of history) byTopic.set(r.topic, [...(byTopic.get(r.topic) ?? []), gradeQuality(r.grade)]);
  return [...byTopic].filter(([, qs]) => qs.reduce((a, b) => a + b, 0) / qs.length < 0.6).map(([t]) => t);
}

// The questions that matter most for this company, skipping ones already answered well.
export function selectQuestions(a: Analysis, history: PracticeRecord[] = [], persona?: PersonaId, n = 5): Question[] {
  const w = topicWeights(a, history, persona);
  const mastered = new Set(history.filter((r) => gradeQuality(r.grade) >= 0.75).map((r) => r.questionId));
  return QUESTIONS.filter((q) => !mastered.has(q.id))
    .map((q, i) => ({ q, i, score: q.topics.reduce((s, t) => s + (w.get(t) ?? 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.i - y.i)
    .slice(0, n)
    .map((x) => x.q);
}

export function selectBenchmarks(topics: Iterable<Topic>): Benchmark[] {
  const set = new Set(topics);
  return BENCHMARKS.filter((b) => set.has(b.topic));
}

export function selectLessons(lessons: Lesson[], topics: Iterable<Topic>, max = 5): Lesson[] {
  const set = new Set(topics);
  return lessons
    .filter((l) => l.topics === "all" || l.topics.some((t) => set.has(t)))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, max);
}

// --- Prompt assembly ---------------------------------------------------------------

export const RULES = [
  "Use only numbers that appear in COMPANY NUMBERS. Never calculate, estimate or invent a figure. If a number is needed and missing, say it is missing.",
  "Label figures as Historical, Forecast or Assumption, and name the input each finding comes from.",
  "Explain in plain language a founder with no finance background understands.",
  "When you use a benchmark, quote it and name its source.",
  "Never give investment advice, a valuation, or a recommendation to invest. If asked, say you can't and explain what investors will look at instead.",
  "Coach, don't just criticise: every weakness comes with a concrete way to improve.",
];

export interface ContextInput {
  mode: "ask" | "simulate" | "report";
  persona?: PersonaId;
  analysis: Analysis;
  history?: PracticeRecord[];
  lessons?: Lesson[];
}

export function buildSystemPrompt(c: ContextInput): string {
  const history = c.history ?? [];
  const weights = topicWeights(c.analysis, history, c.persona);
  const topics = [...weights.keys()];
  const questions = selectQuestions(c.analysis, history, c.persona);
  const persona = c.persona ? PERSONAS[c.persona] : undefined;
  const weak = weakTopics(history);
  const recentNotes = history.filter((r) => weak.includes(r.topic)).slice(-3);
  const lessons = selectLessons(c.lessons ?? [], topics);

  const role =
    c.mode === "simulate" && persona
      ? `You are Vicky playing ${persona.name}, an investor in a mock fundraising meeting. ${persona.style} Ask ONE question at a time. Follow up when an answer is vague or a number does not match COMPANY NUMBERS. After 5 questions, give a scorecard on financial accuracy, clarity and preparedness, with one concrete tip per answer.`
      : c.mode === "report"
        ? "You are Vicky, an AI investor coach. Write a Readiness Report for the founder from COMPANY NUMBERS: the score and what drives it, the riskiest assumptions, and the three actions that would most improve their readiness."
        : "You are Vicky, an AI investor coach. Answer the founder's questions about their own financials and how investors will see them.";

  const sections = [
    role,
    "RULES\n" + RULES.map((r, i) => `${i + 1}. ${r}`).join("\n"),
    "COMPANY NUMBERS (computed by tested code; the only figures you may use)\n" +
      JSON.stringify({ summary: c.analysis.summary, stressTest: c.analysis.stress, readiness: { score: c.analysis.readiness.score, band: c.analysis.readiness.band, coverage: c.analysis.readiness.coverage, components: c.analysis.readiness.components }, flags: c.analysis.flags }, null, 1),
  ];

  const benchmarks = selectBenchmarks(topics);
  if (benchmarks.length) sections.push("BENCHMARKS (quote with source)\n" + benchmarks.map((b) => `- ${b.statement} Source: ${b.source.name} (${b.source.url})`).join("\n"));

  if (questions.length) {
    sections.push(
      (c.mode === "simulate" ? "QUESTIONS TO ASK, in this order of priority" : "WHAT INVESTORS WILL PROBE FOR THIS COMPANY") + "\n" +
        questions.map((q) => `- [${q.id}] ${q.question}\n  Testing: ${q.testing}\n  A strong answer: ${q.strongAnswer}`).join("\n"),
    );
  }

  if (recentNotes.length) {
    sections.push("FOUNDER'S WEAK SPOTS FROM PAST PRACTICE (revisit these)\n" + recentNotes.map((r) => `- ${r.topic}: ${r.coachingNote}`).join("\n"));
  }

  if (lessons.length) sections.push("LESSONS FROM REVIEWERS (follow these; they correct past mistakes)\n" + lessons.map((l) => `- ${l.text}`).join("\n"));

  sections.push(`DISCLAIMER to include when giving a score: ${c.analysis.readiness.disclaimer}`);
  return sections.join("\n\n");
}

// --- Grading: model grades with the rubric, code validates -----------------------

export function gradingPrompt(question: Question, answer: string, a: Analysis): string {
  return [
    "You grade a founder's answer to an investor question. Return ONLY JSON:",
    '{"evidence":0-4,"clarity":0-4,"accuracy":0-4,"ownership":0-4,"coachingNote":"one sentence","improvedAnswer":"a stronger version using only COMPANY NUMBERS"}',
    `RUBRIC: ${RUBRIC}`,
    `QUESTION: ${question.question}`,
    `WHAT THE INVESTOR IS TESTING: ${question.testing}`,
    `A STRONG ANSWER: ${question.strongAnswer}`,
    `COMPANY NUMBERS: ${JSON.stringify(a.summary)}`,
    `FOUNDER'S ANSWER: ${answer}`,
  ].join("\n");
}

export interface ParsedGrade {
  grade: AnswerGrade;
  coachingNote: string;
  improvedAnswer: string;
}

// Accepts the model's reply (with or without code fences), clamps every score
// to 0-4, and returns null if it is not usable rather than guessing.
export function parseGrade(raw: string, questionId: string, flagId?: string): ParsedGrade | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const score = (k: string) => {
    const v = Number(obj[k]);
    return Number.isFinite(v) ? Math.min(4, Math.max(0, Math.round(v))) : null;
  };
  const [evidence, clarity, accuracy, ownership] = ["evidence", "clarity", "accuracy", "ownership"].map(score);
  if ([evidence, clarity, accuracy, ownership].some((v) => v === null)) return null;
  return {
    grade: { questionId, ...(flagId !== undefined ? { flagId } : {}), evidence: evidence!, clarity: clarity!, accuracy: accuracy!, ownership: ownership! },
    coachingNote: String(obj["coachingNote"] ?? ""),
    improvedAnswer: String(obj["improvedAnswer"] ?? ""),
  };
}

// --- Fact-checking a founder's answer in code -----------------------------------

export type Unit = "usd" | "pct" | "months";

export interface KnownMetric {
  name: string;
  value: number;
  unit: Unit;
  aliases: string[]; // words a founder might use, e.g. ["burn", "burn rate"]
}

interface Mention {
  value: number;
  unit: Unit;
  index: number;
}

const MULT: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

// Pulls money, percentages and month counts out of free text.
export function extractNumbers(text: string): Mention[] {
  const out: Mention[] = [];
  const re = /(\$)?\s?(\d+(?:,\d{3})*(?:\.\d+)?)\s?(k|mm|m|b|thousand|million|billion)?\b\s?(%|percent|months?|mos?)?/gi;
  for (const m of text.matchAll(re)) {
    const [, dollar, num, mult, suffix] = m;
    if (!num) continue;
    let value = Number(num.replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    if (mult) value *= MULT[mult.toLowerCase()] ?? 1;
    const s = suffix?.toLowerCase();
    const unit: Unit | null = s && /%|percent/.test(s) ? "pct" : s && /^mo/.test(s) ? "months" : dollar || mult ? "usd" : null;
    if (unit) out.push({ value: unit === "pct" ? value / 100 : value, unit, index: m.index ?? 0 });
  }
  return out;
}

// For each known metric the founder mentions, pair it with the nearest number
// of the right unit after the mention (within 80 characters).
export function factCheckAnswer(text: string, metrics: KnownMetric[]): FactCheck[] {
  const lower = text.toLowerCase();
  const nums = extractNumbers(text);
  const checks: FactCheck[] = [];
  for (const metric of metrics) {
    const at = metric.aliases.map((a) => lower.indexOf(a.toLowerCase())).filter((i) => i >= 0);
    if (!at.length) continue;
    const pos = Math.min(...at);
    const hit = nums.find((n) => n.unit === metric.unit && n.index >= pos && n.index - pos <= 80);
    if (hit) checks.push({ metric: metric.name, stated: hit.value, actual: metric.value });
  }
  return checks;
}
