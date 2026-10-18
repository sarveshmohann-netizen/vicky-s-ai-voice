import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { AppShell, Loading } from '@/components/vicky/AppShell';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MeetingPickers } from '@/components/vicky/MeetingPickers';
import { MeetingCharts } from '@/components/vicky/MeetingCharts';
import { MetricsDialog } from '@/components/vicky/MetricsDialog';
import { Sources, SourceText } from '@/components/vicky/Sources';
import { meetingSearchSchema } from '@/lib/vicky-inputs';
import { getMeetingBrief, getTidewellAnalysis } from '@/lib/vicky.functions';

export const Route = createFileRoute('/')({
  validateSearch: input => meetingSearchSchema.parse(input),
  head: () => ({ meta: [
    { title: 'Meeting prep · Vicky by June Analytics' },
    { name: 'description', content: 'An investor-specific Tidewell meeting brief: chart the plan, tighten the story, and rehearse ten questions.' },
    { property: 'og:title', content: 'Meeting prep · Vicky by June Analytics' },
    { property: 'og:description', content: 'Tidewell’s numbers, investor priorities and ten questions to prepare before your pitch.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <AppShell eyebrow="Tidewell · Your next meeting" title="Meeting prep" intro="A clearer story. A stronger meeting.">{id => <MeetingPrep founderId={id} />}</AppShell>,
});

function MeetingPrep({ founderId }: { founderId: string }) {
  const choice = Route.useSearch();
  const navigate = Route.useNavigate();
  const analysis = useQuery({ queryKey: ['analysis', founderId], queryFn: () => getTidewellAnalysis({ data: { founder_id: founderId } }), staleTime: 0, refetchOnMount: 'always' });
  const brief = useQuery({ queryKey: ['meeting-brief', founderId, choice.persona, choice.stage], queryFn: () => getMeetingBrief({ data: { founder_id: founderId, ...choice } }), staleTime: 0 });
  return <>
    <MeetingPickers {...choice} onChange={search => void navigate({ search })} />
    {analysis.isPending || brief.isPending ? <Loading label="Preparing your meeting…" /> : analysis.isError || brief.isError ? <p role="alert" className="text-destructive">{analysis.error?.message ?? brief.error?.message}</p> : <>
      <section className="mb-10 rounded-lg border border-border bg-section p-6 md:p-8">
        <div className="flex flex-col-reverse items-start gap-6 sm:flex-row sm:items-center"><h2 className="flex-1 text-lg font-medium leading-relaxed"><SourceText>{brief.data.headline}</SourceText></h2><div className="flex shrink-0 items-center gap-4">
          <svg viewBox="0 0 100 100" className="size-24 -rotate-90" role="img" aria-label={`Readiness ${analysis.data.readiness.score} out of 100`}><circle cx="50" cy="50" r="43" fill="none" stroke="var(--border)" strokeWidth="5" /><circle cx="50" cy="50" r="43" fill="none" stroke="var(--primary)" strokeWidth="5" pathLength="100" strokeDasharray={`${analysis.data.readiness.score} 100`} /><text x="50" y="50" textAnchor="middle" dominantBaseline="central" transform="rotate(90 50 50)" className="readiness-ring-label">{analysis.data.readiness.score}/100</text></svg><div><p className="text-xs text-muted-foreground">Readiness</p><p className="text-sm font-semibold">{analysis.data.readiness.band}</p></div>
        </div></div><p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">{analysis.data.readiness.disclaimer}</p>
      </section>
      <MeetingCharts charts={analysis.data.charts} />
      <div className="mt-3 flex justify-end"><MetricsDialog metrics={analysis.data.metrics} /></div>
      <section className="mt-14"><h2 className="mb-6 text-2xl font-bold">Tighten before you send it</h2><div className="divide-y divide-border border-y border-border">{brief.data.tighten.map((item, i) => <article key={item.id} className="grid gap-3 py-5 sm:grid-cols-[32px_1fr]"><span className="text-sm font-semibold text-primary">0{i + 1}</span><div><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{item.title}</h3><Sources refs={item.refs} /></div><div className="grid gap-3 text-sm leading-relaxed md:grid-cols-2"><div><p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">What the data shows now</p><SourceText>{item.now}</SourceText></div><div><p className="mb-1 text-[10px] font-semibold uppercase text-primary">The fix</p><SourceText>{item.fix}</SourceText></div></div></div></article>)}</div></section>
      <section className="mt-14"><h2 className="mb-6 text-2xl font-bold">Where the numbers don't back the story</h2><div className="grid gap-4 md:grid-cols-2">{analysis.data.storyChecks.map(s => <article key={s.id} className="rounded-lg border border-border p-5"><h3 className="mb-4 text-sm font-semibold">{s.title}</h3><div className="grid grid-cols-2 gap-4 text-sm leading-relaxed"><div><p className="mb-2 text-[10px] font-semibold uppercase text-primary">Plan</p><SourceText>{s.plan}</SourceText></div><div><p className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">History</p><SourceText>{s.history}</SourceText></div></div><div className="mt-4"><Sources refs={s.refs} /></div></article>)}</div></section>
      <section className="mt-14"><h2 className="mb-6 text-2xl font-bold">Ten questions they'll ask</h2><Accordion type="multiple">{brief.data.questions.map((q, i) => <AccordionItem key={q.id} value={q.id}><AccordionTrigger className="text-left text-sm"><span><span className="mr-3 text-primary">{String(i + 1).padStart(2, '0')}</span>{q.question}</span></AccordionTrigger><AccordionContent><p className="mb-5 text-xs text-muted-foreground"><strong>Why they ask: </strong><SourceText>{q.whyTheyAsk}</SourceText></p><div className="grid gap-6 sm:grid-cols-2"><div className="text-muted-foreground"><h3 className="mb-2 flex items-center gap-2 text-xs font-semibold"><AlertTriangle className="size-3.5 text-warning" />What you'd say today</h3><SourceText>{q.youWouldSay}</SourceText></div><div><h3 className="mb-2 text-xs font-semibold text-primary">What your numbers support</h3><SourceText>{q.numbersSupport}</SourceText></div></div><Button asChild size="sm" className="mt-5"><Link to="/practice" search={{ ...choice, question: q.id, mode: 'question' }}>Practise this<ArrowUpRight className="size-3" /></Link></Button></AccordionContent></AccordionItem>)}</Accordion></section>
    </>}
  </>;
}
