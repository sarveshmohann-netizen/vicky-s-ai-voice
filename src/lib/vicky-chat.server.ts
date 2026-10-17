import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { chatInput, assertFounderAccess } from './vicky-inputs';
import { loadFounderData } from './vicky-data.server';
import { buildSystemPrompt } from './vicky/knowledge';
import { toKnowledgeAnalysis } from './vicky/tidewell/analysis';
import { createVickyAI, safeAIError } from './vicky-ai.server';
import { withLovableAiGatewayRunIdHeader } from './ai/run-id.server';

export async function handleVickyChat(request: Request) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return Response.json({ error: 'Sign in to use Vicky.' }, { status: 401 });
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) return Response.json({ error: 'Sign-in is not configured.' }, { status: 503 });
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: claims, error } = await client.auth.getClaims(token);
  const userId = claims?.claims.sub;
  if (error || !userId) return Response.json({ error: 'Sign in to use Vicky.' }, { status: 401 });
  const parsed = chatInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid chat request.' }, { status: 400 });
  if (parsed.data.founder_id !== userId) return Response.json({ error: 'You can only access your own practice records.' }, { status: 403 });
  try {
    const id = assertFounderAccess(userId, parsed.data.founder_id);
    const { analysis, history, lessons } = await loadFounderData(client, id, true);
    const system = buildSystemPrompt({ mode: parsed.data.mode, persona: parsed.data.persona, analysis: toKnowledgeAnalysis(analysis), history, lessons });
    const ai = createVickyAI();
    const result = ai.stream(system, parsed.data.messages, request.signal);
    // Read the first event before sending headers, so upstream denials retain status.
    const iterator = result.fullStream[Symbol.asyncIterator]();
    const first = await iterator.next();
    if (!first.done && first.value.type === 'error') throw first.value.error;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let wroteText = false;
        const emit = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        try {
          let current = first;
          while (!current.done) {
            const part = current.value;
            if (part.type === 'text-delta') { wroteText = true; emit({ type: 'text', text: part.text }); }
            if (part.type === 'error') throw part.error;
            current = await iterator.next();
          }
          if (!wroteText) emit({ type: 'error', status: 422, error: 'Lovable AI returned no usable response.' });
          else emit({ type: 'done' });
        } catch (error) { const safe = safeAIError(error); emit({ type: 'error', status: safe.status, error: safe.message }); }
        finally { controller.close(); }
      },
      async cancel() { await iterator.return?.(); },
    });
    return withLovableAiGatewayRunIdHeader(new Response(body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } }), ai.provider);
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    const safe = safeAIError(error);
    return Response.json({ error: safe.message }, { status: safe.status, headers: { 'Cache-Control': 'no-store' } });
  }
}