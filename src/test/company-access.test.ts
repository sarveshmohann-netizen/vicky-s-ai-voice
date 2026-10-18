import { it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import type { Database } from "@/integrations/supabase/types";
it("keeps companies private and prevents chats or grades referencing another founder’s company", async () => {
  const session = JSON.parse(
    process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"] ??
      JSON.stringify(
        JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8")).session,
      ),
  );
  const url = process.env["SUPABASE_URL"],
    key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing verification configuration");
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const stranger = "00000000-0000-4000-8000-000000000001";
  const forbidden = await client
    .from("companies")
    .insert({ founder_id: stranger, name: "Forbidden", source_csv: "none", parsed: { rows: [] } });
  expect(forbidden.error).not.toBeNull();
  const created = await client
    .from("companies")
    .insert({ name: "Privacy verification", source_csv: "none", parsed: { rows: [] } })
    .select()
    .single();
  expect(created.error).toBeNull();
  if (!created.data) throw new Error("No verification company");
  const id = created.data.id;
  try {
    const anon = createClient<Database>(url, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          headers.delete("Authorization");
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
    const read = await anon.from("companies").select().eq("id", id);
    expect(read.data ?? []).toHaveLength(0);
    const wrong = await client
      .from("conversations")
      .insert({ founder_id: stranger, company_id: id });
    expect(wrong.error).not.toBeNull();
    const missing = await client.from("conversations").insert({ company_id: stranger });
    expect(missing.error).not.toBeNull();
    const grade = await client
      .from("practice_records")
      .insert({
        founder_id: stranger,
        company_id: id,
        question_id: "arr",
        topic: "growth",
        grade: { evidence: 4, clarity: 4, accuracy: 4, ownership: 4 },
      });
    expect(grade.error).not.toBeNull();
    const own = await client.from("conversations").insert({ company_id: id }).select().single();
    expect(own.error).toBeNull();
    if (own.data) await client.from("conversations").delete().eq("id", own.data.id);
  } finally {
    await client.from("companies").delete().eq("id", id);
  }
}, 30000);
