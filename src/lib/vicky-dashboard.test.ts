import { describe, it, expect } from "vitest";
import { dashboardCoach, cleanReplyText, CLARIFICATION } from "./vicky-dashboard";
import { analyzeTidewell } from "./vicky/tidewell/analysis";
import { meetingBrief } from "./vicky/tidewell/brief";
import { scenarioBase } from "./vicky/coach";
describe("Vicky coaching boundaries", () => {
  const analysis = analyzeTidewell(),
    brief = meetingBrief("lead-seed", "seed", [], analysis);
  it("uses the requested 4M Tidewell raise in the engine model", () =>
    expect(dashboardCoach(analysis, brief).scenarioBase?.raise).toBe(4000000));
  it("uses company raise and planned burn without falling back to sample funding", () =>
    expect(
      dashboardCoach(analysis, brief, {
        name: "Private company",
        raiseAmount: 900000,
        planMonthlySpendAfterRaise: 30000,
      }).scenarioBase,
    ).toEqual(scenarioBase(analysis.metrics, { raise: 900000, plannedBurn: 30000 })));
  it("removes links, sources and malformed tags before speech", () =>
    expect(cleanReplyText("MRR [P&L] [source](https://example.com) [[chart:mrr]] [[broken")).toBe(
      "MRR  source",
    ));
  it("keeps the requested hidden clarification exact", () =>
    expect(CLARIFICATION).toBe(
      "That didn't answer what I needed. Ask me one short question to understand what I'm after.",
    ));
});
