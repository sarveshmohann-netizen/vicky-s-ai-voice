import { describe, it, expect } from "vitest";
import {
  titleFromMessage,
  conversationGroup,
  lastAnswerPair,
  practiceSearchSchema,
  settingsSchema,
} from "./conversations";
describe("saved conversation rules", () => {
  it("uses the first six words of the first user message", () =>
    expect(titleFromMessage("  One two three four five six seven eight ")).toBe(
      "One two three four five six",
    ));
  it("groups chats into Today, Yesterday and Earlier", () => {
    const now = new Date(2026, 9, 18, 12);
    expect(conversationGroup(new Date(2026, 9, 18, 8).toISOString(), now)).toBe("Today");
    expect(conversationGroup(new Date(2026, 9, 17, 23).toISOString(), now)).toBe("Yesterday");
    expect(conversationGroup(new Date(2026, 9, 16, 23).toISOString(), now)).toBe("Earlier");
  });
  it("uses the investor question before the last founder answer, not the later assistant feedback", () => {
    const pair = lastAnswerPair([
      { id: "q", role: "assistant", content: "What is your runway?" },
      { id: "a", role: "user", content: "Nine months." },
      { id: "reply", role: "assistant", content: "What is churn?" },
    ]);
    expect(pair?.question.id).toBe("q");
    expect(pair?.answer.content).toBe("Nine months.");
  });
  it("cannot grade without an investor question and founder answer", () => {
    expect(lastAnswerPair([])).toBeNull();
    expect(lastAnswerPair([{ id: "a", role: "user", content: "Hello" }])).toBeNull();
  });
  it("permits only ask and simulate as persisted conversation modes", () => {
    expect(
      settingsSchema.safeParse({ mode: "question", persona: "lead-seed", stage: "seed" }).success,
    ).toBe(false);
    expect(settingsSchema.parse({ mode: "simulate", persona: "yc", stage: "pre-seed" }).mode).toBe(
      "simulate",
    );
  });
  it("keeps question launch IDs in the URL", () =>
    expect(
      practiceSearchSchema.parse({ question: "growth", persona: "yc", stage: "seed", mode: "ask" })
        .question,
    ).toBe("growth"));
});
