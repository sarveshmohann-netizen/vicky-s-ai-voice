import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { companySaveSchema } from "./companies";
import { meetingInput, assertFounderAccess } from "./vicky-inputs";
import { parseFinancials } from "./vicky/company/parse";
import { loadOwnedCompany, loadCompanyContext } from "./companies.server";
import { companyBrief } from "./vicky/company/brief";

export const listCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { data, error } = await context.supabase
      .from("companies")
      .select("id,name,currency")
      .eq("founder_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Could not load your companies.");
    return data ?? [];
  });
export const getCompanyDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { company, profile, parsed } = await loadOwnedCompany(
      context.supabase,
      context.userId,
      data.id,
    );
    return { id: company.id, profile, parsed };
  });
export const saveCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => companySaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const parsed = parseFinancials(data.source_csv);
    if (!parsed.rows.length)
      throw new Error(parsed.warnings.at(-1) ?? "No monthly revenue could be read from this file.");
    const values = {
      founder_id: context.userId,
      name: data.profile.name,
      currency: data.profile.currency ?? "USD",
      profile: JSON.parse(JSON.stringify(data.profile)),
      parsed: JSON.parse(JSON.stringify(parsed)),
      source_csv: data.source_csv,
      updated_at: new Date().toISOString(),
    };
    const query = data.id
      ? context.supabase
          .from("companies")
          .update(values)
          .eq("id", data.id)
          .eq("founder_id", context.userId)
      : context.supabase.from("companies").insert(values);
    const { data: row, error } = await query.select("id,name,currency").single();
    if (error || !row) throw new Error("Could not save your company.");
    return row;
  });
export const updateCompanyDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    companySaveSchema.omit({ source_csv: true }).extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("companies")
      .update({
        name: data.profile.name,
        currency: data.profile.currency ?? "USD",
        profile: JSON.parse(JSON.stringify(data.profile)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("founder_id", context.userId)
      .select("id,name,currency")
      .single();
    if (error || !row) throw new Error("Could not save company details.");
    return row;
  });
export const getCompanyDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => meetingInput.extend({ company_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const id = assertFounderAccess(context.userId, data.founder_id);
    setResponseHeader("Cache-Control", "no-store");
    const { analysis, profile, history } = await loadCompanyContext(
      context.supabase,
      id,
      data.company_id,
    );
    return { analysis, profile, brief: companyBrief(analysis, profile, data.persona, data.stage, history) };
  });
