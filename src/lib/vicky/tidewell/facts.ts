// Tidewell facts that come from the organisers' Supporting Resources pack
// rather than from a CSV we hold. Each one names where it came from so Vicky
// can cite it. Every figure is synthetic and in CAD.

export type Basis = "historical" | "forecast" | "founder-claim" | "public-source";

export interface Fact {
  value: number;
  basis: Basis;
  source: string;
}

const B = "Supporting Resources, Appendix B (historical)";
const C = "Supporting Resources, Appendix C (founders' forecast)";
const A = "Supporting Resources, Appendix A (case overview)";

export const COMPANY = {
  name: "Tidewell Systems Inc.",
  product: "Tidewell Dispatch, scheduling and dispatch software for trades businesses with 3 to 30 field technicians",
  founders: "Jennifer (CEO, sales and fundraising) and Craig (CTO, product and engineering)",
  location: "Toronto, Canada",
  currency: "CAD",
  raise: { amount: 4_000_000, targetClose: "2027-01", meetingsStart: "2026-11", instrument: "priced seed round" },
  nextRoundGoal: "Series A at $5M ARR",
  source: A,
};

// Snapshot at September 30, 2026 (actual).
export const SNAPSHOT = {
  cash: { value: 483_270, basis: "historical", source: `${B}, snapshot Sep 30 2026` },
  deferredRevenue: { value: 181_327, basis: "historical", source: `${B}, snapshot Sep 30 2026` },
  customers: { value: 211, basis: "historical", source: `${B}, snapshot Sep 30 2026` },
  seats: { value: 2_493, basis: "historical", source: `${B}, snapshot Sep 30 2026` },
  headcount: { value: 14, basis: "historical", source: `${B}, snapshot Sep 30 2026` },
} satisfies Record<string, Fact>;

// Cash at Sep 30 2025 and financing in the 12 months to Sep 30 2026, for net burn.
export const CASH_HISTORY = {
  cashSep2025: { value: 497_000, basis: "historical", source: `${B}, balance sheet ($000s, rounded)` },
  safeFeb2026: { value: 500_000, basis: "historical", source: `${A}, funding to date` },
  srAndEdJul2026: { value: 182_300, basis: "historical", source: `${A}, funding to date` },
  srAndEdTotal: { value: 278_700, basis: "historical", source: `${A}, funding to date ($96,400 + $182,300)` },
} satisfies Record<string, Fact>;

// Customers by quarter (actual), Appendix B "Customers and seats".
export const CUSTOMERS_BY_QUARTER = [
  { quarter: "Q4 2024", newCustomers: 10, churned: 2, endCustomers: 46, endSeats: 418 },
  { quarter: "Q1 2025", newCustomers: 13, churned: 4, endCustomers: 55, endSeats: 538 },
  { quarter: "Q2 2025", newCustomers: 28, churned: 3, endCustomers: 80, endSeats: 782 },
  { quarter: "Q3 2025", newCustomers: 20, churned: 7, endCustomers: 93, endSeats: 940 },
  { quarter: "Q4 2025", newCustomers: 33, churned: 10, endCustomers: 116, endSeats: 1_201 },
  { quarter: "Q1 2026", newCustomers: 38, churned: 8, endCustomers: 146, endSeats: 1_769 },
  { quarter: "Q2 2026", newCustomers: 42, churned: 8, endCustomers: 180, endSeats: 2_179 },
  { quarter: "Q3 2026", newCustomers: 40, churned: 9, endCustomers: 211, endSeats: 2_493 },
];
export const CUSTOMERS_SOURCE = `${B}, customers and seats by quarter`;

