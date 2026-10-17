import { test } from "vitest";
import assert from "node:assert/strict";
import { buildSystemPrompt, factCheckAnswer } from "../knowledge.ts";
import { analyzeTidewell, knownMetrics, toKnowledgeAnalysis } from "./analysis.ts";
import { auditAssumptions, auditFlags } from "./audit.ts";
import { checkDeckClaims } from "./claims.ts";
import { INCOME_STATEMENT } from "./incomeStatement.ts";
import { checkIncomeStatement, computeMetrics } from "./metrics.ts";

// Expected values are the figures the organisers publish in Supporting
// Resources, Appendices D, H and I, computed from the same CSV.
const m = computeMetrics();
const near = (actual: number, expected: number, tol: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: ${actual} vs ${expected}`);

test("the income statement covers Oct 2024 to Sep 2026 and every subtotal ties", () => {
  assert.equal(INCOME_STATEMENT.length, 24);
  assert.equal(INCOME_STATEMENT[0]!.month, "2024-10");
  assert.equal(INCOME_STATEMENT.at(-1)!.month, "2026-09");
  for (const c of checkIncomeStatement()) assert.ok(c.passed, c.detail);
});

test("revenue metrics match the pack", () => {
  assert.equal(m["mrr"]!.value, 107_189);
  assert.equal(m["arr"]!.value, 1_286_268);
  assert.equal(m["arrIncludingOnboarding"]!.value, 1_372_668);
  assert.equal(m["onboardingL12M"]!.value, 108_600);
  near(m["growth12m"]!.value, 0.09, 0.002, "12-month growth");
  near(m["growth3m"]!.value, 0.049, 0.002, "3-month growth");
});

test("margin, CAC, burn and runway match the pack", () => {
  near(m["grossMarginBooked"]!.value, 0.917, 0.002, "gross margin as booked");
  near(m["grossMarginWithSupport"]!.value, 0.743, 0.002, "gross margin with support");
  assert.equal(m["newCustomersL12M"]!.value, 153);
  near(m["cacFullyLoaded"]!.value, 3_209, 5, "fully loaded CAC");
  near(m["cacProgramsOnly"]!.value, 969, 5, "programs-only CAC");
  near(m["cacPaybackMonths"]!.value, 9.5, 0.6, "CAC payback");
  near(m["monthlyBurn"]!.value, 58_421, 1, "monthly burn");
  near(m["runwayToday"]!.value, 8.3, 0.05, "runway today");
  assert.equal(m["netBurnL12M"]!.value, 513_730);
  assert.equal(m["netNewArr"]!.value, 830_076);
  near(m["burnMultiple"]!.value, 0.62, 0.01, "burn multiple");
  near(m["burnMultipleExSrred"]!.value, 0.84, 0.01, "burn multiple without SR&ED");
});

test("every metric names its basis, source and calculation", () => {
  for (const x of Object.values(m)) {
    assert.ok(x.source.length > 0 && x.calculation.length > 0, x.id);
    assert.ok(Number.isFinite(x.value), x.id);
  }
});

test("deck claims get the same verdicts as the organisers' example", () => {
  const status = Object.fromEntries(checkDeckClaims(m).map((c) => [c.id, c.status]));
  assert.deepEqual(status, {
    arr: "Fix", growth: "Reword", "gross-margin": "Fix", churn: "Fix", nrr: "Fix", cac: "Fix",
    tam: "Remove or source", ncg: "Show as upside", runway: "Reword",
  });
});

test("the audit flags the five riskiest assumptions as high and passes the supported ones", () => {
  const audit = auditAssumptions();
  const high = audit.filter((a) => a.verdict === "high").map((a) => a.id).sort();
  assert.deepEqual(high, ["ae-ramp", "churn", "expansion", "ncg-renewal", "price-existing"]);
  const supported = audit.filter((a) => a.verdict === "supported").map((a) => a.id).sort();
  assert.deepEqual(supported, ["ae-productivity", "seats-per-customer"]);
  const flags = auditFlags(audit);
  assert.equal(flags[0]!.severity, "high");
  assert.ok(flags.every((f) => f.source.length > 0));
});

test("readiness before any practice is below 'ready with gaps', with a disclaimer", () => {
  const a = analyzeTidewell();
  assert.equal(a.readiness.band, "Getting there");
  assert.equal(a.readiness.components.find((c) => c.id === "credibility")!.earned, 0);
  assert.match(a.readiness.disclaimer, /not an assessment of your business/);
  assert.ok(a.readiness.coverage < 1);
});

test("the prompt carries Tidewell's numbers, claim verdicts and data gaps", () => {
  const a = analyzeTidewell();
  const p = buildSystemPrompt({ mode: "simulate", persona: "lead-seed", analysis: toKnowledgeAnalysis(a) });
  assert.match(p, /Tidewell Systems/);
  assert.match(p, /\$1,286,268/);
  assert.match(p, /Remove or source/);
  assert.match(p, /No sales pipeline/);
  assert.match(p, /Lead seed fund partner/);
});

test("a founder quoting the deck's numbers gets caught", () => {
  const checks = factCheckAnswer("Our ARR is $1.37M and churn is around 1%.", knownMetrics(analyzeTidewell()));
  assert.deepEqual(checks.map((c) => c.metric), ["ARR", "monthly churn"]);
  assert.equal(checks[0]!.stated, 1_370_000);
  assert.equal(checks[0]!.actual, 1_286_268);
});
