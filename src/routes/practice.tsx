import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AppShell, Loading } from '@/components/vicky/AppShell';
import { Chat } from '@/components/vicky/Chat';
import { QuestionCard } from '@/components/vicky/QuestionCard';
import { MeetingPickers } from '@/components/vicky/MeetingPickers';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getPracticeQuestions } from '@/lib/vicky.functions';
import { meetingSearchSchema } from '@/lib/vicky-inputs';
import { QUESTIONS, PERSONAS } from '@/lib/vicky/knowledge';

const searchSchema = meetingSearchSchema.extend({ question: z.string().optional(), mode: z.enum(['question', 'ask', 'simulate']).catch('question') });
export const Route = createFileRoute('/practice')({
  validateSearch: input => searchSchema.parse(input),
  head: () => ({ meta: [
    { title: 'Practice · Vicky by June Analytics' }, { name: 'description', content: 'Rehearse investor questions, grade your answers and run a mock pitch with Vicky.' },
    { property: 'og:title', content: 'Practice · Vicky by June Analytics' }, { property: 'og:description', content: 'Investor-specific pitch practice with fact-checked answers and coaching.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <AppShell eyebrow="Tidewell · Rehearse your pitch" title="Practice" intro="Know the numbers. Own the answer.">{id => <Practice founderId={id} />}</AppShell>,
});

function Practice({ founderId }: { founderId: string }) {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const q = useQuery({ queryKey: ['questions', founderId, search.persona, search.stage], queryFn: () => getPracticeQuestions({ data: { founder_id: founderId, persona: search.persona, stage: search.stage } }) });
  const selected = QUESTIONS.find(q => q.id === search.question) ?? q.data?.[0];
  const choices = q.data ? [selected, ...q.data.filter(q => q.id !== selected?.id)].filter(q => q !== undefined) : [];
  return <>
    <MeetingPickers persona={search.persona} stage={search.stage} onChange={choice => void navigate({ search: { ...search, ...choice } })} />
    <p className="mb-5 text-xs text-muted-foreground"><span className="font-semibold">Says no when: </span>{PERSONAS[search.persona].saysNoWhen}</p>
    <Tabs value={search.mode} onValueChange={mode => void navigate({ search: { ...search, mode: searchSchema.shape.mode.parse(mode) } })}>
      <TabsList className="mb-6"><TabsTrigger value="question">Question practice</TabsTrigger><TabsTrigger value="ask">Ask Vicky</TabsTrigger><TabsTrigger value="simulate">Mock meeting</TabsTrigger></TabsList>
      <TabsContent value="question">{q.isPending ? <Loading label="Choosing questions…" /> : q.isError ? <p role="alert" className="text-destructive">{q.error.message}</p> : selected && <>
        <Select value={selected.id} onValueChange={question => void navigate({ search: { ...search, question } })}><SelectTrigger aria-label="Practice question" className="mb-6 h-auto min-h-10 whitespace-normal py-3 text-left [&>span]:line-clamp-none"><SelectValue /></SelectTrigger><SelectContent>{choices.map(question => <SelectItem key={question.id} value={question.id}>{question.question}</SelectItem>)}</SelectContent></Select>
        <Chat key={`${search.persona}-${search.stage}-${selected.id}`} founderId={founderId} mode="ask" persona={search.persona} stage={search.stage} initialQuestion={selected.question} placeholder="Rehearse your answer…" />
        <div className="mt-8"><QuestionCard key={selected.id} n={selected.number ?? 1} question={selected} founderId={founderId} /></div>
      </>}</TabsContent>
      <TabsContent value="ask"><Chat key={`ask-${search.persona}-${search.stage}`} founderId={founderId} mode="ask" persona={search.persona} stage={search.stage} placeholder="Ask about your numbers…" empty={<p className="text-sm text-muted-foreground">What will this investor challenge first?</p>} /></TabsContent>
      <TabsContent value="simulate"><Chat key={`simulate-${search.persona}-${search.stage}`} founderId={founderId} mode="simulate" persona={search.persona} stage={search.stage} placeholder="Answer the investor…" starter="I'm ready for our mock meeting. Please ask five questions one at a time, then give me the scorecard." empty={<p className="font-medium">{PERSONAS[search.persona].name}</p>} /></TabsContent>
    </Tabs>
  </>;
}
