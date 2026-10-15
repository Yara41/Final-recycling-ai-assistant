// EcoWasteAI chat: question -> Gemini embedding (3072) -> Supabase match_documents
// -> Gemini answer -> { answer, topSimilarity }
//
// Same RAG flow as the old netlify/functions/chat.js; only the answer model moved
// from Groq to Gemini. The `documents` table and `match_documents` are read only.

import {
  env,
  guard,
  isExpectedProject,
  HttpError,
  json,
  timedFetch,
  upstreamReason,
} from "../_shared/security.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIM = 3072; // must match the stored embeddings

const FETCH_COUNT = 30; // many rows in `documents` are duplicates, so fetch more
const USE_COUNT = 6; // distinct passages sent to the model
const MAX_CONTEXT_CHARS = 6000;
const MAX_QUESTION_CHARS = 1000;

const NO_INFO_AR =
  "عذراً، لا تتوفر لدي معلومات عن هذا الموضوع في قاعدة المعرفة الحالية. جرّب إعادة صياغة سؤالك، أو اسأل عن إعادة التدوير وإدارة النفايات في الجامعات.";
const NO_INFO_EN =
  "Sorry, I don't have information about this topic in my knowledge base. Try rephrasing, or ask about recycling and waste management at universities.";

export const SYSTEM_PROMPT =
  `You are EcoWasteAI, a friendly assistant that helps students and staff at Jordanian universities with recycling and waste management.

Rules:
1. Answer ONLY using the information in the CONTEXT provided. Do not invent facts, places, numbers, or procedures.
2. If the context does not contain the answer, say clearly that this information is not available, and suggest the person contact the relevant university office. Do not guess.
3. Always reply in the same language as the user's question. If the user writes in Arabic, reply in clear, natural Arabic. If they use Jordanian or colloquial Arabic, understand it fully and answer in simple, friendly Arabic (Modern Standard Arabic is fine, kept easy to read).
4. Be concise and practical. Use short lists when giving steps.
5. Never mention "context", "documents", or "database" in your answer. Just answer naturally.`;

const ARABIC = /[\u0600-\u06FF]/;
// Older versions of the website appended this to English questions.
const OLD_EN_SUFFIX = /\s*\(Please answer in English\.\)\s*$/i;

type Row = { content?: string | null; similarity?: number | null };

function chatModels(): string[] {
  const preferred = env("GEMINI_CHAT_MODEL") || "gemini-2.5-flash";
  return [...new Set([preferred, "gemini-2.5-flash-lite"])];
}

function geminiKey(): string {
  return env("GEMINI_API_KEY");
}

