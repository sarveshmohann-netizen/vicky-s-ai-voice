import { formatAxisLabel, formatValue, seriesLabel, type ValueKind } from "@/lib/chart-format";

type Entry = {
  dataKey?: string | number;
  name?: string | number;
  value?: unknown;
  color?: string;
  payload?: Record<string, unknown>;
};

/**
 * Recharts tooltip content in plain words: the month as "Sep 2026", each
 * series by its real name, and each value with its unit. `kind` can depend on
 * the row (the deck-vs-data chart mixes dollars, percentages and months).
 */
export function ChartTooltip({
  active,
  payload,
  label,
  kind,
}: {
  active?: boolean;
  payload?: Entry[];
  label?: unknown;
  kind: ValueKind | ((row: Record<string, unknown>) => ValueKind);
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => typeof p.value === "number");
  if (!rows.length) return null;
  const row = rows[0]?.payload ?? {};
  const k = typeof kind === "function" ? kind(row) : kind;
  const title = typeof row["label"] === "string" ? row["label"] : formatAxisLabel(label);
  return (
    <div className="min-w-44 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-semibold text-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />
              {seriesLabel(String(p.dataKey))}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatValue(p.value as number, k)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
