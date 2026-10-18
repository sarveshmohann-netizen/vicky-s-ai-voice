import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSystemPrompt } from "../knowledge.ts";
import { investorLens } from "../lens.ts";
import { computeMetrics } from "../tidewell/metrics.ts";
import { analyzeCompany, companyToKnowledge, type CompanyProfile } from "./analysis.ts";
import { companyBrief } from "./brief.ts";
import { classifyColumn, parseAmount, parseFinancials, parseMonth } from "./parse.ts";

// The organisers' Tidewell CSV, uploaded the way a founder would upload theirs.
const csv = readFileSync(new URL("../../../../public/samples/tidewell-income-statement.csv", import.meta.url), "utf8");
const profile: CompanyProfile = {
  name: "Tidewell Systems", currency: "CAD", cash: 483_270, raiseAmount: 4_000_000, customers: 211, newCustomersL12M: 153,
  logoChurnMonthly: 0.02, nrr: 0.88, grr: 0.81, largestCustomerShare: 0.097, planMonthlyGrowth: 0.1, planMonthlySpendAfterRaise: 250_000,
  deck: { arr: 1_370_000, growth: 0.1, grossMargin: 0.92, churn: 0.01, nrr: 1.1, cac: 970, runwayMonths: 24 },
};

test("amounts and months in the formats founders use", () => {
  assert.equal(parseAmount("$15,171.00"), 15171);
  assert.equal(parseAmount("-$57,492.00"), -57492);
  assert.equal(parseAmount("(1,200)"), -1200);
  assert.equal(parseAmount("1.5k"), 1500);
  assert.equal(parseAmount(""), 0);
  assert.equal(parseAmount("n/a"), null);
  assert.equal(parseMonth("2024-10"), "2024-10");
  assert.equal(parseMonth("Oct 2024"), "2024-10");
  assert.equal(parseMonth("Sep-26"), "2026-09");
  assert.equal(parseMonth("10/2024"), "2024-10");
});

test("column names map to the right P&L lines", () => {
  assert.equal(classifyColumn("subscription_revenue"), "recurringRevenue");
  assert.equal(classifyColumn("onboarding_services_revenue"), "otherRevenue");
  assert.equal(classifyColumn("Cost of sales"), "cogs");
  assert.equal(classifyColumn("rnd_salaries"), "rnd");
  assert.equal(classifyColumn("marketing_salaries"), "salesMarketing");
  assert.equal(classifyColumn("marketing_programs"), "marketingPrograms");
  assert.equal(classifyColumn("customer_success_salaries"), "support");
  assert.equal(classifyColumn("ga_salaries"), "ga");
  assert.equal(classifyColumn("other_income_srred_credit"), "otherIncome");
  assert.equal(classifyColumn("Total revenue"), "totalRevenue");
  assert.equal(classifyColumn("Net loss"), "netIncome");
});

test("an uploaded P&L gives the same metrics as the tested Tidewell engine", () => {
  const parsed = parseFinancials(csv);
  assert.equal(parsed.rows.length, 24);
  assert.deepEqual(parsed.warnings, []);
  const a = analyzeCompany(parsed, profile);
  const t = computeMetrics();
  for (const id of ["mrr", "arr", "growth12m", "growth3m", "grossMarginBooked", "grossMarginWithSupport", "monthlyBurn", "runwayToday", "netNewArr"]) {
    assert.ok(Math.abs(a.metrics[id]!.value - t[id]!.value) < 1e-6 * Math.max(1, Math.abs(t[id]!.value)), `${id}: ${a.metrics[id]!.value} vs ${t[id]!.value}`);
  }
  assert.ok(Math.abs(a.metrics["cacFullyLoaded"]!.value - 3_209) < 1);
});

test("months across the top work too", () => {
  const sideways = "Line,Jan 2026,Feb 2026,Mar 2026,Apr 2026\nSubscription revenue,100,110,121,133\nHosting,10,11,12,13\nSales salaries,50,50,50,50\nRent,20,20,20,20\n";
  const p = parseFinancials(sideways);
  assert.deepEqual(p.rows.map((r) => r.month), ["2026-01", "2026-02", "2026-03", "2026-04"]);
  assert.equal(p.rows[3]!.operatingIncome, 133 - 13 - 70);
  assert.ok(p.warnings.some((w) => /13/.test(w)));
});

test("a file with no revenue column is rejected with a clear message", () => {
  const p = parseFinancials("month,rent\n2026-01,100\n");
  assert.equal(p.rows.length, 0);
  assert.match(p.warnings.at(-1)!, /No revenue column/);
  assert.throws(() => analyzeCompany(p, { name: "X" }), /No revenue column/);
});

test("deck claims and story checks for an uploaded company", () => {
  const a = analyzeCompany(parseFinancials(csv), profile);
  const s = Object.fromEntries(a.claims.map((c) => [c.id, c.status]));
  assert.deepEqual(s, { arr: "Fix", growth: "Reword", grossMargin: "Fix", churn: "Fix", nrr: "Fix", cac: "Fix", runwayMonths: "Fix" });
  assert.ok(a.storyChecks.some((c) => c.id === "growth"));
  assert.ok(a.storyChecks.some((c) => c.id === "runway"));
  assert.equal(a.charts.mrr.filter((p) => p.actual !== undefined).length, 24);
  assert.equal(a.charts.mrr.filter((p) => p.plan !== undefined).length, 13);
});

test("missing inputs become gaps, not guesses", () => {
  const a = analyzeCompany(parseFinancials(csv), { name: "Bare" });
  assert.equal(a.metrics["runwayToday"], undefined);
  assert.equal(a.metrics["cacFullyLoaded"], undefined);
  assert.ok(a.dataGaps.some((g) => /Cash/.test(g)));
  const b = companyBrief(a, { name: "Bare" }, "lead-seed", "seed");
  assert.ok(b.questions.find((q) => q.id === "churn")!.numbersSupport.startsWith("Not in your data yet"));
});

test("the investor and stage change what the dashboard leads with", () => {
  const m = analyzeCompany(parseFinancials(csv), profile).metrics;
  const a16zA = investorLens(m, "a16z", "series-a");
  const angel = investorLens(m, "angel-operator", "pre-seed");
  assert.notDeepEqual(a16zA.focus.map((f) => f.id), angel.focus.map((f) => f.id));
  assert.ok(a16zA.focus.some((f) => f.bar), "Series A has published bars");
  assert.ok(angel.focus.every((f) => f.status === "no bar"), "no invented bars at pre-seed");
  const nrr = investorLens(m, "lead-seed", "seed").focus.concat(investorLens(m, "lead-seed", "seed").rest).find((f) => f.id === "nrr")!;
  assert.equal(nrr.status, "close");
  assert.match(nrr.bar!.source.url, /saastr/);
});

test("the brief and prompt for an uploaded company use its numbers, not Tidewell's examples", () => {
  const a = analyzeCompany(parseFinancials(csv), profile);
  const b = companyBrief(a, profile, "skeptic", "seed");
  assert.equal(b.questions.length, 10);
  assert.ok(b.questions.every((q) => !/Northern Comfort|Jobber/.test(q.question)));
  assert.ok(b.tighten.length > 0 && b.tighten.length <= 5);
  const p = buildSystemPrompt({ mode: "simulate", persona: "skeptic", stage: "seed", analysis: companyToKnowledge(a), workedExamples: false });
  assert.doesNotMatch(p, /A strong answer|Northern Comfort|Priya/);
  assert.match(p, /\$1,286,268/);
});
