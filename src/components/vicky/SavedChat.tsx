import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Check,
  Pencil,
  RotateCcw,
  ArrowUp,
  ClipboardCheck,
  Mic,
  Info,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import {
  Conversation as Transcript,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { VickyAvatar } from "./VickyAvatar";
import { ReplyContent } from "./ReplyContent";
import { useVickyVoice } from "@/hooks/use-vicky-voice";
import { chatSuggestions } from "@/lib/vicky/coach";
import { CLARIFICATION } from "@/lib/vicky-dashboard";
import type { useVickyDashboard } from "@/hooks/use-vicky-dashboard";
import type { practiceSearchSchema } from "@/lib/conversations";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { startVickyChat } from "@/lib/vicky-chat";
import { vickyGrade } from "@/lib/vicky.functions";
import { saveFeedback, loadConversation } from "@/lib/conversations.functions";
import {
  GRADE_PREFIX,
  isGradeMessage,
  lastAnswerPair,
  type Conversation,
  type SavedMessage,
} from "@/lib/conversations";
import { z } from "zod";

const gradeSchema = z.object({
  grade: z.object({
    evidence: z.number(),
    clarity: z.number(),
    accuracy: z.number(),
    ownership: z.number(),
  }),
  coachingNote: z.string(),
});
function GradeCard({ content }: { content: string }) {
  const parsed = gradeSchema.safeParse(JSON.parse(content.slice(GRADE_PREFIX.length)));
  if (!parsed.success) return null;
  return (
    <article className="max-w-lg rounded-lg border border-border bg-section p-4">
      <h3 className="mb-3 text-sm font-semibold">Answer scorecard</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(parsed.data.grade).map(([key, value]) => (
          <div key={key}>
            <p className="text-xs capitalize text-muted-foreground">{key}</p>
            <p className="text-lg font-semibold">
              {value}
              <span className="text-xs text-muted-foreground">/4</span>
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed">{parsed.data.coachingNote}</p>
    </article>
  );
}
export function SavedChat({
  conversation,
  initialMessages,
  launch,
  onBusy,
  voice = false,
  onSpeaking,
  dashboard,
  coach,
  choice,
}: {
  voice?: boolean;
  onSpeaking: (value: boolean) => void;
  dashboard: ReturnType<typeof useVickyDashboard>["data"];
  coach: ReturnType<typeof useVickyDashboard>["coach"];
  choice: z.infer<typeof practiceSearchSchema>;
  conversation: Conversation;
  initialMessages: SavedMessage[];
  launch?: string | undefined;
  onBusy: (busy: boolean) => void;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<{ id: string; content: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const launched = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const cache = useQueryClient();
  const speech = useVickyVoice({ onDraft: setDraft, onSend: (text) => void run("send", text) });
  useEffect(() => {
    onSpeaking(speech.speaking);
    return () => onSpeaking(false);
  }, [speech.speaking, onSpeaking]);
  useEffect(() => {
    if (!voice) speech.stop();
  }, [voice]);
  useEffect(() => {
    input.current?.focus();
    return () => {
      abort.current?.abort();
    };
  }, []);
  async function restore() {
    const data = await loadConversation({ data: { id: conversation.id } });
    setOutput("");
    setMessages(data.messages);
    cache.setQueryData(["conversation", conversation.id], data);
    await cache.invalidateQueries({ queryKey: ["conversations"] });
  }
  async function run(
    action: "send" | "edit" | "regenerate",
    content: string,
    messageId?: string,
    clarification = false,
  ) {
    if (lock.current || !content.trim()) return;
    speech.stop();
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    setOutput("");
    const ctrl = new AbortController();
    abort.current = ctrl;
    let next = messages;
    if (action === "send")
      next = [
        ...messages,
        {
          id: "pending",
          conversation_id: conversation.id,
          role: "user",
          content: content.trim(),
          created_at: new Date().toISOString(),
          hidden: clarification,
        },
      ];
    if (action === "edit") {
      const index = messages.findIndex((m) => m.id === messageId);
      next = messages
        .slice(0, index + 1)
        .map((m) => (m.id === messageId ? { ...m, content: content.trim() } : m));
    }
    if (action === "regenerate") {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index >= 0) next = messages.slice(0, index);
    }
    setMessages(next);
    setDraft("");
    setEdit(null);
    input.current?.focus();
    try {
      const requestMessages = next
        .filter((m) => !isGradeMessage(m))
        .map(({ role, content }) => ({ role, content }));
      const res = await startVickyChat(
        {
          founder_id: conversation.founder_id,
          conversation_id: conversation.id,
          company_id: conversation.company_id,
          action,
          clarification,
          message_id: messageId,
          ...{ mode: conversation.mode, persona: conversation.persona, stage: conversation.stage },
          messages: requestMessages,
        },
        ctrl.signal,
      );
      if (!res.body) throw new Error("Vicky could not start a reply.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "",
        text = "",
        doneEvent = false;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const line = event.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const value = JSON.parse(line.slice(6));
          if (value.type === "text") {
            text += value.text;
            setOutput(text);
          }
          if (value.type === "error") throw new Error(value.error);
          if (value.type === "done") doneEvent = true;
        }
      }
      if (!doneEvent) throw new Error("The reply was interrupted and was not saved.");
      if (voice) speech.speak(text);
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Vicky could not reply.");
    } finally {
      try {
        await restore();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not restore the chat.");
      }
      setOutput("");
      setBusy(false);
      onBusy(false);
      lock.current = false;
      abort.current = null;
      if (!edit) input.current?.focus();
    }
  }
  useEffect(() => {
    if (!launch || initialMessages.length || launched.current) return;
    const task = setTimeout(() => {
      launched.current = true;
      void run("send", launch);
    }, 0);
    return () => clearTimeout(task);
  }, [launch, initialMessages.length, run]);
  const latest = [...messages].reverse().find((m) => m.role === "assistant" && !isGradeMessage(m));
  const pair = lastAnswerPair(messages);
  async function grade() {
    if (!pair || grading) return;
    setGrading(true);
    setError("");
    try {
      const result = await vickyGrade({
        data: {
          founder_id: conversation.founder_id,
          conversation_id: conversation.id,
          questionId: "last-answer",
          answer: pair.answer.content,
        },
      });
      if ("error" in result) throw new Error(result.error);
      await restore();
      await cache.invalidateQueries({ queryKey: ["analysis"] });
      await cache.invalidateQueries({ queryKey: ["meeting-brief"] });
      await cache.invalidateQueries({ queryKey: ["company-dashboard"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not grade this answer.");
    } finally {
      setGrading(false);
      input.current?.focus();
    }
  }
  async function feedback(message: SavedMessage, value: "up" | "down") {
    try {
      await saveFeedback({ data: { id: message.id, feedback: value } });
      setMessages((old) => old.map((m) => (m.id === message.id ? { ...m, feedback: value } : m)));
      if (value === "down") await run("send", CLARIFICATION, undefined, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save feedback.");
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Transcript className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-8 px-5 py-8 md:px-8">
          {!messages.length && !busy && (
            <div className="flex flex-col items-center gap-5 py-16">
              <VickyAvatar />
              <div className="flex flex-col gap-2">
                {chatSuggestions(coach?.plan ?? []).map((prompt) => (
                  <Button
                    key={prompt}
                    variant="outline"
                    className="h-auto whitespace-normal py-3 text-xs"
                    onClick={() => void run("send", prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) =>
            m.hidden ? (
              <p key={m.id} className="text-xs text-muted-foreground">
                Vicky will ask what you need
              </p>
            ) : (
              <Message
                key={m.id}
                from={m.role}
                className={m.role === "user" ? "max-w-[90%]" : "max-w-full"}
              >
                {m.role === "assistant" && (
                  <VickyAvatar small active={speech.speaking && m.id === latest?.id} />
                )}
                {edit?.id === m.id ? (
                  <div className="w-full space-y-2">
                    <Textarea
                      autoFocus
                      aria-label="Edit message"
                      value={edit.content}
                      maxLength={20000}
                      onChange={(e) => setEdit({ ...edit, content: e.target.value })}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEdit(null);
                          input.current?.focus();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={!edit.content.trim() || busy}
                        onClick={() => void run("edit", edit.content, m.id)}
                      >
                        Save & regenerate
                      </Button>
                    </div>
                  </div>
                ) : (
                  <MessageContent
                    className={
                      m.role === "user"
                        ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
                        : "w-full max-w-[65ch] overflow-visible text-[15px] leading-7"
                    }
                  >
                    {isGradeMessage(m) ? (
                      <GradeCard content={m.content} />
                    ) : m.role === "user" ? (
                      <p className="whitespace-pre-wrap text-[15px]">{m.content}</p>
                    ) : (
                      <ReplyContent
                        text={m.content}
                        charts={dashboard?.analysis.charts ?? {}}
                        base={coach?.scenarioBase ?? null}
                        metrics={dashboard?.analysis.metrics ?? {}}
                        choice={choice}
                      />
                    )}
                  </MessageContent>
                )}
                {!isGradeMessage(m) && (
                  <MessageActions className={m.role === "user" ? "justify-end" : ""}>
                    {m.role === "user" ? (
                      <MessageAction
                        tooltip="Edit"
                        disabled={busy || grading || m.id === "pending"}
                        onClick={() => setEdit({ id: m.id, content: m.content })}
                      >
                        <Pencil />
                      </MessageAction>
                    ) : (
                      <>
                        <MessageAction
                          tooltip="Helpful"
                          disabled={busy}
                          onClick={() => void feedback(m, "up")}
                          className={m.feedback === "up" ? "text-primary" : ""}
                        >
                          <ThumbsUp />
                        </MessageAction>
                        <MessageAction
                          tooltip="Not helpful"
                          disabled={busy}
                          onClick={() => void feedback(m, "down")}
                          className={m.feedback === "down" ? "text-primary" : ""}
                        >
                          <ThumbsDown />
                        </MessageAction>
                        {m.id === latest?.id && (
                          <>
                            <MessageAction
                              tooltip="Regenerate"
                              disabled={busy || grading}
                              onClick={() => void run("regenerate", m.content, m.id)}
                            >
                              <RotateCcw />
                            </MessageAction>
                            <MessageAction
                              tooltip={copied ? "Copied" : "Copy"}
                              onClick={() => {
                                void navigator.clipboard
                                  .writeText(m.content)
                                  .then(() => setCopied(true))
                                  .catch(() => setError("Copy failed."));
                              }}
                            >
                              {copied ? <Check /> : <Copy />}
                            </MessageAction>
                          </>
                        )}
                      </>
                    )}
                  </MessageActions>
                )}
              </Message>
            ),
          )}
          {busy && (
            <Message from="assistant" className="max-w-full">
              <MessageContent className="max-w-[65ch] text-[15px] leading-7">
                <VickyAvatar small active />
                {output ? (
                  <ReplyContent
                    text={output}
                    charts={dashboard?.analysis.charts ?? {}}
                    base={coach?.scenarioBase ?? null}
                    metrics={dashboard?.analysis.metrics ?? {}}
                    choice={choice}
                    streaming
                  />
                ) : (
                  <Shimmer>Vicky is thinking…</Shimmer>
                )}
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Transcript>
      <div className="mx-auto w-full max-w-3xl px-4 pb-5 md:px-8">
        {error && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {conversation.mode === "simulate" && pair && (
          <Button
            size="sm"
            variant="outline"
            className="mb-3"
            disabled={busy || grading}
            onClick={() => void grade()}
          >
            <ClipboardCheck />
            {grading ? "Grading…" : "Grade my last answer"}
          </Button>
        )}
        <PromptInput onSubmit={({ text }) => run("send", text)}>
          <PromptInputTextarea
            ref={input}
            aria-label="Message"
            placeholder={
              conversation.mode === "ask" ? "Ask about your numbers…" : "Answer the investor…"
            }
            value={draft}
            maxLength={20000}
            onChange={(e) => setDraft(e.target.value)}
          />
          <PromptInputFooter className="justify-between">
            {speech.supported ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={speech.listening ? "Stop dictation" : "Dictate message"}
                disabled={busy}
                onClick={speech.dictate}
              >
                <Mic className={speech.listening ? "text-destructive" : ""} />
              </Button>
            ) : (
              <span
                title="Voice input works in Chrome, Edge and Safari"
                className="text-[10px] text-muted-foreground"
              >
                <Info className="size-3" />
              </span>
            )}
            {speech.speaking && (
              <Button variant="ghost" size="sm" onClick={speech.stop}>
                Stop
              </Button>
            )}
            <PromptInputSubmit
              status={busy ? (output ? "streaming" : "submitted") : "ready"}
              disabled={!busy && (!draft.trim() || grading)}
              onStop={() => {
                speech.stop();
                abort.current?.abort();
              }}
            >
              {!busy && <ArrowUp />}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
