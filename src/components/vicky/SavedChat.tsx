import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Check,
  Pencil,
  RotateCcw,
  ArrowUp,
  ClipboardCheck,
  ExternalLink,
} from "lucide-react";
import {
  Conversation as Transcript,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SourceChip } from "./Sources";
import { sourceTags } from "./Markdown";
import { startVickyChat } from "@/lib/vicky-chat";
import { vickyGrade } from "@/lib/vicky.functions";
import { loadConversation } from "@/lib/conversations.functions";
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
}: {
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
  useEffect(() => {
    input.current?.focus();
    return () => {
      abort.current?.abort();
    };
  }, []);
  async function restore() {
    const data = await loadConversation({ data: { id: conversation.id } });
    setMessages(data.messages);
    cache.setQueryData(["conversation", conversation.id], data);
    await cache.invalidateQueries({ queryKey: ["conversations"] });
  }
  async function run(action: "send" | "edit" | "regenerate", content: string, messageId?: string) {
    if (lock.current || !content.trim()) return;
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
        .slice(-100)
        .map(({ role, content }) => ({ role, content }));
      const res = await startVickyChat(
        {
          founder_id: conversation.founder_id,
          conversation_id: conversation.id,
          action,
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not grade this answer.");
    } finally {
      setGrading(false);
      input.current?.focus();
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Transcript className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-8 px-5 py-8 md:px-8">
          {!messages.length && !busy && (
            <div className="py-16 text-center">
              <img src="/brand/june-analytics-mark.png" alt="" className="mx-auto mb-5 size-12" />
              <h1 className="text-3xl">
                {conversation.mode === "ask" ? "Ask Vicky" : "Mock meeting"}
              </h1>
              {conversation.mode === "simulate" && (
                <Button
                  className="mt-6"
                  onClick={() =>
                    void run(
                      "send",
                      "I'm ready for our mock meeting. Please ask five questions one at a time, then give me the scorecard.",
                    )
                  }
                >
                  Start the meeting
                </Button>
              )}
            </div>
          )}
          {messages.map((m) => (
            <Message
              key={m.id}
              from={m.role}
              className={m.role === "user" ? "max-w-[90%]" : "max-w-full"}
            >
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
                      : "w-full overflow-visible"
                  }
                >
                  {isGradeMessage(m) ? (
                    <GradeCard content={m.content} />
                  ) : m.role === "user" ? (
                    <p className="whitespace-pre-wrap text-[15px]">{m.content}</p>
                  ) : (
                    <MessageResponse
                      remarkPlugins={[sourceTags]}
                      components={{
                        a: ({ href, children }) =>
                          href?.startsWith("#vicky-source=") ? (
                            <SourceChip tag={decodeURIComponent(href.slice(14))} />
                          ) : (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-primary"
                            >
                              {children}
                              <ExternalLink className="size-3" />
                            </a>
                          ),
                      }}
                    >
                      {m.content}
                    </MessageResponse>
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
                    m.id === latest?.id && (
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
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(m.content);
                              setCopied(true);
                            } catch {
                              setError("Copy failed. Please try again.");
                            }
                          }}
                        >
                          {copied ? <Check /> : <Copy />}
                        </MessageAction>
                      </>
                    )
                  )}
                </MessageActions>
              )}
            </Message>
          ))}
          {busy && (
            <Message from="assistant" className="max-w-full">
              <MessageContent>
                {output ? (
                  <MessageResponse isAnimating>{output}</MessageResponse>
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
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit
              status={busy ? (output ? "streaming" : "submitted") : "ready"}
              disabled={!busy && (!draft.trim() || grading)}
              onStop={() => abort.current?.abort()}
            >
              {!busy && <ArrowUp />}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
