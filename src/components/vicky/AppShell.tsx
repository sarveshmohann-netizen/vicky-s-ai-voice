import { useEffect, useState, type ReactNode } from 'react';
import { ClientOnly, Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, LockKeyhole, LogOut } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';

const NAV = [
  { to: '/', label: 'Analyze the Numbers' },
  { to: '/ask', label: 'Ask Vicky' },
  { to: '/prepare', label: 'Prepare the Founder' },
  { to: '/simulate', label: 'Simulate the Pitch' },
] as const;

export function AppShell({ title, eyebrow, intro, children }: { title: string; eyebrow: string; intro: string; children: (userId: string) => ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3">
        <Link to="/" className="flex items-center gap-3">
          <img src="/brand/june-analytics-logo.png" alt="June Analytics" className="h-9 w-auto" />
          <span className="border-l border-border pl-3 text-sm font-semibold tracking-tight">Vicky</span>
        </Link>
        <nav aria-label="Main" className="-mx-1 flex flex-1 gap-1 overflow-x-auto">
          {NAV.map(n => <Link key={n.to} to={n.to} activeOptions={{ exact: true }}
            className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            activeProps={{ className: 'bg-secondary !text-foreground' }}>{n.label}</Link>)}
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{intro}</p>
      </div>
      <ClientOnly fallback={<Loading />}><SessionGate>{children}</SessionGate></ClientOnly>
    </main>
  </div>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p role="status" className="flex items-center gap-2 py-6 text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />{label}</p>;
}

function SessionGate({ children }: { children: (userId: string) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  if (session === undefined) return <Loading />;
  if (!session) return <section className="max-w-md rounded-xl border border-border bg-card p-8">
    <LockKeyhole className="mb-4 size-7 text-accent" />
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
      <span>{session.user.email}</span>
      <Button variant="ghost" size="sm" onClick={async () => { queryClient.clear(); await supabase.auth.signOut(); }}><LogOut className="size-3.5" />Sign out</Button>
    </div>
    {children(session.user.id)}
  </>;
}
