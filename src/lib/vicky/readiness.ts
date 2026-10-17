// Financial Readiness Score: how prepared a founder is to present and defend
// their financials to an investor. It measures preparation, never the quality
// of the business or whether anyone should invest in it.
//
// Pure, deterministic code: the language model supplies structured inputs
// (rubric grades, numbers a founder stated) and this module does all the math.
// Has no dependencies, so it runs anywhere: browser, server functions, Node.

export type Severity = "high" | "medium" | "low";

export type DataInput =
  | "revenueHistory"
  | "costBreakdown"
  | "cashBalance"
  | "forecastAssumptions"
  | "customerMetrics"
  | "acquisitionCosts"
  | "useOfFunds";

export interface AssumptionFlag {
  id: string;
  severity: Severity;
  message: string; // e.g. "Forecast assumes 15% monthly growth; last 6 months averaged 6%"
  source: string; // e.g. "Forecast!C4 vs Historical P&L Mar-Aug"
}

export interface ConsistencyCheck {
  id: string;
  passed: boolean;
  detail: string; // e.g. "Cash roll-forward ties for all 12 months"
}

export interface FactCheck {
  metric: string; // e.g. "monthly burn"
  stated: number; // number the founder said
  actual: number; // number from the calculation engine
}

// Each criterion is graded 0-4 by the coaching model against a fixed rubric.
export interface AnswerGrade {
  questionId: string;
  flagId?: string; // set when the question targets an assumption flag
  evidence: number; // cites their own data
  clarity: number; // plain, direct, no jargon dodging
  accuracy: number; // numbers and claims match the data
  ownership: number; // acknowledges the weakness and states a plan
}

export interface ReadinessInput {
  data: {
    present: Partial<Record<DataInput, boolean>>;
    historicalMonths: number;
    flags: AssumptionFlag[];
    consistencyChecks: ConsistencyCheck[];
    runwayMonthsAfterRaise: number | null; // from the calculation engine
  };
  practice?: {
    factChecks: FactCheck[];
    answers: AnswerGrade[];
  };
}

export interface Component {
  id: string;
  label: string;
  max: number;
  earned: number; // 0 when not assessed
  assessed: boolean;
  evidence: string[];
  nextSteps: string[];
}

export type Band = "Not ready" | "Getting there" | "Ready with gaps" | "Investor-ready";

export interface ReadinessResult {
  score: number; // 0-100 over the components assessed so far
  band: Band;
  coverage: number; // share of the 100 points assessed, 0-1
  components: Component[];
  topActions: string[];
  disclaimer: string;
}

// Tunable settings. Each is a judgement call, kept here so the team can see and change it.
export const CONFIG = {
  // Points per required input, summing to 20.
  inputWeights: {
    revenueHistory: 4,
    costBreakdown: 3,
    cashBalance: 3,
    forecastAssumptions: 3,
    customerMetrics: 3,
    acquisitionCosts: 2,
    useOfFunds: 2,
  } as Record<DataInput, number>,
  fullHistoryMonths: 12, // revenue history earns full points at 12+ months
  flagPenalty: { high: 6, medium: 3, low: 1 } as Record<Severity, number>,
  // Seed rounds are commonly planned to fund 18-24 months; below 12 is a red flag.
  targetRunwayMonths: 18,
  minRunwayMonths: 12,
  factTolerance: 0.05, // a stated number within 5% of the computed one counts as correct
  minFactChecks: 3, // fewer than this and fluency is not yet assessed
  investorReadyThreshold: 85,
};

