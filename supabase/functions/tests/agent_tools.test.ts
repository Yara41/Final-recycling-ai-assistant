// Offline tests for the agent tool registry and tools (fake fetch for Gemini and Supabase).
import assert from "node:assert/strict";
import { runTool, toolsForRole } from "../agent/tools/index.ts";
import type { ToolContext, University } from "../agent/types.ts";

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
const geminiJson = (obj: unknown) => ok({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });

function setEnv() {
  Deno.env.set("SUPABASE_URL", "https://uwxksbwlzjrjlccbdjtk.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  Deno.env.set("GEMINI_API_KEY", "gem-key");
}

const UNI: University = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Demo U",
  country: "AE",
  points_per_item: 10,
  sorting_rules: "Chips bags are general waste.",
  bins: [
    { id: "general", label_ar: "نفايات عامة", label_en: "General waste", color: "#6b7280", accepts: ["general", "organic"] },
    { id: "plastic", label_ar: "بلاستيك", label_en: "Plastic", color: "#2563eb", accepts: ["plastic"] },
  ],
};
const LOC = "00000000-0000-4000-8000-000000000101";
const IMG = { data: btoa("x".repeat(300)), mimeType: "image/jpeg" };

function ctx(over: Partial<ToolContext> = {}): ToolContext {
  return { userId: "u1", role: "student", jwt: "user-jwt", lang: "ar", university: UNI, conversationId: null, ...over };
}

Deno.test("student does not get admin or facilities tools", () => {
  const names = toolsForRole("student").map((t) => t.name);
  for (const n of ["search_knowledge", "classify_item", "log_recycling", "report_bin_issue", "audit_bin_photo", "find_drop_off", "get_my_impact", "get_leaderboard"]) {
    assert.ok(names.includes(n), n);
  }
  for (const n of ["get_campus_stats", "analyze_trends", "draft_campaign", "list_open_reports", "resolve_report"]) {
    assert.ok(!names.includes(n), n);
  }
  assert.ok(toolsForRole("admin").some((t) => t.name === "analyze_trends"));
  assert.ok(toolsForRole("facilities").some((t) => t.name === "resolve_report"));
  assert.ok(!toolsForRole("facilities").some((t) => t.name === "draft_campaign"));
});

Deno.test("runTool refuses a tool outside the role without any network call", async () => {
  setEnv();
  mockFetch(() => { throw new Error("must not be called"); });
  const r = await runTool("get_campus_stats", { days: 7 }, ctx());
  assert.deepEqual([r.ok, r.error], [false, "tool_not_allowed"]);
  const r2 = await runTool("delete_everything", {}, ctx({ role: "admin" }));
  assert.equal(r2.error, "tool_not_allowed");
  assert.equal(calls.length, 0);
  globalThis.fetch = realFetch;
});

Deno.test("log_recycling validates category, bin and quantity before any DB call", async () => {
  setEnv();
  mockFetch(() => { throw new Error("must not be called"); });
  for (const args of [
    { item: "Plank", category: "wood", bin: "general" },
    { item: "Bottle", category: "plastic", bin: "blue_box" },
    { item: "Bottle", category: "plastic", bin: "plastic", quantity: 0 },
    { item: "Bottle", category: "plastic", bin: "plastic", quantity: 51 },
    { item: "", category: "plastic", bin: "plastic" },
    { item: "Bottle", category: "plastic", bin: "plastic", location_id: "not-a-uuid" },
  ]) {
    const r = await runTool("log_recycling", args, ctx());
    assert.equal(r.ok, false, JSON.stringify(args));
  }
  assert.equal(calls.length, 0);
  globalThis.fetch = realFetch;
});

Deno.test("log_recycling returns a logged card with points from the database", async () => {
  setEnv();
  mockFetch(() => ok({ event_id: "e1", correct_bin: true, points: 20, est_kg: 0.05, est_co2e_kg: 0.05, correct_bins: ["plastic"] }));
  const r = await runTool("log_recycling", { item: "Bottle", category: "plastic", bin: "plastic", quantity: 2, location_id: LOC }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.card?.kind, "logged");
  assert.equal(r.card?.points, 20);
  assert.equal(r.card?.location_id, LOC); // the campus animates this bin's building
  assert.equal(r.card?.bin, "plastic"); // the campus flies the item into this bin
  assert.match(calls[0].url, /rpc\/log_recycling_event$/);
  assert.deepEqual(calls[0].body, {
    p_user: "u1", p_item: "Bottle", p_category: "plastic", p_bin: "plastic", p_quantity: 2, p_location: LOC, p_source: "chat",
    p_image_hash: null,
  });
  globalThis.fetch = realFetch;
});

