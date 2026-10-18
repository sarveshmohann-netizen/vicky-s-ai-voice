// Coaching layer for the chat: what to prepare first (with concrete steps),
// which dashboard chart backs each answer, and a small what-if model the chat
// can call up. Everything here is computed; the AI only picks which chart or
// scenario to show and explains it. Client-safe: no secrets, no AI calls.

import { METRIC_TOPIC, type Lens, type LensMetric } from "./lens.ts";
import type { Topic } from "./knowledge.ts";
import { formatMetric, type Metric } from "./tidewell/metrics.ts";

// --- Charts the chat can show --------------------------------------------------

export type ChartId = "mrr" | "growth" | "customers" | "burn" | "margin" | "runway" | "deckVsData";

export const CHART_CATALOG: Record<ChartId, { title: string; shows: string; topics: Topic[] }> = {
  mrr: { title: "Plan vs your actual pace", shows: "monthly recurring revenue so far, the plan, and where the recent pace leads", topics: ["growth", "runway"] },
  growth: { title: "Growth by month", shows: "month-on-month MRR growth", topics: ["growth"] },
  customers: { title: "Customers added each quarter", shows: "net new customers, actual vs plan", topics: ["growth", "cac"] },
  burn: { title: "Monthly burn", shows: "operating loss each month", topics: ["burn", "runway"] },
  margin: { title: "Gross margin", shows: "margin as booked and with support costs", topics: ["margin"] },
  runway: { title: "How long the cash lasts", shows: "runway in months under each scenario", topics: ["runway", "burn", "use-of-funds"] },
  deckVsData: { title: "Deck vs data", shows: "each deck claim next to what the data shows", topics: ["growth", "retention", "churn", "cac", "margin", "runway"] },
};

const CHART_FOR: Record<Topic, ChartId[]> = {
  growth: ["mrr", "growth"], retention: ["deckVsData"], churn: ["deckVsData"], cac: ["customers", "deckVsData"],
  burn: ["burn", "runway"], runway: ["runway", "burn"], margin: ["margin", "deckVsData"], concentration: ["mrr"],
  "use-of-funds": ["runway"], team: [], market: [], valuation: [],
};

/** Charts that have data, given a chart bundle from either the Tidewell or the upload analysis. */
export function availableCharts(charts: Partial<Record<ChartId, unknown[]>>): ChartId[] {
  return (Object.keys(CHART_CATALOG) as ChartId[]).filter((id) => (charts[id]?.length ?? 0) > 0);
}

export function chartFor(topic: Topic, available: ChartId[]): ChartId | null {
  return CHART_FOR[topic].find((c) => available.includes(c)) ?? null;
}

// --- What to prepare first ------------------------------------------------------

export interface PrepItem {
  id: string;
  topic: Topic;
  title: string;
  now: string; // the founder's number, formatted
  bar: string | null; // the published bar and its source, when there is one
  status: LensMetric["status"] | "missing";
  steps: string[]; // two or three things to do before the meeting
  chart: ChartId | null;
  ask: string; // a question the founder can send to Vicky about this
}

const STEPS: Record<Topic, string[]> = {
  growth: [
    "Put your real growth rate next to the plan on one slide, so the gap is yours to explain and not theirs to find.",
    "Name the one or two things that will lift growth, like a channel, a hire or a price change, and the early evidence that each is working.",
    "Have new and lost customers by month ready, because the follow-up is always \"where did growth come from?\"",
  ],
  retention: [
    "Split retention into expansion, downgrades and churn, so you can say which one is pulling it down.",
    "Bring two short customer stories: one account that grew and one that left, and why.",
    "Say what you changed after losing customers and what has happened since.",
  ],
  churn: [
    "Know your churn by cohort or by customer size, not just the average.",
    "Have the top two reasons customers leave, in their words.",
    "Show the fix you've shipped and the months since, even if it's early.",
  ],
  cac: [
    "Break CAC down by channel and lead with the cheapest one that repeats.",
    "Work out payback on gross margin after support costs, the way investors will.",
    "Know which lever moves payback most: price, sales cycle, or cost per lead.",
  ],
  burn: [
    "Show net new ARR against cash burned for each quarter, so they see the trend and not just one ratio.",
    "Name the spending that isn't producing revenue yet, and when it should.",
    "Know what you'd cut first if the round takes longer than planned.",
  ],
  runway: [
    "Show how long the raise lasts at your actual growth, not only at the plan.",
    "Name the milestones the next round will need and the month you expect to hit each.",
    "Know your plan B if the raise slips by three months.",
  ],
  margin: [
    "Show gross margin both as booked and with support costs, and say which one you're quoting.",
    "Name the costs that fall as you grow, and the evidence that they already are.",
  ],
  concentration: [
    "Know your largest customer's share of MRR and their renewal date.",
    "Show growth with that customer taken out, before they ask.",
  ],
  "use-of-funds": ["Tie each slice of the raise to a milestone and a month."],
  team: ["Say who owns each part of the plan and what they've shipped before."],
  market: ["Build market size bottom-up from a named count of customers who fit, times what each pays."],
  valuation: ["Let the lead propose terms. Know your metrics, the round size and any SAFEs that convert."],
};

