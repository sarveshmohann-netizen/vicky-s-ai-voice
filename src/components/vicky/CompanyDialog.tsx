import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, ArrowRight, ArrowLeft, Download, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { parseFinancials, type ParseResult } from '@/lib/vicky/company/parse';
import { type CompanyProfile, DECK_LABELS } from '@/lib/vicky/company/analysis';
import { companyProfileSchema, percentToDecimal } from '@/lib/companies';
import { saveCompany, updateCompanyDetails, getCompanyDetails } from '@/lib/companies.functions';
import { RevenuePreview } from './CompanyCharts';

const FIELDS = [
  ['cash', 'Cash in the bank today', 'Your available cash balance.', false],
  ['raiseAmount', 'Raise amount', 'The funding you plan to raise.', false],
  ['planMonthlySpendAfterRaise', 'Planned monthly spend after the raise', 'Average monthly net burn after the money lands.', false],
  ['customers', 'Paying customers today', 'Count customers, not seats.', false],
  ['newCustomersL12M', 'New customers in the last 12 months', 'Used with sales and marketing costs for CAC.', false],
  ['logoChurnMonthly', 'Monthly logo churn %', 'Customers lost each month. Enter 2 for 2%.', true],
  ['nrr', 'Net revenue retention %', 'Includes expansion and lost revenue. Enter 110 for 110%.', true],
  ['grr', 'Gross revenue retention %', 'Retention before expansion. Enter 95 for 95%.', true],
  ['largestCustomerShare', "Largest customer’s share of MRR %", 'How much recurring revenue one customer contributes.', true],
  ['planMonthlyGrowth', 'Monthly growth your forecast assumes %', 'Enter 5 for 5% monthly growth.', true],
] as const;
const LINE_LABELS: Record<string, string> = { recurringRevenue:'Recurring revenue', otherRevenue:'One-time revenue', totalRevenue:'Total revenue', cogs:'Cost of revenue', grossProfit:'Gross profit', salesMarketing:'Sales and marketing', marketingPrograms:'Marketing programs', support:'Support', rnd:'R&D', ga:'G&A', totalOpex:'Total operating expenses', operatingIncome:'Operating income', otherIncome:'Other income', netIncome:'Net income', ignore:'Ignored' };
type Props = { companyId?: string | undefined; onSaved: (id: string) => void; onClose: () => void };
export function CompanyDialog({ companyId, onSaved, onClose }: Props) {
  const cache = useQueryClient();
  const [step, setStep] = useState(companyId ? 3 : 1);
  const [csv, setCsv] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [values, setValues] = useState<Record<string,string>>({name:'', currency:'USD'});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!companyId);
  // A keyed dialog is mounted once for each edit; no browser-only source CSV is returned.
  useEffect(() => {
    if (companyId) void getCompanyDetails({ data:{ id:companyId } }).then(data => {
      const next: Record<string,string> = {name:data.profile.name, currency:data.profile.currency ?? 'USD'};
      for (const [key,,,percent] of FIELDS) { const v = data.profile[key]; if (v !== undefined) next[key] = String(percent ? v * 100 : v); }
      for (const [key, label] of Object.entries(DECK_LABELS)) { const v = data.profile.deck?.[key as keyof NonNullable<CompanyProfile['deck']>]; if (v !== undefined) next['deck.'+key] = String(label.unit === 'pct' ? v*100 : v); }
      setValues(next); setParsed(data.parsed); setLoaded(true);
    }).catch(e => setError(e.message));
  }, [companyId]);
  async function read(file?: File) {
    if (!file) return;
    setError('');
    try { const text = await file.text(); const result = parseFinancials(text); setCsv(text); setParsed(result); setStep(2); if (!result.rows.length) setError(result.warnings.at(-1) ?? 'No monthly revenue was found.'); }
    catch { setError('This file could not be read. Please upload a CSV.'); }
  }
  function field(key: string, label: string, hint?: string, numeric = true) {
    return <label key={key} className="block min-w-0 text-xs font-medium">{label}<Input aria-label={label} type={numeric?'number':'text'} min={numeric?0:undefined} step={numeric?'any':undefined} required={key==='name'} value={values[key] ?? ''} onChange={e=>setValues({...values,[key]:e.target.value})} className="mt-2" />{hint && <span className="mt-1.5 block text-xs font-normal leading-relaxed text-muted-foreground">{hint}</span>}</label>;
  }
  async function save() {
    setBusy(true); setError('');
    try {
      const profile: Record<string,unknown> = { name:values['name'], currency:values['currency'] || 'USD' };
      for (const [key,,,percent] of FIELDS) if (values[key]?.trim()) profile[key] = percent ? percentToDecimal(values[key]) : Number(values[key]);
      const deck: Record<string,number> = {};
      for (const [key, label] of Object.entries(DECK_LABELS)) if (values['deck.'+key]?.trim()) deck[key] = label.unit === 'pct' ? Number(values['deck.'+key])/100 : Number(values['deck.'+key]);
      profile['deck'] = deck;
      const validated = companyProfileSchema.parse(profile);
      const company = companyId ? await updateCompanyDetails({ data:{id:companyId, profile:validated} }) : await saveCompany({ data:{ source_csv:csv, profile:validated } });
      await Promise.all([cache.invalidateQueries({queryKey:['companies']}),cache.invalidateQueries({queryKey:['company-dashboard']}),cache.invalidateQueries({queryKey:['company-details']})]);
      onSaved(company.id);
    } catch(e) { setError(e instanceof Error ? (e.name==='ZodError' ? 'Add a company name and check that numbers are valid and nonnegative.' : e.message) : 'Could not save the company.'); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open=>{if(!open && !busy) onClose();}}><DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto"><DialogTitle>{companyId?'Company details':'Add your company'}</DialogTitle><DialogDescription>{companyId?'Your company inputs':'Upload · Check mapping · Company details'}</DialogDescription>
    {!loaded ? <p className="py-8 text-sm text-muted-foreground">Loading company details…</p> : <>
    {!companyId && <p className="text-xs font-semibold text-primary">Step {step} of 3</p>}
    {step===1 && <><label onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void read(e.dataTransfer.files[0]);}} className="flex cursor-pointer flex-col items-center gap-4 rounded-lg border-2 border-dashed border-border bg-section px-6 py-12 text-center"><Upload className="size-7 text-primary"/><span className="font-medium">Drop your monthly P&amp;L CSV here</span><span className="text-sm text-muted-foreground">or choose a file · months as rows or columns</span><Input type="file" accept=".csv,text/csv" aria-label="Monthly P&L CSV" onChange={e=>void read(e.target.files?.[0])} className="max-w-xs bg-card"/></label><Button variant="link" asChild className="justify-start"><a href="/samples/tidewell-income-statement.csv" download><Download className="size-4"/>Download a sample file</a></Button></>}
    {step===2 && parsed && <><div className="max-h-60 overflow-auto rounded-md border border-border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-muted"><tr><th className="p-3">Column</th><th className="p-3">Mapped to</th></tr></thead><tbody>{parsed.mapping.map((m,i)=><tr key={i} className="border-t border-border"><td className="p-3">{m.column}</td><td className="p-3">{LINE_LABELS[m.line] ?? m.line}</td></tr>)}</tbody></table></div>{parsed.warnings.map((w,i)=><p key={i} className="text-xs leading-relaxed text-muted-foreground">{w}</p>)}{parsed.rows.length>0 && <><p className="text-xs font-semibold">Recurring revenue · {parsed.rows.length} months</p><RevenuePreview rows={parsed.rows}/></>}</>}
    {step===3 && <><div className="grid gap-5 sm:grid-cols-2">{field('name','Company name',undefined,false)}{field('currency','Currency','Three-letter currency code, e.g. USD or CAD.',false)}{FIELDS.map(([key,label,hint])=>field(key,label,hint))}</div><h3 className="mt-5 font-semibold">What does your deck say?</h3><div className="grid gap-5 sm:grid-cols-2">{Object.entries(DECK_LABELS).map(([key,meta])=>field('deck.'+key,meta.label+(meta.unit==='pct'?' %':meta.unit==='months'?' in months':'')))}</div></>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="mt-4 flex justify-between gap-3">{!companyId && step>1 ? <Button variant="ghost" disabled={busy} onClick={()=>setStep(step-1)}><ArrowLeft className="size-4"/>Back</Button>:<span/>}{step===2?<Button disabled={!parsed?.rows.length} onClick={()=>setStep(3)}>Continue<ArrowRight className="size-4"/></Button>:step===3?<Button disabled={busy || !values['name']?.trim()} onClick={()=>void save()}><Save className="size-4"/>{busy?'Saving…':'Save company'}</Button>:null}</div></>}
  </DialogContent></Dialog>;
}
