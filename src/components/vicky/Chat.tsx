import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { startVickyChat } from '@/lib/vicky-chat';
import type { ChatInput } from '@/lib/vicky-inputs';
import { Markdown } from './Markdown';

type Msg = { role: 'user' | 'assistant'; content: string };

export function VickyAvatar() {
  return <img src="/brand/june-analytics-mark.png" alt="" className="size-7 shrink-0 rounded-md border border-border bg-card p-0.5" />;
}

export function Chat({ founderId, mode, persona, placeholder, starter, empty }: {
  founderId: string; mode: 'ask' | 'simulate'; persona?: ChatInput['persona']; placeholder: string; starter?: string; empty?: ReactNode;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setDraft(''); setError(''); setBusy(true);
    const ctrl = new AbortController(); abort.current = ctrl;
    try {
      const res = await startVickyChat({ founder_id: founderId, mode, ...(persona ? { persona } : {}), messages: next }, ctrl.signal);
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '', out = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop() ?? '';
        for (const p of parts) {
          const line = p.split('\n').find(l => l.startsWith('data: '));
          if (!line) continue;
          const ev = JSON.parse(line.slice(6)) as { type: string; text?: string; error?: string };
          if (ev.type === 'text' && ev.text) { out += ev.text; setMessages([...next, { role: 'assistant', content: out }]); end.current?.scrollIntoView({ block: 'end' }); }
          if (ev.type === 'error') throw new Error(ev.error ?? 'Vicky stopped unexpectedly.');
        }
      }
      if (!out) setMessages(next);
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Vicky could not reply.');
      setMessages(m => m.at(-1)?.content === '' ? m.slice(0, -1) : m);
    } finally { setBusy(false); abort.current = null; }
  }

  function submit(e: FormEvent) { e.preventDefault(); void send(draft); }

  return <div className="flex min-h-[60vh] flex-col rounded-xl border border-border bg-card">
    <div className="flex-1 space-y-6 overflow-y-auto p-5 md:p-7" aria-live="polite">
      {messages.length === 0 && <div className="py-6">
        {empty}
        {starter && <Button className="mt-4" onClick={() => void send(starter)}>{mode === 'simulate' ? 'Start the meeting' : starter}</Button>}
      </div>}
      {messages.map((m, i) => m.role === 'user'
        ? <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-[15px] text-primary-foreground">{m.content}</div>
        : <div key={i} className="flex gap-3"><VickyAvatar />
            <div className="min-w-0 flex-1">{m.content ? <Markdown>{m.content}</Markdown> : <span className="text-sm text-muted-foreground">Vicky is thinking…</span>}</div></div>)}
      <div ref={end} />
    </div>
    {error && <p role="alert" className="mx-5 mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    <form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-3">
      <Textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder} rows={2} aria-label="Message"
        className="min-h-[52px] resize-none border-0 shadow-none focus-visible:ring-0"
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft); } }} />
      {busy
        ? <Button type="button" size="icon" variant="secondary" aria-label="Stop" onClick={() => abort.current?.abort()}><Square className="size-4" /></Button>
        : <Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim()}><ArrowUp className="size-4" /></Button>}
    </form>
  </div>;
}
