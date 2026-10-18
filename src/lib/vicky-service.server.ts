import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { buildSystemPrompt, QUESTIONS, gradingPrompt, factCheckAnswer } from './vicky/knowledge';
import { toKnowledgeAnalysis, knownMetrics } from './vicky/tidewell/analysis';
import { createVickyAI, gradeWithRetry } from './vicky-ai.server';
import { loadFounderData } from './vicky-data.server';
import type { GradeInput } from './vicky-inputs';
import { loadCompanyContext } from './companies.server';
import { companyKnownMetrics } from './companies';

export async function reportForFounder(client: SupabaseClient<Database>, userId: string) {
  const data = await loadFounderData(client, userId, true);
  const system = buildSystemPrompt({ mode: 'report', analysis: toKnowledgeAnalysis(data.analysis), lessons: data.lessons });
  return { report: await createVickyAI().text(system, [{ role: 'user', content: 'Write my Readiness Report from the computed analysis.' }]) };
}

export async function gradeForFounder(client: SupabaseClient<Database>, userId: string, input: GradeInput) {
  const question = QUESTIONS.find(q => q.id === input.questionId);
  if (!question) throw new Error('Unknown practice question.');
  const topic = question.topics[0];
  if (!topic) throw new Error('The practice question has no topic.');
  const data = input.company_id ? await loadCompanyContext(client, userId, input.company_id, true) : await loadFounderData(client, userId, true);
  if (input.flagId && !data.analysis.flags.some(f => f.id === input.flagId)) throw new Error('Unknown assumption flag.');
  const analysis = 'knowledge' in data ? data.knowledge : toKnowledgeAnalysis(data.analysis);
  const metrics = 'profile' in data ? companyKnownMetrics(data.analysis, data.profile) : knownMetrics(data.analysis);
  const factChecks = factCheckAnswer(input.answer, metrics);
  const system = buildSystemPrompt({ mode: 'ask', analysis, history: data.history, lessons: data.lessons, ...(input.company_id ? { workedExamples: false } : {}) });
  const prompt = gradingPrompt(input.investorQuestion ? { ...question, question:input.investorQuestion } : question, input.answer, analysis);
  const ai = createVickyAI();
  const parsed = await gradeWithRetry(retry => ai.text(system, [{ role: 'user', content: prompt + '\nCODE FACT CHECKS: ' + JSON.stringify(factChecks) + (retry ? '\nThe last response could not be parsed. Return only the requested grade JSON, with every criterion present.' : '') }]), question.id, input.flagId);
  if (!parsed) return { error: 'Vicky could not produce a usable grade after two attempts. Nothing was saved.' };
  const { questionId: _questionId, ...scores } = parsed.grade;
  const { error } = await client.from('practice_records').insert({ founder_id: userId, company_id: input.company_id ?? null, question_id: question.id, topic, grade: { ...scores, factChecks: factChecks.map(c => ({ ...c })) }, coaching_note: parsed.coachingNote, improved_answer: parsed.improvedAnswer });
  if (error) throw new Error('Could not save the practice result.');
  return { ...parsed, factChecks };
}