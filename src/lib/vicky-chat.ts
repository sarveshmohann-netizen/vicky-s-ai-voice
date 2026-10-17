import { supabase } from '@/integrations/supabase/client';
import { vickyChat } from './vicky.functions';
import type { ChatInput } from './vicky-inputs';

/** Returns SSE events: {type:'text',text}, {type:'done'}, or {type:'error',status,error}. */
export async function startVickyChat(input: ChatInput, signal?: AbortSignal) {
  const { streamUrl, input: validated } = await vickyChat({ data: input });
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Sign in to use Vicky.');
  const response = await fetch(streamUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(validated), signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Vicky could not start this chat.' }));
    throw new Error(body.error);
  }
  return response;
}