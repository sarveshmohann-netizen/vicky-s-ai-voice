import { useEffect, useRef, useState } from "react";
import { ClientOnly, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, Plus, MoreHorizontal, Pencil, Trash2, MessageSquare } from "lucide-react";
import { AppHeader, SessionGate, Loading } from "./AppShell";
import { SavedChat } from "./SavedChat";
import { ContextBar } from "./ContextBar";
import { VickyAvatar } from "./VickyAvatar";
import { useVickyDashboard } from "@/hooks/use-vicky-dashboard";
import { chatSuggestions } from "@/lib/vicky/coach";
import { PromptInput,PromptInputTextarea,PromptInputFooter,PromptInputSubmit } from "@/components/ai-elements/prompt-input";
import { Switch } from "@/components/ui/switch";
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
      <ContextBar />
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
  const dashboard = useVickyDashboard(search);
  const [questionsOpen,setQuestionsOpen]=useState(false);
  const [voice,setVoice]=useState(false);
  const [draft,setDraft]=useState("");
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
  const settings: Settings = {
    company_id: search.company_id ?? null,
    persona: search.persona,
    stage: search.stage,
    mode: search.mode === "simulate" ? "simulate" : "ask",
  };
  async function newChat(prompt?: string, mode = settings.mode) {
    if (pending || opening.current || busy) return;
    opening.current = true;
    setPending(true);
    setError("");
    try {
      const chat = await createConversation({
        data: { ...settings, mode },
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
          ...(prompt ? { prompt } : {}),
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
    if (!id && (search.prompt || search.question)) { const q=dashboard.data?.brief.questions.find(q=>q.id===search.question);const prompt=search.prompt??(q?search.mode==="simulate"?"Ask me this investor question and wait for my answer: "+q.question:q.question:undefined);if(prompt)void newChat(prompt,search.mode==="simulate"?"simulate":"ask"); }
  }, [id, search.question, search.prompt, dashboard.data, newChat]);
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
  useEffect(()=>{if(!id||!active.data||busy)return; const saved=active.data.conversation;if(saved.persona!==settings.persona||saved.stage!==settings.stage||saved.mode!==settings.mode)void updateConversation({data:{id,settings}}).then(chat=>cache.setQueryData(["conversation",id],{...active.data,conversation:chat})).catch(e=>setError(e.message));},[id,active.data,settings.persona,settings.stage,settings.mode,busy]);
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
          <div className="flex flex-wrap items-center gap-3">
            <Button size="icon-sm" variant="ghost" aria-label="Open saved chats" className="md:hidden" onClick={()=>setDrawer(true)}><Menu/></Button>
            <VickyAvatar small/><h1 className="text-base font-semibold">Vicky</h1>
            <ToggleGroup type="single" value={settings.mode} disabled={busy||pending} onValueChange={mode=>{if(mode==="ask"||mode==="simulate")void change({...settings,mode});}}>
              <ToggleGroupItem value="ask" aria-label="Ask Vicky" className="text-xs">Ask</ToggleGroupItem><ToggleGroupItem value="simulate" aria-label="Mock meeting" className="text-xs">Mock meeting</ToggleGroupItem>
            </ToggleGroup>
            <label className="ml-auto flex items-center gap-2 text-xs"><Switch aria-label="Voice" checked={voice} onCheckedChange={setVoice}/>Voice</label>
            <Button variant="outline" size="sm" onClick={()=>setQuestionsOpen(true)}>Likely questions</Button>
          </div>
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
              launch={search.prompt ?? (() => { const q=dashboard.data?.brief.questions.find(q=>q.id===search.question); return q?.question; })()}
              voice={voice}
              dashboard={dashboard.data}
              coach={dashboard.coach}
              choice={search}
              onBusy={setBusy}
            />
          )
        ) : (
          <div className="flex min-h-0 flex-1 flex-col"><div className="flex flex-1 flex-col items-center justify-center gap-5 px-5"><VickyAvatar/><div className="flex max-w-xl flex-col gap-2">{chatSuggestions(dashboard.coach?.plan??[]).map(prompt=><Button key={prompt} variant="outline" className="h-auto whitespace-normal py-3 text-left text-xs" disabled={pending} onClick={()=>void newChat(prompt)}>{prompt}</Button>)}</div></div><div className="mx-auto w-full max-w-3xl px-5 pb-5"><PromptInput onSubmit={({text})=>newChat(text)}><PromptInputTextarea aria-label="Message" placeholder="Ask about your numbers…" value={draft} onChange={e=>setDraft(e.target.value)}/><PromptInputFooter className="justify-end"><PromptInputSubmit disabled={!draft.trim()||pending} status={pending?'submitted':'ready'}/></PromptInputFooter></PromptInput></div></div>
        )}
      </main>
      <Sheet open={questionsOpen} onOpenChange={setQuestionsOpen}><SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md"><SheetTitle>Likely questions</SheetTitle><div className="mt-6 divide-y divide-border">{dashboard.data?.brief.questions.map((q,i)=><section key={q.id} className="py-4"><p className="text-xs text-primary">{String(i+1).padStart(2,'0')}</p><h3 className="mt-2 text-sm font-semibold">{q.question}</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{q.whyTheyAsk}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={()=>{setQuestionsOpen(false);void newChat("Ask me this investor question and wait for my answer: "+q.question,"simulate");}}>Practise this</Button><Button size="sm" variant="outline" onClick={()=>{setQuestionsOpen(false);void newChat("What should I say when the investor asks: "+q.question,"ask");}}>What should I say?</Button></div></section>)}</div></SheetContent></Sheet>
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
