// Vicky's knowledge and memory layer: what Gemini (or any model) is told
// before each answer. The model is never retrained. Instead, code picks the
// relevant benchmarks, questions, persona, past results and team-written
// lessons, and assembles them into the prompt. Adding a lesson or a benchmark
// changes Vicky's behaviour on the next request.
// Pure, deterministic code with no dependencies.

import type { Summary, StressResult } from "./model.ts";
import type { AnswerGrade, AssumptionFlag, FactCheck, ReadinessResult } from "./readiness.ts";

export type Topic = "growth" | "retention" | "churn" | "cac" | "burn" | "runway" | "margin" | "use-of-funds" | "team" | "market" | "concentration" | "valuation";

// --- Knowledge base ----------------------------------------------------------

export interface Benchmark {
  id: string;
  topic: Topic;
  statement: string;
  source: { name: string; short: string; checked: string; url: string };
}

// Only benchmarks from pages we have opened and checked. Add more with a source link.
const SAASTR = { name: "SaaStr, top metrics Series A investors look at", short: "SaaStr", checked: "Oct 2026", url: "https://www.saastr.com/dear-saastr-what-are-the-top-10-metrics-series-a-investors-look-at" };
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
  number?: number; // position in the organisers' pack, Appendix D
  topics: Topic[];
  question: string;
  testing: string; // why the investor asks
  genericQuestion?: string; // wording for companies other than Tidewell
  weakAnswer?: string; // what an unprepared founder says
  strongAnswer: string; // the shape of a strong answer, not a script
}

// The 15 questions from the organisers' Supporting Resources, Appendix D, in
// the order investors usually ask them. Strong answers quote Tidewell's own
// numbers, which tidewell/metrics.ts reproduces.
const D = (n: number, id: string, topics: Topic[], question: string, testing: string, weakAnswer: string, strongAnswer: string): Question =>
  ({ id, number: n, topics, question, testing, weakAnswer, strongAnswer, ...(GENERIC[id] ? { genericQuestion: GENERIC[id] } : {}) });

const GENERIC: Record<string, string> = {
  "forecast-assumptions": "Your forecast grows faster than your history. What has to change to make that happen?",
  concentration: "How dependent are you on your largest customer?",
  runway: "Why this amount, and how long does it last?",
  tam: "Where does your market size come from?",
  competition: "Why will you win against the bigger competitors?",
  milestones: "What will this round get you to, and what's the biggest risk?",
};

