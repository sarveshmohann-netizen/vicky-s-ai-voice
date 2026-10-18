import { describe, expect, it } from "vitest";
import { extractCitations } from "./reply-citations";

describe("reply citations", () => {
  it("moves tags and benchmark links out of the sentence and lists them once", () => {
    const r = extractCitations(
      "Your ARR is $1,286,268 [P&L], and churn is 2.0% a month [Pack D3]. Series A investors want 7% to 15% a month [SaaStr, Oct 2026](https://www.saastr.com/x). ARR again [P&L].\n[[chart:mrr]]",
    );
    expect(r.body).toBe(
      "Your ARR is $1,286,268, and churn is 2.0% a month. Series A investors want 7% to 15% a month. ARR again.\n[[chart:mrr]]",
    );
    expect(r.sources).toEqual(["P&L", "Pack D3"]);
    expect(r.links).toEqual([{ label: "SaaStr, Oct 2026", url: "https://www.saastr.com/x" }]);
  });
  it("keeps the words of a link written into the sentence, and unknown brackets", () => {
    const r = extractCitations(
      "Read [YC's seed guide](https://www.ycombinator.com/library/x) and note [unknown] [P&L; You].",
    );
    expect(r.body).toBe("Read YC's seed guide and note [unknown].");
    expect(r.sources).toEqual(["P&L", "You"]);
    expect(r.links[0]?.label).toBe("YC's seed guide");
  });
  it("leaves scenario tags for the model card", () => {
    expect(extractCitations("If you hit 8% [[scenario growth=8%]]").body).toBe(
      "If you hit 8% [[scenario growth=8%]]",
    );
  });
});
