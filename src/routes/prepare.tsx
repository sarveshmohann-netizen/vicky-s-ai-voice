import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AppShell, Loading } from '@/components/vicky/AppShell';
import { Markdown } from '@/components/vicky/Markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getPracticeQuestions, vickyGrade } from '@/lib/vicky.functions';
import { withinTolerance } from '@/lib/vicky/readiness';
import type { Question } from '@/lib/vicky/knowledge';

export const Route = createFileRoute('/prepare')({
  head: () => ({ meta: [
    { title: 'Prepare the Founder · Vicky by June Analytics' },
    { name: 'description', content: 'Practise the questions investors will ask and get your answers graded against Tidewell’s data.' },
    { property: 'og:title', content: 'Prepare the Founder · Vicky by June Analytics' },
    { property: 'og:description', content: 'Draft answers to investor questions and get a rubric score with coaching.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <AppShell eyebrow="Practice" title="Prepare the Founder" intro="Five questions chosen for Tidewell’s weakest spots. Draft an answer and Vicky grades it on evidence, clarity, accuracy and ownership.">
    {id => <Practice founderId={id} />}
  </AppShell>,
});

function Practice({ founderId }: { founderId: string }) {
  const q = useQuery({ queryKey: ['questions', founderId], queryFn: () => getPracticeQuestions({ data: { founder_id: founderId } }), staleTime: Infinity });
  if (q.isPending) return <Loading label="Choosing your questions…" />;
  if (q.isError) return <p role="alert" className="text-destructive">{q.error.message}</p>;
  return <div className="space-y-6">
    {q.data.map((question, i) => <QuestionCard key={question.id} n={i + 1} question={question} founderId={founderId} />)}
    <p className="text-sm text-muted-foreground">After grading, revisit <Link to="/" className="font-medium text-accent underline">Analyze the Numbers</Link> to see your readiness score update.</p>
  </div>;
}

const CRITERIA = ['evidence', 'clarity', 'accuracy', 'ownership'] as const;

function QuestionCard({ n, question, founderId }: { n: number; question: Question; founderId: string }) {
  const [answer, setAnswer] = useState('');
  const qc = useQueryClient();
  const grade = useMutation({
    mutationFn: () => vickyGrade({ data: { founder_id: founderId, questionId: question.id, answer } }),
    onSuccess: r => { if (!('error' in r)) void qc.invalidateQueries({ queryKey: ['analysis'] }); },
  });
  const r = grade.data;
  return <article className="rounded-lg border border-border bg-card">
    <div className="p-6 md:p-8">
      <p className="font-mono text-xs text-accent">Q{n}</p>
      <h2 className="mt-1 text-lg font-semibold">{question.question}</h2>
      <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">Why investors ask: </span>{question.testing}</p>
      <Textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={5} className="mt-5 bg-section" placeholder="Draft your answer, using Tidewell’s numbers…" aria-label={`Answer to question ${n}`} />
      <div className="mt-3 flex justify-end"><Button onClick={() => grade.mutate()} disabled={!answer.trim() || grade.isPending}>{grade.isPending ? 'Vicky is grading…' : r ? 'Grade again' : 'Grade my answer'}</Button></div>
      {grade.isError && <p role="alert" className="mt-3 text-sm text-destructive">{grade.error.message}</p>}
      {r && 'error' in r && <p role="alert" className="mt-3 text-sm text-destructive">{r.error}</p>}
    </div>
    {r && !('error' in r) && <div className="space-y-5 border-t border-border bg-muted/50 p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{CRITERIA.map(c => <div key={c} className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs capitalize text-muted-foreground">{c}</p>
        <p className="font-mono text-2xl font-semibold">{r.grade[c]}<span className="text-sm text-muted-foreground">/4</span></p>
        <div className="mt-2 flex gap-1">{[1, 2, 3, 4].map(k => <span key={k} className={'h-1.5 flex-1 rounded-full ' + (k <= r.grade[c] ? 'bg-accent' : 'bg-border')} />)}</div>
      </div>)}</div>
      <FactChecks checks={r.factChecks} />
      <div><h3 className="mb-1 text-sm font-semibold">Coaching note</h3><Markdown>{r.coachingNote}</Markdown></div>
      <div><h3 className="mb-1 text-sm font-semibold">Improved answer</h3><div className="rounded-lg border-l-4 border-accent bg-card p-4"><Markdown>{r.improvedAnswer}</Markdown></div></div>
    </div>}
  </article>;
}

function FactChecks({ checks }: { checks: { metric: string; stated: number; actual: number }[] }) {
  const wrong = checks.filter(c => !withinTolerance(c));
  if (!checks.length) return null;
  if (!wrong.length) return <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" />Every number you quoted matches the data.</p>;
  return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="size-4" />Numbers to correct</h3>
    <ul className="space-y-1 text-sm">{wrong.map(c => <li key={c.metric}>You said <span className="font-semibold">{c.metric}</span> was <span className="font-mono">{fmt(c.stated)}</span>; the data shows <span className="font-mono">{fmt(c.actual)}</span>.</li>)}</ul>
  </div>;
}

const fmt = (n: number) => Math.abs(n) < 1 && n !== 0 ? `${(n * 100).toFixed(1)}%` : n.toLocaleString('en-US', { maximumFractionDigits: 1 });