Deno.test("log_recycling surfaces invalid_location as ok:false", async () => {
  setEnv();
  mockFetch(() => new Response(JSON.stringify({ code: "P0001", message: "invalid_location" }), { status: 400 }));
  const r = await runTool("log_recycling", { item: "Bottle", category: "plastic", bin: "plastic", location_id: LOC }, ctx());
  assert.deepEqual([r.ok, r.error], [false, "invalid_location"]);
  globalThis.fetch = realFetch;
});

function auditRouter(pct: number) {
  return (url: string) => url.includes("generateContent")
    ? geminiJson({ items: [{ name: "Chips bag", category: "general", belongs: false }], contamination_pct: pct, summary: "Chips bags in plastic" })
    : ok({ report_id: "r1", duplicate: false });
}

Deno.test("audit_bin_photo files a contaminated report at 25% and not at 24%", async () => {
  setEnv();
  mockFetch(auditRouter(25));
  const r = await runTool("audit_bin_photo", { location_id: LOC, bin: "plastic" }, ctx({ image: IMG }));
  assert.equal(r.ok, true);
  assert.equal(r.card?.kind, "audit");
  const rpc = calls.find((c) => c.url.includes("rpc/file_bin_report"));
  assert.ok(rpc, "report filed");
  assert.equal(rpc!.body.p_issue, "contaminated");
  assert.equal(rpc!.body.p_contamination_pct, 25);

  mockFetch(auditRouter(24));
  await runTool("audit_bin_photo", { location_id: LOC, bin: "plastic" }, ctx({ image: IMG }));
  assert.equal(calls.filter((c) => c.url.includes("rpc/file_bin_report")).length, 0);
  globalThis.fetch = realFetch;
});

Deno.test("photo tools without an image return no_image", async () => {
  setEnv();
  mockFetch(() => { throw new Error("must not be called"); });
  assert.equal((await runTool("audit_bin_photo", {}, ctx())).error, "no_image");
  assert.equal((await runTool("classify_item", {}, ctx())).error, "no_image");
  globalThis.fetch = realFetch;
});

Deno.test("classify_item prompt contains the university's bins and rules", async () => {
  setEnv();
  mockFetch(() => geminiJson({ is_waste: true, item: "Chips bag", category: "general", recyclable: false, tip: "General waste", confidence: 0.9, bin: "general" }));
  const r = await runTool("classify_item", {}, ctx({ image: IMG }));
  assert.equal(r.ok, true);
  assert.equal(r.card?.kind, "classified");
  const prompt = JSON.stringify(calls[0].body.contents);
  assert.match(prompt, /Plastic/);
  assert.match(prompt, /بلاستيك/);
  assert.match(prompt, /Chips bags are general waste/);
  assert.ok(calls[0].body.contents[0].parts.some((p: any) => p.inline_data?.data === IMG.data));
  globalThis.fetch = realFetch;
});

Deno.test("classify_item rejects an image over 4,000,000 base64 chars with too_large", async () => {
  setEnv();
  mockFetch(() => { throw new Error("must not be called"); });
  const r = await runTool("classify_item", {}, ctx({ image: { data: "A".repeat(4_000_001), mimeType: "image/jpeg" } }));
  assert.deepEqual([r.ok, r.error], [false, "too_large"]);
  globalThis.fetch = realFetch;
});

Deno.test("card text follows lang", async () => {
  setEnv();
  mockFetch(() => ok({ event_id: "e1", correct_bin: false, points: 0, est_kg: 0.05, est_co2e_kg: 0, correct_bins: ["general"] }));
  const en = await runTool("log_recycling", { item: "Chips bag", category: "general", bin: "plastic" }, ctx({ lang: "en" }));
  assert.doesNotMatch(en.card!.title + (en.card!.detail ?? ""), /[؀-ۿ]/);
  assert.match(en.card!.detail ?? "", /General waste/);
  const ar = await runTool("log_recycling", { item: "Chips bag", category: "general", bin: "plastic" }, ctx({ lang: "ar" }));
  assert.match(ar.card!.title, /[؀-ۿ]/);
  globalThis.fetch = realFetch;
});

