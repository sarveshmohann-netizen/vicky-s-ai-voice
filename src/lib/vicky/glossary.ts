// Learn: the investor terms founders hear most, in plain words, with how to
// back each one up. Where the term is a metric Vicky computes, the page shows
// the founder's own number next to it. Links point only at the public sources
// already listed in knowledge.ts RESOURCES.

import { RESOURCES, RESOURCES_CHECKED, type Topic } from "./knowledge.ts";
import { formatMetric, type Metric } from "./tidewell/metrics.ts";

export type TermGroup = "Revenue and growth" | "Customers" | "Efficiency and cash" | "The round";

export interface Term {
  id: string;
  term: string;
  group: TermGroup;
  topic: Topic;
  plain: string; // what it means, in a sentence or two
  backItUp: string; // what to have ready when an investor asks
  metricId?: string; // the founder's number, when Vicky computes it
  ask: string; // a question to send to Vicky
  source?: { title: string; publisher: string; url: string } | undefined;
}

const src = (publisher: string, title: string) => {
  const r = RESOURCES.find((x) => x.publisher === publisher && x.title === title);
  return r ? { title: r.title, publisher: r.publisher, url: r.url } : undefined;
};
const A16Z = src("Andreessen Horowitz", "16 Startup Metrics");
const YC_SEED = src("Y Combinator", "A guide to seed fundraising");

