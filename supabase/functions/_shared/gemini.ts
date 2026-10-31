// Gemini REST helpers shared by the Edge Functions.
import { env, HttpError, timedFetch, upstreamReason } from "./security.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIM = 3072; // must match the stored embeddings

export type FunctionDeclaration = { name: string; description: string; parameters: Record<string, unknown> };
export type GeminiPart = {
  text?: string;
  thought?: boolean;
  inline_data?: { mime_type: string; data: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
export type GenerateRequest = {
  system: string;
  contents: GeminiContent[];
  tools?: FunctionDeclaration[];
  json?: boolean;
  schema?: Record<string, unknown>;
  timeoutMs?: number;
};

function key(): string {
  return env("GEMINI_API_KEY");
}

export function agentModels(): string[] {
  const preferred = env("GEMINI_AGENT_MODEL") || "gemini-2.5-flash";
  return [...new Set([preferred, "gemini-2.5-flash-lite"])];
}

export async function embed(text: string): Promise<number[]> {
  const res = await timedFetch(
    `${GEMINI_BASE}/${EMBED_MODEL}:embedContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key() },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIM,
      }),
    },
    10_000,
  );
  if (!res.ok) {
    console.error(`Gemini embedding failed (HTTP ${res.status}):`, await upstreamReason(res));
    throw new HttpError(res.status === 429 ? 503 : 502, "embedding_failed", "Could not process the question.");
  }
  const data = await res.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIM) {
    console.error("Unexpected embedding size:", Array.isArray(values) ? values.length : typeof values);
    throw new HttpError(502, "embedding_failed", "Could not process the question.");
  }
  return values;
}

// One Gemini call with model fallback. Returns the parts of the first candidate
// (thought parts removed). 401/403 stop immediately (key problem); 429, 5xx,
// timeouts and empty answers move on to the next model.
export async function generate(req: GenerateRequest, models = agentModels()): Promise<{ parts: GeminiPart[]; model: string }> {
  let lastError = "unknown error";
  for (const model of models) {
    const generationConfig: Record<string, unknown> = { temperature: 0.2, maxOutputTokens: 2048 };
    if (model.startsWith("gemini-2.5-flash")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
    if (req.json) generationConfig.responseMimeType = "application/json";
    if (req.schema) generationConfig.responseSchema = req.schema;

    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.contents,
      generationConfig,
    };
    if (req.tools?.length) body.tools = [{ functionDeclarations: req.tools }];

    let res: Response;
    try {
      res = await timedFetch(
        `${GEMINI_BASE}/${model}:generateContent`,
        { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key() }, body: JSON.stringify(body) },
        req.timeoutMs ?? 30_000,
      );
    } catch (err) {
      lastError = `${model}: ${(err as Error).message}`;
      console.error(lastError);
      continue;
    }
    if (!res.ok) {
      lastError = `${model} HTTP ${res.status}: ${await upstreamReason(res)}`;
      console.error("Gemini call failed:", lastError);
      if (res.status === 401 || res.status === 403) break;
      continue;
    }
    const data = await res.json();
    const parts = ((data?.candidates?.[0]?.content?.parts ?? []) as GeminiPart[]).filter((p) => !p.thought);
    if (parts.length) return { parts, model };
    lastError = `${model} returned nothing (finishReason: ${data?.candidates?.[0]?.finishReason ?? "none"})`;
    console.error(lastError);
  }
  throw new HttpError(503, "model_unavailable", "The AI model is busy. Please try again in a moment.");
}

export function partsText(parts: GeminiPart[]): string {
  return parts.map((p) => p.text ?? "").join("").trim();
}
