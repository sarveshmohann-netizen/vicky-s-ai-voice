import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import type { CompanyCharts as Charts } from "@/lib/vicky/company/analysis";
import type { MonthRow } from "@/lib/vicky/company/parse";
import { StatusBadge } from "./MeetingCharts";
const tick = { fill: "var(--muted-foreground)", fontSize: 10 };
const compact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const month = (v: string) =>
  new Date(v + "-01T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
export function RevenuePreview({ rows }: { rows: MonthRow[] }) {
  return (
    <div className="h-44 min-w-0" role="img" aria-label="Recurring revenue by month">
      <ResponsiveContainer>
        <LineChart data={rows}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tickFormatter={month} tick={tick} />
          <YAxis tickFormatter={compact} tick={tick} />
          <Tooltip />
          <Line
            dataKey="recurringRevenue"
            name="Recurring revenue"
            stroke="var(--primary)"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CompanyCharts({ charts, currency }: { charts: Charts; currency: string }) {
  const cash = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  const sections: {
    title: string;
    data: unknown[];
    series: [string, string, string][];
    percent: boolean;
  }[] = [
    {
      title: "Recurring revenue",
      data: charts.mrr,
      series: [
        ["actual", "Actual", "--primary"],
        ["atRecentPace", "At recent pace", "--chart-4"],
        ["plan", "Plan", "--chart-2"],
      ],
      percent: false,
    },
    {
      title: "Growth by month",
      data: charts.growth,
      series: [["growth", "Monthly growth", "--primary"]],
      percent: true,
    },
    {
      title: "Burn by month",
      data: charts.burn,
      series: [
        ["operatingLoss", "Operating loss", "--primary"],
        ["otherIncome", "Other income", "--chart-3"],
      ],
      percent: false,
    },
    {
      title: "Gross margin",
      data: charts.margin,
      series: [
        ["booked", "As booked", "--primary"],
        ["withSupport", "With support", "--chart-4"],
      ],
      percent: true,
    },
  ];
  return (
    <div className="grid min-w-0 gap-10 md:grid-cols-2">
      {sections
        .filter((s) => s.data.length)
        .map((s) => (
          <section key={s.title} className="min-w-0 border-t border-border pt-6">
            <h2 className="mb-5 text-lg font-bold">{s.title}</h2>
            <div className="h-64" role="img" aria-label={s.title}>
              <ResponsiveContainer>
                <LineChart data={s.data}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="month" tickFormatter={month} minTickGap={40} tick={tick} />
                  <YAxis
                    tickFormatter={(n) => (s.percent ? `${Math.round(n * 100)}%` : cash(n))}
                    width={65}
                    tick={tick}
                  />
                  <Tooltip
                    labelFormatter={(v) => month(String(v))}
                    formatter={(v) =>
                      s.percent ? `${(Number(v) * 100).toFixed(1)}%` : cash(Number(v))
                    }
                  />
                  {s.series.map(([key, name, color]) => (
                    <Line
                      key={key}
                      dataKey={key}
                      name={name}
                      stroke={`var(${color})`}
                      strokeWidth={2}
                      strokeDasharray={key === "plan" ? "6 4" : undefined}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {s.series.map(([key, name]) => (
                <span key={key}>{name}</span>
              ))}
            </div>
          </section>
        ))}
      {charts.deckVsData.length > 0 && (
        <section className="min-w-0 border-t border-border pt-6">
          <h2 className="mb-5 text-lg font-bold">Deck vs data</h2>
          <div className="space-y-5">
            {charts.deckVsData.map((d) => (
              <div key={d.id}>
                <div className="flex justify-between gap-3 text-sm">
                  <span>{d.label}</span>
                  <StatusBadge status={d.status} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    Deck:{" "}
                    {d.unit === "pct"
                      ? `${(d.deck * 100).toFixed(1)}%`
                      : d.unit === "usd"
                        ? cash(d.deck)
                        : `${d.deck.toFixed(1)} mo`}
                  </span>
                  <span>
                    Data:{" "}
                    {d.unit === "pct"
                      ? `${(d.data * 100).toFixed(1)}%`
                      : d.unit === "usd"
                        ? cash(d.data)
                        : `${d.data.toFixed(1)} mo`}
                  </span>
                </div>
                <div className="h-12">
                  <ResponsiveContainer>
                    <BarChart
                      data={[
                        { name: "Deck", value: d.deck },
                        { name: "Data", value: d.data },
                      ]}
                      layout="vertical"
                    >
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={tick} width={35} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        fill="var(--primary)"
                        barSize={12}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {charts.runway.length > 0 && (
        <section className="min-w-0 border-t border-border pt-6">
          <h2 className="mb-5 text-lg font-bold">Runway</h2>
          <div className="h-64" role="img" aria-label="Runway scenarios">
            <ResponsiveContainer>
              <BarChart layout="vertical" data={charts.runway}>
                <XAxis type="number" tick={tick} unit=" mo" />
                <YAxis type="category" dataKey="label" width={130} tick={tick} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)} months`} />
                <Bar
                  dataKey="months"
                  fill="var(--primary)"
                  barSize={24}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
