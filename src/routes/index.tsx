import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronDown, FileText, Info } from 'lucide-react';
import { AppShell, Loading } from '@/components/vicky/AppShell';
import { Markdown } from '@/components/vicky/Markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getTidewellAnalysis, vickyReport } from '@/lib/vicky.functions';
import { formatMetric, type Metric } from '@/lib/vicky/tidewell/metrics';
import type { ClaimStatus } from '@/lib/vicky/tidewell/claims';
import type { Verdict } from '@/lib/vicky/tidewell/audit';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'Analyze the Numbers · Vicky by June Analytics' },
    { name: 'description', content: 'Tidewell’s key metrics, deck claims checked, forecast assumptions audited and fundraising readiness score.' },
    { property: 'og:title', content: 'Analyze the Numbers · Vicky by June Analytics' },
    { property: 'og:description', content: 'Tidewell’s key metrics, deck claims and readiness score, computed from the data pack.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <AppShell eyebrow="Tidewell · Seed round" title="Analyze the Numbers" intro="Every figure is computed from Tidewell’s data pack. Vicky explains them; she never calculates them.">
    {id => <Analysis founderId={id} />}
  </AppShell>,
});

const KEY_METRICS = ['arr', 'growth12m', 'growth3m', 'grossMarginBooked', 'grossMarginWithSupport', 'cacFullyLoaded', 'cacPaybackMonths', 'monthlyBurn', 'runwayToday', 'burnMultiple'];

const STATUS_STYLE: Record<ClaimStatus, string> = {
  Fix: 'bg-destructive text-destructive-foreground',
  Reword: 'bg-warning text-warning-foreground',
  'Remove or source': 'bg-muted-foreground text-background',
  'Show as upside': 'bg-info text-info-foreground',
  Holds: 'bg-success text-success-foreground',
};
const VERDICT_STYLE: Record<Verdict, string> = {
  high: 'bg-destructive text-destructive-foreground', medium: 'bg-warning text-warning-foreground',
  low: 'bg-secondary text-secondary-foreground', supported: 'bg-success text-success-foreground',
};

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="mb-12"><h2 className="text-xl font-semibold tracking-tight">{title}</h2>{sub && <p className="mb-4 mt-1 text-sm text-muted-foreground">{sub}</p>}<div className={sub ? '' : 'mt-4'}>{children}</div></section>;
}

