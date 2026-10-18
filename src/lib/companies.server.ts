import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { companyProfileSchema } from "./companies";
import { parseFinancials } from "./vicky/company/parse";
import { analyzeCompany, companyToKnowledge } from "./vicky/company/analysis";
import { loadFounderData } from "./vicky-data.server";

export async function loadOwnedCompany(
  client: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
) {
  const { data, error } = await client
    .from("companies")
    .select("id,name,currency,parsed,profile")
    .eq("id", companyId)
    .eq("founder_id", founderId)
    .single();
  if (error || !data) throw new Error("This company is unavailable.");
  const profile = companyProfileSchema.parse(data.profile);
  // Stored parses are produced by the engine at save time, not accepted from callers.
  const parsed = data.parsed as unknown as ReturnType<typeof parseFinancials>;
  const analysis = analyzeCompany(parsed, profile);
  return { company: data, profile, parsed, analysis };
}

export async function loadCompanyContext(
  client: SupabaseClient<Database>,
  founderId: string,
  companyId: string,
  withLessons = false,
) {
  const [company, founder] = await Promise.all([
    loadOwnedCompany(client, founderId, companyId),
    loadFounderData(client, founderId, withLessons, companyId),
  ]);
  return {
    ...company,
    history: founder.history,
    lessons: founder.lessons,
    knowledge: companyToKnowledge(company.analysis),
  };
}
