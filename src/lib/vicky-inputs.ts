import { z } from 'zod';
import { QUESTIONS, type Topic } from './vicky/knowledge';

export const personaSchema = z.enum(['lead-seed', 'angel-operator', 'strategic', 'gov-fund', 'skeptic']);
export const founderInput = z.object({ founder_id: z.string().uuid() });
export const optionalFounderInput = z.object({ founder_id: z.string().uuid().optional() }).default({});
export const questionsInput = founderInput.extend({ persona: personaSchema.optional() });
export const chatInput = founderInput.extend({
  mode: z.enum(['ask', 'simulate']), persona: personaSchema.optional(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(20000) })).min(1).max(100),
});
export const gradeInput = founderInput.extend({ questionId: z.string().min(1), flagId: z.string().min(1).optional(), answer: z.string().trim().min(1).max(20000) });
export type ChatInput = z.infer<typeof chatInput>;
export type GradeInput = z.infer<typeof gradeInput>;
export const isTopic = (value: string): value is Topic => QUESTIONS.some(q => q.topics.some(t => t === value));

export function assertFounderAccess(userId: string, founderId?: string) {
  if (founderId !== undefined && founderId !== userId) throw new Error('You can only access your own practice records.');
  return userId;
}