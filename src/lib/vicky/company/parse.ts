// Reads a founder's monthly P&L from CSV text, whatever the column names, and
// maps it onto the lines Vicky needs. Works with months as rows or as columns.
// Anything it can't map is reported back, never guessed.

export interface MonthRow {
  month: string; // YYYY-MM
  recurringRevenue: number;
  otherRevenue: number; // one-time: onboarding, services, setup
  totalRevenue: number;
  cogs: number;
  grossProfit: number;
  salesMarketing: number; // salaries, commissions and programs
  marketingPrograms: number;
  support: number; // customer success or support salaries, if listed
  rnd: number;
  ga: number; // general and admin, including depreciation and anything unlabelled
  totalOpex: number;
  operatingIncome: number;
  otherIncome: number; // grants, tax credits, interest
  netIncome: number;
}

export type Line = Exclude<keyof MonthRow, "month" | "salesMarketing" | "grossProfit"> | "salesMarketing" | "grossProfit" | "ignore";

export interface ParseResult {
  rows: MonthRow[];
  mapping: { column: string; line: Line }[];
  warnings: string[];
}

// --- CSV --------------------------------------------------------------------

export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t" || ch === ";") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((c) => c.trim()));
}

// "$1,234.00", "-$57,492", "(1,234)", "1.2k" → number. Blank → 0. Not a number → null.
export function parseAmount(raw: string): number | null {
  let s = raw.trim();
  if (s === "" || s === "-" || s === "—") return 0;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  if (s.startsWith("-")) { sign *= -1; s = s.slice(1); }
  s = s.replace(/[$€£¥,\s]|CAD|USD|EUR|GBP/gi, "");
  if (s.startsWith("-")) { sign *= -1; s = s.slice(1); }
  const m = s.match(/^(\d+(?:\.\d+)?)([kKmM])?$/);
  if (!m) return null;
  const mult = m[2] ? (m[2].toLowerCase() === "k" ? 1e3 : 1e6) : 1;
  return sign * Number(m[1]) * mult;
}

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12" };

