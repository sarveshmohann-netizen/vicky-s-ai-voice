import { test } from "vitest";
import assert from "node:assert/strict";
import { project, summarize, whatIf, stressTest, type Assumptions } from "./model.ts";

// No revenue, 10 people at $10k: burn is exactly $100k a month.
const flat: Assumptions = {
  startingCash: 1_200_000, startingMRR: 0, monthlyGrowth: 0, monthlyChurn: 0, grossMargin: 0.8,
  headcount: 10, costPerHead: 10_000, otherOpex: 0, hires: [], months: 36,
};

// A growing SaaS company raising $4M, in the spirit of the sample use case.
const saas: Assumptions = {
  startingCash: 600_000, startingMRR: 60_000, monthlyGrowth: 0.08, monthlyChurn: 0.015, grossMargin: 0.78,
  headcount: 12, costPerHead: 12_000, otherOpex: 40_000,
  hires: [{ month: 3, count: 4 }, { month: 6, count: 4 }], raise: { amount: 4_000_000, month: 1 }, months: 36,
};

test("flat burn: runway is cash divided by burn", () => {
  assert.equal(summarize(flat).runwayMonths, 12);
  assert.equal(summarize(flat).peakBurn, 100_000);
});

test("runway interpolates inside the month cash runs out", () => {
  assert.equal(summarize({ ...flat, startingCash: 1_250_000 }).runwayMonths, 12.5);
});

test("a raise extends runway by amount over burn", () => {
  assert.equal(summarize({ ...flat, raise: { amount: 600_000, month: 1 } }).runwayMonths, 18);
});

test("cash never running out within the horizon reports null, not a made-up number", () => {
  assert.equal(summarize({ ...flat, startingCash: 10_000_000 }).runwayMonths, null);
});

test("revenue compounds net of churn", () => {
  const rows = project({ ...flat, startingMRR: 100_000, monthlyGrowth: 0.1, monthlyChurn: 0.02, months: 2 });
  assert.equal(Math.round(rows[1]!.revenue), Math.round(100_000 * 1.08 * 1.08));
});

test("what-if: hiring 5 engineers in month 1 cuts runway from 12 to 8 months", () => {
  const r = whatIf(flat, { label: "Hire 5 engineers now", changes: {}, addHires: [{ month: 1, count: 5 }] });
  assert.equal(r.before.runwayMonths, 12);
  assert.equal(r.after.runwayMonths, 8);
  assert.equal(r.runwayChange, -4);
});

test("what-if does not mutate the base plan", () => {
  whatIf(flat, { label: "x", changes: { costPerHead: 20_000 }, addHires: [{ month: 1, count: 3 }] });
  assert.equal(flat.hires.length, 0);
  assert.equal(flat.costPerHead, 10_000);
});

test("stress test ranks drivers by months of runway lost", () => {
  const results = stressTest(saas);
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1]!.monthsLost >= results[i]!.monthsLost);
  }
  for (const r of results) assert.ok(r.monthsLost >= 0, `${r.label} should not gain runway when worse`);
});

test("breaking point is where runway crosses the target", () => {
  const base = summarize(saas).runwayMonths;
  assert.ok(base === null || base >= 18, `base runway ${base}`);
  const cost = stressTest(saas).find((r) => r.driver === "costPerHead")!;
  assert.ok(cost.breakingPoint, "cost per head should have a breaking point");
  const at = summarize({ ...saas, costPerHead: cost.breakingPoint!.value * 1.001 }).runwayMonths!;
  assert.ok(at < 18 && at > 17.5, `runway at breaking point ${at}`);
});

test("a plan already under the target breaks at zero slip", () => {
  const r = stressTest(flat, 0.2, 18).find((x) => x.driver === "costPerHead")!;
  assert.equal(r.breakingPoint!.slip, 0);
});
