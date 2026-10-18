import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { AppHeader, Loading, SessionGate } from "@/components/vicky/AppShell";
import { ContextBar } from "@/components/vicky/ContextBar";
import { Button } from "@/components/ui/button";
import { MetricsDialog } from "@/components/vicky/MetricsDialog";
import { Markdown } from "@/components/vicky/Markdown";
import { EngineChart } from "@/components/vicky/EngineChart";
import { useVickyDashboard } from "@/hooks/use-vicky-dashboard";
import { meetingSearchSchema } from "@/lib/vicky-inputs";
export const Route = createFileRoute("/")({
  validateSearch: (input) => meetingSearchSchema.parse(input),
  head: () => ({
    meta: [
      { title: "Dashboard · Vicky by June Analytics" },
      {
        name: "description",
        content: "Your investor lens, three preparation priorities and computed company charts.",
      },
      { property: "og:title", content: "Dashboard · Vicky by June Analytics" },
      {
        property: "og:description",
        content: "See your company through an investor’s eyes and prepare your next meeting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});
function Dashboard() {
  const choice = Route.useSearch(),
    { data, coach, error } = useVickyDashboard(choice);
  const [more, setMore] = useState(false),
    [gaps, setGaps] = useState(false);
  if (!data || !coach)
    return (
      <>
        <AppHeader />
        <ContextBar />
        <main className="p-6">
          {error ? (
            <p role="alert">{error.message}</p>
          ) : (
            <SessionGate>{() => <Loading />}</SessionGate>
          )}
        </main>
      </>
    );
  const { analysis, brief } = data;
  const primary = [
    ...new Set([
      ...(coach.charts.includes("mrr") ? ["mrr" as const] : []),
      ...(coach.plan[0]?.chart ? [coach.plan[0].chart] : []),
    ]),
  ];
  const extra = coach.charts.filter((c) => !primary.includes(c));
  const missing = Array.isArray(analysis.dataGaps) ? analysis.dataGaps : analysis.dataGaps.items;
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <ContextBar />
      <main className="mx-auto max-w-7xl px-5 py-5 md:px-8">
        <div className="mb-4 flex items-start justify-between gap-5">
          <div>
            <h1 className="text-sm font-semibold text-muted-foreground">
              {analysis.company.name} · Dashboard
            </h1>
            <p className="mt-2 max-w-4xl text-lg font-medium">{brief.lens.headline}</p>
          </div>
          <div className="shrink-0 text-center">
            <svg
              viewBox="0 0 100 100"
              className="size-16 -rotate-90"
              role="img"
              aria-label={`Readiness ${analysis.readiness.score} out of 100`}
            >
              <circle cx="50" cy="50" r="43" fill="none" stroke="var(--border)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="43"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="6"
                pathLength="100"
                strokeDasharray={`${analysis.readiness.score} 100`}
              />
              <text
                x="50"
                y="50"
                textAnchor="middle"
                dominantBaseline="central"
                transform="rotate(90 50 50)"
                className="readiness-ring-label"
              >
                {analysis.readiness.score}
              </text>
            </svg>
            <p className="text-[10px] text-muted-foreground">Readiness</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {brief.lens.focus.map((f) => (
            <article key={f.id} className="rounded-lg border border-border bg-section p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium capitalize">{f.short}</p>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] " +
                    (f.status === "below"
                      ? "bg-destructive/10 text-destructive"
                      : f.status === "meets"
                        ? "bg-success/10 text-success"
                        : f.status === "close"
                          ? "bg-warning/20 text-warning-foreground"
                          : "bg-muted text-muted-foreground")
                  }
                >
                  {f.status}
                </span>
              </div>
              <p className="mt-2 break-words text-2xl font-semibold text-primary">{f.value}</p>
              {f.bar && (
                <div className="mt-2 text-[10px] text-muted-foreground">
                  <p>{f.bar.text}</p>
                  <a
                    href={f.bar.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {f.bar.source.short}, {f.bar.source.checked} ↗
                  </a>
                </div>
              )}
            </article>
          ))}
        </div>
        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold">Before this meeting</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {coach.plan.map((item) => (
              <article key={item.id} className="flex flex-col rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm font-medium text-primary">{item.now}</p>
                {item.bar && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    <Markdown>{item.bar}</Markdown>
                  </div>
                )}
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer font-medium">How to fix it</summary>
                  <ol className="mt-3 list-decimal space-y-2 pl-4 leading-relaxed">
                    {item.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </details>
                <Button asChild variant="ghost" size="sm" className="mt-3 self-start px-0">
                  <Link to="/practice" search={{ ...choice, mode: "ask", prompt: item.ask }}>
                    Ask Vicky
                    <ArrowUpRight className="size-3" />
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        </section>
        <section className="mt-6 grid gap-8 md:grid-cols-2">
          {primary.map((id) => (
            <EngineChart key={id} id={id} charts={analysis.charts} />
          ))}
        </section>
        {extra.length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => setMore(!more)}
              aria-expanded={more}
            >
              More charts
              <ChevronDown className="size-3" />
            </Button>
            {more && (
              <div className="mt-5 grid gap-8 md:grid-cols-2">
                {extra.map((id) => (
                  <EngineChart key={id} id={id} charts={analysis.charts} />
                ))}
              </div>
            )}
          </>
        )}
        <footer className="mt-4 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-4">
            <MetricsDialog metrics={analysis.metrics} />
            <Button variant="ghost" size="sm" onClick={() => setGaps(!gaps)} aria-expanded={gaps}>
              Make this sharper
              <ChevronDown className="size-3" />
            </Button>
          </div>
          {gaps && (
            <ul className="my-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {missing.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            {analysis.readiness.disclaimer}
          </p>
        </footer>
      </main>
    </div>
  );
}