export const QUESTIONS: Question[] = [
  D(1, "arr", ["growth"], "What is your ARR, and how do you calculate it?", "Whether the founder knows the difference between recurring and one-time revenue.", "$1.37M.", "$1.29M. That's September MRR of $107,189 times 12. We leave out onboarding fees because they don't repeat. They were $108,600 over the last 12 months."),
  D(2, "growth", ["growth"], "How fast are you growing?", "Growth rate drives almost every other question, including how much the round is worth to them.", "10% month over month.", "MRR went from $38K to $107K in the 12 months to September, about 9% a month compounded. About $10K of that is Northern Comfort Group; without them it's about 8%. Growth slowed to about 5% a month from July to September, and here is why."),
  D(3, "churn", ["churn", "retention"], "What is your churn?", "SMB software lives or dies on churn. High churn means growth has to work harder just to stand still.", "Around 1%. Most of it was early customers on the old product.", "2.0% of customers a month over the last 12 months, 1.6% over the last six. Most churn is early: about 3.3% a month in the first six months on monthly plans, 1.4% after. So onboarding effort goes into the first 90 days."),
  D(4, "nrr", ["retention"], "What is your net revenue retention?", "Whether existing customers grow or shrink over time: how much growth comes for free.", "Above 110%.", "Customers paying $38.0K a month in September 2025 pay $33.3K today, so NRR is about 88% and gross retention about 81%. Seat expansion is small. It's the number we most want to improve."),
  D(5, "gross-margin", ["margin"], "What is your gross margin?", "How much of each dollar of revenue can pay for growth.", "92%.", "92% counting only hosting, SMS and card fees. Including customer support, as most SaaS investors do, it's 74% over the last 12 months."),
  D(6, "cac", ["cac"], "What does it cost you to win a customer, and how long to earn it back?", "Whether more sales and marketing money turns into profitable growth.", "$970, paid back in under 3 months.", "Fully loaded, about $3,200 per customer: $491,000 of sales and marketing salaries, commissions and programs over 153 new customers. A new customer brings about $458 of MRR, so payback is about 9 to 10 months on a margin that includes support."),
  D(7, "forecast-assumptions", ["churn", "growth"], "Your forecast assumes churn drops to 1% and a 20% price increase with no extra churn. Why?", "A forecast is only as credible as its weakest assumption; investors test the ones that move the result most.", "We're confident in the product.", "Fair challenge. Churn has been 2.0%, 1.6% recently, so 1% is a target, not a trend; we have a version at 2%. Annual customers can't be repriced until renewal and 59 are on the legacy $39 price, so we'd phase it in and expect some churn. Here's the plan if both go against us."),
  D(8, "ae-ramp", ["growth", "team", "burn"], "How fast do new account executives ramp, and how many deals will they close?", "The hiring plan only works if new reps produce. Ramp time is where most seed forecasts break.", "One month. The product is easy to demo.", "Our two reps took about three months to reach 4 or 5 new customers a month. The plan assumes one month; we're moving it to three and will show the revised numbers."),
  D(9, "concentration", ["concentration", "retention"], "How dependent are you on Northern Comfort Group?", "One customer can make a small company look bigger than it is, and a renewal can go either way.", "They're expanding to 600 seats next year.", "About 10% of MRR, renewing March 2027. Their COO wants every location on Tidewell, but nothing is signed, so the base plan keeps them at 260 seats and shows expansion as upside."),
  D(10, "runway", ["runway", "use-of-funds"], "Why $4M, and how long does it last?", "Whether the founders understand their burn and have planned for the next round.", "24 months of runway.", "On our plan, cash lasts to about November 2028, roughly 22 months after a January close. At the growth we've actually achieved it's closer to 17, so we'd raise again in late 2027. Here are the milestones and where we'd slow hiring."),
  D(11, "raise-slips", ["runway", "burn"], "What happens if the round takes longer than you expect?", "Founders who run out of money mid-raise lose their negotiating position.", "It won't. We have strong interest.", "We have $483K and burn about $58K a month, so about 8 months. Our plan raises marketing from October; if the round slipped to April, that plan runs out of cash in March. So we're holding spend at today's level until a term sheet is signed."),
  D(12, "tam", ["market"], "Your deck says $2B TAM. Where does that come from?", "A large unsourced number tells an investor the founder hasn't done the work.", "Industry reports.", "We haven't built it bottom-up yet, so we've taken it off the slide. Method: trades businesses with 3 to 30 technicians in Canada and the US, times seats, times price, sourced from Statistics Canada and the US Census Bureau."),
  D(13, "competition", ["market"], "Why will you win against Jobber, Housecall Pro and ServiceTitan?", "Whether the founder knows why customers choose them.", "Our product is better.", "We don't track win/loss in a system yet, which we're fixing. Here is what customers who switched told us. (The data pack has no competitor or win/loss data: help the founder find evidence, never invent it.)"),
  D(14, "milestones", ["use-of-funds", "growth", "runway"], "What will this round get you to, and what is the biggest risk?", "Investors fund a path to the next round, not a budget.", "Series A at $5M ARR.", "Our plan reaches about $5.1M ARR by March 2028. The Series A milestones are churn under a stated target, a repeatable rep ramp and Northern Comfort renewed. The biggest risk is growth staying near 5% while we triple the team; if churn or rep productivity miss for two quarters, we slow hiring."),
  D(15, "valuation", ["valuation"], "What valuation are you looking for?", "Whether expectations are realistic, and sometimes to anchor the negotiation.", "A number with no reasoning, or 'whatever the market says'.", "We'd like the lead to propose terms. Here are our metrics, the round size and the two SAFEs converting at this round with $10M and $15M caps. (Vicky explains how valuation, dilution and SAFE conversion work, but never recommends a valuation.)"),
];

