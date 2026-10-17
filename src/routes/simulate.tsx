import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/vicky/AppShell';
import { Chat } from '@/components/vicky/Chat';
import { Button } from '@/components/ui/button';
import { PERSONAS, type PersonaId } from '@/lib/vicky/knowledge';

export const Route = createFileRoute('/simulate')({
  head: () => ({ meta: [
    { title: 'Simulate the Pitch · Vicky by June Analytics' },
    { name: 'description', content: 'A mock investor meeting with one of five investor types, ending in a scorecard.' },
    { property: 'og:title', content: 'Simulate the Pitch · Vicky by June Analytics' },
    { property: 'og:description', content: 'Rehearse your raise with a simulated investor and get scored.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <AppShell eyebrow="Mock meeting" title="Simulate the Pitch" intro="Pick an investor. They ask five questions, one at a time, then hand you a scorecard.">
    {id => <Simulate founderId={id} />}
  </AppShell>,
});

function Simulate({ founderId }: { founderId: string }) {
  const [persona, setPersona] = useState<PersonaId | null>(null);
  if (!persona) return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {Object.values(PERSONAS).map(p => <button key={p.id} onClick={() => setPersona(p.id)}
      className="flex flex-col rounded-xl border border-border bg-card p-5 text-left transition hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <h2 className="font-semibold">{p.name}</h2>
      <p className="mt-1 font-mono text-sm text-accent">{p.cheque}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Says no when</p>
      <p className="mt-1 text-sm">{p.saysNoWhen}</p>
    </button>)}
  </div>;
  const p = PERSONAS[persona];
  return <div>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Button variant="ghost" size="sm" onClick={() => setPersona(null)}><ArrowLeft className="size-4" />Change investor</Button>
      <p className="text-sm"><span className="font-semibold">{p.name}</span> <span className="text-muted-foreground">· {p.cheque}</span></p>
    </div>
    <Chat key={persona} founderId={founderId} mode="simulate" persona={persona} placeholder="Answer the investor…"
      starter="Hi, thanks for taking the meeting. I'm ready when you are."
      empty={<p className="text-sm text-muted-foreground">The {p.name.toLowerCase()} will open the meeting. After five questions you’ll get a scorecard on financial accuracy, clarity and preparedness.</p>} />
  </div>;
}