Deno.test("resolve_report passes the verified user id", async () => {
  setEnv();
  mockFetch(() => ok({ report_id: "r1", status: "resolved", location_id: LOC }));
  const r = await runTool("resolve_report", { report_id: LOC, note: "emptied" }, ctx({ role: "facilities" }));
  assert.equal(r.ok, true);
  assert.equal(r.card?.location_id, LOC);
  assert.equal(calls[0].body.p_user, "u1");
  globalThis.fetch = realFetch;
});

Deno.test("search_knowledge scopes the search to the user's university", async () => {
  setEnv();
  mockFetch((url) => url.includes("embedContent")
    ? ok({ embedding: { values: new Array(3072).fill(0.01) } })
    : ok([{ content: "Rinse bottles before recycling.", similarity: 0.8 }]));
  const r = await runTool("search_knowledge", { query: "bottles" }, ctx());
  assert.equal(r.ok, true);
  const rpc = calls.find((c) => c.url.includes("rpc/match_documents_scoped"))!;
  assert.equal(rpc.body.p_university, UNI.id);
  assert.match(JSON.stringify(r.data), /Rinse bottles/);
  globalThis.fetch = realFetch;
});

Deno.test("analyze_trends returns exactly three recommendations", async () => {
  setEnv();
  mockFetch((url) => url.includes("generateContent")
    ? geminiJson({ summary: "Chips bags are the main problem.", recommendations: ["a", "b", "c", "d"] })
    : ok({ totals: { events: 10 }, top_missorted: [{ item: "Chips bag", count: 5 }] }));
  const r = await runTool("analyze_trends", { days: 7 }, ctx({ role: "admin" }));
  assert.equal(r.ok, true);
  assert.equal(r.card?.kind, "insight");
  assert.equal((r.data as any).recommendations.length, 3);
  const stats = calls.find((c) => c.url.includes("rpc/university_stats"))!;
  assert.equal((stats.init.headers as Record<string, string>).Authorization, "Bearer user-jwt");
  globalThis.fetch = realFetch;
});

Deno.test("log_recycling with a photo sends the photo's SHA-256 as p_image_hash", async () => {
  setEnv();
  mockFetch(() => ok({ event_id: "e1", correct_bin: true, points: 10, verification: "photo", est_kg: 0.025, est_co2e_kg: 0.025, correct_bins: ["plastic"] }));
  await runTool("log_recycling", { item: "Bottle", category: "plastic", bin: "plastic" }, ctx({ image: IMG }));
  const expected = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(IMG.data))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  assert.equal(calls[0].body.p_image_hash, expected);
  assert.equal(calls[0].body.p_source, "photo");
  globalThis.fetch = realFetch;
});

Deno.test("a self-reported item gets no points and the card asks for a photo", async () => {
  setEnv();
  mockFetch(() => ok({ event_id: "e1", correct_bin: true, points: 0, verification: "self_reported", est_kg: 0.025, est_co2e_kg: 0.025, correct_bins: ["plastic"] }));
  const r = await runTool("log_recycling", { item: "Bottle", category: "plastic", bin: "plastic" }, ctx({ lang: "en" }));
  assert.equal(r.card?.points, 0);
  assert.match(r.card?.detail ?? "", /photo/i);
  assert.equal((r.data as any).verification, "self_reported");
  globalThis.fetch = realFetch;
});

Deno.test("a reused photo surfaces as duplicate_photo", async () => {
  setEnv();
  mockFetch(() => new Response(JSON.stringify({ code: "P0001", message: "duplicate_photo" }), { status: 400 }));
  const r = await runTool("log_recycling", { item: "Bottle", category: "plastic", bin: "plastic" }, ctx({ image: IMG }));
  assert.deepEqual([r.ok, r.error], [false, "duplicate_photo"]);
  globalThis.fetch = realFetch;
});
