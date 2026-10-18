import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { chatInput, assertFounderAccess } from "./vicky-inputs";
import { loadFounderData } from "./vicky-data.server";
import { buildSystemPrompt } from "./vicky/knowledge";
import { toKnowledgeAnalysis } from "./vicky/tidewell/analysis";
import { createVickyAI, safeAIError, VickyAIError } from "./vicky-ai.server";
import { withLovableAiGatewayRunIdHeader } from "./ai/run-id.server";
import { turnSchema, isGradeMessage } from "./conversations";
import { loadCompanyContext } from "./companies.server";
import { meetingBrief } from "./vicky/tidewell/brief";
import { companyBrief } from "./vicky/company/brief";
import { dashboardCoach, CLARIFICATION } from "./vicky-dashboard";

export async function handleVickyChat(request: Request) {
  const token = request.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return Response.json({ error: "Sign in to use Vicky." }, { status: 401 });
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return Response.json({ error: "Sign-in is not configured." }, { status: 503 });
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: claims, error } = await client.auth.getClaims(token);
  const userId = claims?.claims.sub;
  if (error || !userId) return Response.json({ error: "Sign in to use Vicky." }, { status: 401 });
  const parsed = chatInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid chat request." }, { status: 400 });
  if (parsed.data.founder_id !== userId)
    return Response.json(
      { error: "You can only access your own practice records." },
      { status: 403 },
    );
  try {
    const id = assertFounderAccess(userId, parsed.data.founder_id);
    let input = parsed.data;
    let version: string | undefined;
    if (input.conversation_id) {
      const last = input.messages.at(-1);
      const { data: prepared, error: prepareError } = await client.rpc("vicky_prepare_turn", {
        p_conversation: input.conversation_id,
        p_action: input.action ?? "send",
        ...(input.message_id ? { p_message: input.message_id } : {}),
        ...(last ? { p_content: last.content } : {}),
      });
      if (prepareError)
        return Response.json(
          { error: "Could not save this message. Reload the chat and try again." },
          { status: 409 },
        );
      if (input.clarification && last?.content === CLARIFICATION) {
        const hidden = await client.rpc("vicky_hide_clarification", {
          p_conversation: input.conversation_id,
        });
        if (hidden.error) throw new Error("Could not save clarification.");
      }
      const turn = turnSchema.parse(prepared);
      version = turn.conversation.updated_at;
      input = {
        ...input,
        company_id: turn.conversation.company_id ?? null,
        mode: turn.conversation.mode,
        persona: turn.conversation.persona,
        stage: turn.conversation.stage,
        messages: turn.messages
          .filter((m) => !isGradeMessage(m))
          .map(({ role, content }) => ({ role, content })),
      };
    }
    const context = input.company_id
      ? await loadCompanyContext(client, id, input.company_id, true)
      : await loadFounderData(client, id, true);
    const analysis =
      "knowledge" in context ? context.knowledge : toKnowledgeAnalysis(context.analysis);
    const persona = input.persona ?? "lead-seed";
    const brief =
      "profile" in context
        ? companyBrief(context.analysis, context.profile, persona, input.stage, context.history)
        : meetingBrief(persona, input.stage, context.history, context.analysis);
    const coach = dashboardCoach(
      context.analysis,
      brief,
      "profile" in context ? context.profile : undefined,
    );
    const system = buildSystemPrompt({
      ...(input.mode === "ask" ? { coach } : {}),
      mode: input.mode,
      stage: input.stage,
      ...(input.persona ? { persona: input.persona } : {}),
      analysis,
      history: context.history,
      lessons: context.lessons,
      ...(input.company_id ? { workedExamples: false } : {}),
    });
    const ai = createVickyAI();
    const result = ai.stream(system, input.messages, request.signal);
    // Read the first event before sending headers, so upstream denials retain status.
    const iterator = result.fullStream[Symbol.asyncIterator]();
    let first = await iterator.next();
    while (!first.done && first.value.type !== "text-delta" && first.value.type !== "error")
      first = await iterator.next();
    if (!first.done && first.value.type === "error") throw first.value.error;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let wroteText = false;
        let completedText = "";
        const emit = (event: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        try {
          let current = first;
          while (!current.done) {
            const part = current.value;
            if (part.type === "text-delta") {
              wroteText = true;
              completedText += part.text;
              emit({ type: "text", text: part.text });
            }
            if (part.type === "error") throw part.error;
            current = await iterator.next();
          }
          if (!wroteText)
            emit({ type: "error", status: 422, error: "Lovable AI returned no usable response." });
          else {
            if (input.conversation_id && version && !request.signal.aborted) {
              const { error: saveError } = await client.rpc("vicky_complete_turn", {
                p_conversation: input.conversation_id,
                p_version: version,
                p_content: completedText,
              });
              if (saveError)
                throw new VickyAIError(
                  409,
                  "The reply could not be saved. Reload the chat before continuing.",
                );
            }
            emit({ type: "done" });
          }
        } catch (error) {
          const safe = safeAIError(error);
          emit({ type: "error", status: safe.status, error: safe.message });
        } finally {
          controller.close();
        }
      },
      async cancel() {
        await iterator.return?.();
      },
    });
    return withLovableAiGatewayRunIdHeader(
      new Response(body, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
      }),
      ai.provider,
    );
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    const safe = safeAIError(error);
    return Response.json(
      { error: safe.message },
      { status: safe.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
