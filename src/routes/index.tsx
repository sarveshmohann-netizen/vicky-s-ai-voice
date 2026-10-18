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
import { VickyAvatar } from "@/components/vicky/VickyAvatar";
import { PERSONAS } from "@/lib/vicky/knowledge";
import { Button } from "@/components/ui/button";
import { MetricsDialog } from "@/components/vicky/MetricsDialog";
import { formatMetric } from "@/lib/vicky/tidewell/metrics";
import type { LensStatus } from "@/lib/vicky/lens";
import { EngineChart } from "@/components/vicky/EngineChart";
import type { ChartId } from "@/lib/vicky/coach";
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
  const missing = Array.isArray(analysis.dataGaps) ? analysis.dataGaps : analysis.dataGaps.items;
  const glance = GLANCE.filter((g) => analysis.metrics[g.id]);
  // The MRR trend sits in the results band; each prep item brings its own chart,
  // and whatever is left goes behind "More charts".
  // MRR already leads the results band, so a growth item shows the monthly growth bars instead.
  const chartFor = (c: ChartId | null): ChartId | null =>
    c === "mrr" ? (coach.charts.includes("growth") ? "growth" : null) : c;
  const shown = new Set<string>(["mrr", ...coach.plan.map((p) => chartFor(p.chart) ?? "")]);
  const extra = coach.charts.filter((c) => !shown.has(c));
  const pairs = [brief.lens.focus.slice(0, 2), brief.lens.focus.slice(2, 4)].filter(
    (p) => p.length,
  );
  const first = coach.plan[0];
  const persona = PERSONAS[choice.persona];
  return (
    <div className="min-h-screen bg-background">
      {/* 1. Hero: who you're meeting, how ready you are, and the two things to do next. */}
      <div className="vicky-hero">
        <AppHeader transparent />
        <section
          aria-labelledby="hero-heading"
          className="mx-auto max-w-4xl px-5 pb-16 pt-10 text-center md:pb-24 md:pt-16"
        >
          <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-medium text-navy shadow-sm">
            <span className="font-semibold tabular-nums">{analysis.readiness.score}/100</span>
            readiness
            <span aria-hidden className="text-navy/40">
              ·
            </span>
            {analysis.readiness.band}
          </p>
          <h1
            id="hero-heading"
            className="font-heading mt-6 text-4xl font-extrabold leading-[1.05] text-navy sm:text-5xl md:text-7xl"
          >
            Walk in knowing your numbers
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-navy/75 md:text-lg">
            {analysis.company.name}, seen the way {persona.name} will see it. {brief.lens.headline}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <MetricsDialog
              metrics={analysis.metrics}
              trigger={
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-lg border-navy/30 bg-white/60 text-navy hover:bg-white"
                >
                  <ListTree className="size-4" aria-hidden />
                  All numbers
                </Button>
              }
            />
            <Button
              asChild
              size="lg"
              className="rounded-lg bg-navy text-navy-foreground hover:bg-navy/90"
            >
              <Link
                to="/practice"
                search={{ ...choice, mode: "ask", prompt: first?.ask ?? undefined }}
              >
                Ask Vicky
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="mt-8">
            <ContextBar bare />
          </div>
          {missing.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setGaps(!gaps)}
                aria-expanded={gaps}
                aria-controls="sharper"
                className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-navy underline-offset-4 hover:underline"
              >
                <Sparkles className="size-4" aria-hidden />
                Make this sharper ({missing.length} missing)
                <ChevronDown
                  className={"size-4 transition-transform " + (gaps ? "rotate-180" : "")}
                  aria-hidden
                />
              </button>
              {gaps && (
                <div
                  id="sharper"
                  className="mx-auto mt-3 max-w-xl rounded-xl bg-white/80 p-4 text-left shadow-sm"
                >
                  <p className="mb-2 text-sm font-semibold text-navy">
                    Add these and Vicky's answers get more specific:
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-navy/80">
                    {missing.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* 2. The numbers strip: every key number before anything else. */}
      <section aria-labelledby="glance-heading" className="bg-navy text-navy-foreground">
        <h2 id="glance-heading" className="sr-only">
          Your numbers at a glance
        </h2>
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-6 px-5 py-8 sm:grid-cols-4 md:px-8 lg:grid-cols-8">
          {glance.map((g) => (
            <div key={g.id} className="text-center">
              <dt className="text-xs font-medium text-navy-foreground/70">{g.label}</dt>
              <dd className="font-heading mt-1 text-2xl font-bold tabular-nums">
                {formatMetric(analysis.metrics[g.id]!)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <main id="main">
        {/* 3. The investor's view: trend on the left, what they check first on the right. */}
        <section aria-labelledby="lens-heading" className="on-navy bg-navy text-navy-foreground">
          <div className="mx-auto max-w-7xl border-t border-white/10 px-5 py-16 md:px-8 md:py-24">
            <h2
              id="lens-heading"
              className="font-heading text-center text-3xl font-bold md:text-5xl"
            >
              How {persona.name} will read you
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-base text-navy-foreground/75">
              The trend they will ask about, and the four numbers they check first against their
              published bar.
            </p>
            <div className="mt-12 grid gap-6 lg:grid-cols-5">
              <div className="min-w-0 lg:col-span-3">
                <EngineChart id="mrr" charts={analysis.charts} size="lg" />
              </div>
              <div className="grid gap-6 lg:col-span-2">
                {pairs.map((pair, i) => (
                  <div key={i} className="vicky-card-glow grid gap-5 rounded-2xl p-6 text-navy">
                    {pair.map((f) => {
                      const st = STATUS[f.status];
                      return (
                        <article key={f.id}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold capitalize">{f.short}</h3>
                            <span
                              className={
                                "inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-xs font-semibold " +
                                st.text
                              }
                            >
                              <st.icon className="size-3" aria-hidden />
                              {st.label}
                            </span>
                          </div>
                          <p className="font-heading mt-1 break-words text-4xl font-extrabold tabular-nums">
                            {f.value}
                          </p>
                          {f.bar ? (
                            <p className="mt-1 text-xs leading-relaxed text-navy/75">
                              {f.bar.appliesAs.split(",")[0]}: {f.bar.text}{" "}
                              <a
                                href={f.bar.source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="whitespace-nowrap font-medium underline underline-offset-2"
                              >
                                {f.bar.source.short}, {f.bar.source.checked}
                                <span className="sr-only"> (opens in a new tab)</span>
                              </a>
                            </p>
                          ) : (
                            <p className="mt-1 text-xs leading-relaxed text-navy/75">{f.note}</p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4. Vicky's one-line verdict, set like a testimonial. */}
        {first && (
          <section
            aria-label="Vicky's top advice"
            className="mx-auto max-w-5xl px-5 py-16 md:py-24"
          >
            <figure className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-elegant)] md:p-12">
              <blockquote className="font-heading text-2xl font-semibold leading-snug text-navy md:text-3xl">
                “{first.title}. {first.steps[0]}”
              </blockquote>
              <figcaption className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <span className="flex items-center gap-3">
                  <VickyAvatar />
                  <span>
                    <span className="block font-semibold text-foreground">Vicky</span>
                    <span className="block text-sm text-muted-foreground">Your pitch coach</span>
                  </span>
                </span>
                <Button asChild variant="outline" className="rounded-lg">
                  <Link to="/practice" search={{ ...choice, mode: "ask", prompt: first.ask }}>
                    Talk it through
                    <ArrowUpRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </figcaption>
            </figure>
          </section>
        )}

        {/* 5. What to do about it, one feature row per priority with its evidence. */}
        <section aria-labelledby="prep-heading" className="mx-auto max-w-7xl px-5 pb-16 md:px-8">
          <h2
            id="prep-heading"
            className="font-heading text-center text-3xl font-bold text-navy md:text-5xl"
          >
            Before this meeting
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base text-muted-foreground">
            The {coach.plan.length} things most likely to come up, in order, with what to do about
            each and the chart behind it.
          </p>
          <ol className="mt-14 space-y-16">
            {coach.plan.map((item, i) => (
              <li key={item.id} className="grid items-center gap-8 lg:grid-cols-2">
                <div className={i % 2 ? "lg:order-2" : ""}>
                  <span className="flex size-9 items-center justify-center rounded-full bg-navy text-sm font-semibold text-navy-foreground">
                    {i + 1}
                  </span>
                  <h3 className="font-heading mt-4 text-2xl font-bold leading-tight text-navy md:text-3xl">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-base">
                    <span className="text-muted-foreground">You're at </span>
                    <span className="font-semibold text-primary">{item.now}</span>
                  </p>
                  <ol className="mt-4 list-decimal space-y-2 pl-5 text-base leading-relaxed text-muted-foreground">
                    {item.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <Button
                    asChild
                    className="mt-6 rounded-lg bg-navy text-navy-foreground hover:bg-navy/90"
                  >
                    <Link to="/practice" search={{ ...choice, mode: "ask", prompt: item.ask }}>
                      Ask Vicky
                      <ArrowUpRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
                {chartFor(item.chart) && (
                  <div className="min-w-0">
                    <EngineChart id={chartFor(item.chart)!} charts={analysis.charts} />
                  </div>
                )}
              </li>
            ))}
          </ol>

          {extra.length > 0 && (
            <div className="mt-16 text-center">
              <Button
                variant="outline"
                className="rounded-lg"
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
                <div className="mt-6 grid gap-5 text-left md:grid-cols-2">
                  {extra.map((id) => (
                    <EngineChart key={id} id={id} charts={analysis.charts} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <footer className="border-t border-border">
          <p className="mx-auto max-w-7xl px-5 py-6 text-xs leading-relaxed text-muted-foreground md:px-8">
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
const STATUS: Record<
  LensStatus,
  { label: string; icon: typeof Check; className: string; text: string }
> = {
  meets: {
    label: "Meets the bar",
    icon: Check,
    className: "bg-success/10 text-success",
    text: "text-success",
  },
  close: {
    label: "Close",
    icon: Minus,
    className: "bg-warning/20 text-warning-foreground",
    text: "text-warning-foreground",
  },
  below: {
    label: "Below the bar",
    icon: ArrowDown,
    className: "bg-destructive/10 text-destructive",
    text: "text-destructive",
  },
  "no bar": {
    label: "No published bar",
    icon: Minus,
    className: "bg-muted text-muted-foreground",
    text: "text-navy/70",
  },
};
