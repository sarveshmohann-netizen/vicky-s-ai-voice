import { Suspense, useState, type FormEvent } from 'react';
import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { BookOpen, Plus, Trash2, LogOut, LockKeyhole, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/vicky/AppShell';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';
import { addLesson, deleteLesson, lessonsPageOptions } from '@/lib/lessons';
import '@lovable.dev/cloud-auth-js/styles.css';

export const Route = createFileRoute('/lessons')({
  head: () => ({ meta: [
    { title: 'Lessons · Vicky AI VC' },
    { name: 'description', content: 'Team corrections for Vicky’s financial coaching.' },
    { property: 'og:title', content: 'Lessons · Vicky AI VC' },
    { property: 'og:description', content: 'Team corrections for Vicky’s financial coaching.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: LessonsPage,
});

function LessonsPage() {
  return <div className="min-h-screen bg-background text-foreground">
    <AppHeader />
    <div className="vicky-intro"><p className="mb-4 text-xs font-semibold uppercase text-primary">Vicky’s knowledge</p><h1 className="text-4xl md:text-5xl">Lessons</h1></div>
    <main className="mx-auto max-w-5xl px-6 py-12">
      <ClientOnly fallback={<Loading />}><Suspense fallback={<Loading />}><LessonsWorkspace /></Suspense></ClientOnly>
    </main>
  </div>;
}

function Loading() {
  return <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />Loading…</p>;
}

function LessonsWorkspace() {
  const { data } = useSuspenseQuery(lessonsPageOptions);
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [topics, setTopics] = useState('all');
  const [notice, setNotice] = useState('');
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => addLesson(text, topics),
    onSuccess: async () => { setText(''); setTopics('all'); setNotice('Lesson added.'); await queryClient.invalidateQueries({ queryKey: lessonsPageOptions.queryKey }); },
  });
  const remove = useMutation({
    mutationFn: deleteLesson,
    onSuccess: async () => { setConfirmDelete(null); setNotice('Lesson deleted.'); await queryClient.invalidateQueries({ queryKey: lessonsPageOptions.queryKey }); },
  });
  async function signIn(provider: 'google' | 'lovable') {
    setAuthError(''); setSigningIn(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/lessons` });
      if (result.error) throw result.error;
      if (!result.redirected) await queryClient.invalidateQueries({ queryKey: lessonsPageOptions.queryKey });
    } catch { setAuthError('Sign-in failed. Please try again.'); }
    finally { setSigningIn(false); }
  }
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError('Could not sign out. Please try again.');
    await queryClient.invalidateQueries();
  }
  if (!data.user) return <section className="max-w-md py-8">
    <LockKeyhole className="mb-6 size-8 text-primary" />
    <h2 className="mb-6 text-2xl font-semibold">Team sign-in</h2>
    <div className="flex flex-col gap-3">
      <Button variant="outline" size="lg" disabled={signingIn} onClick={() => void signIn('google')}>Continue with Google</Button>
      <Button className="lovable-auth-button w-full" disabled={signingIn} onClick={() => void signIn('lovable')}>Continue with Lovable</Button>
    </div>
    {authError && <p role="alert" className="mt-4 text-sm text-destructive">{authError}</p>}
  </section>;
  return <>
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><span className="break-all text-sm text-muted-foreground">{data.user.email}</span><Button variant="ghost" onClick={() => void signOut()}><LogOut />Sign out</Button></div>
    {authError && <p role="alert" className="mb-4 text-sm text-destructive">{authError}</p>}
    {!data.admin ? <section className="border-l-2 border-primary py-2 pl-5"><h2 className="mb-2 text-xl font-semibold">Administrator access required</h2><p className="text-sm text-muted-foreground">Your account hasn’t been granted permission to manage lessons.</p></section> : <div className="grid items-start gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <section><h2 className="mb-6 text-xl font-semibold">New lesson</h2>
        <form className="space-y-5" onSubmit={(event: FormEvent) => { event.preventDefault(); setNotice(''); save.mutate(); }}>
          <div className="space-y-2"><label htmlFor="topics" className="text-sm font-medium">Topics</label><Input id="topics" value={topics} onChange={(event) => setTopics(event.target.value)} placeholder="all, or runway, churn" disabled={save.isPending} /></div>
          <div className="space-y-2"><label htmlFor="correction" className="text-sm font-medium">Correction</label><Textarea id="correction" className="min-h-44 resize-y" value={text} onChange={(event) => setText(event.target.value)} required disabled={save.isPending} /></div>
          <Button type="submit" disabled={save.isPending || !text.trim()}><Plus />{save.isPending ? 'Saving…' : 'Add lesson'}</Button>
          {save.error && <p role="alert" className="text-sm text-destructive">Could not save: {save.error.message}</p>}
        </form>
      </section>
      <section><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-semibold">Saved lessons</h2><span className="text-sm tabular-nums text-muted-foreground">{data.lessons.length}</span></div>
        {notice && <p role="status" className="mb-4 text-sm text-primary">{notice}</p>}
        {remove.error && <p role="alert" className="mb-4 text-sm text-destructive">{remove.error.message}</p>}
        {!data.lessons.length ? <div className="border-y border-dashed border-border py-12 text-center"><BookOpen className="mx-auto mb-4 size-6 text-muted-foreground" /><p className="font-medium">No lessons yet</p></div> : <ul className="divide-y divide-border border-t border-border">{data.lessons.map((lesson) => <li key={lesson.id} className="py-5">
          <div className="mb-3 flex items-start justify-between gap-3"><div className="flex flex-wrap gap-2">{lesson.topics.map((topic) => <span key={topic} className="rounded-sm bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">{topic === 'all' ? 'All topics' : topic}</span>)}</div><Button variant="ghost" size="icon" aria-label="Delete lesson" title="Delete lesson" disabled={remove.isPending} onClick={() => { setConfirmDelete(lesson.id); remove.reset(); }}><Trash2 className="text-muted-foreground" /></Button></div>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{lesson.text}</p>
          <p className="mt-3 text-xs text-muted-foreground">{new Date(lesson.created_at).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
          {confirmDelete === lesson.id && <div className="mt-4 flex flex-wrap items-center gap-3"><span className="text-sm">Delete this lesson?</span><Button variant="destructive" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(lesson.id)}>{remove.isPending ? 'Deleting…' : 'Delete'}</Button><Button variant="outline" size="sm" disabled={remove.isPending} onClick={() => setConfirmDelete(null)}>Cancel</Button></div>}
        </li>)}</ul>}
      </section>
    </div>}
  </>;
}