export type PersonaId = "lead-seed" | "angel-operator" | "strategic" | "gov-fund" | "skeptic" | "yc" | "a16z";

export interface Persona {
  id: PersonaId;
  name: string;
  cheque: string;
  focus: Topic[];
  evaluates: string;
  saysNoWhen: string;
  style: string;
  questionIds: string[]; // Appendix D questions this investor asks first
  ownQuestions: string[]; // questions only this investor type asks
  basedOn?: { title: string; short: string; url: string }; // public writing the profile is drawn from
}

// The five investor archetypes from Supporting Resources, Appendix E. Not real firms or people.
export const PERSONAS: Record<PersonaId, Persona> = {
  "lead-seed": {
    id: "lead-seed", name: "Lead seed fund partner", cheque: "$1.5M to $3M, sets the terms",
    focus: ["growth", "retention", "burn", "cac", "runway"],
    evaluates: "MRR × 12 with no one-time fees; NRR and GRR by cohort; burn multiple; CAC payback on a margin that includes support; whether forecast drivers match history; runway to the next round.",
    saysNoWhen: "Inflated metrics, or a forecast they can't trace to history.",
    style: "Calm, precise, asks for the spreadsheet. Follows a number down two or three levels: how did you get 1%? Which months? Which customers?",
    questionIds: ["arr", "growth", "churn", "nrr", "cac", "forecast-assumptions", "runway"], ownQuestions: [],
  },
  "angel-operator": {
    id: "angel-operator", name: "Angel operator", cheque: "$25K to $150K",
    focus: ["team", "churn", "growth", "market"],
    evaluates: "Why these founders and how fast they learn; specific customers who love it or left; how a deal actually closes; whether the founders know their numbers without looking.",
    saysNoWhen: "Founders who can't explain their own numbers.",
    style: "Conversational and warm, but stops the meeting if a founder bluffs. Asks for a story, then the number behind it.",
    questionIds: ["churn", "ae-ramp", "competition"], ownQuestions: ["Tell me about the last customer who churned.", "Walk me through Priya's last deal."],
  },
  strategic: {
    id: "strategic", name: "Strategic investor", cheque: "$250K to $1M",
    focus: ["market", "concentration", "use-of-funds"],
    evaluates: "How Tidewell helps their own customers and channel; whether the referral channel could scale through them; what data Tidewell holds and who owns it; whether investing limits other partnerships.",
    saysNoWhen: "Conflicts with their partners, or unclear exclusivity.",
    style: "Friendly and long-term, slower to decide. May ask for rights the founders should think hard about, such as information rights or a right of first refusal.",
    questionIds: ["concentration", "competition", "milestones"], ownQuestions: ["How many of your customers buy from distributors like us?", "What would you need from us to grow the referral channel?"],
  },
  "gov-fund": {
    id: "gov-fund", name: "Government-backed fund", cheque: "Co-invests beside a private lead",
    focus: ["team", "runway", "use-of-funds"],
    evaluates: "A credible private lead; Canadian headquarters, jobs and IP; governance, board and financial controls; use of non-dilutive funding such as SR&ED.",
    saysNoWhen: "No private lead, weak governance, or IP held outside Canada.",
    style: "Thorough and process-driven. Asks for documents. Interested in the finance function, which Tidewell does not have yet.",
    questionIds: ["runway", "milestones"], ownQuestions: ["Who prepares your financial statements?", "How are the SR&ED claims prepared and recorded?", "Who will lead the round?"],
  },
  yc: {
    id: "yc", name: "Y Combinator partner", cheque: "Accelerator, then seed",
    focus: ["growth", "runway", "burn", "market"],
    evaluates: "Whether you can say what you do in one sentence, how fast you're growing, and whether you can reach profitability on the money you have.",
    saysNoWhen: "You can't explain the business simply, or a number moves when they ask a follow-up.",
    style: "Fast and direct. Short meetings. Wants the growth rate and the plain answer first, then stops you when you ramble.",
    questionIds: ["growth", "arr", "churn", "runway", "raise-slips", "milestones"], ownQuestions: ["What do you do, in one sentence?", "Are you default alive?"],
    basedOn: { title: "YC's published pitching and seed guides, and Paul Graham's Default Alive or Default Dead?", short: "YC", url: "https://www.ycombinator.com/library/4A-a-guide-to-seed-fundraising" },
  },
  a16z: {
    id: "a16z", name: "a16z partner", cheque: "Seed to Series A",
    focus: ["growth", "cac", "margin", "churn", "retention"],
    evaluates: "Metrics defined the standard way: ARR without one-time fees, CAC with every sales and marketing cost, gross margin with support, churn and retention by cohort.",
    saysNoWhen: "A metric is defined to flatter the company.",
    style: "Analytical. Asks how each number is defined before talking about whether it's good.",
    questionIds: ["arr", "gross-margin", "cac", "churn", "nrr", "forecast-assumptions"], ownQuestions: ["Is that bookings or revenue?", "Is your CAC blended or paid only?"],
    basedOn: { title: "Andreessen Horowitz, 16 Startup Metrics", short: "a16z", url: "https://a16z.com/16-startup-metrics/" },
  },
  skeptic: {
    id: "skeptic", name: "Skeptical partner", cheque: "None; votes in the partner meeting",
    focus: ["growth", "concentration", "churn", "market", "runway"],
    evaluates: "The one weakness that breaks the story: concentration, slowing growth, a forecast built on hope, a better-funded competitor.",
    saysNoWhen: "Any claim that falls apart under one follow-up question.",
    style: "Blunt. Interrupts. Asks 'so what?' after every answer.",
    questionIds: ["growth", "concentration", "forecast-assumptions", "competition"], ownQuestions: ["Growth went from 9% to 5% a month. Why shouldn't I assume it keeps falling?", "If Northern Comfort leaves, what does your growth look like?", "Why won't Jobber just copy this?"],
  },
};

