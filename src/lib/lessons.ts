import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function parseTopics(value: string): string[] {
  const topics = [...new Set(value.split(',').map((topic) => topic.trim().toLowerCase()).filter(Boolean))];
  if (!topics.length || topics.includes('all')) return ['all'];
  return topics;
}

export const lessonsPageOptions = queryOptions({
  queryKey: ['lessons-admin'],
  queryFn: async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { user: null, admin: false, lessons: [] };
    const { data: admin, error: roleError } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (roleError) throw roleError;
    if (!admin) return { user, admin: false, lessons: [] };
    const { data, error } = await supabase.from('lessons').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return { user, admin: true, lessons: data ?? [] };
  },
});

export async function addLesson(text: string, topics: string) {
  if (!text.trim()) throw new Error('Enter a correction before saving.');
  const { data, error } = await supabase.from('lessons').insert({ text: text.trim(), topics: parseTopics(topics) }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLesson(id: string) {
  const { data, error } = await supabase.from('lessons').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Lesson was not deleted. Check your administrator access and try again.');
}