const TERMS: Term[] = [
  { id: "mrr", term: "MRR", group: "Revenue and growth", topic: "growth", metricId: "mrr", source: A16Z,
    plain: "Monthly recurring revenue: what customers pay you every month on subscription. One-off fees don't count.",
    backItUp: "Show MRR by month from your books, with one-time revenue kept separate.",
    ask: "How should I present my MRR?" },
  { id: "arr", term: "ARR", group: "Revenue and growth", topic: "growth", metricId: "arr", source: A16Z,
    plain: "Annual recurring revenue: this month's MRR times 12. It's a run rate, not last year's revenue.",
    backItUp: "Say which month it's based on, and leave setup or services fees out.",
    ask: "Is my ARR calculated the way investors expect?" },
  { id: "growth", term: "Month-on-month growth", group: "Revenue and growth", topic: "growth", metricId: "growth3m", source: A16Z,
    plain: "How fast MRR grows each month, usually averaged over the last 3 or 12 months.",
    backItUp: "Give the period you measured over, and have a reason ready for any jump or dip.",
    ask: "Is my growth fast enough for this investor?" },
  { id: "nrr", term: "Net revenue retention (NRR)", group: "Customers", topic: "retention", metricId: "nrr", source: A16Z,
    plain: "Revenue from customers you had a year ago, as a share of what they paid then. Over 100% means existing customers grow even after some leave.",
    backItUp: "Split it into expansion, downgrades and churn, so you know which one moves it.",
    ask: "What's dragging my retention?" },
  { id: "grr", term: "Gross revenue retention (GRR)", group: "Customers", topic: "retention", metricId: "grr", source: A16Z,
    plain: "Like NRR but without upsells, so it can't go above 100%. It shows how much revenue you keep.",
    backItUp: "Know your biggest losses by name and why they left.",
    ask: "How do I talk about the revenue we lose?" },
  { id: "churn", term: "Churn", group: "Customers", topic: "churn", metricId: "logoChurnMonthly12m", source: A16Z,
    plain: "The share of customers (logo churn) or revenue (revenue churn) you lose each month.",
    backItUp: "Know it by cohort or customer size, and the top reasons people leave.",
    ask: "How do I answer questions about churn?" },
  { id: "concentration", term: "Customer concentration", group: "Customers", topic: "concentration", metricId: "largestCustomerShare",
    plain: "How much of your revenue depends on your largest customers. If one customer is a big slice, losing them is a big risk.",
    backItUp: "Know their share of MRR, the renewal date and your growth without them.",
    ask: "How do I handle questions about my biggest customer?" },
  { id: "cac", term: "CAC", group: "Efficiency and cash", topic: "cac", metricId: "cacFullyLoaded", source: A16Z,
    plain: "Customer acquisition cost: all sales and marketing spend, salaries included, divided by new customers won.",
    backItUp: "Use the fully loaded number, not ad spend alone, and have it by channel.",
    ask: "Is my CAC going to worry this investor?" },
  { id: "payback", term: "CAC payback", group: "Efficiency and cash", topic: "cac", metricId: "cacPaybackMonths", source: A16Z,
    plain: "How many months of gross profit from a new customer it takes to earn back what you spent to win them.",
    backItUp: "Calculate it on gross margin, not revenue, and know what would shorten it.",
    ask: "How can I shorten my CAC payback?" },
  { id: "gross-margin", term: "Gross margin", group: "Efficiency and cash", topic: "margin", metricId: "grossMarginWithSupport", source: A16Z,
    plain: "The share of revenue left after the direct cost of serving customers, like hosting and support.",
    backItUp: "Say whether support costs are in it. Investors usually count them.",
    ask: "Which gross margin should I quote?" },
  { id: "burn", term: "Burn", group: "Efficiency and cash", topic: "burn", metricId: "monthlyBurn", source: src("Paul Graham", "Default Alive or Default Dead?"),
    plain: "How much cash you lose each month after revenue comes in.",
    backItUp: "Use a recent average, and leave one-off refunds or grants out.",
    ask: "How will they read my burn?" },
  { id: "burn-multiple", term: "Burn multiple", group: "Efficiency and cash", topic: "burn", metricId: "burnMultiple", source: src("David Sacks", "The Burn Multiple"),
    plain: "Cash burned divided by net new ARR added in the same period. Lower is better: it's how much you spend to grow by a dollar.",
    backItUp: "Show it by quarter so the trend is clear.",
    ask: "How will they read my burn multiple?" },
  { id: "runway", term: "Runway", group: "Efficiency and cash", topic: "runway", metricId: "runwayToday", source: src("Paul Graham", "How to Raise Money"),
    plain: "How many months your cash lasts at the current burn.",
    backItUp: "Show it before and after the raise, and at your actual growth, not only the plan.",
    ask: "How long will the raise really last?" },
  { id: "safe", term: "SAFE", group: "The round", topic: "valuation", source: src("Y Combinator", "The SAFE"),
    plain: "A simple agreement for future equity: money now that turns into shares at the next priced round, often with a cap or a discount.",
    backItUp: "Know every SAFE you've signed, its cap and discount, and how they convert.",
    ask: "How do my SAFEs affect this round?" },
  { id: "pre-post", term: "Pre-money and post-money", group: "The round", topic: "valuation", source: YC_SEED,
    plain: "Pre-money is the company's value before new money comes in; post-money is that plus the new money.",
    backItUp: "You don't need to name a number. Know your round size and what it buys.",
    ask: "What do I say if they ask about valuation?" },
  { id: "dilution", term: "Dilution", group: "The round", topic: "valuation", source: YC_SEED,
    plain: "The share of the company founders and earlier investors give up when new shares are issued.",
    backItUp: "Keep a current cap table, including SAFEs and the option pool.",
    ask: "How should I think about dilution in this round?" },
  { id: "lead", term: "Lead investor", group: "The round", topic: "use-of-funds", source: YC_SEED,
    plain: "The investor who sets the terms, usually writes the biggest cheque and does the most diligence. Others follow.",
    backItUp: "Know your round size and who's already committed.",
    ask: "How do I find and pitch a lead investor?" },
  { id: "use-of-funds", term: "Use of funds", group: "The round", topic: "use-of-funds", source: YC_SEED,
    plain: "What the money will be spent on and what milestones it gets you to before the next round.",
    backItUp: "Tie each slice of the raise to a milestone and a month.",
    ask: "How should I explain where the money goes?" },
  { id: "tam", term: "TAM", group: "The round", topic: "market", source: src("Sequoia Capital", "Writing a Business Plan"),
    plain: "Total addressable market: the revenue available if every customer who fits bought from you.",
    backItUp: "Build it bottom-up: a named count of customers who fit, times what each would pay.",
    ask: "How do I size my market without overselling it?" },
];

export interface GlossaryEntry extends Term { yourNumber: string | null; sourceLabel: string | null }

/** The glossary, with the founder's own number filled in where Vicky has it. */
export function glossary(metrics: Record<string, Metric> = {}): GlossaryEntry[] {
  return TERMS.map((t) => {
    const m = t.metricId ? metrics[t.metricId] : undefined;
    return { ...t, yourNumber: m ? formatMetric(m) : null, sourceLabel: t.source ? `${t.source.publisher}, ${RESOURCES_CHECKED}` : null };
  });
}

/** Terms to underline in chat replies: the term, and the id to look it up by. */
export function glossaryMatchers(): { id: string; pattern: RegExp }[] {
  return TERMS.map((t) => {
    const short = t.term.match(/\(([^)]+)\)/)?.[1];
    const words = [t.term.replace(/\s*\([^)]*\)/, ""), ...(short ? [short] : [])].map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return { id: t.id, pattern: new RegExp(`\\b(${words.join("|")})\\b`, "i") };
  });
}
