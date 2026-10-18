// Short source tags. Vicky cites "[P&L]" or "[Pack D3]" in the text, and the
// UI shows the full source in a tooltip, so answers stay readable.

export const SOURCE_KEY: Record<string, string> = {
  "P&L": "Tidewell income statement, Oct 2024 to Sep 2026 (01_income_statement_monthly_actuals.csv)",
  Deck: "The founders' draft pitch deck (Supporting Resources, Appendix A)",
  Plan: "The founders' 18-month forecast (Supporting Resources, Appendix C)",
  "Pack A": "Supporting Resources, Appendix A: case overview",
  "Pack B": "Supporting Resources, Appendix B: historical financials",
  "Pack D": "Supporting Resources, Appendix D: investor questions, worked from the customer files",
  "Pack I": "Supporting Resources, Appendix I: glossary",
  Vicky: "Calculated by Vicky from the figures above",
};

// Maps a long source string to its short tag. Order matters: the most specific match wins.
const RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/Appendix D (Q\d+)/, (m) => `Pack D${m[1]!.slice(1)}`],
  [/Appendix D/, () => "Pack D"],
  [/draft deck/, () => "Deck"],
  [/Appendix C/, () => "Plan"],
  [/Appendix I/, () => "Pack I"],
  [/01_income_statement|income statement/i, () => "P&L"],
  [/Appendix B/, () => "Pack B"],
  [/Appendix A/, () => "Pack A"],
];

export function shortRef(source: string): string {
  for (const [re, tag] of RULES) {
    const m = source.match(re);
    if (m) return tag(m);
  }
  return "Vicky";
}

// All the distinct tags in a source string that names several sources ("A; B").
export function shortRefs(source: string): string[] {
  return [...new Set(source.split(/;\s*| vs /).map(shortRef))];
}