// Public sources from Supporting Resources, Appendix F (links checked by the organisers on Oct 14 2026).
// Vicky links to these instead of quoting unsourced benchmarks.
// The organisers checked every link on Oct 14 2026.
export const RESOURCES_CHECKED = "Oct 2026";
export interface Resource { title: string; publisher: string; url: string; topics: Topic[] | "all" }
export const RESOURCES: Resource[] = [
  { title: "How to Pitch Your Startup", publisher: "Y Combinator", url: "https://www.ycombinator.com/library/6q-how-to-pitch-your-startup", topics: "all" },
  { title: "How to build your seed round pitch deck", publisher: "Y Combinator", url: "https://www.ycombinator.com/library/2u-how-to-build-your-seed-round-pitch-deck", topics: "all" },
  { title: "Writing a Business Plan", publisher: "Sequoia Capital", url: "https://www.sequoiacap.com/article/writing-a-business-plan/", topics: ["market"] },
  { title: "A guide to seed fundraising", publisher: "Y Combinator", url: "https://www.ycombinator.com/library/4A-a-guide-to-seed-fundraising", topics: ["use-of-funds", "valuation"] },
  { title: "How to Raise Money", publisher: "Paul Graham", url: "https://paulgraham.com/fr.html", topics: ["runway", "valuation"] },
  { title: "Default Alive or Default Dead?", publisher: "Paul Graham", url: "https://paulgraham.com/aord.html", topics: ["burn", "runway"] },
  { title: "16 Startup Metrics", publisher: "Andreessen Horowitz", url: "https://a16z.com/16-startup-metrics/", topics: ["growth", "cac", "churn", "retention"] },
  { title: "The Burn Multiple", publisher: "David Sacks", url: "https://sacks.substack.com/p/the-burn-multiple-51a7e43cb200", topics: ["burn"] },
  { title: "10 laws of cloud", publisher: "Bessemer Venture Partners", url: "https://www.bvp.com/atlas/10-laws-of-cloud", topics: ["growth", "retention", "margin"] },
  { title: "Five ways to build a $100 million business", publisher: "Christoph Janz", url: "https://christophjanz.blogspot.com/2014/10/five-ways-to-build-100-million-business.html", topics: ["market", "cac"] },
  { title: "The SAFE", publisher: "Y Combinator", url: "https://www.ycombinator.com/documents", topics: ["valuation"] },
  { title: "State of Private Markets: Q1 2026 (US data)", publisher: "Carta", url: "https://carta.com/data/state-of-private-markets-q1-2026/", topics: ["valuation"] },
  { title: "CVCA market reports", publisher: "CVCA", url: "https://www.cvca.ca/research-insight/market-reports/", topics: ["valuation"] },
  { title: "How to pitch your business to venture capital investors", publisher: "BDC", url: "https://www.bdc.ca/en/articles-tools/start-buy-business/start-business/how-pitch-your-business-venture-capital-investors", topics: "all" },
  { title: "BDC Seed Venture Fund", publisher: "BDC Capital", url: "https://www.bdc.ca/en/bdc-capital/venture-capital/funds/seed-fund", topics: ["team"] },
  { title: "SR&ED tax incentives", publisher: "Canada Revenue Agency", url: "https://www.canada.ca/en/revenue-agency/services/scientific-research-experimental-development-tax-incentive-program.html", topics: ["runway", "burn"] },
];

