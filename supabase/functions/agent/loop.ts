// The agent loop: ask the model, run the tools it calls, feed results back, repeat
// until it answers in text or MAX_STEPS model calls have been made.
import { generate as realGenerate, type GeminiContent, type GeminiPart, type GenerateRequest } from "../_shared/gemini.ts";
import { buildSystemPrompt } from "./prompt.ts";
import { runTool as realRunTool, toolsForRole } from "./tools/index.ts";
import type { ActionCard, ToolContext, ToolResult } from "./types.ts";

export const MAX_STEPS = 4;
// Hard cap on tools run per user message, so one prompt cannot log dozens of items
// (protects points and the recorded behaviour data).
export const MAX_TOOL_CALLS = 6;

export type ActionRecord = { tool: string; input: Record<string, unknown>; result: unknown; ok: boolean; card?: ActionCard };

export type AgentDeps = {
  generate: (req: GenerateRequest) => Promise<{ parts: GeminiPart[]; model: string }>;
  runTool: (name: string, args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
};

const FALLBACK = {
  ar: "نفّذت طلبك (التفاصيل في البطاقات)، لكن خدمة الذكاء الاصطناعي مشغولة الآن فلم أكمل الرد. جرّب بعد قليل.",
  en: "I completed your request (see the cards), but the AI service is busy so I couldn't finish my reply. Please try again shortly.",
};
const STEP_LIMIT = {
  ar: "نفّذت ما استطعت؛ النتائج في البطاقات أعلاه.",
  en: "I did what I could; the results are in the cards above.",
};

export async function runAgent(
  input: { ctx: ToolContext; history: GeminiContent[]; message: string; hasImage: boolean },
  deps: AgentDeps = { generate: realGenerate, runTool: realRunTool },
): Promise<{ reply: string; actions: ActionCard[]; records: ActionRecord[] }> {
  const { ctx } = input;
  const system = buildSystemPrompt(ctx);
  const tools = toolsForRole(ctx.role).map((t) => t.declaration);
  const userText = input.hasImage
    ? `[The user attached a photo.]\n${input.message || "(no text)"}`
    : input.message;
  const contents: GeminiContent[] = [...input.history, { role: "user", parts: [{ text: userText }] }];
  const records: ActionRecord[] = [];
  const cards = () => records.flatMap((r) => (r.card ? [r.card] : []));

  for (let step = 1; step <= MAX_STEPS; step++) {
    let parts: GeminiPart[];
    try {
      ({ parts } = await deps.generate({ system, contents, tools }));
    } catch (err) {
      if (records.length === 0) throw err;
      return { reply: FALLBACK[ctx.lang], actions: cards(), records };
    }

    const calls = parts.filter((p) => p.functionCall);
    if (calls.length === 0) {
      const reply = parts.map((p) => p.text ?? "").join("").trim();
      return { reply: reply || STEP_LIMIT[ctx.lang], actions: cards(), records };
    }
    if (step === MAX_STEPS) break;

    contents.push({ role: "model", parts: calls });
    const responses: GeminiPart[] = [];
    for (const part of calls) {
      const name = part.functionCall!.name;
      const args = part.functionCall!.args ?? {};
      if (records.length >= MAX_TOOL_CALLS) {
        responses.push({ functionResponse: { name, response: { ok: false, error: "too_many_actions" } } });
        continue;
      }
      const result = await deps.runTool(name, args, ctx);
      records.push({ tool: name, input: args, result: result.data ?? { error: result.error }, ok: result.ok, card: result.card });
      responses.push({
        functionResponse: {
          name,
          response: result.ok ? { ok: true, result: result.data ?? null } : { ok: false, error: result.error ?? "failed" },
        },
      });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { reply: STEP_LIMIT[ctx.lang], actions: cards(), records };
}
