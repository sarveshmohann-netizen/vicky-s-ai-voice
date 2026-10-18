import { z } from 'zod';
import { QUESTIONS, type Topic } from './vicky/knowledge';

export const personaSchema = z.enum(['lead-seed', 'angel-operator', 'strategic', 'gov-fund', 'skeptic', 'yc', 'a16z']);
export const stageSchema = z.enum(['pre-seed', 'seed', 'series-a']);
export const meetingSearchSchema = z.object({ persona: personaSchema.catch('lead-seed'), stage: stageSchema.catch('seed'), company_id: z.string().uuid().optional() });
export const founderInput = z.object({ founder_id: z.string().uuid() });
export const optionalFounderInput = z.object({ founder_id: z.string().uuid().optional() }).default({});
export const questionsInput = founderInput.extend({ persona: personaSchema.optional(), stage: stageSchema.default('seed') });
export const meetingInput = founderInput.extend({ persona: personaSchema, stage: stageSchema });
export const chatInput = founderInput.extend({
  company_id: z.string().uuid().nullable().optional(),
  clarification: z.boolean().optional(),
  conversation_id: z.string().uuid().optional(), action: z.enum(['send','edit','regenerate']).optional(), message_id: z.string().uuid().optional(),
  mode: z.enum(['ask', 'simulate']), persona: personaSchema.optional(), stage: stageSchema.default('seed'),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(20000) })).min(1).max(100),
});
export const gradeInput = founderInput.extend({ company_id: z.string().uuid().nullable().optional(), questionId: z.string().min(1), flagId: z.string().min(1).optional(), answer: z.string().trim().min(1).max(20000), conversation_id: z.string().uuid().optional(), investorQuestion: z.string().min(1).max(20000).optional() });
export type ChatInput = z.infer<typeof chatInput>;
export type GradeInput = z.infer<typeof gradeInput>;
export const isTopic = (value: string): value is Topic => QUESTIONS.some(q => q.topics.some(t => t === value));

export function assertFounderAccess(userId: string, founderId?: string) {
  if (founderId !== undefined && founderId !== userId) throw new Error('You can only access your own practice records.');
  return userId;
}