const ASK: Record<Topic, string> = {
  growth: "How do I explain the gap between my growth and the plan?",
  retention: "What's dragging my retention, and how do I talk about it?",
  churn: "How do I answer questions about churn?",
  cac: "Is my CAC payback going to worry this investor?",
  burn: "How will they read my burn multiple?",
  runway: "How long will the raise really last?",
  margin: "Which gross margin should I quote, and why?",
  concentration: "How do I handle questions about my biggest customer?",
  "use-of-funds": "How should I explain where the money goes?",
  team: "What will they ask about the team?",
  market: "How do I size my market without overselling it?",
  valuation: "What do I say if they ask about valuation?",
};

function titleFor(m: LensMetric): string {
  const label = m.short.charAt(0).toUpperCase() + m.short.slice(1);
  if (m.status === "below") return `${label} is below the ${m.bar!.appliesAs.split(",")[0]}`;
  if (m.status === "close") return `${label} is just short of the ${m.bar!.appliesAs.split(",")[0]}`;
  return `Be ready to explain your ${m.short}`;
}

/**
 * The three things to work on before this meeting, most important first:
 * metrics below the published bar, then close to it, then gaps in the data,
 * then (where no bar exists) the metrics this investor reads first.
 */
export function prepPlan(lens: Lens, available: ChartId[], max = 3): PrepItem[] {
  const fromMetric = (m: LensMetric): PrepItem => ({
    id: m.id, topic: m.topic, title: titleFor(m), now: m.value,
    bar: m.bar ? `${m.bar.text} [${m.bar.source.short}, ${m.bar.source.checked}](${m.bar.source.url})` : null,
    status: m.status, steps: STEPS[m.topic].slice(0, 3), chart: chartFor(m.topic, available), ask: ASK[m.topic],
  });
  const all = [...lens.focus, ...lens.rest];
  const below = all.filter((m) => m.status === "below");
  const close = all.filter((m) => m.status === "close");
  const missing: PrepItem[] = lens.missing.map((w) => {
    const topic = METRIC_TOPIC[w.id] ?? "growth";
    return { id: w.id, topic, title: `Add ${w.label.toLowerCase()}`, now: "Not in your data", bar: null, status: "missing", steps: [w.why, "Add it in Company details so Vicky can build the answer from your numbers."], chart: null, ask: ASK[topic] };
  });
  const lead = lens.focus.filter((m) => m.status === "no bar" || m.status === "meets");
  const seen = new Set<Topic>();
  const out: PrepItem[] = [];
  for (const item of [...below.map(fromMetric), ...close.map(fromMetric), ...missing, ...lead.map(fromMetric)]) {
    if (out.length >= max) break;
    if (seen.has(item.topic)) continue;
    seen.add(item.topic);
    out.push(item);
  }
  return out;
}

/** Up to three openers for an empty chat, built from the prep plan so they're never generic. */
export function chatSuggestions(plan: PrepItem[]): string[] {
  const asks = plan.map((p) => p.ask);
  if (asks.length < 3) asks.push("What will this investor ask me first?");
  return [...new Set(asks)].slice(0, 3);
}

// --- What-if model --------------------------------------------------------------

export interface ScenarioInput {
  startMrr: number;
  monthlyGrowth: number; // 0.05 = 5% a month
  grossMargin: number; // share of revenue left after cost of revenue (and support, when known)
  monthlySpend: number; // operating spend a month, excluding cost of revenue
  cash: number; // cash today
  raise: number; // added in month 1; 0 for none
  months: number;
}

export interface ScenarioPoint { month: number; mrr: number; cash: number }

export interface ScenarioResult {
  input: ScenarioInput;
  points: ScenarioPoint[];
  endMrr: number;
  endArr: number;
  runwayMonths: number | null; // month the cash runs out; null if it lasts the whole period
  breakEvenMonth: number | null; // first month gross profit covers spend
}

