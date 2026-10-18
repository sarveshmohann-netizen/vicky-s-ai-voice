// Words and number formats for chart hovers and legends, so a tooltip reads
// "Actual MRR: $107K" instead of "actual: 107189.0034". Display only: the
// numbers themselves come from the engine untouched.

export type ValueKind = "usd" | "pct" | "months" | "count" | "ratio";

export const SERIES_LABEL: Record<string, string> = {
  actual: "Actual MRR",
  plan: "Founders' plan",
  atRecentPace: "At recent pace",
  growth: "Growth that month",
  operatingLoss: "Operating loss",
  otherIncome: "Other income",
  srAndEd: "SR&ED refund",
  booked: "Gross margin as booked",
  withSupport: "With support costs",
  netNew: "Net new customers",
  months: "Runway",
  deck: "Deck says",
  data: "Your data shows",
  mrr: "MRR",
  cash: "Cash in the bank",
  recurringRevenue: "Recurring revenue",
};

export function seriesLabel(key: string): string {
  return (
    SERIES_LABEL[key] ??
    key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())
  );
}

export function formatValue(
  value: number,
  kind: ValueKind,
  opts: { compact?: boolean } = {},
): string {
  if (!Number.isFinite(value)) return "–";
  switch (kind) {
    case "pct":
      return `${(value * 100).toFixed(1)}%`;
    case "months":
      return `${value.toFixed(1)} months`;
    case "count":
      return Math.round(value).toLocaleString("en-US");
    case "ratio":
      return `${value.toFixed(1)}x`;
    default: {
      const sign = value < 0 ? "−" : "";
      const abs = Math.abs(value);
      if (opts.compact && abs >= 1000)
        return (
          sign +
          "$" +
          new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
            abs,
          )
        );
      return sign + "$" + Math.round(abs).toLocaleString("en-US");
    }
  }
}

/** "2026-09" → "Sep 2026"; a scenario month number → "Month 5"; anything else as is. */
export function formatAxisLabel(label: unknown, long = true): string {
  if (typeof label === "number") return label === 0 ? "Today" : `Month ${label}`;
  const s = String(label ?? "");
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (!m) return s;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: long ? "numeric" : "2-digit",
    timeZone: "UTC",
  });
}
