// FINAL VERSION
// React -> Gemini embedding -> Supabase match_documents -> Groq -> { answer }

const GEMINI_MODEL = "gemini-embedding-001";
// llama-3.3-70b-versatile was retired by Groq on 16 Aug 2026.
// The function tries these models in order and uses the first one that works.
const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
const FETCH_COUNT = 30; // ask Supabase for more rows, because many documents are stored as duplicates
const USE_COUNT = 6;    // number of DISTINCT documents sent to Groq
const MAX_CONTEXT_CHARS = 6000;
const MAX_QUESTION_CHARS = 1000;

const SYSTEM_PROMPT = `You are EcoWasteAI, a friendly assistant that helps students and staff at Jordanian universities with recycling and waste management.

Rules:
1. Answer ONLY using the information in the CONTEXT provided. Do not invent facts, places, numbers, or procedures.
2. If the context does not contain the answer, say clearly that this information is not available, and suggest the person contact the relevant university office. Do not guess.
3. Always reply in the same language as the user's question. If the user writes in Arabic, reply in clear, natural Arabic. If they use Jordanian or colloquial Arabic, understand it fully and answer in simple, friendly Arabic (Modern Standard Arabic is fine, kept easy to read).
4. Be concise and practical. Use short lists when giving steps.
5. Never mention "context", "documents", or "database" in your answer. Just answer naturally.`;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function timedFetch(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Request timed out after ${ms / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function embedQuestion(question) {
  const res = await timedFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model: `models/${GEMINI_MODEL}`,
        content: { parts: [{ text: question }] },
        outputDimensionality: 3072,
      }),
    },
    8000
  );
  if (!res.ok) throw new Error(`Gemini embedding failed (HTTP ${res.status})`);
  const data = await res.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Gemini returned no embedding");
  return values;
}

async function searchDocuments(embedding) {
  const base = process.env.SUPABASE_URL.replace(/\/+$/, "");
  const res = await timedFetch(
    `${base}/rest/v1/rpc/match_documents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_count: FETCH_COUNT,
        filter: {},
      }),
    },
    8000
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase search failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

function buildContext(rows) {
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const text = String(row.content || "").trim();
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

async function askGroq(question, context) {
  const userMessage = context
    ? `CONTEXT:\n${context}\n\nQUESTION:\n${question}`
    : `CONTEXT:\n(no relevant information found)\n\nQUESTION:\n${question}`;

  let lastError = "unknown error";

  for (const model of GROQ_MODELS) {
    const res = await timedFetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          // gpt-oss models "think" before answering; the budget must cover thinking + answer.
          reasoning_effort: "low",
          max_completion_tokens: 1500,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
        }),
      },
      15000
    );

    if (!res.ok) {
      const text = await res.text();
      lastError = `Groq (${model}) failed, HTTP ${res.status}: ${text.slice(0, 200)}`;
      console.error(lastError);
      // Model missing/retired -> try the next model. Any other error -> stop.
      if (res.status === 404 || res.status === 400) continue;
      throw new Error(lastError);
    }

    const data = await res.json();
    const answer = data?.choices?.[0]?.message?.content;
    if (answer && answer.trim()) return answer.trim();

    lastError = `Groq (${model}) returned an empty answer`;
    console.error(lastError);
  }

  throw new Error(lastError);
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const missing = ["SUPABASE_URL", "SUPABASE_KEY", "GEMINI_API_KEY", "GROQ_API_KEY"].filter(
      (name) => !process.env[name]
    );
    if (missing.length) {
      console.error("Missing environment variables:", missing.join(", "));
      return json(500, {
        error: "Server configuration error",
        details: `Missing environment variables: ${missing.join(", ")}`,
      });
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const question = String(body.question || "").trim().slice(0, MAX_QUESTION_CHARS);
    if (!question) return json(400, { error: "Question is required" });

    const embedding = await embedQuestion(question);
    const rows = await searchDocuments(embedding);
    const context = buildContext(rows);
    const answer = await askGroq(question, context);

    return json(200, { answer });
  } catch (error) {
    console.error("chat function error:", error.message);
    return json(500, { error: "Something went wrong", details: error.message });
  }
}
