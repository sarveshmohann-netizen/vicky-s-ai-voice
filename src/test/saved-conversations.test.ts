import { it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import type { Database } from "@/integrations/supabase/types";
import { turnSchema } from "@/lib/conversations";

it("enforces founder-only rows, six-word titles and atomic edit/regenerate history", async () => {
  const session = JSON.parse(
    process.env["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"] ??
      JSON.stringify(
        JSON.parse(readFileSync(`${homedir()}/.cache/lovable-auth/session.json`, "utf8")).session,
      ),
  );
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Verification database configuration is unavailable");
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const stranger = "00000000-0000-4000-8000-000000000001";
  const forbidden = await client
    .from("conversations")
    .insert({ founder_id: stranger, title: "Forbidden" });
  expect(forbidden.error).not.toBeNull();
  const created = await client
    .from("conversations")
    .insert({ title: "Verification only" })
    .select()
    .single();
  expect(created.error).toBeNull();
  if (!created.data) throw new Error("Missing test conversation");
  const id = created.data.id;
  try {
    const first = await client.rpc("vicky_prepare_turn", {
      p_conversation: id,
      p_action: "send",
      p_content: "One two three four five six seven",
    });
    expect(first.error).toBeNull();
    const a = turnSchema.parse(first.data);
    expect(a.conversation.title).toBe("One two three four five six");
    expect(a.messages).toHaveLength(1);
    const reply = await client.rpc("vicky_complete_turn", {
      p_conversation: id,
      p_version: a.conversation.updated_at,
      p_content: "First reply",
    });
    expect(reply.error).toBeNull();
    const next = await client.rpc("vicky_prepare_turn", {
      p_conversation: id,
      p_action: "send",
      p_content: "Second answer",
    });
    expect(next.error).toBeNull();
    const b = turnSchema.parse(next.data);
    const reply2 = await client.rpc("vicky_complete_turn", {
      p_conversation: id,
      p_version: b.conversation.updated_at,
      p_content: "Second reply",
    });
    expect(reply2.error).toBeNull();
    const firstMessage = a.messages[0];
    if (!firstMessage) throw new Error("Missing first user message");
    const edit = await client.rpc("vicky_prepare_turn", {
      p_conversation: id,
      p_action: "edit",
      p_message: firstMessage.id,
      p_content: "Edited first answer",
    });
    expect(edit.error).toBeNull();
    const c = turnSchema.parse(edit.data);
    expect(c.messages).toHaveLength(1);
    expect(c.messages[0]?.content).toBe("Edited first answer");
    const stale = await client.rpc("vicky_complete_turn", {
      p_conversation: id,
      p_version: a.conversation.updated_at,
      p_content: "Stale reply",
    });
    expect(stale.error).not.toBeNull();
    const completed = await client.rpc("vicky_complete_turn", {
      p_conversation: id,
      p_version: c.conversation.updated_at,
      p_content: "Replacement reply",
    });
    expect(completed.error).toBeNull();
    if (!completed.data) throw new Error("Missing reply");
    const grade = await client
      .from("messages")
      .insert({ conversation_id: id, role: "assistant", content: "vicky-grade:{}" });
    expect(grade.error).toBeNull();
    const regenerated = await client.rpc("vicky_prepare_turn", {
      p_conversation: id,
      p_action: "regenerate",
      p_message: completed.data.id,
    });
    expect(regenerated.error).toBeNull();
    expect(turnSchema.parse(regenerated.data).messages).toHaveLength(1);
    const anon = createClient<Database>(url, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const hidden = await anon.from("messages").select("*").eq("conversation_id", id);
    expect(hidden.data ?? []).toHaveLength(0);
    const deleted = await client.from("conversations").delete().eq("id", id);
    expect(deleted.error).toBeNull();
    const cascade = await client.from("messages").select().eq("conversation_id", id);
    expect(cascade.data).toHaveLength(0);
  } finally {
    await client.from("conversations").delete().eq("id", id);
  }
}, 30000);