export function runScenario(input: ScenarioInput): ScenarioResult {
  const months = Math.max(1, Math.min(60, Math.round(input.months)));
  let mrr = input.startMrr;
  let cash = input.cash + input.raise;
  let runwayMonths: number | null = null;
  let breakEvenMonth: number | null = null;
  const points: ScenarioPoint[] = [{ month: 0, mrr, cash }];
  for (let t = 1; t <= months; t++) {
    mrr *= 1 + input.monthlyGrowth;
    const net = mrr * input.grossMargin - input.monthlySpend;
    cash += net;
    if (breakEvenMonth === null && net >= 0) breakEvenMonth = t;
    if (runwayMonths === null && cash < 0) runwayMonths = t;
    points.push({ month: t, mrr, cash });
  }
  return { input: { ...input, months }, points, endMrr: mrr, endArr: mrr * 12, runwayMonths, breakEvenMonth };
}

/**
 * Today's numbers as a starting point for what-ifs. Spend is backed out of
 * the burn so that month 0 reproduces today's burn exactly, and stays flat
 * unless the founder's planned burn after the raise is passed in.
 */
export function scenarioBase(metrics: Record<string, Metric>, extra: { raise?: number; months?: number; plannedBurn?: number } = {}): ScenarioInput | null {
  const mrr = metrics["mrr"]?.value;
  const burn = metrics["monthlyBurn"]?.value;
  const runway = metrics["runwayToday"]?.value;
  const gm = metrics["grossMarginWithSupport"]?.value ?? metrics["grossMarginBooked"]?.value;
  if (mrr === undefined || burn === undefined || gm === undefined) return null;
  return {
    startMrr: mrr,
    monthlyGrowth: metrics["growth3m"]?.value ?? metrics["growth12m"]?.value ?? 0,
    grossMargin: gm,
    monthlySpend: (extra.plannedBurn ?? burn) + mrr * gm, // spend that gives today's burn, or the planned burn after the raise
    cash: runway !== undefined ? runway * burn : 0,
    raise: extra.raise ?? 0,
    months: extra.months ?? 24,
  };
}

/** Plain-language summary of a scenario, for the card under a chat reply. */
export function describeScenario(r: ScenarioResult): string {
  const usd = (n: number) => formatMetric({ value: n, unit: "usd" });
  const g = `${(r.input.monthlyGrowth * 100).toFixed(1)}% a month`;
  const cash = r.runwayMonths === null
    ? `the cash lasts the full ${r.input.months} months, ending at ${usd(r.points.at(-1)!.cash)}`
    : `the cash runs out in month ${r.runwayMonths}`;
  const be = r.breakEvenMonth === null ? "" : ` You'd cover your spending from month ${r.breakEvenMonth}.`;
  return `At ${g} growth and ${usd(r.input.monthlySpend)} of spending a month, MRR reaches ${usd(r.endMrr)} (ARR ${usd(r.endArr)}) after ${r.input.months} months and ${cash}.${be}`;
}

// --- Reading the chat's chart and scenario tags ---------------------------------

export type ReplySegment =
  | { type: "text"; text: string }
  | { type: "chart"; id: ChartId }
  | { type: "scenario"; changes: Partial<Pick<ScenarioInput, "monthlyGrowth" | "monthlySpend" | "raise" | "months" | "grossMargin">> };

const KEYS = { growth: "monthlyGrowth", spend: "monthlySpend", raise: "raise", months: "months", margin: "grossMargin" } as const;

function num(raw: string): number | null {
  const m = raw.trim().replace(/[$,]/g, "").match(/^(-?\d+(?:\.\d+)?)(%|k|m)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const suffix = m[2]?.toLowerCase();
  return suffix === "%" ? n / 100 : suffix === "k" ? n * 1e3 : suffix === "m" ? n * 1e6 : n;
}

/**
 * Splits a reply on [[chart:id]] and [[scenario key=value ...]] tags. Unknown
 * charts and bad values are dropped, so a malformed tag never renders.
 */
export function parseReply(text: string): ReplySegment[] {
  const out: ReplySegment[] = [];
  const push = (t: string) => { if (t.trim()) out.push({ type: "text", text: t.trim() }); };
  let last = 0;
  for (const m of text.matchAll(/\[\[(chart|scenario)\s*:?\s*([^\]]*)\]\]/gi)) {
    push(text.slice(last, m.index));
    last = m.index! + m[0].length;
    const body = (m[2] ?? "").trim();
    if (m[1]!.toLowerCase() === "chart") {
      if (body in CHART_CATALOG) out.push({ type: "chart", id: body as ChartId });
      continue;
    }
    const changes: Extract<ReplySegment, { type: "scenario" }>["changes"] = {};
    for (const [, k, v] of body.matchAll(/(\w+)\s*=\s*([^\s]+)/g)) {
      const key = KEYS[k!.toLowerCase() as keyof typeof KEYS];
      const n = num(v!);
      if (!key || n === null || n < 0) continue;
      if ((key === "monthlyGrowth" || key === "grossMargin") && n > 1) continue;
      changes[key] = n;
    }
    out.push({ type: "scenario", changes });
  }
  push(text.slice(last));
  return out;
}