// Retention and churn figures the pack computes from 05_customers.csv and
// 06_seats_by_customer_by_month.csv, which we have not been given as files.
export const RETENTION = {
  logoChurnMonthly12m: { value: 0.02, basis: "historical", source: "Supporting Resources, Appendix D Q3 (from 05_customers.csv)" },
  logoChurnMonthly6m: { value: 0.016, basis: "historical", source: "Supporting Resources, Appendix D Q3 (from 05_customers.csv)" },
  earlyChurnMonthly: { value: 0.033, basis: "historical", source: "Supporting Resources, Appendix D Q3: monthly-plan customers, first six months" },
  matureChurnMonthly: { value: 0.014, basis: "historical", source: "Supporting Resources, Appendix D Q3: monthly-plan customers after six months" },
  nrr: { value: 0.88, basis: "historical", source: "Supporting Resources, Appendix D Q4: Sep 2025 cohort, $38.0K to $33.3K MRR" },
  grr: { value: 0.81, basis: "historical", source: "Supporting Resources, Appendix D Q4" },
  newMrrPerCustomer: { value: 458, basis: "historical", source: "Supporting Resources, Appendix D Q6" },
  expansionMonthly: { value: 0.004, basis: "historical", source: "Supporting Resources, Appendix I (expansion: about 0.4% of starting MRR a month)" },
  aeRampMonths: { value: 3, basis: "historical", source: "Supporting Resources, Appendix D Q8 (sales_owner in 05_customers.csv)" },
  ncgShareOfMrr: { value: 0.1, basis: "historical", source: "Supporting Resources, Appendix D Q9" },
} satisfies Record<string, Fact>;

export const NORTHERN_COMFORT = {
  seats: 260,
  pricePerSeat: 40,
  billing: "prepaid annually",
  signed: "2026-03",
  renews: "2027-03",
  prepayment: 124_800,
  unearnedAtSep2026: 52_000,
  source: `${A} and Appendix B`,
};

export const PRICING = {
  listPricePerSeat: 45,
  legacyPricePerSeat: 39,
  legacyCustomers: 59,
  annualPlanCustomers: 45,
  onboardingFee: 1_200,
  source: `${A}, product and pricing`,
};

// The nine claims in the founders' draft deck, Appendix A.
export interface DeckClaim {
  id: string;
  claim: string;
  claimed: number | null;
  unit: "usd" | "pct" | "months" | "usd-per-customer" | "seats" | "text";
}
export const DECK_CLAIMS: DeckClaim[] = [
  { id: "arr", claim: "$1.37M ARR", claimed: 1_370_000, unit: "usd" },
  { id: "growth", claim: "Growing 10% month over month", claimed: 0.1, unit: "pct" },
  { id: "gross-margin", claim: "92% gross margin", claimed: 0.92, unit: "pct" },
  { id: "churn", claim: "Monthly logo churn around 1%", claimed: 0.01, unit: "pct" },
  { id: "nrr", claim: "Net revenue retention above 110%", claimed: 1.1, unit: "pct" },
  { id: "cac", claim: "$970 customer acquisition cost, paid back in under 3 months", claimed: 970, unit: "usd-per-customer" },
  { id: "tam", claim: "$2B total addressable market in North America", claimed: 2_000_000_000, unit: "usd" },
  { id: "ncg", claim: "Northern Comfort Group is expanding to 600 seats next year", claimed: 600, unit: "seats" },
  { id: "runway", claim: "$4M gives us 24 months of runway and gets us to $5M ARR", claimed: 24, unit: "months" },
];
export const DECK_SOURCE = `${A}, founders' draft deck`;

// Founders' 18-month plan by quarter, Appendix C ($, converted from $000s).
export const FORECAST_BY_QUARTER = [
  { quarter: "Q4 2026", revenue: 404_000, netIncome: -179_000, endingCash: 301_000, endingMrr: 129_000, customers: 251, headcount: 15 },
  { quarter: "Q1 2027", revenue: 613_000, netIncome: -376_000, endingCash: 3_898_000, endingMrr: 200_000, customers: 306, headcount: 26 },
  { quarter: "Q2 2027", revenue: 785_000, netIncome: -556_000, endingCash: 3_317_000, endingMrr: 251_000, customers: 391, headcount: 36 },
  { quarter: "Q3 2027", revenue: 963_000, netIncome: -405_000, endingCash: 2_897_000, endingMrr: 308_000, customers: 484, headcount: 42 },
  { quarter: "Q4 2027", revenue: 1_139_000, netIncome: -668_000, endingCash: 2_219_000, endingMrr: 367_000, customers: 577, headcount: 46 },
  { quarter: "Q1 2028", revenue: 1_316_000, netIncome: -627_000, endingCash: 1_592_000, endingMrr: 426_000, customers: 668, headcount: 46 },
];
export const FORECAST_SOURCE = `${C}, forecast by quarter`;

