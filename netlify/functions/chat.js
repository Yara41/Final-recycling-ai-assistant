// DIAGNOSTIC VERSION - tests each step and reports which one failed.
// Always returns HTTP 200 with the report in "answer" so React displays it.

const GEMINI_MODEL = "gemini-embedding-001";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 8000;

function redact(text) {
  let out = String(text ?? "");
  for (const name of ["GEMINI_API_KEY", "GROQ_API_KEY", "SUPABASE_KEY"]) {
    const value = process.env[name];
    if (value && value.length > 8) out = out.split(value).join(`[${name} hidden]`);
  }
  return out.length > 700 ? out.slice(0, 700) + "..." : out;
}

async function timedFetch(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Timed out after ${TIMEOUT_MS / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function reply(lines) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer: lines.join("\n") }),
  };
}

export async function handler(event) {
  const report = [];
  let question = "";

  try {
    question = JSON.parse(event.body || "{}").question || "";
  } catch {
    return reply(["STEP 0: FAILED - request body is not valid JSON"]);
  }
  if (!question) question = "كيف أعيد تدوير البلاستيك؟";

  // STEP 0: environment variables
  const env = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_KEY: !!process.env.SUPABASE_KEY,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
  };
  const missing = Object.keys(env).filter((k) => !env[k]);
  if (missing.length) {
    return reply([
      `STEP 0: FAILED - missing environment variables: ${missing.join(", ")}`,
      "Fix: add them in Netlify, then redeploy (Clear cache and deploy site).",
    ]);
  }
  report.push("STEP 0: Environment variables OK (all 4 present)");

  // STEP 1: Gemini embedding
  let embedding;
  try {
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
      }
    );
    const text = await res.text();
    if (!res.ok) {
      report.push(`STEP 1: Gemini FAILED - HTTP ${res.status}: ${redact(text)}`);
      return reply(report);
    }
    embedding = JSON.parse(text)?.embedding?.values;
    if (!Array.isArray(embedding)) {
      report.push("STEP 1: Gemini FAILED - response had no embedding values");
      return reply(report);
    }
    report.push(`STEP 1: Gemini OK - embedding has ${embedding.length} dimensions`);
    if (embedding.length !== 3072) {
      report.push("WARNING: your database vectors have 3072 dimensions. This does not match.");
    }
  } catch (err) {
    report.push(`STEP 1: Gemini FAILED - ${redact(err.message)}`);
    return reply(report);
  }

  // STEP 2: Supabase match_documents
  try {
    const base = process.env.SUPABASE_URL.replace(/\/+$/, "");
    const res = await timedFetch(`${base}/rest/v1/rpc/match_documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
      },
      body: JSON.stringify({ query_embedding: embedding, match_count: 6, filter: {} }),
    });
    const text = await res.text();
    if (!res.ok) {
      report.push(`STEP 2: Supabase FAILED - HTTP ${res.status}: ${redact(text)}`);
      return reply(report);
    }
    const matches = JSON.parse(text);
    if (!Array.isArray(matches)) {
      report.push(`STEP 2: Supabase FAILED - unexpected response: ${redact(text)}`);
      return reply(report);
    }
    if (matches.length === 0) {
      report.push(
        "STEP 2: Supabase connected but returned 0 rows. Most likely cause: SUPABASE_KEY is the anon key and RLS is blocking the table. Use the service_role key."
      );
      return reply(report);
    }
    const top = matches[0];
    report.push(
      `STEP 2: Supabase OK - ${matches.length} documents returned. Top similarity: ${Number(top.similarity).toFixed(3)}`
    );
    report.push(`Top document preview: ${String(top.content).slice(0, 200).replace(/\s+/g, " ")}`);
  } catch (err) {
    report.push(`STEP 2: Supabase FAILED - ${redact(err.message)}`);
    return reply(report);
  }

  // STEP 3: Groq
  try {
    const res = await timedFetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: "Reply with the single word: OK" }],
        max_tokens: 5,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      report.push(`STEP 3: Groq FAILED - HTTP ${res.status}: ${redact(text)}`);
      return reply(report);
    }
    const out = JSON.parse(text)?.choices?.[0]?.message?.content;
    report.push(`STEP 3: Groq OK - model replied: ${redact(out)}`);
  } catch (err) {
    report.push(`STEP 3: Groq FAILED - ${redact(err.message)}`);
    return reply(report);
  }

  report.push("ALL STEPS PASSED. You can now install the final chat.js.");
  return reply(report);
}
