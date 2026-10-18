import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { settingsSchema, parseConversation, messageSchema } from "./conversations";

const idInput = z.object({ id: z.string().uuid() });
export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { data, error } = await context.supabase
      .from("conversations")
      .select("*")
      .eq("founder_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Could not load saved chats.");
    return (data ?? []).map(parseConversation);
  });
export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("conversations")
      .insert({ ...data, company_id: data.company_id ?? null, founder_id: context.userId })
      .select("*")
      .single();
    if (error || !row) throw new Error("Could not create this chat.");
    return parseConversation(row);
  });
export const loadConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { data: row, error } = await context.supabase
      .from("conversations")
      .select("*")
      .eq("id", data.id)
      .eq("founder_id", context.userId)
      .single();
    if (error || !row) throw new Error("This chat is unavailable.");
    const messages = await context.supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", row.id)
      .order("created_at")
      .order("id");
    if (messages.error) throw new Error("Could not restore this chat.");
    return {
      conversation: parseConversation(row),
      messages: (messages.data ?? []).map((m) => messageSchema.parse(m)),
    };
  });
export const updateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    idInput
      .extend({
        settings: settingsSchema.optional(),
        title: z.string().trim().min(1).max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("conversations")
      .update({
        ...data.settings,
        ...(data.settings ? { company_id: data.settings.company_id ?? null } : {}),
        ...(data.title ? { title: data.title } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("founder_id", context.userId)
      .select("*")
      .single();
    if (error || !row) throw new Error("Could not update this chat.");
    return parseConversation(row);
  });
export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("conversations")
      .delete()
      .eq("id", data.id)
      .eq("founder_id", context.userId)
      .select("id");
    if (error || !rows?.length) throw new Error("Could not delete this chat.");
    return { deleted: true };
  });
