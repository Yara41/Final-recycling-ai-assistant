// Offline tests for the shared Supabase REST and Gemini helpers.
import assert from "node:assert/strict";
import { getUser, restGet, serviceRpc } from "../_shared/supabase.ts";
import { generate } from "../_shared/gemini.ts";
import { HttpError } from "../_shared/security.ts";

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
const status = (code: number, data: unknown = {}) => new Response(JSON.stringify(data), { status: code });

function setEnv() {
  Deno.env.set("SUPABASE_URL", "https://uwxksbwlzjrjlccbdjtk.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  Deno.env.set("GEMINI_API_KEY", "gem-key");
  Deno.env.delete("GEMINI_AGENT_MODEL");
}

Deno.test("getUser returns the user id and anonymous flag", async () => {
  setEnv();
  mockFetch(() => ok({ id: "u1", is_anonymous: true }));
  assert.deepEqual(await getUser("jwt"), { id: "u1", isAnonymous: true });
  assert.match(calls[0].url, /\/auth\/v1\/user$/);
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer jwt");
  assert.equal((calls[0].init.headers as Record<string, string>).apikey, "anon-key");
  globalThis.fetch = realFetch;
});

Deno.test("getUser returns null on 401", async () => {
  setEnv();
  mockFetch(() => status(401));
  assert.equal(await getUser("bad"), null);
  globalThis.fetch = realFetch;
});

Deno.test("restGet sends the user's JWT, not the service key", async () => {
  setEnv();
  mockFetch(() => ok([{ role: "student" }]));
  const rows = await restGet<{ role: string }[]>("user-jwt", "profiles?select=role");
  assert.equal(rows[0].role, "student");
  assert.match(calls[0].url, /\/rest\/v1\/profiles\?select=role$/);
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer user-jwt");
  globalThis.fetch = realFetch;
});

Deno.test("serviceRpc maps invalid_location to 400", async () => {
  setEnv();
  mockFetch(() => status(400, { code: "P0001", message: "invalid_location" }));
  await assert.rejects(serviceRpc("log_recycling_event", {}), (e: unknown) => {
    assert.ok(e instanceof HttpError);
    assert.equal(e.status, 400);
    assert.equal(e.code, "invalid_location");
    return true;
  });
  assert.match(calls[0].url, /\/rest\/v1\/rpc\/log_recycling_event$/);
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer service-key");
  globalThis.fetch = realFetch;
});

Deno.test("serviceRpc maps unknown database errors to 502 db_failed", async () => {
  setEnv();
  mockFetch(() => status(500, { message: "boom" }));
  await assert.rejects(serviceRpc("x", {}), (e: unknown) => e instanceof HttpError && e.status === 502 && e.code === "db_failed");
  globalThis.fetch = realFetch;
});

const textReply = (text: string) => ok({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });

Deno.test("generate uses the always-current Flash aliases and falls back to Flash-Lite on 429", async () => {
  setEnv();
  mockFetch((url) => url.includes("/gemini-flash-latest:") ? status(429, { error: { message: "quota" } }) : textReply("hi"));
  const out = await generate({ system: "s", contents: [{ role: "user", parts: [{ text: "q" }] }] });
  assert.match(calls[0].url, /\/gemini-flash-latest:generateContent$/);
  assert.equal(out.model, "gemini-flash-lite-latest");
  assert.equal(out.parts[0].text, "hi");
  assert.equal(calls.length, 2);
  globalThis.fetch = realFetch;
});

Deno.test("generate stops on 403 and throws model_unavailable", async () => {
  setEnv();
  mockFetch(() => status(403, { error: { message: "bad key" } }));
  await assert.rejects(
    generate({ system: "s", contents: [{ role: "user", parts: [{ text: "q" }] }] }),
    (e: unknown) => e instanceof HttpError && e.code === "model_unavailable",
  );
  assert.equal(calls.length, 1);
  globalThis.fetch = realFetch;
});

Deno.test("generate falls back when a model is retired (404)", async () => {
  setEnv();
  mockFetch((url) => url.includes("/gemini-flash-latest:") ? status(404, { error: { message: "no longer available" } }) : textReply("ok"));
  const out = await generate({ system: "s", contents: [{ role: "user", parts: [{ text: "q" }] }] });
  assert.equal(out.model, "gemini-flash-lite-latest");
  globalThis.fetch = realFetch;
});

Deno.test("GEMINI_AGENT_MODEL overrides the first model and 2.5 models get thinking disabled", async () => {
  setEnv();
  Deno.env.set("GEMINI_AGENT_MODEL", "gemini-2.5-flash");
  mockFetch(() => textReply("hi"));
  await generate({ system: "s", contents: [{ role: "user", parts: [{ text: "q" }] }] });
  assert.match(calls[0].url, /\/gemini-2\.5-flash:generateContent$/);
  assert.deepEqual(calls[0].body.generationConfig.thinkingConfig, { thinkingBudget: 0 });
  Deno.env.delete("GEMINI_AGENT_MODEL");
  globalThis.fetch = realFetch;
});

Deno.test("generate sends tools as functionDeclarations", async () => {
  setEnv();
  mockFetch(() => ok({ candidates: [{ content: { parts: [{ functionCall: { name: "t", args: {} } }] } }] }));
  const decl = { name: "t", description: "d", parameters: { type: "OBJECT", properties: {} } };
  const out = await generate({ system: "s", contents: [{ role: "user", parts: [{ text: "q" }] }], tools: [decl] });
  assert.deepEqual(calls[0].body.tools, [{ functionDeclarations: [decl] }]);
  assert.equal(calls[0].body.generationConfig.temperature, 0.2);
  assert.equal(calls[0].body.generationConfig.thinkingConfig, undefined);
  assert.equal(out.parts[0].functionCall?.name, "t");
  globalThis.fetch = realFetch;
});

Deno.test("generate with json=true asks for application/json", async () => {
  setEnv();
  mockFetch(() => textReply("{}"));
  await generate({ system: "s", contents: [{ role: "user", parts: [{ text: "q" }] }], json: true });
  assert.equal(calls[0].body.generationConfig.responseMimeType, "application/json");
  globalThis.fetch = realFetch;
});