export function selectResources(topics: Iterable<Topic>, max = 6): Resource[] {
  const set = new Set(topics);
  return RESOURCES.filter((r) => r.topics === "all" || r.topics.some((t) => set.has(t))).slice(0, max);
}

export type Stage = "pre-seed" | "seed" | "series-a";

export interface StageProfile {
  id: Stage;
  label: string;
  focus: Topic[];
  wants: string;
}

export const STAGES: Record<Stage, StageProfile> = {
  "pre-seed": { id: "pre-seed", label: "Pre-seed", focus: ["team", "market", "growth"], wants: "Founders who understand the problem, early proof that customers want the product, and a clear plan for the first raise." },
  seed: { id: "seed", label: "Seed", focus: ["growth", "retention", "cac", "runway", "use-of-funds"], wants: "Real growth and retention, sensible unit economics, and a forecast that traces back to history and reaches Series A milestones." },
  "series-a": { id: "series-a", label: "Series A", focus: ["retention", "cac", "burn", "margin", "growth"], wants: "Efficient, repeatable growth: strong retention, CAC paid back within a year, and a burn multiple that holds up as spending rises." },
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
  readiness: ReadinessResult;
  flags: AssumptionFlag[];
  summary?: Summary; // from the what-if model, when one has been run
  stress?: StressResult[];
  numbers?: unknown; // company figures pre-computed in code, e.g. tidewell/analysis.ts
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
  [/runway|cash|sr&ed|refund|deferred/i, "runway"],
  [/use of funds|raise/i, "use-of-funds"],
  [/ramp|account executive|price/i, "growth"],
  [/northern comfort|concentration|one customer/i, "concentration"],
  [/expansion|seat/i, "retention"],
  [/\btam\b|market size/i, "market"],
];

export function flagTopics(flag: AssumptionFlag): Topic[] {
  const found = FLAG_KEYWORDS.filter(([re]) => re.test(flag.message)).map(([, t]) => t);
  return found.length ? [...new Set(found)] : ["runway"];
}

