import { useEffect, useState, type ReactNode } from "react";
import { ClientOnly, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LockKeyhole, LogOut } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { meetingSearchSchema } from "@/lib/vicky-inputs";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/practice", label: "Vicky" },
  { to: "/learn", label: "Learn" },
] as const;

export function AppShell({
  title,
  eyebrow,
  intro,
  children,
}: {
  title: string;
  eyebrow: string;
  intro: string;
  children: (userId: string) => ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <h1 className="font-heading mx-auto max-w-6xl px-5 pt-8 text-3xl font-bold text-navy">
        {title}
      </h1>
      <main className="vicky-content mx-auto max-w-6xl px-5 md:px-8">
        <ClientOnly fallback={<Loading />}>
          <SessionGate>{children}</SessionGate>
        </ClientOnly>
      </main>
    </div>
  );
}

export function AppHeader({ transparent = false }: { transparent?: boolean }) {
  return (
    <header
      className={
        // The see-through header sits on a page's hero and scrolls away with it;
        // the solid one stays pinned.
        transparent
          ? "relative z-20 bg-transparent"
          : "sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur"
      }
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-x-6 gap-y-3 px-5 py-4 md:grid-cols-[1fr_auto_1fr] md:px-8">
        <Link
          to="/"
          search={(prev) => meetingSearchSchema.parse(prev)}
          className="flex items-center gap-3"
        >
          <img
            src="/brand/june-analytics-logo-navy.png"
            alt="June Analytics"
            className="h-5 w-auto"
          />
          <span className="font-heading border-l border-navy/20 pl-3 text-lg font-bold text-navy">
            Vicky<span className="text-primary">.</span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex justify-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              search={(prev) => ({ ...meetingSearchSchema.parse(prev), mode: "question" as const })}
              activeOptions={{ exact: true, includeSearch: false }}
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-navy/70 transition-colors hover:bg-white/60 hover:text-navy"
              activeProps={{ className: "bg-white !text-navy shadow-sm ring-1 ring-navy/10" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div aria-hidden className="hidden md:block" />
      </div>
    </header>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-6 text-muted-foreground">
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
      {label}
    </p>
  );
}

export function SessionGate({ children }: { children: (userId: string) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  if (session === undefined) return <Loading />;
  if (!session)
    return (
      <section className="mx-auto max-w-md px-5 py-8 text-center">
        <LockKeyhole className="mx-auto mb-4 size-7 text-primary" />
        <h2 className="font-heading mb-1 text-2xl font-bold text-navy">
          Sign in to work with Vicky
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Your practice answers and readiness score are saved to your account.
        </p>
        <div className="flex flex-col gap-3">
          {(["google", "lovable"] as const).map((p) => (
            <Button
              key={p}
              variant="outline"
              size="lg"
              onClick={async () => {
                setError("");
                const r = await lovable.auth.signInWithOAuth(p, {
                  redirect_uri: window.location.origin + window.location.pathname,
                });
                if (r.error) setError("Sign-in failed. Please try again.");
              }}
            >
              Continue with {p === "google" ? "Google" : "Lovable"}
            </Button>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </section>
    );
  return (
    <>
      <div className="flex items-center justify-end gap-3 px-4 py-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">{session.user.email}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            queryClient.clear();
            await supabase.auth.signOut();
          }}
        >
          <LogOut className="size-3.5" />
          Sign out
        </Button>
      </div>
      {children(session.user.id)}
    </>
  );
}
