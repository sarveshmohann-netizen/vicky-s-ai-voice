import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { AppHeader, Loading } from "@/components/vicky/AppShell";
import { ContextBar } from "@/components/vicky/ContextBar";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { glossary } from "@/lib/vicky/glossary";
import { useVickyDashboard } from "@/hooks/use-vicky-dashboard";
import { meetingSearchSchema } from "@/lib/vicky-inputs";
export const Route = createFileRoute("/learn")({
  validateSearch: (input) => meetingSearchSchema.parse(input),
  head: () => ({
    meta: [
      { title: "Learn Investor Terms · Vicky" },
      {
        name: "description",
        content:
          "Investor terms in plain words, with your own company numbers and supporting sources.",
      },
      { property: "og:title", content: "Learn Investor Terms · Vicky" },
      {
        property: "og:description",
        content: "Understand revenue, customers, efficiency and your funding round.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Learn,
});
function Learn() {
  const choice = Route.useSearch(),
    { data, error } = useVickyDashboard(choice);
  const terms = glossary(data?.analysis.metrics);
  const groups = [...new Set(terms.map((t) => t.group))];
  // A link from a chat reply lands on /learn#term and opens that term.
  const [open, setOpen] = useState<string[]>([]);
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id || !data) return;
    setOpen((o) => (o.includes(id) ? o : [...o, id]));
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "center" }));
  }, [data]);
  return (
    <div className="min-h-screen bg-background">
      <div className="vicky-hero">
        <AppHeader transparent />
        <section
          aria-labelledby="learn-heading"
          className="mx-auto max-w-4xl px-5 pb-14 pt-8 text-center md:pb-20 md:pt-12"
        >
          <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-medium text-navy shadow-sm">
            {terms.length} terms, with your own numbers
          </p>
          <h1
            id="learn-heading"
            className="font-heading mt-6 text-4xl font-extrabold leading-[1.05] text-navy sm:text-5xl md:text-6xl"
          >
            Investor terms, in plain words
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-navy/75 md:text-lg">
            Open a term to see what it means, your number for it, and how to back it up when an
            investor asks.
          </p>
          <div className="mt-8">
            <ContextBar bare />
          </div>
        </section>
      </div>

      {groups.length > 0 && (
        <nav aria-label="Topics" className="bg-navy text-navy-foreground">
          <ul className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-8 gap-y-3 px-5 py-6">
            {groups.map((g) => (
              <li key={g}>
                <a
                  href={"#group-" + slug(g)}
                  className="font-heading text-lg font-bold underline-offset-4 hover:underline"
                >
                  {g}
                  <span className="ml-2 text-sm font-medium text-navy-foreground/70">
                    {terms.filter((t) => t.group === g).length}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <main id="main" className="mx-auto max-w-3xl px-5 py-14 md:px-8">
        {error && <p role="alert">{error.message}</p>}
        {!data ? (
          <Loading />
        ) : (
          <Accordion type="multiple" value={open} onValueChange={setOpen} className="space-y-14">
            {groups.map((group) => (
              <section key={group} id={"group-" + slug(group)} className="scroll-mt-8">
                <h2 className="font-heading mb-6 text-center text-3xl font-bold text-navy md:text-4xl">
                  {group}
                </h2>
                <div className="space-y-3">
                  {terms
                    .filter((t) => t.group === group)
                    .map((t) => (
                      <AccordionItem
                        key={t.id}
                        value={t.id}
                        id={t.id}
                        className="scroll-mt-8 rounded-2xl border border-border bg-card px-5 shadow-sm data-[state=open]:shadow-[var(--shadow-elegant)]"
                      >
                        <AccordionTrigger className="gap-3 py-4 hover:no-underline">
                          <span className="font-heading text-lg font-bold text-navy">{t.term}</span>
                          {t.yourNumber && (
                            <span className="ml-auto shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-sm font-semibold tabular-nums text-primary">
                              {t.yourNumber}
                            </span>
                          )}
                        </AccordionTrigger>
                        <AccordionContent className="pb-5">
                          <p className="leading-relaxed text-muted-foreground">{t.plain}</p>
                          <div className="vicky-card-glow mt-4 rounded-xl p-4 text-navy">
                            <h3 className="text-sm font-semibold">How to back it up</h3>
                            <p className="mt-1 text-sm leading-relaxed">{t.backItUp}</p>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            {t.source ? (
                              <a
                                href={t.source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary underline underline-offset-2"
                              >
                                {t.sourceLabel}
                                <span className="sr-only"> (opens in a new tab)</span>
                              </a>
                            ) : (
                              <span />
                            )}
                            <Button
                              asChild
                              size="sm"
                              className="rounded-lg bg-navy text-navy-foreground hover:bg-navy/90"
                            >
                              <Link
                                to="/practice"
                                search={{ ...choice, mode: "ask", prompt: t.ask }}
                              >
                                Ask Vicky
                                <ArrowUpRight className="size-4" aria-hidden />
                              </Link>
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                </div>
              </section>
            ))}
          </Accordion>
        )}
      </main>
    </div>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
