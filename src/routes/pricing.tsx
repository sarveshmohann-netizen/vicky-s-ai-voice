import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Check } from "lucide-react";
import { AppHeader } from "@/components/vicky/AppShell";
import { Button } from "@/components/ui/button";
import { meetingSearchSchema } from "@/lib/vicky-inputs";

export const Route = createFileRoute("/pricing")({
  validateSearch: (input) => meetingSearchSchema.parse(input),
  head: () => ({
    meta: [
      { title: "Pricing · Vicky by June Analytics" },
      {
        name: "description",
        content:
          "A free start, a monthly Founder plan, a one-off $299 Raise Pass and seats for accelerators. No commission on your raise.",
      },
      { property: "og:title", content: "Pricing · Vicky by June Analytics" },
      {
        property: "og:description",
        content: "Pay for preparation, not for the raise. No commission, ever.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pricing,
});

// The pricing model from the pitch. Prices are USD and still hypotheses to test.
const TIERS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "See where your numbers stand before you spend anything.",
    includes: [
      "Upload your monthly P&L",
      "The data half of your readiness score",
      "3 tough investor questions",
    ],
  },
  {
    id: "founder",
    name: "Founder",
    price: "$49",
    cadence: "per month",
    blurb: "For founders preparing steadily between rounds.",
    includes: [
      "Full analysis of your numbers",
      "Ask Vicky anything, with charts and what-ifs",
      "Unlimited practice",
      "2 investor personas",
      "Readiness score history",
    ],
  },
  {
    id: "raise-pass",
    name: "Raise Pass",
    price: "$299",
    cadence: "one-time, 90 days",
    blurb: "Everything you need for one round, without a subscription to cancel.",
    includes: [
      "Everything in Founder",
      "Every investor persona",
      "Voice mock meetings",
      "An investor Q&A pack you can export",
    ],
    featured: true,
  },
  {
    id: "programs",
    name: "Programs",
    price: "$30–50",
    cadence: "per founder, per month",
    blurb: "For accelerators and VC platform teams running a cohort.",
    includes: [
      "Seats for the whole cohort",
      "A dashboard of each founder's readiness",
      "Everything in Founder for every seat",
    ],
  },
] as const;

const WHY = [
  {
    label: "Legal risk",
    subscription: "Low. Software sold for a flat fee.",
    commission:
      "High. Success fees are a sign of dealer activity that needs registration, and in the US an unregistered fee can let investors claw back their money.",
  },
  {
    label: "Incentives",
    subscription: "Paid for preparation, so Vicky can tell you when you're not ready.",
    commission: "Paid when money is raised, which pushes toward “raise more, raise now”.",
  },
  {
    label: "For founders",
    subscription: "A small, predictable cost.",
    commission: "Free upfront, then a share of the round goes to fees at closing.",
  },
];

const SOURCES = [
  {
    label: "Wright Business Law",
    url: "https://wrightbusinesslaw.ca/articles/do-you-need-an-emd-or-can-you-raise-capital-directly",
  },
  {
    label: "Davis Wright Tremaine",
    url: "https://dwt.com/blogs/startup-law-blog/2021/03/transaction-based-fee-unlicensed-broker-dealer",
  },
];

const MARKET = [
  {
    name: "Yoodli",
    price: "$8–20",
    cadence: "per month",
    note: "Coaches how you speak",
    url: "https://www.outdoo.ai/blog/yoodli-review-and-pricing",
  },
  {
    name: "PitchBob",
    price: "$19.90",
    cadence: "per month",
    note: "Writes and scores your deck",
    url: "https://www.xpay.sh/saas-pricing/pitchbob-io/",
  },
  {
    name: "Fractional CFO",
    price: "$3,000–12,000",
    cadence: "per month",
    note: "A person who models your numbers",
    url: "https://pilot.com/blog/fractional-cfo-cost-guide",
  },
];

function Pricing() {
  const choice = Route.useSearch();
  return (
    <div className="min-h-screen bg-background">
      {/* 1. Hero */}
      <div className="vicky-hero">
        <AppHeader transparent />
        <section
          aria-labelledby="pricing-heading"
          className="mx-auto max-w-4xl px-5 pb-16 pt-8 text-center md:pb-24 md:pt-12"
        >
          <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-medium text-navy shadow-sm">
            No commission on your raise
          </p>
          <h1
            id="pricing-heading"
            className="font-heading mt-6 text-4xl font-extrabold leading-[1.05] text-navy sm:text-5xl md:text-7xl"
          >
            Pay for preparation, not for the raise
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-navy/75 md:text-lg">
            Start free, pay monthly while you prepare, or buy one Raise Pass for the round you're
            working on. Accelerators can buy seats for a whole cohort.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-lg border-navy/30 bg-white/60 text-navy hover:bg-white"
            >
              <a href="#raise-pass">See the Raise Pass</a>
            </Button>
            <Button
              asChild
              size="lg"
              className="rounded-lg bg-navy text-navy-foreground hover:bg-navy/90"
            >
              <Link to="/" search={choice}>
                Start free
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </div>

      <main id="main">
        {/* 2. The plans */}
        <section aria-labelledby="plans-heading" className="mx-auto max-w-7xl px-5 py-16 md:px-8">
          <h2 id="plans-heading" className="sr-only">
            Plans
          </h2>
          <ul className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t) => {
              const featured = "featured" in t && t.featured;
              return (
                <li
                  key={t.id}
                  id={t.id}
                  className={
                    "flex scroll-mt-8 flex-col rounded-2xl p-6 " +
                    (featured
                      ? "on-navy bg-navy text-foreground shadow-[var(--shadow-elegant)] ring-2 ring-[var(--chart-1)]"
                      : "border border-border bg-card shadow-sm")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={"font-heading text-xl font-bold " + (featured ? "" : "text-navy")}
                    >
                      {t.name}
                    </h3>
                    {featured && (
                      <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
                        Best for a round
                      </span>
                    )}
                  </div>
                  <p className="mt-4">
                    <span
                      className={
                        "font-heading text-4xl font-extrabold tabular-nums " +
                        (featured ? "" : "text-navy")
                      }
                    >
                      {t.price}
                    </span>
                    <span className="ml-2 text-sm text-muted-foreground">{t.cadence}</span>
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.blurb}</p>
                  <ul className="mt-5 space-y-2.5 text-sm">
                    {t.includes.map((line) => (
                      <li key={line} className="flex gap-2">
                        <Check
                          className={
                            "mt-0.5 size-4 shrink-0 " +
                            (featured ? "text-[var(--chart-1)]" : "text-primary")
                          }
                          aria-hidden
                        />
                        {line}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Prices in USD. Checkout isn't switched on in this demo, so every feature is open to try.
          </p>
        </section>

        {/* 3. Why no commission */}
        <section aria-labelledby="why-heading" className="on-navy bg-navy text-foreground">
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
            <h2
              id="why-heading"
              className="font-heading text-center text-3xl font-bold md:text-5xl"
            >
              Why Vicky takes no commission
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-base text-muted-foreground">
              A fee on the money you raise would give Vicky a reason to tell you you're ready when
              you're not. A flat price keeps her honest.
            </p>
            <div className="mt-12 grid gap-5 lg:grid-cols-2">
              <div className="vicky-card-glow rounded-2xl p-6 text-navy">
                <h3 className="font-heading text-2xl font-bold">Flat subscription</h3>
                <p className="mt-1 text-sm text-navy/75">What Vicky charges</p>
                <dl className="mt-5 space-y-4">
                  {WHY.map((w) => (
                    <div key={w.label}>
                      <dt className="text-xs font-semibold uppercase">{w.label}</dt>
                      <dd className="mt-1 text-sm leading-relaxed">{w.subscription}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-heading text-2xl font-bold">Commission on the raise</h3>
                <p className="mt-1 text-sm text-muted-foreground">What we chose not to do</p>
                <dl className="mt-5 space-y-4">
                  {WHY.map((w) => (
                    <div key={w.label}>
                      <dt className="text-xs font-semibold uppercase text-muted-foreground">
                        {w.label}
                      </dt>
                      <dd className="mt-1 text-sm leading-relaxed">{w.commission}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Sources:{" "}
              {SOURCES.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ", "}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    {s.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </span>
              ))}
              . General research, not legal advice.
            </p>
          </div>
        </section>

        {/* 4. Where Vicky sits in the market */}
        <section
          aria-labelledby="market-heading"
          className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24"
        >
          <h2
            id="market-heading"
            className="font-heading text-center text-3xl font-bold text-navy md:text-5xl"
          >
            Deeper than a pitch app, far cheaper than a CFO
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base text-muted-foreground">
            What founders pay today for the tools closest to Vicky.
          </p>
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {MARKET.map((m) => (
              <li key={m.name} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-muted-foreground">{m.name}</h3>
                <p className="mt-2">
                  <span className="font-heading text-3xl font-extrabold tabular-nums text-navy">
                    {m.price}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground">{m.cadence}</span>
                </p>
                <p className="mt-2 text-sm">{m.note}</p>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-xs text-primary underline underline-offset-2"
                >
                  Source
                  <span className="sr-only">: {m.name} pricing (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-12 text-center">
            <Button asChild className="rounded-lg bg-navy text-navy-foreground hover:bg-navy/90">
              <Link to="/practice" search={{ ...choice, mode: "ask" }}>
                Try Vicky now
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
