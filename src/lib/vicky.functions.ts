import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { assertFounderAccess, optionalFounderInput, questionsInput, chatInput, gradeInput } from './vicky-inputs';
import { loadFounderData } from './vicky-data.server';
import { reportForFounder, gradeForFounder } from './vicky-service.server';
import { selectQuestions } from './vicky/knowledge';
import { toKnowledgeAnalysis } from './vicky/tidewell/analysis';

export const getTidewellAnalysis = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => optionalFounderInput.parse(input))
  .handler(async ({ data, context }) => {
    const id = assertFounderAccess(context.userId, data.founder_id);
    setResponseHeader('Cache-Control', 'no-store');
    return (await loadFounderData(context.supabase, id)).analysis;
  });

export const vickyReport = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => optionalFounderInput.parse(input))
  .handler(async ({ data, context }) => {
    const id = assertFounderAccess(context.userId, data.founder_id);
    setResponseHeader('Cache-Control', 'no-store');
    return reportForFounder(context.supabase, id);
  });

// RPC returns plain data. The authenticated HTTP endpoint owns the streaming body;
// startVickyChat calls this entry point, then opens that endpoint with a bearer token.
export const vickyChat = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => chatInput.parse(input))
  .handler(async ({ data, context }) => {
    assertFounderAccess(context.userId, data.founder_id);
    setResponseHeader('Cache-Control', 'no-store');
    return { streamUrl: '/api/public/vicky-chat' as const, input: data };
  });

export const vickyGrade = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => gradeInput.parse(input))
  .handler(async ({ data, context }) => {
    const id = assertFounderAccess(context.userId, data.founder_id);
    setResponseHeader('Cache-Control', 'no-store');
    return gradeForFounder(context.supabase, id, data);
  });

export const getPracticeQuestions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => questionsInput.parse(input))
  .handler(async ({ data, context }) => {
    const id = assertFounderAccess(context.userId, data.founder_id);
    setResponseHeader('Cache-Control', 'no-store');
    const { analysis, history } = await loadFounderData(context.supabase, id);
    return selectQuestions(toKnowledgeAnalysis(analysis), history, data.persona, 5);
  });