import { useEffect, useState, type ReactNode } from 'react';
import { ClientOnly, Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, LockKeyhole, LogOut } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';
import { meetingSearchSchema } from '@/lib/vicky-inputs';
import { CompanySwitcher } from './CompanySwitcher';

const NAV = [
  { to: '/', label: 'Meeting prep' },
  { to: '/practice', label: 'Practice' },
] as const;

export function AppShell({ title, eyebrow, intro, children }: { title: string; eyebrow: string; intro: string; children: (userId: string) => ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">
    <AppHeader />
    <div className="vicky-intro">
      <p className="mb-4 text-xs font-semibold uppercase text-primary">{eyebrow}</p>
      <h1 className="text-4xl md:text-5xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">{intro}</p>
    </div>
    <main className="vicky-content mx-auto max-w-6xl px-5 md:px-8">
      <ClientOnly fallback={<Loading />}><SessionGate>{children}</SessionGate></ClientOnly>
    </main>
  </div>;
}

export function AppHeader() {
  return <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 md:px-8">
        <Link to="/" search={prev => meetingSearchSchema.parse(prev)} className="flex items-center gap-3">
          <img src="/brand/june-analytics-logo.png" alt="June Analytics" className="h-8 w-auto" />
          <span className="border-l border-border pl-3 text-lg font-bold">Vicky<span className="text-primary">.</span></span>
        </Link>
        <nav aria-label="Main" className="-mx-1 flex max-w-full gap-1 overflow-x-auto">
          {NAV.map(n => <Link key={n.to} to={n.to} search={prev => ({ ...meetingSearchSchema.parse(prev), mode: 'question' as const })} activeOptions={{ exact: true, includeSearch: false }}
            className="whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
            activeProps={{ className: 'bg-secondary !text-primary' }}>{n.label}</Link>)}
        </nav>
      </div>
    </header>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p role="status" className="flex items-center gap-2 py-6 text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />{label}</p>;
}

export function SessionGate({ children }: { children: (userId: string) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  if (session === undefined) return <Loading />;
  if (!session) return <section className="mx-auto max-w-md py-8 text-center">
    <LockKeyhole className="mx-auto mb-4 size-7 text-primary" />
    <h2 className="mb-1 text-xl font-semibold">Sign in to work with Vicky</h2>
    <p className="mb-6 text-sm text-muted-foreground">Your practice answers and readiness score are saved to your account.</p>
    <div className="flex flex-col gap-3">
      {(['google', 'lovable'] as const).map(p => <Button key={p} variant="outline" size="lg" onClick={async () => {
        setError('');
        const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin + window.location.pathname });
        if (r.error) setError('Sign-in failed. Please try again.');
      }}>Continue with {p === 'google' ? 'Google' : 'Lovable'}</Button>)}
    </div>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
  </section>;
  return <>
    <div className="mb-6 flex items-center justify-end gap-3 text-xs text-muted-foreground">
      <span className="min-w-0 truncate">{session.user.email}</span>
      <Button variant="ghost" size="sm" onClick={async () => { queryClient.clear(); await supabase.auth.signOut(); }}><LogOut className="size-3.5" />Sign out</Button>
    </div>
    <CompanySwitcher founderId={session.user.id} />
    {children(session.user.id)}
  </>;
}
