import { afterEach, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVickyVoice } from "./use-vicky-voice";
class FakeRecognition {
  static latest: FakeRecognition;
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((e: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null =
    null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeRecognition.latest = this;
  }
  start = vi.fn();
  stop = () => this.onend?.();
  abort = () => this.onend?.();
}
afterEach(() => vi.unstubAllGlobals());
it("dictates live text and sends once speech ends", () => {
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  const onDraft = vi.fn(),
    onSend = vi.fn();
  const hook = renderHook(() => useVickyVoice({ onDraft, onSend }));
  expect(hook.result.current.supported).toBe(true);
  act(() => hook.result.current.dictate());
  act(() =>
    FakeRecognition.latest.onresult?.({
      results: [{ isFinal: true, 0: { transcript: "Explain my runway" } }],
    }),
  );
  expect(onDraft).toHaveBeenCalledWith("Explain my runway");
  expect(onSend).not.toHaveBeenCalled();
  act(() => FakeRecognition.latest.onend?.());
  expect(onSend).toHaveBeenCalledWith("Explain my runway");
  hook.unmount();
});
it("Stop cancels dictation without sending", () => {
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  const onSend = vi.fn();
  const hook = renderHook(() => useVickyVoice({ onDraft: vi.fn(), onSend }));
  act(() => hook.result.current.dictate());
  act(() =>
    FakeRecognition.latest.onresult?.({
      results: [{ isFinal: false, 0: { transcript: "Do not send" } }],
    }),
  );
  act(() => hook.result.current.stop());
  expect(onSend).not.toHaveBeenCalled();
  expect(hook.result.current.listening).toBe(false);
  hook.unmount();
});
it("reads cleaned replies and clears speaking when finished", () => {
  class Utterance {
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }
  let spoken: Utterance | undefined;
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("speechSynthesis", {
    cancel: vi.fn(),
    speak: (u: Utterance) => {
      spoken = u;
      u.onstart?.();
    },
  });
  const hook = renderHook(() => useVickyVoice({ onDraft: vi.fn(), onSend: vi.fn() }));
  act(() => hook.result.current.speak("Your MRR [P&L] [[chart:mrr]]"));
  expect(spoken?.text).toBe("Your MRR");
  expect(hook.result.current.speaking).toBe(true);
  act(() => spoken?.onend?.());
  expect(hook.result.current.speaking).toBe(false);
  hook.unmount();
});
