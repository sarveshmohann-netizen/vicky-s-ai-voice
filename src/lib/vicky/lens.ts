// The investor lens: the same numbers, read the way a given investor at a
// given stage reads them. It decides which metrics lead the dashboard, which
// published bar each one is held to, and how far off it is. Works for the
// Tidewell sample and any uploaded company, since both use the same metric ids.

import { PERSONAS, STAGES, type PersonaId, type Stage, type Topic } from "./knowledge.ts";
import { formatMetric, type Metric } from "./tidewell/metrics.ts";

export interface Bar {
  text: string; // the bar in words
  target: number;
  better: "higher" | "lower";
  source: { short: string; checked: string; url: string };
  appliesAs: string; // e.g. "Series A bar" when shown to a seed company as the next milestone
}

export type LensStatus = "meets" | "close" | "below" | "no bar";

export interface LensMetric {
  id: string;
  label: string;
  short: string; // a few words for headlines and card titles
  value: string;
  topic: Topic;
  priority: number; // higher = this investor looks at it sooner
  bar: Bar | null;
  status: LensStatus;
  note: string;
}

export interface Lens {
  persona: PersonaId;
  stage: Stage;
  headline: string;
  focus: LensMetric[]; // the four this investor looks at first
  rest: LensMetric[];
  missing: { id: string; label: string; why: string }[]; // metrics this investor wants that aren't in the data
}

const SAASTR = { short: "SaaStr", checked: "Oct 2026", url: "https://www.saastr.com/dear-saastr-what-are-the-top-10-metrics-series-a-investors-look-at" };

// Every bar comes from a source Vicky has checked. Stages without a published
// bar get none, rather than an invented one.
const SERIES_A_BARS: Record<string, Omit<Bar, "appliesAs">> = {
  growth3m: { text: "7% to 15% a month", target: 0.07, better: "higher", source: SAASTR },
  nrr: { text: "at least 100%, and 120%+ is top tier", target: 1.0, better: "higher", source: SAASTR },
  grr: { text: "90%+ is ideal, under 80% is a churn problem", target: 0.9, better: "higher", source: SAASTR },
  cacPaybackMonths: { text: "12 months or less", target: 12, better: "lower", source: SAASTR },
  burnMultiple: { text: "1x to 2x is healthy, 3x is a red flag", target: 2, better: "lower", source: SAASTR },
};
const SEED_BARS: Record<string, Omit<Bar, "appliesAs">> = {
  nrr: { text: "at least 100% at seed", target: 1.0, better: "higher", source: SAASTR },
};

function barFor(id: string, stage: Stage): Bar | null {
  if (stage === "series-a") { const b = SERIES_A_BARS[id]; return b ? { ...b, appliesAs: "Series A bar" } : null; }
  if (stage === "seed") {
    const s = SEED_BARS[id];
    if (s) return { ...s, appliesAs: "Seed bar" };
    const a = SERIES_A_BARS[id];
    return a ? { ...a, appliesAs: "Series A bar, the milestone this round should reach" } : null;
  }
  return null;
}

const METRIC_TOPIC: Record<string, Topic> = {
  arr: "growth", growth3m: "growth", growth12m: "growth", netNewArr: "growth",
  grossMarginWithSupport: "margin", grossMarginBooked: "margin",
  logoChurnMonthly12m: "churn", nrr: "retention", grr: "retention", largestCustomerShare: "concentration",
  cacFullyLoaded: "cac", cacPaybackMonths: "cac",
  burnMultiple: "burn", monthlyBurn: "burn", runwayToday: "runway", runwayAfterRaise: "runway",
};

const SHORT: Record<string, string> = {
  arr: "ARR", growth3m: "recent growth", growth12m: "growth over the year", netNewArr: "net new ARR",
  grossMarginWithSupport: "gross margin", grossMarginBooked: "gross margin", logoChurnMonthly12m: "churn",
  nrr: "net revenue retention", grr: "gross retention", largestCustomerShare: "customer concentration",
  cacFullyLoaded: "CAC", cacPaybackMonths: "CAC payback", burnMultiple: "burn multiple", monthlyBurn: "burn",
  runwayToday: "runway", runwayAfterRaise: "runway after the raise",
};
const STAGE_PHRASE: Record<Stage, string> = { "pre-seed": "pre-seed", seed: "seed", "series-a": "Series A" };

const WANTED: Record<Topic, { id: string; label: string; why: string }[]> = {
  churn: [{ id: "logoChurnMonthly12m", label: "Monthly churn", why: "They will ask how many customers leave each month." }],
  retention: [{ id: "nrr", label: "Net revenue retention", why: "Shows whether existing customers grow or shrink." }],
  cac: [{ id: "cacFullyLoaded", label: "CAC", why: "Needs new customer counts to calculate." }],
  runway: [{ id: "runwayToday", label: "Runway", why: "Needs your cash balance." }],
  concentration: [{ id: "largestCustomerShare", label: "Largest customer's share", why: "They'll ask how much one customer carries." }],
  growth: [], margin: [], burn: [], "use-of-funds": [], team: [], market: [], valuation: [],
};

function status(value: number, bar: Bar | null): LensStatus {
  if (!bar) return "no bar";
  const ok = bar.better === "higher" ? value >= bar.target : value <= bar.target;
  if (ok) return "meets";
  const gap = bar.better === "higher" ? (bar.target - value) / bar.target : (value - bar.target) / bar.target;
  return gap <= 0.2 ? "close" : "below";
}

export function investorLens(metrics: Record<string, Metric>, persona: PersonaId, stage: Stage): Lens {
  const p = PERSONAS[persona];
  const s = STAGES[stage];
  const rank = (t: Topic) => {
    const i = p.focus.indexOf(t);
    return (i >= 0 ? 10 - i : 0) + (s.focus.includes(t) ? 3 : 0);
  };
  const items: LensMetric[] = Object.entries(METRIC_TOPIC)
    .filter(([id]) => metrics[id])
    .map(([id, topic]) => {
      const m = metrics[id]!;
      const bar = barFor(id, stage);
      const st = status(m.value, bar);
      const note = bar ? `${bar.appliesAs}: ${bar.text}` : stage === "pre-seed" ? "No published bar at pre-seed; investors read this as an early signal." : "No published bar for this metric.";
      return { id, label: m.label, short: SHORT[id] ?? m.label, value: formatMetric(m), topic, priority: rank(topic) + (st === "below" ? 2 : 0) + (bar ? 1 : 0), bar, status: st, note };
    })
    .sort((a, b) => b.priority - a.priority);
  // One metric per topic in the lead row, so the four cards say four different things.
  const seen = new Set<Topic>();
  const focus: LensMetric[] = [];
  for (const it of items) if (focus.length < 4 && !seen.has(it.topic)) { focus.push(it); seen.add(it.topic); }
  const rest = items.filter((i) => !focus.includes(i));
  const missing = [...new Set([...p.focus, ...s.focus])].flatMap((t) => WANTED[t]).filter((w) => !metrics[w.id]);

  const below = focus.filter((f) => f.status === "below").map((f) => f.short);
  const meets = focus.filter((f) => f.status === "meets").map((f) => f.short);
  const headline = `${p.name}s at ${STAGE_PHRASE[stage]} look first at ${listJoin(focus.map((f) => f.short))}.`
    + (below.length ? ` ${cap(listJoin(below))} ${below.length > 1 ? "are" : "is"} below the published bar.` : "")
    + (meets.length ? ` ${cap(listJoin(meets))} ${meets.length > 1 ? "meet" : "meets"} it.` : "");
  return { persona, stage, headline, focus, rest, missing };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const listJoin = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
