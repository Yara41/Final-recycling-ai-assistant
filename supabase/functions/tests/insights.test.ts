// Tests for the weekly insights job.
import assert from "node:assert/strict";
import { handleInsights } from "../insights/handler.ts";

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
  Deno.env.set("CRON_SECRET", "s3cret");
}

const req = (secret?: string) =>
  new Request("https://x/functions/v1/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(secret ? { "x-cron-secret": secret } : {}) },
    body: "{}",
  });

const UNIS = [
  { id: "u-a", name: "Uni A", default_language: "en" },
  { id: "u-b", name: "Uni B", default_language: "ar" },
];

Deno.test("missing or wrong secret gives 401 and touches nothing", async () => {
  setup();
  mockFetch(() => { throw new Error("must not be called"); });
  assert.equal((await handleInsights(req())).status, 401);
  assert.equal((await handleInsights(req("nope"))).status, 401);
  Deno.env.set("CRON_SECRET", "");
  assert.equal((await handleInsights(req(""))).status, 401);
  assert.equal(calls.length, 0);
  globalThis.fetch = realFetch;
});

Deno.test("creates one insight per active university", async () => {
  setup();
  mockFetch((url) => {
    if (url.includes("/rest/v1/universities")) return ok(UNIS);
    if (url.includes("rpc/university_stats")) return ok({ totals: { events: 12 }, top_missorted: [] });
    if (url.includes("generateContent")) {
      return ok({ candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: "S", recommendations: ["1", "2", "3"] }) }] } }] });
    }
    if (url.includes("rpc/save_insight")) return ok("ins-1");
    throw new Error("unexpected " + url);
  });
  const res = await handleInsights(req("s3cret"));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { created: 2 });
  const saves = calls.filter((c) => c.url.includes("rpc/save_insight"));
  assert.deepEqual(saves.map((s) => s.body.p_university), ["u-a", "u-b"]);
  assert.match(saves[0].body.p_report, /S/);
  assert.match(saves[0].body.p_report, /1/);
  const stats = calls.find((c) => c.url.includes("rpc/university_stats"))!;
  assert.equal((stats.init.headers as Record<string, string>).Authorization, "Bearer service-key");
  globalThis.fetch = realFetch;
});

Deno.test("a university with no events gets a 'no data yet' insight without calling Gemini", async () => {
  setup();
  mockFetch((url) => {
    if (url.includes("/rest/v1/universities")) return ok([UNIS[1]]);
    if (url.includes("rpc/university_stats")) return ok({ totals: { events: 0 } });
    if (url.includes("rpc/save_insight")) return ok("ins-1");
    throw new Error("unexpected " + url);
  });
  const res = await handleInsights(req("s3cret"));
  assert.deepEqual(await res.json(), { created: 1 });
  assert.ok(!calls.some((c) => c.url.includes("generateContent")));
  assert.match(calls.find((c) => c.url.includes("save_insight"))!.body.p_report, /[؀-ۿ]/);
  globalThis.fetch = realFetch;
});