const gradeQuality = (g: AnswerGrade) => (g.evidence + g.clarity + g.accuracy + g.ownership) / 16;

// Topic priorities from this company's own analysis and the founder's history.
export function topicWeights(a: Analysis, history: PracticeRecord[] = [], persona?: PersonaId, stage?: Stage): Map<Topic, number> {
  const w = new Map<Topic, number>();
  const add = (t: Topic, n: number) => w.set(t, (w.get(t) ?? 0) + n);
  for (const f of a.flags) for (const t of flagTopics(f)) add(t, f.severity === "high" ? 3 : f.severity === "medium" ? 2 : 0.5);
  (a.stress ?? []).filter((s) => s.monthsLost > 0).slice(0, 2).forEach((s, i) => add(DRIVER_TOPIC[s.driver], 2 - i * 0.5));
  const runway = a.summary?.runwayMonths ?? null;
  if (runway !== null && runway < 18) add("runway", 2);
  for (const t of weakTopics(history)) add(t, 1.5);
  if (persona) for (const t of PERSONAS[persona].focus) add(t, 1);
  if (stage) for (const t of STAGES[stage].focus) add(t, 1);
  return w;
}

// Topics where the founder's average practice grade is below 60%.
export function weakTopics(history: PracticeRecord[]): Topic[] {
  const byTopic = new Map<Topic, number[]>();
  for (const r of history) byTopic.set(r.topic, [...(byTopic.get(r.topic) ?? []), gradeQuality(r.grade)]);
  return [...byTopic].filter(([, qs]) => qs.reduce((a, b) => a + b, 0) / qs.length < 0.6).map(([t]) => t);
}

// The questions that matter most for this company, skipping ones already answered well.
export function selectQuestions(a: Analysis, history: PracticeRecord[] = [], persona?: PersonaId, n = 5, stage?: Stage): Question[] {
  const w = topicWeights(a, history, persona, stage);
  const mastered = new Set(history.filter((r) => gradeQuality(r.grade) >= 0.75).map((r) => r.questionId));
  const preferred = persona ? PERSONAS[persona].questionIds : [];
  return QUESTIONS.filter((q) => !mastered.has(q.id))
    .map((q, i) => ({ q, i, score: q.topics.reduce((s, t) => s + (w.get(t) ?? 0), 0) + (preferred.includes(q.id) ? 3 : 0) }))
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
  "Answer first, in a sentence or two. Keep chat replies under 120 words unless the founder asks for more. No headings in chat, and no more than three bullets.",
  "Use only figures from COMPANY NUMBERS. Never calculate, estimate or invent a figure. If a number is missing, say so.",
  "After a figure, cite its short tag in square brackets, like $1,286,268 [P&L] or 2.0% churn [Pack D3]. Never write file names or full source titles.",
  "Say when a figure comes from the plan rather than the books, like \"the plan says 22 months [Plan]\".",
  "If you use an outside benchmark, give its short name, the month it was checked and its link once, like [SaaStr, Oct 2026](url). Benchmarks are context only: never use them to change the company's numbers.",
  "Never give a valuation, investment advice or a recommendation to invest. If asked, say so and explain what investors will look at instead.",
  "Coach like a calm, honest partner. Say plainly what is strong and what is weak, and give one concrete fix for each weakness. Don't flatter and don't alarm: confidence comes from knowing the numbers.",
];

export interface ContextInput {
  mode: "ask" | "simulate" | "report";
  persona?: PersonaId;
  stage?: Stage;
  workedExamples?: boolean; // false for uploaded companies: the pack's example answers are about Tidewell
  analysis: Analysis;
  history?: PracticeRecord[];
  lessons?: Lesson[];
}

