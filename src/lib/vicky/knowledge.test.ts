import { test } from "vitest";
import assert from "node:assert/strict";
import { stressTest, summarize, type Assumptions } from "./model.ts";
import { scoreReadiness, type AssumptionFlag } from "./readiness.ts";
import {
  BENCHMARKS, QUESTIONS, buildSystemPrompt, extractNumbers, factCheckAnswer, flagTopics, parseGrade,
  selectLessons, selectQuestions, weakTopics, type Analysis, type PracticeRecord,
} from "./knowledge.ts";

// Test fixture only, not demo data.
const plan: Assumptions = {
  startingCash: 600_000, startingMRR: 60_000, monthlyGrowth: 0.08, monthlyChurn: 0.015, grossMargin: 0.78,
  headcount: 12, costPerHead: 12_000, otherOpex: 40_000, hires: [{ month: 3, count: 4 }], raise: { amount: 4_000_000, month: 1 }, months: 36,
};
const flags: AssumptionFlag[] = [
  { id: "g1", severity: "high", message: "Forecast assumes 15% monthly revenue growth; last 6 months averaged 6%", source: "Forecast!C4" },
  { id: "h1", severity: "medium", message: "Hiring plan doubles headcount in 6 months", source: "Forecast!H2" },
];
const analysis: Analysis = {
  summary: summarize(plan),
  stress: stressTest(plan),
  flags,
  readiness: scoreReadiness({ data: { present: { revenueHistory: true }, historicalMonths: 6, flags, consistencyChecks: [], runwayMonthsAfterRaise: 20 } }),
};
const grade = (q: string, n: number) => ({ questionId: q, evidence: n, clarity: n, accuracy: n, ownership: n });

test("every benchmark has a source link and every question id is unique", () => {
  for (const b of BENCHMARKS) assert.match(b.source.url, /^https:\/\//);
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length);
});

test("flags map to topics by their wording", () => {
  assert.deepEqual(flagTopics(flags[0]!), ["growth"]);
  assert.deepEqual(flagTopics(flags[1]!), ["burn"]);
});

test("questions target this company's biggest risks first", () => {
  const qs = selectQuestions(analysis);
  assert.ok(qs[0]!.topics.includes("growth"), `first question ${qs[0]!.id}`);
  assert.ok(qs.some((q) => q.topics.includes("burn")));
});

test("questions answered well are not asked again; weak ones come back", () => {
  const history: PracticeRecord[] = [
    { questionId: "growth-basis", topic: "growth", grade: grade("growth-basis", 4), coachingNote: "", at: "2026-10-17" },
    { questionId: "hiring-plan", topic: "burn", grade: grade("hiring-plan", 1), coachingNote: "Tie each hire to a milestone.", at: "2026-10-17" },
  ];
  const ids = selectQuestions(analysis, history).map((q) => q.id);
  assert.ok(!ids.includes("growth-basis"));
  assert.ok(ids.includes("hiring-plan"));
  assert.deepEqual(weakTopics(history), ["burn"]);
});

test("the system prompt carries rules, numbers, sourced benchmarks, history and lessons", () => {
  const p = buildSystemPrompt({
    mode: "simulate", persona: "skeptic", analysis,
    history: [{ questionId: "hiring-plan", topic: "burn", grade: grade("hiring-plan", 1), coachingNote: "Tie each hire to a milestone.", at: "2026-10-17" }],
    lessons: [
      { id: "l1", topics: ["burn"], text: "Say 'net burn' not 'burn' when revenue is netted off.", at: "2026-10-17" },
      { id: "l2", topics: ["team"], text: "Unrelated lesson", at: "2026-10-17" },
    ],
  });
  assert.match(p, /Skeptical numbers partner/);
  assert.match(p, /Never calculate, estimate or invent a figure/);
  assert.match(p, /"runwayMonths"/);
  assert.match(p, /saastr\.com/);
  assert.match(p, /Tie each hire to a milestone/);
  assert.match(p, /net burn/);
  assert.doesNotMatch(p, /Unrelated lesson/);
  assert.match(p, /not an assessment of your business/);
});

test("lessons for all topics are always included, newest first", () => {
  const ls = selectLessons([
    { id: "a", topics: "all", text: "old", at: "2026-10-16" },
    { id: "b", topics: "all", text: "new", at: "2026-10-17" },
  ], []);
  assert.deepEqual(ls.map((l) => l.id), ["b", "a"]);
});

test("grades from the model are validated and clamped, junk is rejected", () => {
  const g = parseGrade('```json\n{"evidence":5,"clarity":3.4,"accuracy":-1,"ownership":2,"coachingNote":"Cite churn."}\n```', "q1", "g1")!;
  assert.deepEqual([g.grade.evidence, g.grade.clarity, g.grade.accuracy, g.grade.ownership], [4, 3, 0, 2]);
  assert.equal(g.grade.flagId, "g1");
  assert.equal(parseGrade("Sorry, I can't grade that.", "q1"), null);
  assert.equal(parseGrade('{"evidence":"high"}', "q1"), null);
});

test("numbers are pulled from speech-like text with units", () => {
  const n = extractNumbers("We burn about $182k a month, grow 15% and have 18 months of runway, raising $4M in 2026.");
  assert.deepEqual(n.map((x) => [x.value, x.unit]), [[182000, "usd"], [0.15, "pct"], [18, "months"], [4000000, "usd"]]);
});

test("fact-check pairs each metric with the number the founder said", () => {
  const checks = factCheckAnswer("Our monthly burn is $120k and runway is 14 months.", [
    { name: "monthly burn", value: 182000, unit: "usd", aliases: ["burn"] },
    { name: "runway", value: 14, unit: "months", aliases: ["runway"] },
    { name: "churn", value: 0.015, unit: "pct", aliases: ["churn"] },
  ]);
  assert.deepEqual(checks, [
    { metric: "monthly burn", stated: 120000, actual: 182000 },
    { metric: "runway", stated: 14, actual: 14 },
  ]);
});
