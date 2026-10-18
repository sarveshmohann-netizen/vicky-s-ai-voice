import { describe, expect, it, vi } from 'vitest';
import { companyProfileSchema, percentToDecimal, companyKnownMetrics } from './companies';
import { parseFinancials } from './vicky/company/parse';
import { analyzeCompany, companyToKnowledge } from './vicky/company/analysis';
import { factCheckAnswer, buildSystemPrompt } from './vicky/knowledge';
import { loadOwnedCompany } from './companies.server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
const parsed = parseFinancials('month,subscription revenue,cost of revenue,sales salaries\n2026-01,10000,2000,12000\n2026-02,11000,2200,12000\n2026-03,12000,2400,12000\n2026-04,13000,2600,12000\n');
describe('company input rules',()=>{
 it('stores an entered 2% as 0.02 and leaves blank inputs absent',()=>{expect(percentToDecimal('2')).toBe(0.02);expect(percentToDecimal('')).toBeUndefined();});
 it('requires a company name but allows every other founder input to be omitted',()=>{expect(companyProfileSchema.safeParse({name:''}).success).toBe(false);expect(companyProfileSchema.parse({name:'Aurora'})).toEqual({name:'Aurora',currency:'USD'});});
 it('fact-checks ARR against only the uploaded company’s calculated ARR',()=>{const c=analyzeCompany(parsed,{name:'Aurora'});const checks=factCheckAnswer('Our ARR is $200,000.',companyKnownMetrics(c,{name:'Aurora'}));expect(checks.find(x=>x.metric==='ARR')?.actual).toBe(156000);});
 it('never invents cash when the founder left it blank',()=>{const c=analyzeCompany(parsed,{name:'Aurora'});expect(companyKnownMetrics(c,{name:'Aurora'}).some(m=>m.name==='cash')).toBe(false);});
 it('turns off Tidewell worked examples for uploaded companies',()=>{const c=analyzeCompany(parsed,{name:'Aurora'});const prompt=buildSystemPrompt({mode:'ask',analysis:companyToKnowledge(c),workedExamples:false});expect(prompt).toContain('Aurora');expect(prompt).not.toContain('Northern Comfort');});
 it('rejects an unavailable company through an owner-filtered read',async()=>{const eq=vi.fn().mockReturnThis();const client={from:vi.fn(()=>({select:()=>({eq,single:async()=>({data:null,error:{message:'hidden'}})})}))};await expect(loadOwnedCompany(client as unknown as SupabaseClient<Database>,'founder-id','company-id')).rejects.toThrow('unavailable');expect(eq).toHaveBeenCalledWith('founder_id','founder-id');});
});