function Analysis({ founderId }: { founderId: string }) {
  const q = useQuery({ queryKey: ['analysis', founderId], queryFn: () => getTidewellAnalysis({ data: { founder_id: founderId } }), staleTime: 0, refetchOnMount: 'always' });
  if (q.isPending) return <Loading label="Computing Tidewell’s numbers…" />;
  if (q.isError) return <p role="alert" className="text-destructive">{q.error.message}</p>;
  const a = q.data;
  const metrics = KEY_METRICS.map(id => a.metrics[id]).filter((m): m is Metric => !!m);
  return <TooltipProvider delayDuration={150}>
    <Readiness r={a.readiness} />
    <Section title="Key metrics" sub="Hover a card for how it was calculated and where the number comes from.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(m => <Tooltip key={m.id}><TooltipTrigger asChild>
          <div tabIndex={0} className="cursor-help rounded-lg border border-border bg-card p-4 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring">
            <div className="mb-3 flex items-start justify-between gap-2"><p className="text-xs leading-snug text-muted-foreground">{m.label}</p><Info className="size-3.5 shrink-0 text-muted-foreground" /></div>
            <p className="font-mono text-2xl font-semibold tracking-tight">{formatMetric(m)}</p>
            <Badge variant="outline" className={'mt-3 text-[10px] uppercase tracking-wider ' + (m.basis === 'historical' ? 'border-accent text-accent' : 'border-info text-info')}>{m.basis === 'historical' ? 'Historical' : 'Forecast'}</Badge>
          </div>
        </TooltipTrigger><TooltipContent className="max-w-xs space-y-1.5 text-xs"><p><span className="font-semibold">Calculation:</span> {m.calculation}</p><p><span className="font-semibold">Source:</span> {m.source}</p></TooltipContent></Tooltip>)}
      </div>
    </Section>

    <Section title="Deck claims checked" sub="Each claim in Tidewell’s deck compared against the data.">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Claim</th><th className="px-4 py-3 font-medium">What the data shows</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
          <tbody>{a.claims.map(c => <tr key={c.id} className="border-t border-border align-top">
            <td className="px-4 py-3 font-medium">“{c.claim}”</td>
            <td className="px-4 py-3"><p>{c.dataShows}</p>
              <details className="group mt-2"><summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-accent">Why <ChevronDown className="size-3 transition-transform group-open:rotate-180" /></summary><p className="mt-1.5 text-muted-foreground">{c.why}</p></details></td>
            <td className="px-4 py-3"><span className={'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ' + STATUS_STYLE[c.status]}>{c.status}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
    </Section>

    <Section title="Forecast assumptions audited" sub="The founders’ forecast drivers compared with what Tidewell actually achieved.">
      <div className="grid gap-3 md:grid-cols-2">{a.audit.map(item => <article key={item.id} className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-start justify-between gap-3"><h3 className="font-semibold">{item.assumption}</h3><span className={'whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ' + VERDICT_STYLE[item.verdict]}>{item.verdict}{item.verdict !== 'supported' && ' risk'}</span></div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm"><dt className="text-muted-foreground">Founders</dt><dd className="font-mono">{item.foundersValue}</dd><dt className="text-muted-foreground">History</dt><dd className="font-mono">{item.history}</dd></dl>
        <p className="mt-3 border-t border-border pt-3 text-sm"><span className="font-semibold">Fix: </span>{item.fix}</p>
      </article>)}</div>
    </Section>

    <Section title="Not in the data" sub={a.dataGaps.source}>
      <ul className="grid gap-2 md:grid-cols-2">{a.dataGaps.items.map(g => <li key={g} className="rounded-md border border-dashed border-border bg-card px-4 py-3 text-sm">{g}</li>)}</ul>
    </Section>

    <Report founderId={founderId} />
  </TooltipProvider>;
}

function Readiness({ r }: { r: Awaited<ReturnType<typeof getTidewellAnalysis>>['readiness'] }) {
  return <section className="mb-12 overflow-hidden rounded-xl border border-border bg-card">
    <div className="grid gap-6 bg-primary p-6 text-primary-foreground md:grid-cols-[auto_1fr] md:p-8">
      <div><p className="text-xs uppercase tracking-[0.18em] opacity-70">Readiness score</p>
        <p className="font-mono text-6xl font-semibold">{r.score}<span className="text-2xl opacity-60">/100</span></p>
        <p className="mt-1 text-lg font-medium">{r.band}</p></div>
      <div className="self-end"><p className="mb-2 text-sm opacity-80">Coverage: {Math.round(r.coverage * 100)}% of the 100 points assessed so far</p>
        <Progress value={r.coverage * 100} className="h-2 bg-primary-foreground/20 [&>div]:bg-accent" />
        {r.topActions.length > 0 && <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm opacity-90">{r.topActions.map(t => <li key={t}>{t}</li>)}</ol>}</div>
    </div>
    <div className="grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-3">{r.components.map(c => <div key={c.id} className="border-border p-5 [&:nth-child(n+3)]:md:border-t lg:[&:nth-child(n+3)]:border-t-0 lg:[&:nth-child(n+4)]:border-t">
      <div className="mb-2 flex items-baseline justify-between gap-2"><h3 className="text-sm font-semibold">{c.label}</h3>
        <span className="font-mono text-sm">{c.assessed ? `${Math.round(c.earned * 10) / 10}/${c.max}` : <span className="text-muted-foreground">Not assessed</span>}</span></div>
      {c.evidence.length > 0 && <ul className="mb-2 space-y-1 text-xs text-muted-foreground">{c.evidence.map(e => <li key={e}>• {e}</li>)}</ul>}
      {c.nextSteps.length > 0 && <ul className="space-y-1 text-xs">{c.nextSteps.map(s => <li key={s} className="text-foreground">→ {s}</li>)}</ul>}
    </div>)}</div>
    <p className="border-t border-border bg-muted px-5 py-3 text-xs text-muted-foreground">{r.disclaimer}</p>
  </section>;
}

function Report({ founderId }: { founderId: string }) {
  const m = useMutation({ mutationFn: () => vickyReport({ data: { founder_id: founderId } }) });
  return <Section title="Readiness Report" sub="Vicky writes it from the computed analysis above.">
    <Button size="lg" onClick={() => m.mutate()} disabled={m.isPending}><FileText className="size-4" />{m.isPending ? 'Vicky is writing…' : m.data ? 'Rewrite my report' : 'Write my report'}</Button>
    {m.isError && <p role="alert" className="mt-4 text-sm text-destructive">{m.error.message}</p>}
    {m.data && <article className="mt-6 rounded-xl border border-border bg-card p-6 md:p-8"><Markdown>{m.data.report}</Markdown></article>}
  </Section>;
}
