import { test } from "vitest";
import assert from "node:assert/strict";
import { availableCharts, chatSuggestions, describeScenario, parseReply, prepPlan, runScenario, scenarioBase } from "./coach.ts";
import { glossary, glossaryMatchers } from "./glossary.ts";
import { buildSystemPrompt, RESOURCES } from "./knowledge.ts";
import { investorLens } from "./lens.ts";
import { analyzeTidewell, toKnowledgeAnalysis } from "./tidewell/analysis.ts";

const t = analyzeTidewell();
const charts = availableCharts(t.charts);

test("the what-if model starts from today's burn and cash", () => {
  const base = scenarioBase(t.metrics)!;
  const burn = base.monthlySpend - base.startMrr * base.grossMargin;
  assert.ok(Math.abs(burn - t.metrics["monthlyBurn"]!.value) < 1e-6);
  // Flat revenue, no raise: the cash should run out in the month runway predicts.
  const flat = runScenario({ ...base, monthlyGrowth: 0, raise: 0, months: 24 });
  assert.equal(flat.runwayMonths, Math.ceil(t.metrics["runwayToday"]!.value));
  // A raise and faster growth both buy time.
  const raised = runScenario({ ...base, raise: 4_000_000 });
  assert.ok(raised.runwayMonths === null || raised.runwayMonths > flat.runwayMonths!);
  const planned = scenarioBase(t.metrics, { plannedBurn: 250_000 })!;
  assert.ok(Math.abs(planned.monthlySpend - planned.startMrr * planned.grossMargin - 250_000) < 1e-6);
  assert.match(describeScenario(raised), /^At \d+\.\d% a month growth and \$[\d,]+ of spending a month, MRR reaches \$[\d,]+/);
});

test("the prep plan leads with what's below this investor's bar", () => {
  const a16z = prepPlan(investorLens(t.metrics, "a16z", "series-a"), charts);
  assert.equal(a16z.length, 3);
  assert.equal(a16z[0]!.status, "below");
  assert.ok(a16z.every((p) => p.steps.length >= 2));
  assert.ok(a16z.some((p) => p.chart === "mrr"), "growth comes with the MRR chart");
  assert.match(a16z.find((p) => p.bar)!.bar!, /\[SaaStr, Oct 2026\]\(https:/);
  // Pre-seed has no published bars, so the plan explains what this investor reads first.
  const angel = prepPlan(investorLens(t.metrics, "angel-operator", "pre-seed"), charts);
  assert.ok(angel.length > 0 && angel.every((p) => p.bar === null));
  assert.equal(new Set(chatSuggestions(a16z)).size, 3);
});

test("chart and scenario tags in a reply", () => {
  const seg = parseReply("Growth is 6.3% a month [P&L].\n[[chart:mrr]]\nIf you hit 8%:\n[[scenario growth=8% spend=$250k raise=4m months=24]] [[chart:pie]] [[scenario growth=300%]]");
  assert.deepEqual(seg.map((s) => s.type), ["text", "chart", "text", "scenario", "scenario"]);
  assert.deepEqual(seg[3], { type: "scenario", changes: { monthlyGrowth: 0.08, monthlySpend: 250_000, raise: 4_000_000, months: 24 } });
  assert.deepEqual(seg[4], { type: "scenario", changes: {} }, "an impossible growth rate is dropped");
});

test("learn shows the founder's own number and only listed sources", () => {
  const g = glossary(t.metrics);
  assert.equal(g.find((e) => e.id === "arr")!.yourNumber, "$1,286,268");
  assert.equal(g.find((e) => e.id === "safe")!.yourNumber, null);
  const urls = new Set(RESOURCES.map((r) => r.url));
  assert.ok(g.every((e) => !e.source || urls.has(e.source.url)));
  assert.ok(glossaryMatchers().find((m) => m.id === "nrr")!.pattern.test("Your NRR is 88%"));
});

test("ask mode tells the AI which charts and model it can show", () => {
  const lens = investorLens(t.metrics, "a16z", "series-a");
  const coach = { charts, plan: prepPlan(lens, charts), scenarioBase: scenarioBase(t.metrics, { raise: 4_000_000 }) };
  const ask = buildSystemPrompt({ mode: "ask", persona: "a16z", stage: "series-a", analysis: toKnowledgeAnalysis(t), coach });
  assert.match(ask, /\[\[chart:mrr\]\] Plan vs your actual pace/);
  assert.match(ask, /SCENARIO BASE[\s\S]*raise \$4,000,000/);
  assert.match(ask, /PREP PLAN/);
  const sim = buildSystemPrompt({ mode: "simulate", persona: "a16z", stage: "series-a", analysis: toKnowledgeAnalysis(t), coach });
  assert.doesNotMatch(sim, /\[\[chart:/);
});