export async function embedQuestion(question: string): Promise<number[]> {
  const res = await timedFetch(
    `${GEMINI_BASE}/${EMBED_MODEL}:embedContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey() },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: question }] },
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

export async function searchDocuments(embedding: number[]): Promise<Row[]> {
  const base = env("SUPABASE_URL").replace(/\/+$/, "");
  // The documents table has RLS enabled with no public policy, so the search must
  // run with the service role key. It never leaves this server-side function.
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await timedFetch(
    `${base}/rest/v1/rpc/match_documents`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query_embedding: embedding, match_count: FETCH_COUNT, filter: {} }),
    },
    10_000,
  );
  if (!res.ok) {
    console.error(`match_documents failed (HTTP ${res.status}):`, (await res.text()).slice(0, 300));
    throw new HttpError(502, "search_failed", "Could not search the knowledge base.");
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

// Removes duplicate passages (the table stores many copies) and caps the size.
export function buildContext(rows: Row[]): string {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const row of rows) {
    const text = String(row?.content ?? "").trim();
    const key = text.replace(/\s+/g, " ");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    unique.push(text);
    if (unique.length >= USE_COUNT) break;
  }
  let context = "";
  unique.forEach((text, i) => {
    const piece = `[${i + 1}] ${text}\n\n`;
    if (context.length + piece.length <= MAX_CONTEXT_CHARS) context += piece;
  });
  return context.trim();
}

export async function generateAnswer(question: string, context: string, forceEnglish: boolean): Promise<string> {
  const userMessage = `CONTEXT:\n${context}\n\nQUESTION:\n${question}` +
    (forceEnglish ? "\n\n(Please answer in English.)" : "");

  let lastError = "unknown error";
  for (const model of chatModels()) {
    const generationConfig: Record<string, unknown> = { temperature: 0.2, maxOutputTokens: 1500 };
    // 2.5 Flash models "think" by default and thinking tokens count against
    // maxOutputTokens; turning it off keeps answers complete and fast.
    if (model.startsWith("gemini-2.5-flash")) generationConfig.thinkingConfig = { thinkingBudget: 0 };

    let res: Response;
    try {
      res = await timedFetch(
        `${GEMINI_BASE}/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey() },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: userMessage }] }],
            generationConfig,
          }),
        },
        30_000,
      );
    } catch (err) {
      lastError = `${model}: ${(err as Error).message}`;
      console.error(lastError);
      continue;
    }

    if (!res.ok) {
      lastError = `${model} HTTP ${res.status}: ${await upstreamReason(res)}`;
      console.error("Gemini answer failed:", lastError);
      if (res.status === 401 || res.status === 403) break; // key problem, other models will fail too
      continue;
    }

    const data = await res.json();
    const answer = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string; thought?: boolean }) => (p.thought ? "" : p.text ?? ""))
      .join("")
      .trim();
    if (answer) return answer;

    lastError = `${model} returned no text (finishReason: ${data?.candidates?.[0]?.finishReason ?? "none"}, ` +
      `blockReason: ${data?.promptFeedback?.blockReason ?? "none"})`;
    console.error(lastError);
  }

  throw new HttpError(502, "generation_failed", "Could not generate an answer.");
}

export async function handleChat(req: Request): Promise<Response> {
  const checked = await guard(req, { name: "chat", perMinute: 20, maxBodyChars: 10_000 });
  if (checked instanceof Response) return checked;
  const { body, cors } = checked;

  try {
    const missing = ["GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((n) => !env(n));
    if (missing.length) {
      console.error("Missing secrets:", missing.join(", "));
      throw new HttpError(500, "server_config", "Server configuration error.");
    }
    // Refuse to search a database other than the EcoWasteAI project.
    if (!isExpectedProject(env("SUPABASE_URL"))) {
      console.error("Wrong Supabase project for this function:", env("SUPABASE_URL"));
      throw new HttpError(500, "wrong_project", "Server configuration error.");
    }

    const question = String(body.question ?? "").replace(OLD_EN_SUFFIX, "").trim().slice(0, MAX_QUESTION_CHARS);
    if (!question) return json({ error: "Question is required", code: "missing_question" }, 400, cors);

    const forceEnglish = body.lang === "en" || OLD_EN_SUFFIX.test(String(body.question ?? ""));
    const answerInArabic = !forceEnglish && ARABIC.test(question);

    const embedding = await embedQuestion(question);
    const rows = await searchDocuments(embedding);
    const topSimilarity = rows.length ? Number(rows[0].similarity ?? 0) : 0;

    const minSimilarity = Number(env("MIN_SIMILARITY") || "0");
    const context = buildContext(rows);
    if (!context || (minSimilarity > 0 && topSimilarity < minSimilarity)) {
      return json({ answer: answerInArabic ? NO_INFO_AR : NO_INFO_EN, topSimilarity }, 200, cors);
    }

    const answer = await generateAnswer(question, context, forceEnglish);
    return json({ answer, topSimilarity }, 200, cors);
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: err.message, code: err.code }, err.status, cors);
    }
    console.error("chat function error:", err);
    return json({ error: "Something went wrong", code: "server_error" }, 500, cors);
  }
}
