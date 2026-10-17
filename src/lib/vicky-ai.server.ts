import { APICallError, streamText, type ModelMessage } from 'ai';
import { createLovableAiGatewayProvider } from './ai/gateway.server';
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server';
import { parseGrade, type ParsedGrade } from './vicky/knowledge';

export class VickyAIError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function safeAIError(error: unknown) {
  if (error instanceof VickyAIError) return error;
  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? 502;
    const messages: Record<number, string> = {
      400: 'Lovable AI could not accept this request.', 401: 'Lovable AI is not configured correctly.',
      402: 'Lovable AI credits are unavailable. Check Plans & credits.',
      403: 'Lovable AI access is blocked. A workspace administrator must review AI access settings.',
      404: 'The requested Gemini model is unavailable.', 429: 'Lovable AI is busy. Please try again later.',
    };
    console.error('Vicky AI request failed', status);
    return new VickyAIError(status, messages[status] ?? 'Lovable AI is temporarily unavailable.');
  }
  return new VickyAIError(502, 'Lovable AI could not complete this response.');
}

export function createVickyAI() {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new VickyAIError(401, 'Lovable AI is not configured.');
  const provider = createLovableAiGatewayProvider(key, getRequestHeader('X-Lovable-AIG-Run-ID'), { baseURL: 'https://ai.gateway.lovable.dev/v1' });
  return {
    stream(system: string, messages: ModelMessage[], signal?: AbortSignal) {
      return streamText({ model: provider('google/gemini-3.8-flash'), system, messages, ...(signal ? { abortSignal: signal } : {}), maxRetries: 0 });
    },
    async text(system: string, messages: ModelMessage[]) {
      try {
        const result = this.stream(system, messages);
        const text = await result.text;
        const runId = provider.getRunId();
        if (runId) setResponseHeader('X-Lovable-AIG-Run-ID', runId);
        if (!text.trim()) throw new VickyAIError(422, 'Lovable AI returned no usable response.');
        return text;
      } catch (error) { throw safeAIError(error); }
    },
    provider,
  };
}

export async function gradeWithRetry(generate: (retry: boolean) => Promise<string>, questionId: string, flagId?: string): Promise<ParsedGrade | null> {
  const first = parseGrade(await generate(false), questionId, flagId);
  if (first) return first;
  return parseGrade(await generate(true), questionId, flagId);
}