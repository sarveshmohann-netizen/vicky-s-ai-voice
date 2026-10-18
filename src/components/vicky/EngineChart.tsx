import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
} from "recharts";
import { CHART_CATALOG, type ChartId } from "@/lib/vicky/coach";
import { formatAxisLabel, formatValue, seriesLabel, type ValueKind } from "@/lib/chart-format";
import { ChartTooltip } from "./ChartTooltip";

// Blue-and-white series colours: strongest blue for what actually happened,
// lighter or dashed blues for plans and projections.
const BLUE = "var(--chart-1)";
const NAVY = "var(--chart-2)";
const SKY = "var(--chart-4)";
const PALE = "var(--chart-3)";
const tick = { fill: "var(--muted-foreground)", fontSize: 11 };

const SERIES: Record<ChartId, { key: string; color: string; dash?: string }[]> = {
  mrr: [
    { key: "actual", color: BLUE },
    { key: "plan", color: NAVY, dash: "6 4" },
    { key: "atRecentPace", color: SKY, dash: "2 4" },
  ],
  growth: [{ key: "growth", color: BLUE }],
  burn: [
    { key: "operatingLoss", color: BLUE },
    { key: "srAndEd", color: SKY },
    { key: "otherIncome", color: SKY },
  ],
  margin: [
    { key: "booked", color: SKY },
    { key: "withSupport", color: BLUE },
  ],
  customers: [{ key: "netNew", color: BLUE }],
  runway: [{ key: "months", color: BLUE }],
  deckVsData: [],
};
const KIND: Record<ChartId, ValueKind> = {
  mrr: "usd",
  growth: "pct",
  burn: "usd",
  margin: "pct",
  customers: "count",
  runway: "months",
  deckVsData: "usd",
};

type Row = Record<string, unknown>;

export function EngineChart({
  id,
  charts,
  inline = false,
  size = "md",
}: {
  id: ChartId;
  charts: Partial<Record<ChartId, unknown[]>>;
  inline?: boolean;
  size?: "md" | "lg";
}) {
  const data = charts[id] as Row[] | undefined;
  if (!data?.length) return null;
  const kind = KIND[id];
  const series = SERIES[id].filter((s) => data.some((r) => typeof r[s.key] === "number"));
  const height = inline ? "h-[200px]" : size === "lg" ? "h-[300px]" : "h-[240px]";
  const yTick = (v: number) =>
    kind === "pct" ? `${Math.round(v * 100)}%` : formatValue(v, kind, { compact: true });
  const xTick = (v: unknown) => formatAxisLabel(v, false);

  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{CHART_CATALOG[id].title}</h3>
          {inline && <p className="mt-0.5 text-xs text-muted-foreground">From your dashboard</p>}
        </div>
        {series.length > 1 && (
          <ul
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
            aria-label="Legend"
          >
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <svg aria-hidden width="18" height="6">
                  <line
                    x1="0"
                    y1="3"
                    x2="18"
                    y2="3"
                    stroke={s.color}
                    strokeWidth="3"
                    strokeDasharray={s.dash}
                  />
                </svg>
                {seriesLabel(s.key)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {id === "deckVsData" ? (
        <DeckVsData rows={data} />
      ) : (
        <div
          className={`${height} w-full`}
          role="img"
          aria-label={CHART_CATALOG[id].title + ": " + CHART_CATALOG[id].shows}
        >
          <ResponsiveContainer>
            {id === "mrr" ? (
              <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="vicky-mrr-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tickFormatter={xTick}
                  minTickGap={40}
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={yTick}
                  width={56}
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ChartTooltip kind="usd" />}
                  cursor={{ stroke: "var(--border)" }}
                />
                {series.map((s) =>
                  s.key === "actual" ? (
                    <Area
                      key={s.key}
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={2.5}
                      fill="url(#vicky-mrr-fill)"
                      connectNulls
                      isAnimationActive={false}
                    />
                  ) : (
                    <Area
                      key={s.key}
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={2}
                      strokeDasharray={s.dash}
                      fill="none"
                      connectNulls
                      isAnimationActive={false}
                    />
                  ),
                )}
              </AreaChart>
            ) : id === "runway" ? (
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 0, right: 72, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ChartTooltip kind="months" />}
                  cursor={{ fill: "var(--secondary)" }}
                />
                <Bar dataKey="months" radius={[0, 6, 6, 0]} barSize={22} isAnimationActive={false}>
                  {data.map((r, i) => (
                    <Cell key={i} fill={i === data.length - 1 ? PALE : BLUE} />
                  ))}
                  <LabelList
                    dataKey="months"
                    position="right"
                    formatter={(v: number) => formatValue(v, "months")}
                    className="fill-foreground text-xs"
                  />
                </Bar>
              </BarChart>
            ) : id === "growth" || id === "burn" || id === "customers" ? (
              <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey={id === "customers" ? "quarter" : "month"}
                  tickFormatter={xTick}
                  minTickGap={24}
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={yTick}
                  width={56}
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ChartTooltip kind={kind} />}
                  cursor={{ fill: "var(--secondary)" }}
                />
                {series.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    fill={s.color}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  >
                    {id === "customers" &&
                      data.map((r, i) => (
                        <Cell key={i} fill={r["kind"] === "plan" ? PALE : BLUE} />
                      ))}
                  </Bar>
                ))}
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tickFormatter={xTick}
                  minTickGap={40}
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={yTick}
                  width={56}
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ChartTooltip kind={kind} />}
                  cursor={{ stroke: "var(--border)" }}
                />
                {series.map((s) => (
                  <Line
                    key={s.key}
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={2.5}
                    strokeDasharray={s.dash}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {id === "customers" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Dark bars are actual quarters, light bars are the plan.
        </p>
      )}
    </section>
  );
}

// Each deck claim has its own unit, so each gets its own scale instead of
// sharing one axis where $1.3M would flatten 2% churn to nothing.
function DeckVsData({ rows }: { rows: Row[] }) {
  return (
    <ul className="space-y-4">
      {rows.map((r) => {
        const deck = Number(r["deck"]),
          data = Number(r["data"]);
        const unit = (
          r["unit"] === "months" ? "months" : r["unit"] === "pct" ? "pct" : "usd"
        ) as ValueKind;
        const max = Math.max(Math.abs(deck), Math.abs(data)) || 1;
        const status = String(r["status"] ?? "");
        return (
          <li key={String(r["id"])}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{String(r["label"])}</span>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-xs font-medium " +
                  (status === "Holds"
                    ? "bg-success/10 text-success"
                    : status === "Fix"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-secondary text-secondary-foreground")
                }
              >
                {status}
              </span>
            </div>
            {[
              { name: "Deck says", value: deck, color: PALE },
              { name: "Your data shows", value: data, color: BLUE },
            ].map((b) => (
              <div
                key={b.name}
                className="mt-1 grid grid-cols-[110px_1fr_auto] items-center gap-2 text-xs"
              >
                <span className="text-muted-foreground">{b.name}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(Math.abs(b.value) / max) * 100}%`, background: b.color }}
                  />
                </span>
                <span className="w-24 text-right font-semibold tabular-nums">
                  {formatValue(b.value, unit)}
                </span>
              </div>
            ))}
          </li>
        );
      })}
    </ul>
  );
}
