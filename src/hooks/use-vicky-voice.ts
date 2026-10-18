import { useEffect, useRef, useState } from "react";
import { cleanReplyText } from "@/lib/vicky-dashboard";
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e?: { error?: string }) => void) | null;
}

// How long a pause ends a spoken question. Chrome's own single-shot mode
// stops on the first short silence (or straight away in some frames), which
// made the mic look like it switched itself off.
const PAUSE_MS = 1800;

const VOICE_ERRORS: Record<string, string> = {
  "not-allowed":
    "Vicky can't use your microphone. Allow it in your browser's address bar, then try again.",
  "service-not-allowed":
    "Vicky can't use your microphone here. Open the app in its own tab and try again.",
  "audio-capture": "No microphone was found. Check that one is connected.",
  network: "Voice input needs an internet connection. Try again in a moment.",
};
export function useVickyVoice({
  onDraft,
  onSend,
}: {
  onDraft: (text: string) => void;
  onSend: (text: string) => void;
}) {
  const [supported, setSupported] = useState(false),
    [listening, setListening] = useState(false),
    [speaking, setSpeaking] = useState(false),
    [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null),
    heard = useRef(""),
    cancelled = useRef(false),
    pause = useRef<ReturnType<typeof setTimeout> | null>(null),
    callbacks = useRef({ onDraft, onSend });
  callbacks.current = { onDraft, onSend };
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      if (pause.current) clearTimeout(pause.current);
      cancelled.current = true;
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);
  function stop() {
    if (pause.current) clearTimeout(pause.current);
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    cancelled.current = true;
    recognition.current?.abort();
    setListening(false);
  }
  function dictate() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!C) return;
    const r = new C();
    recognition.current = r;
    heard.current = "";
    cancelled.current = false;
    setError("");
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      heard.current = Array.from(e.results)
        .map((result) => result[0].transcript)
        .join(" ");
      callbacks.current.onDraft(heard.current);
      // Send once the founder has paused, rather than on the first breath.
      if (pause.current) clearTimeout(pause.current);
      pause.current = setTimeout(() => r.stop(), PAUSE_MS);
    };
    r.onend = () => {
      if (pause.current) clearTimeout(pause.current);
      setListening(false);
      if (!cancelled.current && heard.current.trim())
        callbacks.current.onSend(heard.current.trim());
    };
    r.onerror = (e) => {
      // "no-speech" and "aborted" are normal endings, not something to report.
      const message = e?.error ? VOICE_ERRORS[e.error] : undefined;
      if (message) {
        cancelled.current = true;
        setError(message);
      }
      setListening(false);
    };
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Voice input couldn't start. Try again.");
      setListening(false);
    }
  }
  function speak(text: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanReplyText(text));
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }
  return { supported, listening, speaking, error, stop, dictate, speak };
}
