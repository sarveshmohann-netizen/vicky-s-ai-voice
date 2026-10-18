import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { assertFounderAccess, optionalFounderInput, questionsInput, chatInput, gradeInput, meetingInput } from './vicky-inputs';
import { loadFounderData } from './vicky-data.server';
import { reportForFounder, gradeForFounder } from './vicky-service.server';
import { selectQuestions } from './vicky/knowledge';
import { toKnowledgeAnalysis } from './vicky/tidewell/analysis';
import { meetingBrief } from './vicky/tidewell/brief';
import { GRADE_PREFIX, lastAnswerPair, closestQuestion, messageSchema } from './conversations';

export const getMeetingBrief = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => meetingInput.parse(input))
  .handler(async ({ data, context }) => {
    const id = assertFounderAccess(context.userId, data.founder_id);
    setResponseHeader('Cache-Control', 'no-store');
    const { analysis, history } = await loadFounderData(context.supabase, id);
    return meetingBrief(data.persona, data.stage, history, analysis);
  });

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
    let gradeData = data;
    if (data.conversation_id) {
      const { data:conversation,error } = await context.supabase.from('conversations').select('id,mode').eq('id',data.conversation_id).eq('founder_id',id).single();
      if (error || conversation?.mode !== 'simulate') throw new Error('Open your own mock meeting to grade an answer.');
      const records = await context.supabase.from('messages').select('*').eq('conversation_id',conversation.id).order('created_at').order('id');
      if (records.error) throw new Error('Could not load the answer.');
      const pair = lastAnswerPair((records.data ?? []).map(m => messageSchema.parse(m)));
      if (!pair) throw new Error('Answer an investor question first.');
      const question = closestQuestion(pair.question.content);
      if (!question) throw new Error('No practice rubric is available.');
      gradeData = { ...data, questionId:question.id, answer:pair.answer.content, investorQuestion:pair.question.content };
    }
    const result = await gradeForFounder(context.supabase,id,gradeData);
    if (data.conversation_id && !('error' in result)) {
      const saved = await context.supabase.from('messages').insert({ conversation_id:data.conversation_id,role:'assistant',content:GRADE_PREFIX+JSON.stringify(result) });
      if (saved.error) throw new Error('Your grade was recorded but could not be displayed in this chat.');
    }
    return result;
  });

export const getPracticeQuestions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input => questionsInput.parse(input))
  .handler(async ({ data, context }) => {
    const id = assertFounderAccess(context.userId, data.founder_id);
    setResponseHeader('Cache-Control', 'no-store');
    const { analysis, history } = await loadFounderData(context.supabase, id);
    return selectQuestions(toKnowledgeAnalysis(analysis), history, data.persona, 5, data.stage);
  });