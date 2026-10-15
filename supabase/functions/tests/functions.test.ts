// Offline tests for the chat and classify edge functions.
// External services (Gemini, Supabase REST) are replaced with a fake fetch,
// so these tests check request/response handling, not live AI output.
//
// Run:  npm run test:functions   (deno test --no-lock --no-config --allow-env --allow-read supabase/functions/tests/)
import assert from "node:assert/strict";
import { handleChat, buildContext } from "../chat/handler.ts";
import { handleClassify, normalize } from "../classify/handler.ts";
import { EXPECTED_PROJECT_REF, isExpectedProject, resetRateLimits } from "../_shared/security.ts";

const PROJECT_URL = "https://uwxksbwlzjrjlccbdjtk.supabase.co";

const SITE = "https://recycling-ai-assistant2026.netlify.app";
const PREVIEW = "https://deploy-preview-12--recycling-ai-assistant2026.netlify.app";
const realFetch = globalThis.fetch;

type Call = { url: string; init: RequestInit; body: any };
let calls: Call[] = [];

function setEnv() {
  Deno.env.set("GEMINI_API_KEY", "test-gemini-key");
  Deno.env.set("SUPABASE_URL", PROJECT_URL);
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.delete("ALLOWED_ORIGINS");
  Deno.env.delete("GEMINI_CHAT_MODEL");
  Deno.env.delete("GEMINI_VISION_MODEL");
  Deno.env.delete("MIN_SIMILARITY");
}

function mockFetch(router: (url: string, body: any) => Response | Promise<Response>) {
  calls = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, init, body });
    return router(url, body);
  }) as typeof fetch;
}

const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
const fail = (status: number, message = "boom") =>
  new Response(JSON.stringify({ error: { message } }), { status });
const embedding = () => ok({ embedding: { values: new Array(3072).fill(0.01) } });
const geminiText = (text: string) => ok({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });

