import { useEffect, useRef, useState } from "react";
import { ClientOnly, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, Plus, MoreHorizontal, Pencil, Trash2, MessageSquare } from "lucide-react";
import { AppHeader, SessionGate, Loading } from "./AppShell";
import { SavedChat } from "./SavedChat";
import { MeetingPickers } from "./MeetingPickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  createConversation,
  listConversations,
  loadConversation,
  updateConversation,
  deleteConversation,
} from "@/lib/conversations.functions";
import {
  conversationGroup,
  type Conversation,
  type Settings,
  type practiceSearchSchema,
} from "@/lib/conversations";
import { QUESTIONS } from "@/lib/vicky/knowledge";
import type { z } from "zod";

export function PracticePage({
  id,
  search,
}: {
  id?: string;
  search: z.infer<typeof practiceSearchSchema>;
}) {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <AppHeader />
      <ClientOnly fallback={<Loading />}>
        <SessionGate>
          {(founderId) => (
            <Workspace key={id ?? "new"} founderId={founderId} id={id} search={search} />
          )}
        </SessionGate>
      </ClientOnly>
    </div>
  );
}
function Workspace({
  founderId,
  id,
  search,
}: {
  founderId: string;
  id?: string | undefined;
  search: z.infer<typeof practiceSearchSchema>;
}) {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const chats = useQuery({
    queryKey: ["conversations", founderId],
    queryFn: () => listConversations(),
  });
  const active = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => loadConversation({ data: { id: id ?? "" } }),
    enabled: !!id,
  });
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<{ type: "rename" | "delete"; chat: Conversation } | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const opening = useRef(false);
  const settings: Settings = active.data?.conversation ?? {
    company_id: search.company_id ?? null,
    persona: search.persona,
    stage: search.stage,
    mode: search.mode === "simulate" ? "simulate" : "ask",
  };
  async function newChat(question?: string) {
    if (pending || opening.current || busy) return;
    opening.current = true;
    setPending(true);
    setError("");
    try {
      const chat = await createConversation({
        data: { ...settings, ...(question ? { mode: "ask" as const } : {}) },
      });
      await cache.invalidateQueries({ queryKey: ["conversations"] });
      setDrawer(false);
      await navigate({
        to: "/practice/$conversationId",
        params: { conversationId: chat.id },
        search: {
          persona: chat.persona,
          stage: chat.stage,
          mode: chat.mode,
          company_id: chat.company_id ?? undefined,
          ...(question ? { question } : {}),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a chat.");
    } finally {
      opening.current = false;
      setPending(false);
    }
  }
  useEffect(() => {
    if (!id && search.question) void newChat(search.question);
  }, [id, search.question, newChat]);
  async function change(next: Settings) {
    setError("");
    try {
      if (id) {
        const chat = await updateConversation({ data: { id, settings: next } });
        cache.setQueryData(["conversation", id], (old: typeof active.data) =>
          old ? { ...old, conversation: chat } : old,
        );
        await cache.invalidateQueries({ queryKey: ["conversations"] });
        await navigate({
          to: "/practice/$conversationId",
          params: { conversationId: id },
          search: { ...next, company_id: next.company_id ?? undefined },
          replace: true,
        });
      } else await navigate({ to: "/practice", search: { ...next, company_id: next.company_id ?? undefined }, replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save chat settings.");
    }
  }
  async function confirm() {
    if (!dialog) return;
    setPending(true);
    setError("");
    try {
      if (dialog.type === "delete") {
        await deleteConversation({ data: { id: dialog.chat.id } });
        if (id === dialog.chat.id) await navigate({ to: "/practice", search: { ...settings, company_id: settings.company_id ?? undefined } });
      } else {
        const chat = await updateConversation({ data: { id: dialog.chat.id, title } });
        if (chat.id === id)
          cache.setQueryData(["conversation", id], (old: typeof active.data) =>
            old ? { ...old, conversation: chat } : old,
          );
      }
      await cache.invalidateQueries({ queryKey: ["conversations"] });
      setDialog(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update this chat.");
    } finally {
      setPending(false);
    }
  }
  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Button
        variant="outline"
        className="justify-start bg-card"
        disabled={busy || pending}
        onClick={() => void newChat()}
      >
        <Plus />
        New chat
      </Button>
      <div className="flex-1 space-y-6 overflow-y-auto">
        {chats.isPending ? (
          <Loading />
        ) : chats.isError ? (
          <p className="text-sm text-destructive">{chats.error.message}</p>
        ) : (
          ["Today", "Yesterday", "Earlier"].map((group) => {
            const rows = chats.data.filter((c) => conversationGroup(c.updated_at) === group);
            return (
              rows.length > 0 && (
                <section key={group}>
                  <h2 className="mb-2 px-2 text-[11px] font-semibold uppercase text-muted-foreground">
                    {group}
                  </h2>
                  <div className="space-y-1">
                    {rows.map((chat) => (
                      <div
                        key={chat.id}
                        className={
                          "group flex items-center gap-1 rounded-md " +
                          (id === chat.id ? "bg-secondary" : "hover:bg-secondary/60")
                        }
                      >
                        <Button
                          asChild
                          variant="ghost"
                          className="min-w-0 flex-1 justify-start px-2 hover:bg-transparent"
                          disabled={busy}
                        >
                          <Link
                            to="/practice/$conversationId"
                            params={{ conversationId: chat.id }}
                            search={{ persona: chat.persona, stage: chat.stage, mode: chat.mode, company_id: chat.company_id ?? undefined }}
                            onClick={(e) => {
                              if (busy) {
                                e.preventDefault();
                                return;
                              }
                              setDrawer(false);
                            }}
                          >
                            <MessageSquare className="size-3.5 shrink-0" />
                            <span className="truncate text-xs">{chat.title}</span>
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={"Chat menu: " + chat.title}
                              disabled={busy}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                setTitle(chat.title);
                                setDialog({ type: "rename", chat });
                              }}
                            >
                              <Pencil />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => setDialog({ type: "delete", chat })}
                              className="text-destructive"
                            >
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </section>
              )
            );
          })
        )}
      </div>
      <p className="px-2 text-xs text-muted-foreground">Investor practice</p>
    </div>
  );
  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className="hidden w-64 shrink-0 border-r border-border bg-section md:block"
        aria-label="Saved chats"
      >
        {sidebar}
      </aside>
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-72 bg-section p-0">
          <SheetTitle className="px-4 pt-5 text-lg">Your chats</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-4 md:px-8">
          <div className="mb-4 flex items-center gap-3">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Open saved chats"
              className="md:hidden"
              onClick={() => setDrawer(true)}
            >
              <Menu />
            </Button>
            <h1 className="truncate font-sans text-base font-semibold">
              {active.data?.conversation.title ?? "New chat"}
            </h1>
          </div>
          <fieldset
            disabled={busy || pending}
            className="min-w-0 disabled:opacity-60 [&>div]:mb-3 [&>div>div:first-child]:sm:w-72"
          >
            <MeetingPickers
              persona={settings.persona}
              stage={settings.stage}
              onChange={(choice) => void change({ ...settings, ...choice })}
            />
            <ToggleGroup
              type="single"
              value={settings.mode}
              onValueChange={(mode) => {
                if (mode === "ask" || mode === "simulate") void change({ ...settings, mode });
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="ask" aria-label="Ask Vicky" className="text-xs">
                Ask Vicky
              </ToggleGroupItem>
              <ToggleGroupItem value="simulate" aria-label="Mock meeting" className="text-xs">
                Mock meeting
              </ToggleGroupItem>
            </ToggleGroup>
          </fieldset>
        </div>
        {error && (
          <p role="alert" className="px-5 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {id ? (
          active.isPending ? (
            <div className="p-6">
              <Loading label="Restoring your chat…" />
            </div>
          ) : active.isError ? (
            <p role="alert" className="p-6 text-destructive">
              {active.error.message}
            </p>
          ) : (
            <SavedChat
              key={id}
              conversation={active.data.conversation}
              initialMessages={active.data.messages}
              launch={(() => { const q=QUESTIONS.find(q=>q.id===search.question); return active.data.conversation.company_id ? q?.genericQuestion ?? q?.question : q?.question; })()}
              onBusy={setBusy}
            />
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
            <img src="/brand/june-analytics-mark.png" alt="" className="size-12" />
            <h2 className="text-3xl">What’s on your mind?</h2>
            <Button disabled={pending} onClick={() => void newChat()}>
              <Plus />
              New chat
            </Button>
          </div>
        )}
      </main>
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open && !pending) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{dialog?.type === "rename" ? "Rename chat" : "Delete chat?"}</DialogTitle>
          <DialogDescription>
            {dialog?.type === "rename"
              ? "Give this conversation a new title."
              : "This conversation and all of its messages will be permanently deleted."}
          </DialogDescription>
          {dialog?.type === "rename" && (
            <Input
              aria-label="Chat title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={dialog?.type === "delete" ? "destructive" : "default"}
              disabled={pending || (dialog?.type === "rename" && !title.trim())}
              onClick={() => void confirm()}
            >
              {dialog?.type === "rename" ? "Save title" : "Delete chat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