export function buildSystemPrompt(c: ContextInput): string {
  const history = c.history ?? [];
  const weights = topicWeights(c.analysis, history, c.persona, c.stage);
  const topics = [...weights.keys()];
  const questions = selectQuestions(c.analysis, history, c.persona, 5, c.stage);
  const persona = c.persona ? PERSONAS[c.persona] : undefined;
  const weak = weakTopics(history);
  const recentNotes = history.filter((r) => weak.includes(r.topic)).slice(-3);
  const lessons = selectLessons(c.lessons ?? [], topics);

  const role =
    c.mode === "simulate" && persona
      ? `You are Vicky playing a ${persona.name} (${persona.cheque}), an investor in a mock fundraising meeting. You evaluate: ${persona.evaluates} You say no when: ${persona.saysNoWhen} ${persona.style}${persona.ownQuestions.length && c.workedExamples !== false ? ` Questions you like to ask: ${persona.ownQuestions.map((q) => `"${q}"`).join(" ")}` : ""} Ask ONE question at a time and keep each turn to one to three sentences, like a real meeting. Follow up when an answer is vague or a number does not match COMPANY NUMBERS. After 5 questions, give a scorecard on financial accuracy, clarity and preparedness, with one concrete tip per answer.`
      : c.mode === "report"
        ? "You are Vicky, an AI investor coach. Write a short meeting brief from COMPANY NUMBERS: one sentence on where the founder stands, the three things to fix before the meeting (each with its number and the fix), and two things that are genuinely strong. Under 200 words."
        : "You are Vicky, an AI investor coach. Answer the founder's questions about their own financials and how investors will see them.";

  const sections = [
    role,
    "RULES\n" + RULES.map((r, i) => `${i + 1}. ${r}`).join("\n"),
    ...(c.stage ? [`STAGE: ${STAGES[c.stage].label}. Investors at this stage want: ${STAGES[c.stage].wants}`] : []),
    ...(persona?.basedOn ? [`This investor profile is drawn from ${persona.basedOn.title} [${persona.basedOn.short}](${persona.basedOn.url}). You are not that firm; say so if asked.`] : []),
    "COMPANY NUMBERS (computed by tested code; the only figures you may use)\n" +
      JSON.stringify({ ...(c.analysis.numbers !== undefined ? { company: c.analysis.numbers } : {}), ...(c.analysis.summary ? { summary: c.analysis.summary } : {}), ...(c.analysis.stress ? { stressTest: c.analysis.stress } : {}), readiness: { score: c.analysis.readiness.score, band: c.analysis.readiness.band, coverage: c.analysis.readiness.coverage, components: c.analysis.readiness.components }, flags: c.analysis.flags.map((f) => ({ severity: f.severity, message: f.message, cite: f.source })) }, null, 1),
  ];

  const benchmarks = selectBenchmarks(topics);
  if (benchmarks.length) sections.push("BENCHMARKS (quote with source)\n" + benchmarks.map((b) => `- ${b.statement} [${b.source.short}, ${b.source.checked}](${b.source.url})`).join("\n"));

  if (questions.length) {
    sections.push(
      (c.mode === "simulate" ? "QUESTIONS TO ASK, in this order of priority" : "WHAT INVESTORS WILL PROBE FOR THIS COMPANY") + "\n" +
        questions.map((q) => c.workedExamples === false
          ? `- [${q.id}] ${q.genericQuestion ?? q.question}\n  Why they ask: ${q.testing}`
          : `- [${q.id}] ${q.question}\n  Why they ask: ${q.testing}${q.weakAnswer ? `\n  A weak answer: ${q.weakAnswer}` : ""}\n  A strong answer: ${q.strongAnswer}`).join("\n"),
    );
  }

  const resources = selectResources(topics);
  if (resources.length) sections.push("PUBLIC SOURCES (link to these; never cite an unsourced benchmark)\n" + resources.map((r) => `- ${r.title} [${r.publisher}, ${RESOURCES_CHECKED}](${r.url})`).join("\n"));

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
    `COMPANY NUMBERS: ${JSON.stringify(a.numbers ?? a.summary ?? {})}`,
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