const INPUT_LABELS: Record<DataInput, string> = {
  revenueHistory: "monthly revenue history",
  costBreakdown: "cost breakdown (COGS and operating expenses)",
  cashBalance: "current cash balance",
  forecastAssumptions: "forecast with stated assumptions",
  customerMetrics: "customer count and churn",
  acquisitionCosts: "sales and marketing spend with new customers won",
  useOfFunds: "use of funds for the raise",
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function dataCompleteness(input: ReadinessInput): Component {
  const { present, historicalMonths } = input.data;
  const evidence: string[] = [];
  const nextSteps: string[] = [];
  let earned = 0;
  for (const [key, weight] of Object.entries(CONFIG.inputWeights) as [DataInput, number][]) {
    if (!present[key]) {
      nextSteps.push(`Add your ${INPUT_LABELS[key]}; investors will ask for it.`);
      continue;
    }
    if (key === "revenueHistory" && historicalMonths < CONFIG.fullHistoryMonths) {
      const share = clamp(historicalMonths / CONFIG.fullHistoryMonths, 0, 1);
      earned += weight * share;
      evidence.push(`Revenue history covers ${historicalMonths} of ${CONFIG.fullHistoryMonths} months`);
      nextSteps.push("Extend revenue history to 12 months, or explain why it is shorter.");
      continue;
    }
    earned += weight;
    evidence.push(`Has ${INPUT_LABELS[key]}`);
  }
  return { id: "completeness", label: "Data completeness", max: 20, earned, assessed: true, evidence, nextSteps };
}

function forecastCredibility(input: ReadinessInput): Component {
  const { flags } = input.data;
  const penalty = flags.reduce((sum, f) => sum + CONFIG.flagPenalty[f.severity], 0);
  const order: Severity[] = ["high", "medium", "low"];
  const sorted = [...flags].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  return {
    id: "credibility",
    label: "Forecast credibility",
    max: 20,
    earned: clamp(20 - penalty, 0, 20),
    assessed: true,
    evidence: flags.length
      ? sorted.map((f) => `[${f.severity}] ${f.message} (${f.source})`)
      : ["Every forecast assumption is supported by historical performance"],
    nextSteps: sorted
      .filter((f) => f.severity !== "low")
      .map((f) => `Revise or justify: ${f.message}.`),
  };
}

function internalConsistency(input: ReadinessInput): Component {
  const checks = input.data.consistencyChecks;
  const base = { id: "consistency", label: "Internal consistency", max: 10 };
  if (!checks.length) {
    return { ...base, earned: 0, assessed: false, evidence: [], nextSteps: ["Run the consistency checks on your statements."] };
  }
  const failed = checks.filter((c) => !c.passed);
  return {
    ...base,
    earned: (10 * (checks.length - failed.length)) / checks.length,
    assessed: true,
    evidence: checks.map((c) => `${c.passed ? "Passed" : "Failed"}: ${c.detail}`),
    nextSteps: failed.map((c) => `Fix: ${c.detail}.`),
  };
}

function askFitsPlan(input: ReadinessInput): Component {
  const runway = input.data.runwayMonthsAfterRaise;
  const base = { id: "ask", label: "Raise matches the plan", max: 10, assessed: true };
  if (runway === null) {
    return { ...base, earned: 0, evidence: ["No runway can be computed for the raise"], nextSteps: ["Show how the raise is spent month by month so runway can be computed."] };
  }
  const { targetRunwayMonths: target, minRunwayMonths: min } = CONFIG;
  // Full points at the target, 5 at the minimum, scaling to 0 below it.
  const earned = runway >= target ? 10 : runway >= min ? 5 + (5 * (runway - min)) / (target - min) : (5 * runway) / min;
  return {
    ...base,
    earned,
    evidence: [`The raise funds about ${round1(runway)} months of runway under the forecast`],
    nextSteps: runway >= target ? [] : [`Explain how ${round1(runway)} months reaches your next milestone, or revisit the amount or the spend plan.`],
  };
}

function metricFluency(input: ReadinessInput): Component {
  const checks = input.practice?.factChecks ?? [];
  const base = { id: "fluency", label: "Knows the numbers", max: 15 };
  if (checks.length < CONFIG.minFactChecks) {
    return { ...base, earned: 0, assessed: false, evidence: [], nextSteps: ["Practise questions that ask you to state your key metrics."] };
  }
  const wrong = checks.filter((c) => !withinTolerance(c));
  return {
    ...base,
    earned: (15 * (checks.length - wrong.length)) / checks.length,
    assessed: true,
    evidence: [`Stated ${checks.length - wrong.length} of ${checks.length} metrics correctly`],
    nextSteps: wrong.map((c) => `You said ${c.metric} was ${c.stated}; your data shows ${c.actual}.`),
  };
}

export function withinTolerance(c: FactCheck): boolean {
  if (c.actual === 0) return c.stated === 0;
  return Math.abs(c.stated - c.actual) / Math.abs(c.actual) <= CONFIG.factTolerance;
}

function assumptionDefense(input: ReadinessInput): Component {
  const base = { id: "defense", label: "Defends the assumptions", max: 15 };
  const flagged = input.data.flags.filter((f) => f.severity !== "low");
  const answers = (input.practice?.answers ?? []).filter((a) => a.flagId);
  if (!flagged.length) {
    return { ...base, earned: 15, assessed: true, evidence: ["No medium or high flags to defend"], nextSteps: [] };
  }
  if (!answers.length) {
    return { ...base, earned: 0, assessed: false, evidence: [], nextSteps: ["Practise the questions about your flagged assumptions."] };
  }
  // Best attempt per flag, so practice that improves an answer raises the score.
  const best = new Map<string, number>();
  for (const a of answers) {
    const q = (a.evidence + a.clarity + a.accuracy) / 12;
    best.set(a.flagId!, Math.max(best.get(a.flagId!) ?? 0, q));
  }
  const quality = flagged.map((f) => best.get(f.id) ?? 0);
  const unanswered = flagged.filter((f) => !best.has(f.id));
  return {
    ...base,
    earned: 15 * mean(quality),
    assessed: true,
    evidence: [`Answered ${flagged.length - unanswered.length} of ${flagged.length} flagged-assumption questions; average quality ${Math.round(100 * mean([...best.values()]))}%`],
    nextSteps: [
      ...unanswered.map((f) => `Prepare an answer for: ${f.message}.`),
      ...flagged.filter((f) => (best.get(f.id) ?? 1) < 0.75).map((f) => `Strengthen your answer on: ${f.message}. Cite your own numbers.`),
    ],
  };
}

function gapAwareness(input: ReadinessInput): Component {
  const answers = input.practice?.answers ?? [];
  const base = { id: "awareness", label: "Owns the weaknesses", max: 10 };
  if (!answers.length) {
    return { ...base, earned: 0, assessed: false, evidence: [], nextSteps: ["Run a practice session so Vicky can assess this."] };
  }
  const avg = mean(answers.map((a) => a.ownership)) / 4;
  return {
    ...base,
    earned: 10 * avg,
    assessed: true,
    evidence: [`Acknowledged weaknesses with a plan in ${Math.round(100 * avg)}% of graded answers`],
    nextSteps: avg < 0.75 ? ["When a number is weak, say so, explain why, and give the plan to fix it."] : [],
  };
}

export function scoreReadiness(input: ReadinessInput): ReadinessResult {
  const components = [
    dataCompleteness(input),
    forecastCredibility(input),
    internalConsistency(input),
    askFitsPlan(input),
    metricFluency(input),
    assumptionDefense(input),
    gapAwareness(input),
  ].map((c) => ({ ...c, earned: round1(c.earned) }));

  const assessed = components.filter((c) => c.assessed);
  const possible = assessed.reduce((s, c) => s + c.max, 0);
  const earned = assessed.reduce((s, c) => s + c.earned, 0);
  const coverage = possible / 100;
  const score = possible ? Math.round((100 * earned) / possible) : 0;

  // Investor-ready requires every component assessed, so a founder cannot reach
  // the top band without practising.
  const band: Band =
    score >= CONFIG.investorReadyThreshold && coverage === 1 ? "Investor-ready"
    : score >= 70 ? "Ready with gaps"
    : score >= 50 ? "Getting there"
    : "Not ready";

  // Biggest point gaps first: that is where practice pays off most.
  const topActions = [...components]
    .sort((a, b) => b.max - b.earned - (a.max - a.earned))
    .flatMap((c) => c.nextSteps.slice(0, 1))
    .slice(0, 3);

  return {
    score,
    band,
    coverage,
    components,
    topActions,
    disclaimer:
      "This score measures how prepared you are to present and defend your financials. It is not an assessment of your business, a valuation, or investment advice.",
  };
}
