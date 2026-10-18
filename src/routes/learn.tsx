import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { AppHeader, Loading } from "@/components/vicky/AppShell";
import { ContextBar } from "@/components/vicky/ContextBar";
import { Button } from "@/components/ui/button";
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
  return (
    <>
      <AppHeader />
      <ContextBar />
      <main className="mx-auto max-w-6xl px-5 py-6">
        <h1 className="mb-6 text-xl font-semibold">Learn</h1>
        {error && <p role="alert">{error.message}</p>}
        {!data ? (
          <Loading />
        ) : (
          [...new Set(terms.map((t) => t.group))].map((group) => (
            <section key={group} className="mb-10">
              <h2 className="mb-4 text-base font-semibold">{group}</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {terms
                  .filter((t) => t.group === group)
                  .map((t) => (
                    <article
                      id={t.id}
                      key={t.id}
                      className="scroll-mt-32 rounded-lg border border-border p-5"
                    >
                      <h3 className="font-semibold">{t.term}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {t.plain}
                      </p>
                      {t.yourNumber && (
                        <p className="mt-3 text-sm text-primary">
                          Your number: <strong>{t.yourNumber}</strong>
                        </p>
                      )}
                      <h4 className="mt-4 text-xs font-semibold">How to back it up</h4>
                      <p className="mt-2 text-xs leading-relaxed">{t.backItUp}</p>
                      {t.source && (
                        <a
                          href={t.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 block text-[10px] text-primary underline"
                        >
                          {t.sourceLabel} ↗
                        </a>
                      )}
                      <Button asChild variant="ghost" size="sm" className="mt-3 px-0">
                        <Link to="/practice" search={{ ...choice, mode: "ask", prompt: t.ask }}>
                          Ask Vicky
                          <ArrowUpRight className="size-3" />
                        </Link>
                      </Button>
                    </article>
                  ))}
              </div>
            </section>
          ))
        )}
      </main>
    </>
  );
}
