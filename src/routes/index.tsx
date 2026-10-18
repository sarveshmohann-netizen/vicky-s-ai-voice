import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronDown,
  ListTree,
  Minus,
  Sparkles,
} from "lucide-react";
import { AppHeader, Loading, SessionGate } from "@/components/vicky/AppShell";
import { ContextBar } from "@/components/vicky/ContextBar";
import { Button } from "@/components/ui/button";
import { MetricsDialog } from "@/components/vicky/MetricsDialog";
import { formatMetric } from "@/lib/vicky/tidewell/metrics";
import type { LensStatus } from "@/lib/vicky/lens";
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
  // The MRR trend leads; next to it, the chart behind the first prep item that
  // isn't MRR (or the next chart with data), so the row never has a gap.
  const lead = coach.charts.includes("mrr") ? ["mrr" as const] : [];
  const second =
    coach.plan.map((p) => p.chart).find((c) => c && !lead.includes(c as "mrr")) ??
    coach.charts.find((c) => !lead.includes(c as "mrr"));
  const primary = [...lead, ...(second ? [second] : [])].slice(0, 2);
  const extra = coach.charts.filter((c) => !primary.includes(c));
  const missing = Array.isArray(analysis.dataGaps) ? analysis.dataGaps : analysis.dataGaps.items;
  const glance = GLANCE.filter((g) => analysis.metrics[g.id]);
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <ContextBar />
      <main id="main" className="mx-auto max-w-7xl space-y-10 px-5 py-6 md:px-8">
        {/* 1. The overview first: every key number on one row, with the full list and the gaps one click away. */}
        <section aria-labelledby="glance-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{analysis.company.name}</p>
              <h1 id="glance-heading" className="font-sans text-2xl font-bold text-foreground">
                Your numbers at a glance
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <MetricsDialog
                metrics={analysis.metrics}
                trigger={
                  <Button variant="outline" size="sm">
                    <ListTree className="size-4" aria-hidden />
                    All numbers
                  </Button>
                }
              />
              {missing.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGaps(!gaps)}
                  aria-expanded={gaps}
                  aria-controls="sharper"
                >
                  <Sparkles className="size-4" aria-hidden />
                  Make this sharper
                  <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                    {missing.length}
                  </span>
                </Button>
              )}
            </div>
          </div>
          {gaps && (
            <div id="sharper" className="mb-4 rounded-xl border border-primary/30 bg-section p-4">
              <p className="mb-2 text-sm font-semibold text-section-foreground">
                Add these and Vicky's answers get more specific:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-section-foreground">
                {missing.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {glance.map((g) => {
              const m = analysis.metrics[g.id]!;
              return (
                <div key={g.id} className="rounded-xl border border-border bg-card px-4 py-3">
                  <dt className="text-xs font-medium text-muted-foreground">{g.label}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {formatMetric(m)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>

        {/* 2. The investor's view: the biggest numbers on the page. */}
        <section aria-labelledby="lens-heading" className="rounded-2xl bg-section p-5 md:p-7">
          <div className="mb-5 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-3xl">
              <h2
                id="lens-heading"
                className="font-sans text-sm font-semibold uppercase tracking-wide text-primary"
              >
                How this investor will read you
              </h2>
              <p className="mt-2 text-xl font-semibold leading-snug text-section-foreground md:text-2xl">
                {brief.lens.headline}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <svg
                viewBox="0 0 100 100"
                className="size-20 -rotate-90"
                role="img"
                aria-label={`Readiness ${analysis.readiness.score} out of 100, ${analysis.readiness.band}`}
              >
                <circle cx="50" cy="50" r="43" fill="none" stroke="var(--border)" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="43"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="8"
                  strokeLinecap="round"
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
              <div>
                <p className="text-xs text-muted-foreground">Readiness</p>
                <p className="text-sm font-semibold text-section-foreground">
                  {analysis.readiness.band}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {brief.lens.focus.map((f) => {
              const st = STATUS[f.status];
              return (
                <article
                  key={f.id}
                  className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold capitalize text-foreground">{f.short}</h3>
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " +
                        st.className
                      }
                    >
                      <st.icon className="size-3" aria-hidden />
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-3 break-words text-3xl font-bold tabular-nums text-primary md:text-4xl">
                    {f.value}
                  </p>
                  {f.bar ? (
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      {f.bar.appliesAs.split(",")[0]}: {f.bar.text}{" "}
                      <a
                        href={f.bar.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="whitespace-nowrap text-primary underline underline-offset-2"
                      >
                        {f.bar.source.short}, {f.bar.source.checked}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </p>
                  ) : (
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{f.note}</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* 3. What to do about it. */}
        <section aria-labelledby="prep-heading">
          <h2 id="prep-heading" className="mb-4 font-sans text-xl font-bold">
            Before this meeting
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {coach.plan.map((item, i) => (
              <li
                key={item.id}
                className="flex flex-col rounded-xl border border-border bg-card p-5"
              >
                <span className="mb-2 flex size-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="text-base font-semibold leading-snug">{item.title}</h3>
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Now: </span>
                  <span className="font-semibold text-primary">{item.now}</span>
                </p>
                <details className="group mt-3 text-sm">
                  <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1 font-medium text-foreground">
                    How to fix it
                    <ChevronDown
                      className="size-4 transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <ol className="mt-2 list-decimal space-y-2 pl-5 leading-relaxed text-muted-foreground">
                    {item.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </details>
                <Button asChild size="sm" className="mt-auto self-start">
                  <Link to="/practice" search={{ ...choice, mode: "ask", prompt: item.ask }}>
                    Ask Vicky
                    <ArrowUpRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </li>
            ))}
          </ol>
        </section>

        {/* 4. The evidence. */}
        <section aria-labelledby="charts-heading">
          <h2 id="charts-heading" className="mb-4 font-sans text-xl font-bold">
            The trend behind it
          </h2>
          <div className="grid gap-5 lg:grid-cols-5">
            {primary.map((id, i) => (
              <div key={id} className={i === 0 ? "min-w-0 lg:col-span-3" : "min-w-0 lg:col-span-2"}>
                <EngineChart id={id} charts={analysis.charts} size={i === 0 ? "lg" : "md"} />
              </div>
            ))}
          </div>
          {extra.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setMore(!more)}
                aria-expanded={more}
              >
                {more ? "Fewer charts" : "More charts"}
                <ChevronDown
                  className={"size-4 transition-transform " + (more ? "rotate-180" : "")}
                  aria-hidden
                />
              </Button>
              {more && (
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {extra.map((id) => (
                    <EngineChart key={id} id={id} charts={analysis.charts} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <footer className="border-t border-border pt-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {analysis.readiness.disclaimer}
          </p>
        </footer>
      </main>
    </div>
  );
}

// The overview row: the numbers most founders get asked about first.
const GLANCE = [
  { id: "arr", label: "ARR" },
  { id: "growth3m", label: "Growth, last 3 months" },
  { id: "grossMarginWithSupport", label: "Gross margin" },
  { id: "monthlyBurn", label: "Monthly burn" },
  { id: "runwayToday", label: "Runway today" },
  { id: "nrr", label: "Net revenue retention" },
  { id: "logoChurnMonthly12m", label: "Monthly churn" },
  { id: "cacPaybackMonths", label: "CAC payback" },
];

// Status is shown with an icon and a word, never by colour alone.
const STATUS: Record<LensStatus, { label: string; icon: typeof Check; className: string }> = {
  meets: { label: "Meets the bar", icon: Check, className: "bg-success/10 text-success" },
  close: { label: "Close", icon: Minus, className: "bg-warning/20 text-warning-foreground" },
  below: {
    label: "Below the bar",
    icon: ArrowDown,
    className: "bg-destructive/10 text-destructive",
  },
  "no bar": { label: "No published bar", icon: Minus, className: "bg-muted text-muted-foreground" },
};
