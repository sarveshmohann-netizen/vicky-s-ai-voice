import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, ArrowUpRight, Settings2 } from 'lucide-react';
import { AppShell, Loading } from '@/components/vicky/AppShell';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MeetingPickers } from '@/components/vicky/MeetingPickers';
import { MeetingCharts } from '@/components/vicky/MeetingCharts';
import { CompanyCharts } from '@/components/vicky/CompanyCharts';
import { CompanyDialog } from '@/components/vicky/CompanyDialog';
import { InvestorLens } from '@/components/vicky/InvestorLens';
import { MetricsDialog } from '@/components/vicky/MetricsDialog';
import { Sources, SourceText } from '@/components/vicky/Sources';
import { meetingSearchSchema } from '@/lib/vicky-inputs';
import { getMeetingBrief, getTidewellAnalysis } from '@/lib/vicky.functions';
import { getCompanyDashboard } from '@/lib/companies.functions';
import type { TidewellAnalysis } from '@/lib/vicky/tidewell/analysis';
import type { MeetingBrief } from '@/lib/vicky/tidewell/brief';
import type { CompanyAnalysis } from '@/lib/vicky/company/analysis';
import type { CompanyBrief } from '@/lib/vicky/company/brief';

export const Route = createFileRoute('/')({
  validateSearch: input => meetingSearchSchema.parse(input),
  head: () => ({ meta: [
    { title: 'Company Meeting Prep · Vicky by June Analytics' },
    { name: 'description', content: 'Prepare an investor-specific meeting brief from your company’s monthly financials, or explore the Tidewell sample.' },
    { property: 'og:title', content: 'Company Meeting Prep · Vicky by June Analytics' },
    { property: 'og:description', content: 'Your company’s numbers, published investor benchmarks and ten questions to prepare before your pitch.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: MeetingPage,
});
function MeetingPage() {
  return <AppShell eyebrow="June Analytics · Your next meeting" title="Meeting prep" intro="A clearer story. A stronger meeting.">{id => <MeetingPrep founderId={id}/>}</AppShell>;
}
function MeetingPrep({founderId}:{founderId:string}) {
  const choice = Route.useSearch(); const navigate = Route.useNavigate();
  const reduced = useReducedMotion();
  const [details,setDetails] = useState(false);
  const dashboard = useQuery({
    queryKey:['company-dashboard',founderId,choice.company_id??'sample',choice.persona,choice.stage],
    queryFn: async ():Promise<{kind:'company';analysis:CompanyAnalysis;brief:CompanyBrief}|{kind:'sample';analysis:TidewellAnalysis;brief:MeetingBrief}> => {
      if(choice.company_id) return {kind:'company',...await getCompanyDashboard({data:{founder_id:founderId,company_id:choice.company_id,persona:choice.persona,stage:choice.stage}})};
      const [analysis,brief] = await Promise.all([getTidewellAnalysis({data:{founder_id:founderId}}),getMeetingBrief({data:{founder_id:founderId,persona:choice.persona,stage:choice.stage}})]);
      return {kind:'sample',analysis,brief};
    }, staleTime:0, refetchOnMount:'always', placeholderData:previous=>previous,
  });
  const data = dashboard.data;
  const gaps = data?.kind==='company'?data.analysis.dataGaps:data?.analysis.dataGaps.items??[];
  return <>
    <MeetingPickers {...choice} onChange={next=>void navigate({search:{...choice,...next}})}/>
    {dashboard.isPending?<Loading label="Preparing your meeting…"/>:dashboard.isError?<p role="alert" className="text-destructive">{dashboard.error.message}</p>:data && <>
      <p className="mb-5 text-xs font-semibold uppercase text-primary">{data.analysis.company.name}</p>
      <InvestorLens lens={data.brief.lens} onDetails={choice.company_id?()=>setDetails(true):undefined}/>
      <section className="mb-10 border-y border-border bg-section px-6 py-6 md:px-8">
        <div className="flex flex-col-reverse items-start gap-6 sm:flex-row sm:items-center"><h2 className="flex-1 text-lg font-medium leading-relaxed"><SourceText>{data.kind==='sample'?data.brief.headline:data.brief.lens.headline}</SourceText></h2><div className="flex shrink-0 items-center gap-4">
          <svg viewBox="0 0 100 100" className="size-24 -rotate-90" role="img" aria-label={`Readiness ${data.analysis.readiness.score} out of 100`}><circle cx="50" cy="50" r="43" fill="none" stroke="var(--border)" strokeWidth="5"/><circle cx="50" cy="50" r="43" fill="none" stroke="var(--primary)" strokeWidth="5" pathLength="100" strokeDasharray={`${data.analysis.readiness.score} 100`}/><text x="50" y="50" textAnchor="middle" dominantBaseline="central" transform="rotate(90 50 50)" className="readiness-ring-label">{data.analysis.readiness.score}/100</text></svg><div><p className="text-xs text-muted-foreground">Readiness</p><p className="text-sm font-semibold">{data.analysis.readiness.band}</p></div>
        </div></div><p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">{data.analysis.readiness.disclaimer}</p>
      </section>
      {data.kind==='company'?<CompanyCharts charts={data.analysis.charts} currency={data.analysis.company.currency}/>:<MeetingCharts charts={data.analysis.charts}/>}
      <div className="mt-3 flex justify-end"><MetricsDialog metrics={data.analysis.metrics}/></div>
      <section className="mt-14"><h2 className="mb-6 text-2xl font-bold">Tighten before you send it</h2><div className="divide-y divide-border border-y border-border">{data.brief.tighten.map((item,i)=><motion.article layout={!reduced} key={item.id} transition={{duration:0.2}} className="grid gap-3 py-5 sm:grid-cols-[32px_1fr]"><span className="text-sm font-semibold text-primary">0{i+1}</span><div><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{item.title}</h3><Sources refs={item.refs}/></div><div className="grid gap-3 text-sm leading-relaxed md:grid-cols-2"><div><p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">What the data shows now</p><SourceText>{item.now}</SourceText></div><div><p className="mb-1 text-[10px] font-semibold uppercase text-primary">The fix</p><SourceText>{item.fix}</SourceText></div></div></div></motion.article>)}</div></section>
      {data.analysis.storyChecks.length>0 && <section className="mt-14"><h2 className="mb-6 text-2xl font-bold">Where the numbers don't back the story</h2><div className="grid gap-4 md:grid-cols-2">{data.analysis.storyChecks.map(s=><article key={s.id} className="rounded-lg border border-border p-5"><h3 className="mb-4 text-sm font-semibold">{s.title}</h3><div className="grid grid-cols-2 gap-4 text-sm leading-relaxed"><div><p className="mb-2 text-[10px] font-semibold uppercase text-primary">Plan</p><SourceText>{s.plan}</SourceText></div><div><p className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">History</p><SourceText>{s.history}</SourceText></div></div><div className="mt-4"><Sources refs={s.refs}/></div></article>)}</div></section>}
      <section className="mt-14"><h2 className="mb-6 text-2xl font-bold">Ten questions they'll ask</h2><Accordion type="multiple">{data.brief.questions.map((q,i)=><motion.div layout={!reduced} key={q.id} transition={{duration:0.2}}><AccordionItem value={q.id}><AccordionTrigger className="text-left text-sm"><span><span className="mr-3 text-primary">{String(i+1).padStart(2,'0')}</span>{q.question}</span></AccordionTrigger><AccordionContent><p className="mb-5 text-xs text-muted-foreground"><strong>Why they ask: </strong><SourceText>{q.whyTheyAsk}</SourceText></p><div className={q.youWouldSay?'grid gap-6 sm:grid-cols-2':''}>{q.youWouldSay && <div className="text-muted-foreground"><h3 className="mb-2 flex items-center gap-2 text-xs font-semibold"><AlertTriangle className="size-3.5 text-warning"/>What you'd say today</h3><SourceText>{q.youWouldSay}</SourceText></div>}<div><h3 className="mb-2 text-xs font-semibold text-primary">What your numbers support</h3><SourceText>{q.numbersSupport}</SourceText></div></div><Button asChild size="sm" className="mt-5"><Link to="/practice" search={{...choice,question:q.id,mode:'ask'}}>Practise this<ArrowUpRight className="size-3"/></Link></Button></AccordionContent></AccordionItem></motion.div>)}</Accordion></section>
      {gaps.length>0 && <section className="mt-12 border-t border-border bg-section px-5 py-6"><h2 className="mb-3 text-lg font-semibold">Make this sharper</h2><ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">{gaps.map((gap,i)=><li key={i}>{gap}</li>)}</ul>{choice.company_id && <Button variant="outline" size="sm" className="mt-5" onClick={()=>setDetails(true)}><Settings2 className="size-3.5"/>Company details</Button>}</section>}
    </>}
    {details && choice.company_id && <CompanyDialog companyId={choice.company_id} onClose={()=>setDetails(false)} onSaved={()=>setDetails(false)}/>}
  </>;
}
