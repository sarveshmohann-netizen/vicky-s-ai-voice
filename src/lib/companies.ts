import { z } from 'zod';
import type { CompanyAnalysis, CompanyProfile } from './vicky/company/analysis';
import type { KnownMetric } from './vicky/knowledge';

const amount = z.number().finite().nonnegative().optional();
const rate = z.number().finite().nonnegative().optional();
export const companyProfileSchema = z.object({
  name: z.string().trim().min(1).max(200), currency: z.string().trim().min(1).max(8).default('USD'),
  cash: amount, raiseAmount: amount, planMonthlySpendAfterRaise: amount,
  customers: z.number().int().nonnegative().optional(), newCustomersL12M: z.number().int().nonnegative().optional(),
  logoChurnMonthly: rate, nrr: rate, grr: rate, largestCustomerShare: rate, planMonthlyGrowth: rate,
  deck: z.object({ arr: amount, growth: rate, grossMargin: rate, churn: rate, nrr: rate, cac: amount, runwayMonths: amount }).optional(),
}).transform(value => JSON.parse(JSON.stringify(value)) as CompanyProfile);
export const companySaveSchema = z.object({ id: z.string().uuid().optional(), source_csv: z.string().min(1), profile: companyProfileSchema });
export const companyIdSchema = z.string().uuid().nullable().optional();
export function percentToDecimal(value: string) { return value.trim() === '' ? undefined : Number(value) / 100; }

/** Match spoken metric names to the company's code-produced figures, never sample figures. */
export function companyKnownMetrics(c: CompanyAnalysis, profile: CompanyProfile): KnownMetric[] {
  const fields: [string, string, string[]][] = [
    ['arr', 'ARR', ['arr', 'annual recurring']], ['mrr', 'MRR', ['mrr', 'monthly recurring']],
    ['growth12m', 'monthly growth', ['growing', 'growth', 'month over month']],
    [c.metrics['grossMarginWithSupport'] ? 'grossMarginWithSupport' : 'grossMarginBooked', 'gross margin', ['gross margin', 'margin']],
    ['logoChurnMonthly12m', 'monthly churn', ['churn']], ['nrr', 'net revenue retention', ['nrr', 'net revenue retention', 'net retention']],
    ['cacFullyLoaded', 'CAC', ['cac', 'acquisition cost', 'cost to acquire']], ['cacPaybackMonths', 'CAC payback', ['payback']],
    ['monthlyBurn', 'monthly burn', ['burn']], ['runwayToday', 'runway today', ['runway']],
  ];
  const metrics: KnownMetric[] = fields.flatMap(([id, name, aliases]) => {
    const metric = c.metrics[id];
    if (!metric || !['usd', 'pct', 'months'].includes(metric.unit)) return [];
    return [{ name, aliases, value: metric.value, unit: metric.unit as KnownMetric['unit'] }];
  });
  if (profile.cash !== undefined) metrics.push({ name: 'cash', aliases: ['cash', 'in the bank'], value: profile.cash, unit: 'usd' });
  return metrics;
}