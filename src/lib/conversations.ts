import { z } from "zod";
import { QUESTIONS } from "./vicky/knowledge";
import { personaSchema, stageSchema, meetingSearchSchema } from "./vicky-inputs";
import type { Tables } from "@/integrations/supabase/types";

export const modeSchema = z.enum(["ask", "simulate"]);
export const practiceSearchSchema = meetingSearchSchema.extend({
  question: z.string().optional(),
  mode: z.enum(["question", "ask", "simulate"]).catch("ask"),
});
export const settingsSchema = z.object({
  company_id: z.string().uuid().nullable().optional(),
  mode: modeSchema,
  persona: personaSchema,
  stage: stageSchema,
});
export const conversationSchema = z
  .object({
    id: z.string().uuid(),
    founder_id: z.string().uuid(),
    title: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .merge(settingsSchema);
export const messageSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  created_at: z.string(),
});
export const turnSchema = z.object({
  conversation: conversationSchema,
  messages: z.array(messageSchema),
});
export type Conversation = z.infer<typeof conversationSchema>;
export type SavedMessage = z.infer<typeof messageSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export const GRADE_PREFIX = "vicky-grade:";
export const isGradeMessage = (m: Pick<SavedMessage, "content">) =>
  m.content.startsWith(GRADE_PREFIX);
export function titleFromMessage(text: string) {
  return text.trim().split(/\s+/).slice(0, 6).join(" ").slice(0, 200);
}
export function conversationGroup(updatedAt: string, now = new Date()) {
  const date = new Date(updatedAt);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return date >= today ? "Today" : date >= yesterday ? "Yesterday" : "Earlier";
}
export function lastAnswerPair(messages: Pick<SavedMessage, "role" | "content" | "id">[]) {
  const chat = messages.filter((m) => !isGradeMessage(m));
  const index = chat.length - 1 - [...chat].reverse().findIndex((m) => m.role === "user");
  const answer = chat[index];
  const question = chat
    .slice(0, index)
    .reverse()
    .find((m) => m.role === "assistant");
  if (!answer || !question) return null;
  return { answer, question };
}
export function closestQuestion(text: string) {
  const words = new Set(text.toLowerCase().match(/[a-z]{3,}/g) ?? []);
  return [...QUESTIONS].sort((a, b) => {
    const score = (question: typeof a) =>
      (question.question.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((word) => words.has(word))
        .length;
    return score(b) - score(a);
  })[0];
}
export function parseConversation(row: Tables<"conversations">) {
  return conversationSchema.parse(row);
}
