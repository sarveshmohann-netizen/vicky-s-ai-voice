import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/integrations/supabase/types';
import type { Lesson, PracticeRecord } from './vicky/knowledge';
import type { FactCheck } from './vicky/readiness';
import { analyzeTidewell } from './vicky/tidewell/analysis';
import { isTopic } from './vicky-inputs';
import { z } from 'zod';

const storedGrade = z.object({
  evidence: z.number().min(0).max(4), clarity: z.number().min(0).max(4),
  accuracy: z.number().min(0).max(4), ownership: z.number().min(0).max(4),
  flagId: z.string().optional(),
  factChecks: z.array(z.object({ metric: z.string(), stated: z.number().finite(), actual: z.number().finite() })).optional(),
});

export function practiceFromRows(rows: Tables<'practice_records'>[]) {
  const history: PracticeRecord[] = [];
  const factChecks: FactCheck[] = [];
  for (const row of rows) {
    const parsed = storedGrade.safeParse(row.grade);
    if (!parsed.success || !isTopic(row.topic)) throw new Error('A saved practice record is invalid.');
    const { factChecks: checks, flagId, ...scores } = parsed.data;
    history.push({ questionId: row.question_id, topic: row.topic, grade: { ...scores, ...(flagId ? { flagId } : {}), questionId: row.question_id }, coachingNote: row.coaching_note, at: row.created_at });
    factChecks.push(...(checks ?? []));
  }
  return { history, practice: rows.length ? { answers: history.map(r => r.grade), factChecks } : undefined };
}

export function lessonsFromRows(rows: Tables<'lessons'>[]): Lesson[] {
  return rows.map(row => ({ id: row.id, text: row.text, at: row.created_at, topics: row.topics.includes('all') ? 'all' : row.topics.filter(isTopic) }));
}

export async function loadFounderData(client: SupabaseClient<Database>, founderId: string, withLessons = false, companyId?: string | null) {
  const recordsQuery = client.from('practice_records').select('*').eq('founder_id', founderId);
  const [records, corrections] = await Promise.all([
    (companyId ? recordsQuery.eq('company_id', companyId) : recordsQuery.is('company_id', null)).order('created_at', { ascending: true }),
    withLessons ? client.from('lessons').select('*').order('created_at', { ascending: true }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (records.error || corrections.error) throw new Error('Could not load Vicky’s saved practice and lessons.');
  const { history, practice } = practiceFromRows(records.data ?? []);
  return { history, lessons: lessonsFromRows(corrections.data ?? []), analysis: analyzeTidewell(practice) };
}