// HTTP-level tests for the agent function (fake fetch for Auth, PostgREST and Gemini).
import assert from "node:assert/strict";
import { handleAgent } from "../agent/handler.ts";
import { resetRateLimits } from "../_shared/security.ts";

const SITE = "https://recycling-ai-assistant2026.netlify.app";
const realFetch = globalThis.fetch;
type Call = { url: string; init: RequestInit; body: any };
let calls: Call[] = [];
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

function setup() {
  Deno.env.set("SUPABASE_URL", "https://uwxksbwlzjrjlccbdjtk.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  Deno.env.set("GEMINI_API_KEY", "gem-key");
  Deno.env.delete("ALLOWED_ORIGINS");
  resetRateLimits();
}

const PROFILE = [{
  role: "student",
  faculty: "Engineering",
  university_id: "uni",
  universities: { id: "uni", name: "Demo U", country: "AE", points_per_item: 10, sorting_rules: "", default_language: "en",
    bins: [{ id: "plastic", label_ar: "بلاستيك", label_en: "Plastic", color: "#2563eb", accepts: ["plastic"] }] },
}];

type Opts = { profile?: unknown[]; history?: unknown[]; userId?: string };
function router({ profile = PROFILE, history = [], userId = "u1" }: Opts = {}) {
  return (url: string) => {
    if (url.endsWith("/auth/v1/user")) return ok({ id: userId, is_anonymous: true });
    if (url.includes("/rest/v1/profiles")) return ok(profile);
    if (url.includes("/rest/v1/messages")) return ok(history);
    if (url.includes("rpc/save_agent_turn")) return ok("conv-1");
    if (url.includes("generateContent")) return ok({ candidates: [{ content: { parts: [{ text: "Hello!" }] } }] });
    throw new Error("unexpected " + url);
  };
}

function post(body: unknown, { token = "user-jwt", ip = "198.51.100.1" }: { token?: string | null; ip?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Origin: SITE, "x-forwarded-for": ip };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request("https://x/functions/v1/agent", { method: "POST", headers, body: JSON.stringify(body) });
}

Deno.test("no token gives 401 unauthorized", async () => {
  setup();
  mockFetch(() => new Response("{}", { status: 401 }));
  const res = await handleAgent(post({ message: "hi", lang: "en" }, { token: null }));
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, "unauthorized");
  globalThis.fetch = realFetch;
});

Deno.test("a user without a profile gets 409 needs_onboarding", async () => {
  setup();
  mockFetch(router({ profile: [] }));
  const res = await handleAgent(post({ message: "hi", lang: "en" }));
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "needs_onboarding");
  assert.ok(!calls.some((c) => c.url.includes("generateContent")));
  globalThis.fetch = realFetch;
});

Deno.test("the 31st message in 10 minutes from one user gets 429", async () => {
  setup();
  mockFetch(router());
  for (let i = 0; i < 30; i++) {
    const r = await handleAgent(post({ message: "hi", lang: "en" }, { ip: `198.51.100.${i + 1}` }));
    assert.equal(r.status, 200, `request ${i + 1}`);
  }
  const blocked = await handleAgent(post({ message: "hi", lang: "en" }, { ip: "198.51.100.99" }));
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).code, "rate_limited");
  globalThis.fetch = realFetch;
});

Deno.test("happy path: loads memory with the user's token, saves the turn, returns conversationId", async () => {
  setup();
  mockFetch(router({ history: [
    { role: "assistant", content: "earlier answer", actions: [{ kind: "logged", title: "Logged 1 × Bottle", detail: "Engineering cafeteria bin station" }] },
    { role: "user", content: "earlier question", actions: [] },
  ] }));
  const res = await handleAgent(post({ message: "hello", lang: "en", conversationId: "11111111-1111-4111-8111-111111111111" }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data, { reply: "Hello!", actions: [], conversationId: "conv-1" });

  const hist = calls.find((c) => c.url.includes("/rest/v1/messages"))!;
  assert.match(hist.url, /conversation_id=eq\.11111111-1111-4111-8111-111111111111/);
  assert.match(hist.url, /limit=12/);
  assert.equal((hist.init.headers as Record<string, string>).Authorization, "Bearer user-jwt");

  const gem = calls.find((c) => c.url.includes("generateContent"))!;
  assert.deepEqual(gem.body.contents.slice(0, 2).map((c: any) => [c.role, c.parts[0].text]), [
    ["user", "earlier question"],
    ["model", "earlier answer\n[Actions done: Logged 1 × Bottle (Engineering cafeteria bin station)]"],
  ]);
  assert.match(hist.url, /select=role,content,actions/);

  const save = calls.find((c) => c.url.includes("rpc/save_agent_turn"))!;
  assert.equal(save.body.p_user, "u1");
  assert.equal(save.body.p_conversation, "11111111-1111-4111-8111-111111111111");
  assert.equal(save.body.p_user_text, "hello");
  assert.equal(save.body.p_reply, "Hello!");
  globalThis.fetch = realFetch;
});

Deno.test("an invalid conversationId is ignored (no history query, new conversation)", async () => {
  setup();
  mockFetch(router());
  const res = await handleAgent(post({ message: "hello", lang: "ar", conversationId: "x' or 1=1" }));
  assert.equal(res.status, 200);
  assert.ok(!calls.some((c) => c.url.includes("/rest/v1/messages")));
  assert.equal(calls.find((c) => c.url.includes("save_agent_turn"))!.body.p_conversation, null);
  globalThis.fetch = realFetch;
});

Deno.test("missing message and no image gives 400; oversized image gives 413", async () => {
  setup();
  mockFetch(router());
  const r1 = await handleAgent(post({ message: "  ", lang: "en" }));
  assert.equal(r1.status, 400);
  assert.equal((await r1.json()).code, "missing_message");
  const r2 = await handleAgent(post({ message: "", image: "A".repeat(4_000_001), lang: "en" }));
  assert.equal(r2.status, 413);
  globalThis.fetch = realFetch;
});