// "2024-10", "2024-10-31", "Oct 2024", "Oct-24", "10/2024", "10/31/2024" → "2024-10".
export function parseMonth(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}`;
  m = s.match(/^([a-z]{3,9})[\s\-']*(\d{2}|\d{4})$/);
  if (m) {
    const mm = MONTHS[m[1]!.slice(0, m[1]!.startsWith("sept") ? 4 : 3)];
    if (!mm) return null;
    const y = m[2]!.length === 2 ? `20${m[2]}` : m[2]!;
    return `${y}-${mm}`;
  }
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[2]}-${m[1]!.padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.]\d{1,2}[-/.](\d{4})$/);
  if (m) return `${m[2]}-${m[1]!.padStart(2, "0")}`;
  return null;
}

// --- Column names ------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

// First matching rule wins, so totals and specific lines come before broad ones.
const RULES: [RegExp, Line][] = [
  [/^(month|date|period)$/, "ignore"],
  [/gross (profit|margin)/, "grossProfit"],
  [/^total (cogs|cost of (revenue|goods|sales))|^(cogs|cost of (revenue|goods sold|sales)) total$/, "cogs"],
  [/^total (operating )?(expenses|opex)$|^(operating expenses|opex)( total)?$/, "totalOpex"],
  [/operating (income|loss|profit)|^ebit$/, "operatingIncome"],
  [/net (income|loss|profit)|^net$/, "netIncome"],
  [/^total (revenue|sales)$|^(net )?revenue( total)?$|^(total )?income$|^sales$/, "totalRevenue"],
  [/subscription|recurring|^mrr$|saas|licen[cs]e/, "recurringRevenue"],
  [/onboarding|implementation|setup|set up|one time|services revenue|professional services rev|^services$/, "otherRevenue"],
  [/^cogs|cost of (revenue|goods|sales)|hosting|payment processing|telephony|^sms/, "cogs"],
  [/customer success|customer support|^support/, "support"],
  [/marketing programs?|^marketing( spend| ads| campaigns)?$|advertising|paid (ads|acquisition)/, "marketingPrograms"],
  [/sales|marketing|commission|business development/, "salesMarketing"],
  [/^r ?and ?d|^rnd|research|engineering|product development|development/, "rnd"],
  [/other income|grant|tax credit|sr ?and ?ed|srred|interest income|non operating/, "otherIncome"],
  [/^g ?and ?a|^ga |general|admin|rent|software|professional fees|legal|accounting|bookkeeping|insurance|office|depreciation|amorti|travel|^other/, "ga"],
];

export function classifyColumn(name: string): Line | null {
  const n = norm(name);
  for (const [re, line] of RULES) if (re.test(n)) return line;
  return null;
}

// --- Parsing -----------------------------------------------------------------

export function parseFinancials(text: string): ParseResult {
  const grid = splitCsv(text);
  const warnings: string[] = [];
  if (grid.length < 2) return { rows: [], mapping: [], warnings: ["The file needs a header row and at least one month of numbers."] };

  // Months down the first column, or months across the header row.
  const header = grid[0]!;
  const monthsAcross = header.slice(1).filter((h) => parseMonth(h)).length >= Math.max(2, (header.length - 1) / 2);
  const table: { months: string[]; columns: { name: string; values: string[] }[] } = monthsAcross
    ? { months: header.slice(1), columns: grid.slice(1).map((r) => ({ name: r[0] ?? "", values: r.slice(1) })) }
    : { months: grid.slice(1).map((r) => r[0] ?? ""), columns: header.slice(1).map((name, i) => ({ name, values: grid.slice(1).map((r) => r[i + 1] ?? "") })) };

  const monthKeys = table.months.map(parseMonth);
  const badMonths = table.months.filter((_, i) => !monthKeys[i]);
  if (badMonths.length) warnings.push(`Skipped ${badMonths.length} row(s) without a recognisable month, such as "${badMonths[0]}".`);

  const mapping: ParseResult["mapping"] = [];
  const sums = new Map<Line, number[]>();
  const n = table.months.length;
  for (const col of table.columns) {
    if (!col.name) continue;
    const line = classifyColumn(col.name);
    if (!line) { warnings.push(`Didn't recognise "${col.name}", so it was left out. Rename it (for example "G&A software") to include it.`); continue; }
    mapping.push({ column: col.name, line });
    if (line === "ignore") continue;
    const values = col.values.map(parseAmount);
    if (values.some((v) => v === null)) warnings.push(`Some values in "${col.name}" weren't numbers and were read as 0.`);
    const acc = sums.get(line) ?? new Array<number>(n).fill(0);
    values.forEach((v, i) => { acc[i] = (acc[i] ?? 0) + (v ?? 0); });
    sums.set(line, acc);
  }

  const has = (l: Line) => sums.has(l);
  const get = (l: Line, i: number) => sums.get(l)?.[i] ?? 0;
  if (!has("recurringRevenue") && !has("totalRevenue")) {
    return { rows: [], mapping, warnings: [...warnings, "No revenue column found. Add a column called \"Subscription revenue\" or \"Total revenue\"."] };
  }
  if (!has("recurringRevenue")) warnings.push("No recurring revenue column, so all revenue is treated as recurring. Split out one-time fees for an accurate ARR.");
  if (!has("cogs")) warnings.push("No cost of revenue column, so gross margin can't be calculated.");
  if (!has("operatingIncome") && !has("totalOpex") && !["salesMarketing", "marketingPrograms", "rnd", "ga", "support"].some((l) => has(l as Line))) {
    warnings.push("No operating expenses found, so burn and runway can't be calculated.");
  }

  const rows: MonthRow[] = [];
  for (let i = 0; i < n; i++) {
    const month = monthKeys[i];
    if (!month) continue;
    const other = get("otherRevenue", i);
    const total = has("totalRevenue") ? get("totalRevenue", i) : get("recurringRevenue", i) + other;
    const recurring = has("recurringRevenue") ? get("recurringRevenue", i) : total - other;
    const cogs = get("cogs", i);
    const grossProfit = has("grossProfit") ? get("grossProfit", i) : total - cogs;
    const programs = get("marketingPrograms", i);
    const salesMarketing = get("salesMarketing", i) + programs;
    const lines = salesMarketing + get("support", i) + get("rnd", i) + get("ga", i);
    const totalOpex = has("totalOpex") ? get("totalOpex", i) : lines;
    const operatingIncome = has("operatingIncome") ? get("operatingIncome", i) : grossProfit - totalOpex;
    const otherIncome = get("otherIncome", i);
    const netIncome = has("netIncome") ? get("netIncome", i) : operatingIncome + otherIncome;
    rows.push({
      month, recurringRevenue: recurring, otherRevenue: other, totalRevenue: total, cogs, grossProfit,
      salesMarketing, marketingPrograms: programs, support: get("support", i), rnd: get("rnd", i),
      ga: has("totalOpex") && !lines ? 0 : get("ga", i), totalOpex, operatingIncome, otherIncome, netIncome,
    });
  }
  rows.sort((a, b) => a.month.localeCompare(b.month));
  for (let i = 1; i < rows.length; i++) if (rows[i]!.month === rows[i - 1]!.month) warnings.push(`${rows[i]!.month} appears twice; check the file.`);
  if (rows.length < 13) warnings.push(`Only ${rows.length} months of data. Growth over 12 months needs at least 13.`);
  return { rows, mapping, warnings };
}