// Runway conclusions the pack draws from the full forecast files (08-10), which we don't hold.
export const RUNWAY_AFTER_RAISE = {
  foundersPlanMonths: { value: 22, basis: "forecast", source: "Supporting Resources, Appendix D Q10: cash lasts to about Nov 2028 on the founders' plan" },
  historicalDriversMonths: { value: 17, basis: "forecast", source: "Supporting Resources, Appendix D Q10: growth at rates actually achieved" },
  slipToAprilRunsOutBy: "2027-03",
  slipSource: "Supporting Resources, Appendix D Q11 and Appendix H action 4",
};

export interface FounderAssumption {
  id: string;
  assumption: string;
  foundersValue: string;
  foundersReasoning: string;
}
export const FOUNDER_ASSUMPTIONS: FounderAssumption[] = [
  { id: "ae-productivity", assumption: "New customers per account executive per month, once ramped", foundersValue: "5", foundersReasoning: "Priya closes 4 to 5 a month. New AEs will have a head of sales and better tools." },
  { id: "ae-ramp", assumption: "Months for a new AE to reach full productivity", foundersValue: "1", foundersReasoning: "Our product is easy to demo." },
  { id: "inbound", assumption: "Inbound new customers", foundersValue: "4 a month, growing 3% a month", foundersReasoning: "Our content is starting to compound." },
  { id: "seats-per-customer", assumption: "Seats per new customer", foundersValue: "10", foundersReasoning: "That's our average." },
  { id: "churn", assumption: "Monthly logo churn", foundersValue: "1.0%", foundersReasoning: "Most of our churn came from early customers on the old product." },
  { id: "expansion", assumption: "Net seat expansion in the existing base", foundersValue: "1.0% a month", foundersReasoning: "Customers add technicians as they grow." },
  { id: "price-new", assumption: "List price for new customers", foundersValue: "$45, rising to $54 in January 2027", foundersReasoning: "We are cheaper than the competitors we lose to." },
  { id: "price-existing", assumption: "Price increase for existing customers", foundersValue: "20% in January 2027 for every customer, including legacy $39 and annual plans. No extra churn assumed.", foundersReasoning: "Nobody left when we raised prices for new customers in 2025." },
  { id: "ncg-renewal", assumption: "Northern Comfort Group renewal", foundersValue: "Renews March 2027 at 600 seats and $40, plus a $20,000 onboarding fee", foundersReasoning: "Their COO told us they want every location on Tidewell. Nothing is signed." },
  { id: "cogs", assumption: "Cost of revenue", foundersValue: "12% of revenue", foundersReasoning: "A cushion over today's 8%." },
  { id: "marketing", assumption: "Marketing programs", foundersValue: "$32,000 in October 2026, growing 8% a month", foundersReasoning: "Pour fuel on what works." },
  { id: "srred", assumption: "SR&ED refund", foundersValue: "$240,000 received July 2027", foundersReasoning: "R&D spend is up, so the claim will be bigger." },
  { id: "cash-method", assumption: "Cash", foundersValue: "Net income plus the raise minus equipment", foundersReasoning: "Receivables, payables and deferred revenue are not modelled." },
];
export const ASSUMPTIONS_SOURCE = `${C}, the founders' assumptions`;

export const USE_OF_FUNDS = [
  { category: "Product and engineering", share: 0.45, amount: 1_800_000 },
  { category: "Sales and marketing", share: 0.4, amount: 1_600_000 },
  { category: "G&A and operations", share: 0.1, amount: 400_000 },
  { category: "Reserve", share: 0.05, amount: 200_000 },
];

// What the data pack does not contain. Vicky says so instead of guessing.
export const DATA_GAPS = [
  "No sales pipeline or CRM data: there is no record of deals in progress.",
  "No win/loss or competitor data.",
  "No bottom-up market size: the $2B TAM has no source.",
  "Nothing signed for the Northern Comfort Group expansion to 600 seats.",
  "No finance function: bookkeeping is outsourced part time.",
];
export const GAPS_SOURCE = "Supporting Resources, Appendices B and D";
