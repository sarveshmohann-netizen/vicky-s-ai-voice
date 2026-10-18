import { motion, useReducedMotion } from "motion/react";
import { ExternalLink } from "lucide-react";
import type { Lens, LensStatus } from "@/lib/vicky/lens";
import { PERSONAS, STAGES } from "@/lib/vicky/knowledge";
import { Button } from "@/components/ui/button";
const statuses: Record<LensStatus, string> = {
  meets: "bg-success/10 text-success",
  close: "bg-warning/20 text-warning-foreground",
  below: "bg-destructive/10 text-destructive",
  "no bar": "bg-muted text-muted-foreground",
};
export function InvestorLens({
  lens,
  onDetails,
}: {
  lens: Lens;
  onDetails?: (() => void) | undefined;
}) {
  const reduced = useReducedMotion();
  return (
    <section className="mb-10" aria-label="Investor priorities">
      <h2 className="mb-3 text-xl font-bold">
        What a {PERSONAS[lens.persona].name} at {STAGES[lens.stage].label} looks at first
      </h2>
      <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{lens.headline}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {lens.focus.map((f) => (
          <motion.article
            layout={!reduced}
            key={f.id}
            transition={{ duration: 0.2 }}
            className="metric-card min-w-0 rounded-lg border border-border p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <p className="text-xs font-semibold capitalize">{f.short}</p>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold " + statuses[f.status]
                }
              >
                {f.status}
              </span>
            </div>
            <p className="break-words text-3xl font-semibold text-primary">{f.value}</p>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{f.note}</p>
            {f.bar && (
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="mt-2 h-auto rounded-full px-2 py-1 text-[10px]"
              >
                <a href={f.bar.source.url} target="_blank" rel="noopener noreferrer">
                  {f.bar.source.short}, {f.bar.source.checked}
                  <ExternalLink className="size-3" />
                </a>
              </Button>
            )}
          </motion.article>
        ))}
      </div>
      {lens.missing.length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          This investor will also ask about:{" "}
          {lens.missing.map((m) => m.label.toLowerCase()).join(", ")}.
          {onDetails && (
            <>
              {" "}
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onDetails}>
                Add them in Company details.
              </Button>
            </>
          )}
        </p>
      )}
    </section>
  );
}