function post(path: string, body: unknown, origin: string | null = SITE, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extra };
  if (origin) headers.Origin = origin;
  return new Request(`https://example.supabase.co/functions/v1/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// A real (tiny) JPEG would also work; the function only checks it is base64.
const FAKE_JPEG_BASE64 = btoa("x".repeat(300));

function setup() {
  setEnv();
  resetRateLimits();
}
function teardown() {
  globalThis.fetch = realFetch;
}

// ---------------------------------------------------------------- shared guard
Deno.test("CORS preflight from the production site and a deploy preview", async () => {
  setup();
  for (const origin of [SITE, PREVIEW, "http://localhost:5173"]) {
    const res = await handleChat(new Request("https://x/functions/v1/chat", { method: "OPTIONS", headers: { Origin: origin } }));
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), origin);
    assert.match(res.headers.get("Access-Control-Allow-Headers") ?? "", /apikey/);
  }
  teardown();
});

Deno.test("requests from unknown origins or with no origin are rejected", async () => {
  setup();
  mockFetch(() => { throw new Error("should not call upstream"); });
  for (const origin of ["https://evil.example", "https://recycling-ai-assistant2026.netlify.app.evil.com", null]) {
    const res = await handleChat(post("chat", { question: "test" }, origin));
    assert.equal(res.status, 403);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
  }
  assert.equal(calls.length, 0);
  teardown();
});

Deno.test("ALLOWED_ORIGINS secret adds a custom domain", async () => {
  setup();
  Deno.env.set("ALLOWED_ORIGINS", "https://ecowaste.example.jo, https://www.ecowaste.example.jo/");
  const res = await handleChat(new Request("https://x", { method: "OPTIONS", headers: { Origin: "https://www.ecowaste.example.jo" } }));
  assert.equal(res.status, 204);
  teardown();
});

Deno.test("GET is not allowed; non-JSON is rejected", async () => {
  setup();
  const res = await handleChat(new Request("https://x", { method: "GET", headers: { Origin: SITE } }));
  assert.equal(res.status, 405);
  const res2 = await handleChat(new Request("https://x", { method: "POST", headers: { Origin: SITE, "Content-Type": "text/plain" }, body: "hi" }));
  assert.equal(res2.status, 415);
  teardown();
});

Deno.test("per-IP rate limit returns 429 with Retry-After", async () => {
  setup();
  mockFetch((url) => url.includes("embedContent") ? embedding() : url.includes("rpc") ? ok([]) : geminiText("x"));
  const ip = { "x-forwarded-for": "203.0.113.7" };
  for (let i = 0; i < 20; i++) {
    const r = await handleChat(post("chat", { question: "سؤال" }, SITE, ip));
    assert.equal(r.status, 200);
  }
  const blocked = await handleChat(post("chat", { question: "سؤال" }, SITE, ip));
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("Retry-After")) >= 1);
  assert.equal((await blocked.json()).code, "rate_limited");
  // a different visitor is not affected
  const other = await handleChat(post("chat", { question: "سؤال" }, SITE, { "x-forwarded-for": "198.51.100.1" }));
  assert.equal(other.status, 200);
  teardown();
});

// ---------------------------------------------------------------- chat
Deno.test("chat: full RAG flow, duplicates removed, keys sent as headers", async () => {
  setup();
  const rows = [
    { content: "ضع العبوات البلاستيكية النظيفة في الحاوية الزرقاء.", similarity: 0.82 },
    { content: "ضع العبوات البلاستيكية النظيفة في الحاوية الزرقاء.", similarity: 0.82 },
    { content: "ضع  العبوات البلاستيكية النظيفة في الحاوية الزرقاء. ", similarity: 0.81 },
    { content: "الورق المتسخ بالطعام لا يُعاد تدويره.", similarity: 0.7 },
  ];
  mockFetch((url) => {
    if (url.includes("embedContent")) return embedding();
    if (url.includes("/rest/v1/rpc/match_documents")) return ok(rows);
    return geminiText("ضعها في الحاوية الزرقاء بعد تفريغها.");
  });

  const res = await handleChat(post("chat", { question: "وين بحط قنينة المي الفاضية؟", lang: "ar" }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), SITE);
  const data = await res.json();
  assert.equal(data.answer, "ضعها في الحاوية الزرقاء بعد تفريغها.");
  assert.equal(data.topSimilarity, 0.82);

  const [embed, rpc, gen] = calls;
  assert.ok(embed.url.endsWith("gemini-embedding-001:embedContent"));
  assert.ok(!embed.url.includes("key="), "API key must not be in the URL");
  assert.equal((embed.init.headers as Record<string, string>)["x-goog-api-key"], "test-gemini-key");
  assert.equal(embed.body.outputDimensionality, 3072);

  assert.equal(rpc.url, `${PROJECT_URL}/rest/v1/rpc/match_documents`);
  assert.equal(rpc.init.method, "POST");
  assert.equal(rpc.body.match_count, 30);
  assert.equal(rpc.body.query_embedding.length, 3072);
  assert.equal((rpc.init.headers as Record<string, string>).Authorization, "Bearer test-service-role");

  assert.ok(gen.url.endsWith("gemini-2.5-flash:generateContent"));
  const sent = gen.body.contents[0].parts[0].text as string;
  assert.equal(sent.split("الحاوية الزرقاء").length - 1, 1, "duplicate passages must be sent once");
  assert.ok(sent.includes("الورق المتسخ"));
  assert.ok(!sent.includes("Please answer in English"));
  assert.deepEqual(gen.body.generationConfig.thinkingConfig, { thinkingBudget: 0 });
  teardown();
});

Deno.test("chat: English UI asks for an English answer without changing the search text", async () => {
  setup();
  mockFetch((url) => url.includes("embedContent") ? embedding() : url.includes("rpc") ? ok([{ content: "info", similarity: 0.6 }]) : geminiText("Use the blue bin."));
  const res = await handleChat(post("chat", { question: "Where do bottles go?", lang: "en" }));
  assert.equal(res.status, 200);
  assert.equal(calls[0].body.content.parts[0].text, "Where do bottles go?");
  assert.ok((calls[2].body.contents[0].parts[0].text as string).endsWith("(Please answer in English.)"));
  teardown();
});

Deno.test("chat: old payload with '(Please answer in English.)' suffix still works", async () => {
  setup();
  mockFetch((url) => url.includes("embedContent") ? embedding() : url.includes("rpc") ? ok([{ content: "info" }]) : geminiText("ok"));
  const res = await handleChat(post("chat", { question: "Where?\n\n(Please answer in English.)" }));
  assert.equal(res.status, 200);
  assert.equal(calls[0].body.content.parts[0].text, "Where?");
  teardown();
});

Deno.test("chat: falls back to the next Gemini model when the first is overloaded", async () => {
  setup();
  mockFetch((url) => {
    if (url.includes("embedContent")) return embedding();
    if (url.includes("rpc")) return ok([{ content: "info", similarity: 0.7 }]);
    if (url.includes("gemini-2.5-flash:")) return fail(503, "overloaded");
    return geminiText("answer from lite");
  });
  const res = await handleChat(post("chat", { question: "سؤال" }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).answer, "answer from lite");
  assert.ok(calls.some((c) => c.url.includes("gemini-2.5-flash-lite:generateContent")));
  teardown();
});

Deno.test("chat: no matching documents -> fixed 'no information' reply in the question's language", async () => {
  setup();
  mockFetch((url) => url.includes("embedContent") ? embedding() : ok([]));
  const ar = await (await handleChat(post("chat", { question: "شو أخبار الطقس؟" }))).json();
  assert.match(ar.answer, /^عذراً/);
  const en = await (await handleChat(post("chat", { question: "weather?" }))).json();
  assert.match(en.answer, /^Sorry/);
  assert.ok(!calls.some((c) => c.url.includes("generateContent")), "model must not be called");
  teardown();
});

Deno.test("chat: upstream errors return safe messages, never secrets", async () => {
  setup();
  mockFetch(() => fail(403, "API key test-gemini-key is invalid"));
  const res = await handleChat(post("chat", { question: "سؤال" }));
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.ok(!text.includes("test-gemini-key"));
  assert.equal(JSON.parse(text).code, "embedding_failed");
  teardown();
});

Deno.test("chat: missing question and missing secrets", async () => {
  setup();
  assert.equal((await handleChat(post("chat", { question: "   " }))).status, 400);
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  const res = await handleChat(post("chat", { question: "x" }));
  assert.equal(res.status, 500);
  assert.equal((await res.json()).code, "server_config");
  teardown();
});

Deno.test("chat: buildContext caps to 6 distinct passages", () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ content: `passage ${i % 10}` }));
  const ctx = buildContext(rows);
  assert.equal(ctx.split("\n\n").length, 6);
});

// ---------------------------------------------------------------- classify
Deno.test("classify: accepts the exact payload the website sends and returns UI fields", async () => {
  setup();
  mockFetch(() =>
    geminiText(JSON.stringify({
      is_waste: true,
      item: "عبوة مياه بلاستيكية",
      category: "plastic",
      recyclable: true,
      tip: "أفرغها واضغطها ثم ضعها في حاوية البلاستيك.",
      confidence: 0.93,
    }))
  );
  // same body as sendImage() in src/App.jsx
  const res = await handleClassify(post("classify", { image: FAKE_JPEG_BASE64, mimeType: "image/jpeg", lang: "ar" }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(Object.keys(data).sort(), ["category", "confidence", "is_waste", "item", "recyclable", "tip"]);
  assert.equal(data.category, "plastic");
  assert.equal(data.recyclable, true);

  const req = calls[0];
  assert.ok(req.url.endsWith("gemini-flash-latest:generateContent"));
  assert.ok(!req.url.includes("key="));
  assert.equal(req.body.contents[0].parts[1].inline_data.mime_type, "image/jpeg");
  assert.equal(req.body.contents[0].parts[1].inline_data.data, FAKE_JPEG_BASE64);
  assert.equal(req.body.generationConfig.responseMimeType, "application/json");
  assert.ok(req.body.generationConfig.responseSchema.properties.category.enum.includes("hazardous"));
  teardown();
});

Deno.test("classify: data: URL accepted, English note added for English UI", async () => {
  setup();
  mockFetch(() => geminiText(JSON.stringify({ is_waste: true, item: "Can", category: "metal", recyclable: true, tip: "Rinse it.", confidence: 0.8 })));
  const res = await handleClassify(post("classify", { image: `data:image/png;base64,${FAKE_JPEG_BASE64}`, lang: "en" }));
  assert.equal(res.status, 200);
  assert.equal(calls[0].body.contents[0].parts[1].inline_data.mime_type, "image/png");
  assert.match(calls[0].body.contents[0].parts[0].text, /الإنجليزية/);
  teardown();
});

Deno.test("classify: not-waste result keeps is_waste=false (UI shows its own message)", async () => {
  setup();
  mockFetch(() => geminiText(JSON.stringify({ is_waste: false, item: "شخص", category: "general", recyclable: false, tip: "", confidence: 0.9 })));
  const data = await (await handleClassify(post("classify", { image: FAKE_JPEG_BASE64, mimeType: "image/jpeg" }))).json();
  assert.equal(data.is_waste, false);
  teardown();
});

Deno.test("classify: rejects bad input before calling Gemini", async () => {
  setup();
  mockFetch(() => { throw new Error("should not call Gemini"); });
  assert.equal((await handleClassify(post("classify", {}))).status, 400);
  assert.equal((await handleClassify(post("classify", { image: FAKE_JPEG_BASE64, mimeType: "application/pdf" }))).status, 400);
  assert.equal((await handleClassify(post("classify", { image: "not base64 !!!".repeat(20), mimeType: "image/jpeg" }))).status, 400);
  assert.equal((await handleClassify(post("classify", { image: "A".repeat(4_000_004), mimeType: "image/jpeg" }))).status, 413);
  assert.equal(calls.length, 0);
  teardown();
});

Deno.test("classify: falls back to a second model on 503", async () => {
  setup();
  mockFetch((url) =>
    url.includes("gemini-flash-latest")
      ? fail(503)
      : geminiText(JSON.stringify({ is_waste: true, item: "x", category: "paper", recyclable: false, tip: "t", confidence: 0.5 }))
  );
  const res = await handleClassify(post("classify", { image: FAKE_JPEG_BASE64, mimeType: "image/jpeg" }));
  assert.equal(res.status, 200);
  assert.ok(calls[1].url.includes("gemini-2.5-flash:generateContent"));
  teardown();
});

Deno.test("classify: normalize() repairs unexpected model output", () => {
  const n = normalize({ is_waste: true, item: "", category: "electronics", recyclable: "yes", tip: 5, confidence: 85 }, "ar");
  assert.equal(n.category, "general");
  assert.equal(n.recyclable, false);
  assert.equal(n.confidence, 0.85);
  assert.equal(n.item, "عنصر غير محدد");
  assert.equal(n.tip, "5");
});

// ---------------------------------------------------------------- project ref
Deno.test("chat refuses to run against any Supabase project other than uwxksbwlzjrjlccbdjtk", async () => {
  setup();
  Deno.env.set("SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
  mockFetch(() => { throw new Error("must not call Gemini or the database"); });
  const res = await handleChat(post("chat", { question: "سؤال" }));
  assert.equal(res.status, 500);
  assert.equal((await res.json()).code, "wrong_project");
  assert.equal(calls.length, 0);
  teardown();
});

Deno.test("isExpectedProject only accepts the EcoWasteAI project URL", () => {
  assert.equal(isExpectedProject(PROJECT_URL), true);
  assert.equal(isExpectedProject(PROJECT_URL + "/"), true);
  assert.equal(isExpectedProject("https://abcdefghijklmnopqrst.supabase.co"), false);
  assert.equal(isExpectedProject("https://uwxksbwlzjrjlccbdjtk.supabase.co.evil.com"), false);
  assert.equal(isExpectedProject(""), false);
});

Deno.test("project ref is the same in vite.config.js, supabase/config.toml, package.json and the functions", async () => {
  const root = new URL("../../../", import.meta.url);
  const read = (p: string) => Deno.readTextFile(new URL(p, root));
  assert.equal(EXPECTED_PROJECT_REF, "uwxksbwlzjrjlccbdjtk");
  assert.match(await read("vite.config.js"), /EXPECTED_SUPABASE_REF = 'uwxksbwlzjrjlccbdjtk'/);
  assert.match(await read("supabase/config.toml"), /^project_id = "uwxksbwlzjrjlccbdjtk"$/m);
  const deploy = JSON.parse(await read("package.json")).scripts["supabase:deploy"] as string;
  assert.equal(deploy.match(/--project-ref uwxksbwlzjrjlccbdjtk/g)?.length, 2);
});

Deno.test("no code in this repo writes to the database", async () => {
  // The only database call allowed is the read-only RPC match_documents.
  const root = new URL("../../../", import.meta.url);
  const files = [
    "supabase/functions/chat/handler.ts",
    "supabase/functions/classify/handler.ts",
    "supabase/functions/_shared/security.ts",
    "src/lib/api.js",
    "src/App.jsx",
  ];
  for (const f of files) {
    const code = await Deno.readTextFile(new URL(f, root));
    const restCalls = code.match(/\/rest\/v1\/[A-Za-z_/]+/g) ?? [];
    for (const call of restCalls) assert.equal(call, "/rest/v1/rpc/match_documents", `${f}: ${call}`);
    // no supabase-js table access (.from("x").insert/update/delete/upsert)
    assert.doesNotMatch(code, /\.from\(\s*["'`]/, f);
    // no write HTTP methods
    assert.doesNotMatch(code, /method:\s*["'](PUT|PATCH|DELETE)["']/i, f);
    assert.doesNotMatch(code, /\b(INSERT INTO|DELETE FROM|UPDATE\s+public|DROP TABLE|TRUNCATE)\b/, f);
  }
  let migrations = false;
  try { await Deno.stat(new URL("supabase/migrations", root)); migrations = true; } catch { /* none */ }
  assert.equal(migrations, false, "this branch must not contain database migrations");
});
