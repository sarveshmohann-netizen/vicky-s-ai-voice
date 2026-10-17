import { test } from "vitest";
import assert from "node:assert/strict";
import { scoreReadiness, withinTolerance, type ReadinessInput } from "./readiness.ts";

const allPresent = {
  revenueHistory: true, costBreakdown: true, cashBalance: true, forecastAssumptions: true,
  customerMetrics: true, acquisitionCosts: true, useOfFunds: true,
};

const growthFlag = { id: "g1", severity: "high" as const, message: "Forecast assumes 15% monthly growth; last 6 months averaged 6%", source: "Forecast!C4" };

const unprepared: ReadinessInput = {
  data: {
    present: { revenueHistory: true, cashBalance: true },
    historicalMonths: 6,
    flags: [growthFlag, { id: "m1", severity: "medium", message: "Hiring plan doubles headcount with no ramp", source: "Forecast!H2" }],
    consistencyChecks: [{ id: "c1", passed: false, detail: "Cash roll-forward is off by $42,000 in June" }],
    runwayMonthsAfterRaise: 10,
  },
};

test("data only: practice components are not assessed and the score is over what was assessed", () => {
  const r = scoreReadiness(unprepared);
  assert.equal(r.coverage, 0.6);
  for (const id of ["fluency", "defense", "awareness"]) {
    assert.equal(r.components.find((c) => c.id === id)!.assessed, false);
  }
  // completeness 2 + 3 = 5, credibility 20 - 9 = 11, consistency 0, ask 5*10/12 = 4.2 -> 20.2 / 60
  assert.equal(r.score, 34);
  assert.equal(r.band, "Not ready");
  assert.equal(r.topActions.length, 3);
});

test("strong data and practice reaches Investor-ready", () => {
  const r = scoreReadiness({
    data: { present: allPresent, historicalMonths: 18, flags: [], consistencyChecks: [{ id: "c1", passed: true, detail: "Ties" }], runwayMonthsAfterRaise: 22 },
    practice: {
      factChecks: [
        { metric: "burn", stated: 180000, actual: 182000 },
        { metric: "runway", stated: 22, actual: 22 },
        { metric: "MRR", stated: 95000, actual: 94000 },
      ],
      answers: [{ questionId: "q1", evidence: 4, clarity: 4, accuracy: 4, ownership: 4 }],
    },
  });
  assert.equal(r.score, 100);
  assert.equal(r.coverage, 1);
  assert.equal(r.band, "Investor-ready");
});

test("a high score without practice cannot be Investor-ready", () => {
  const r = scoreReadiness({
    data: { present: allPresent, historicalMonths: 12, flags: [], consistencyChecks: [{ id: "c1", passed: true, detail: "Ties" }], runwayMonthsAfterRaise: 24 },
  });
  assert.equal(r.score, 100);
  assert.equal(r.band, "Ready with gaps");
});

test("practice that improves an answer raises the score (best attempt counts)", () => {
  const base: ReadinessInput = {
    data: { ...unprepared.data, flags: [growthFlag] },
    practice: { factChecks: [], answers: [{ questionId: "q1", flagId: "g1", evidence: 1, clarity: 2, accuracy: 1, ownership: 1 }] },
  };
  const first = scoreReadiness(base);
  const second = scoreReadiness({
    ...base,
    practice: { factChecks: [], answers: [...base.practice!.answers, { questionId: "q1", flagId: "g1", evidence: 4, clarity: 4, accuracy: 3, ownership: 4 }] },
  });
  assert.ok(second.score > first.score, `${second.score} > ${first.score}`);
});

test("wrong stated numbers lower fluency and say what the data shows", () => {
  const r = scoreReadiness({
    ...unprepared,
    practice: {
      factChecks: [
        { metric: "monthly burn", stated: 120000, actual: 182000 },
        { metric: "runway", stated: 14, actual: 14 },
        { metric: "MRR", stated: 94000, actual: 94000 },
      ],
      answers: [],
    },
  });
  const fluency = r.components.find((c) => c.id === "fluency")!;
  assert.equal(fluency.earned, 10);
  assert.match(fluency.nextSteps[0]!, /your data shows 182000/);
});

test("missing runway gets zero and a clear next step, never an invented number", () => {
  const r = scoreReadiness({ data: { ...unprepared.data, runwayMonthsAfterRaise: null } });
  const ask = r.components.find((c) => c.id === "ask")!;
  assert.equal(ask.earned, 0);
  assert.match(ask.nextSteps[0]!, /how the raise is spent/);
});

test("tolerance is 5% of the computed value", () => {
  assert.equal(withinTolerance({ metric: "x", stated: 105, actual: 100 }), true);
  assert.equal(withinTolerance({ metric: "x", stated: 106, actual: 100 }), false);
  assert.equal(withinTolerance({ metric: "x", stated: 0, actual: 0 }), true);
});

test("every result carries the not-investment-advice disclaimer", () => {
  assert.match(scoreReadiness(unprepared).disclaimer, /not an assessment of your business/);
});
