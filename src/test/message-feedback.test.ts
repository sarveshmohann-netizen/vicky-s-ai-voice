import { it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import type { Database } from "@/integrations/supabase/types";
it("saves feedback only on owned assistant messages and hides only the specified clarification", async () => {
  const session = JSON.parse(
    process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"] ??
      JSON.stringify(
        JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8")).session,
      ),
  );
  const url = process.env["SUPABASE_URL"],
    key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Test configuration unavailable");
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const created = await client
    .from("conversations")
    .insert({ title: "Feedback verification" })
    .select()
    .single();
  if (!created.data) throw new Error("Could not create test conversation");
  const id = created.data.id;
  try {
    const inserted = await client
      .from("messages")
      .insert({ conversation_id: id, role: "assistant", content: "Owned reply" })
      .select()
      .single();
    if (!inserted.data) throw new Error("Missing test reply");
    expect(
      (await client.rpc("vicky_set_feedback", { p_message: inserted.data.id, p_feedback: "up" }))
        .error,
    ).toBeNull();
    expect(
      (await client.from("messages").select("feedback").eq("id", inserted.data.id).single()).data
        ?.feedback,
    ).toBe("up");
    expect(
      (
        await client.rpc("vicky_set_feedback", {
          p_message: "00000000-0000-4000-8000-000000000001",
          p_feedback: "down",
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await client.rpc("vicky_set_feedback", {
          p_message: inserted.data.id,
          p_feedback: "invalid",
        })
      ).error,
    ).not.toBeNull();
    const user = await client
      .from("messages")
      .insert({ conversation_id: id, role: "user", content: "Ordinary answer" })
      .select()
      .single();
    if (!user.data) throw new Error("Missing user message");
    expect(
      (await client.rpc("vicky_set_feedback", { p_message: user.data.id, p_feedback: "up" })).error,
    ).not.toBeNull();
    expect(
      (await client.rpc("vicky_hide_clarification", { p_conversation: id })).error,
    ).not.toBeNull();
    await client
      .from("messages")
      .insert({
        conversation_id: id,
        role: "user",
        content:
          "That didn't answer what I needed. Ask me one short question to understand what I'm after.",
      });
    expect((await client.rpc("vicky_hide_clarification", { p_conversation: id })).error).toBeNull();
    expect(
      (await client.from("messages").select("hidden").eq("conversation_id", id).eq("hidden", true))
        .data,
    ).toHaveLength(1);
  } finally {
    await client.from("conversations").delete().eq("id", id);
  }
}, 30000);
