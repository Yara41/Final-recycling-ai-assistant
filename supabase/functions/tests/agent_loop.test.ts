// Agent loop tests with a scripted fake model and fake tools.
import assert from "node:assert/strict";
import { MAX_STEPS, MAX_TOOL_CALLS, runAgent } from "../agent/loop.ts";
import { buildSystemPrompt } from "../agent/prompt.ts";
import type { GeminiContent, GeminiPart, GenerateRequest } from "../_shared/gemini.ts";
import { HttpError } from "../_shared/security.ts";
import type { ToolContext, ToolResult } from "../agent/types.ts";

const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({
  userId: "u1",
  role: "student",
  jwt: "jwt",
  lang: "ar",
  conversationId: null,
  university: {
    id: "uni",
    name: "Demo U",
    country: "AE",
    points_per_item: 10,
    sorting_rules: "Chips bags are general waste.",
    bins: [{ id: "plastic", label_ar: "بلاستيك", label_en: "Plastic", color: "#2563eb", accepts: ["plastic"] }],
  },
  ...over,
});

const call = (name: string, args: Record<string, unknown> = {}): GeminiPart => ({ functionCall: { name, args } });
const text = (t: string): GeminiPart => ({ text: t });

function script(steps: (GeminiPart[] | Error)[]) {
  const requests: GenerateRequest[] = [];
  const generate = async (req: GenerateRequest) => {
    requests.push(structuredClone(req));
    const next = steps.shift();
    if (!next) throw new Error("no more scripted steps");
    if (next instanceof Error) throw next;
    return { parts: next, model: "fake" };
  };
  return { generate, requests };
}

function fakeTools(results: Record<string, ToolResult>) {
  const ran: string[] = [];
  const runTool = async (name: string): Promise<ToolResult> => {
    ran.push(name);
    return results[name] ?? { ok: false, error: "tool_not_allowed" };
  };
  return { runTool, ran };
}

Deno.test("two-step: classify then log returns two cards and the final text", async () => {
  const { generate } = script([[call("classify_item")], [call("log_recycling", { item: "Bottle" })], [text("رائع!")]]);
  const { runTool, ran } = fakeTools({
    classify_item: { ok: true, card: { kind: "classified", title: "Bottle → Plastic" } },
    log_recycling: { ok: true, card: { kind: "logged", title: "Logged", points: 10 } },
  });
  const out = await runAgent({ ctx: ctx(), history: [], message: "رميت قنينة", hasImage: true }, { generate, runTool });
  assert.equal(out.reply, "رائع!");
  assert.deepEqual(out.actions.map((a) => a.kind), ["classified", "logged"]);
  assert.deepEqual(ran, ["classify_item", "log_recycling"]);
  assert.equal(out.records.length, 2);
  assert.equal(out.records[1].tool, "log_recycling");
  assert.deepEqual(out.records[1].input, { item: "Bottle" });
});

Deno.test("stops after MAX_STEPS model calls", async () => {
  assert.equal(MAX_STEPS, 4);
  assert.equal(MAX_TOOL_CALLS, 6);
  const { generate, requests } = script([
    [call("get_my_impact")], [call("get_my_impact")], [call("get_my_impact")], [call("get_my_impact")], [text("never")],
  ]);
  const { runTool, ran } = fakeTools({ get_my_impact: { ok: true, card: { kind: "impact", title: "x" } } });
  const out = await runAgent({ ctx: ctx({ lang: "en" }), history: [], message: "impact", hasImage: false }, { generate, runTool });
  assert.equal(requests.length, 4);
  assert.equal(ran.length, 3);
  assert.ok(out.reply.length > 0);
});

Deno.test("a forbidden tool becomes a functionResponse error and the loop continues", async () => {
  const { generate, requests } = script([[call("get_campus_stats")], [text("I can't do that.")]]);
  const { runTool } = fakeTools({});
  const out = await runAgent({ ctx: ctx({ lang: "en" }), history: [], message: "stats", hasImage: false }, { generate, runTool });
  assert.equal(out.reply, "I can't do that.");
  assert.equal(out.actions.length, 0);
  const last = requests[1].contents.at(-1)!;
  assert.equal(last.parts[0].functionResponse?.name, "get_campus_stats");
  assert.equal(last.parts[0].functionResponse?.response.error, "tool_not_allowed");
});

Deno.test("model failure after a write returns cards and a fallback reply; the tool ran once", async () => {
  const { generate } = script([[call("log_recycling")], new HttpError(503, "model_unavailable", "busy")]);
  const { runTool, ran } = fakeTools({ log_recycling: { ok: true, card: { kind: "logged", title: "Logged", points: 10 } } });
  const out = await runAgent({ ctx: ctx({ lang: "en" }), history: [], message: "I recycled a can", hasImage: false }, { generate, runTool });
  assert.deepEqual(ran, ["log_recycling"]);
  assert.equal(out.actions[0].kind, "logged");
  assert.match(out.reply, /[a-z]/i);
  assert.doesNotMatch(out.reply, /[؀-ۿ]/);
});

Deno.test("model failure before any tool rethrows", async () => {
  const { generate } = script([new HttpError(503, "model_unavailable", "busy")]);
  const { runTool } = fakeTools({});
  await assert.rejects(runAgent({ ctx: ctx(), history: [], message: "hi", hasImage: false }, { generate, runTool }), /busy/);
});

Deno.test("system prompt explains that points need a photo", () => {
  assert.match(buildSystemPrompt(ctx()), /points only for items .*photo/i);
});

Deno.test("system prompt makes the agent file bin reports itself", () => {
  const p = buildSystemPrompt(ctx());
  assert.match(p, /never tell the user to report it themselves/i);
  assert.match(p, /earlier in the conversation/i);
});

Deno.test("system prompt fixes the reply language to lang, not the message language", () => {
  const en = buildSystemPrompt(ctx({ lang: "en" }));
  assert.match(en, /Reply only in English/);
  const ar = buildSystemPrompt(ctx({ lang: "ar" }));
  assert.match(ar, /Reply only in Arabic/);
  assert.match(ar, /Demo U/);
  assert.match(ar, /student/);
  assert.match(ar, /plastic/);
});

Deno.test("history comes before the new message, and an attached photo is announced", async () => {
  const { generate, requests } = script([[text("ok")]]);
  const { runTool } = fakeTools({});
  const history: GeminiContent[] = [{ role: "user", parts: [{ text: "earlier" }] }, { role: "model", parts: [{ text: "answer" }] }];
  await runAgent({ ctx: ctx(), history, message: "now", hasImage: true }, { generate, runTool });
  const contents = requests[0].contents;
  assert.equal(contents[0].parts[0].text, "earlier");
  assert.equal(contents.length, 3);
  assert.match(contents[2].parts[0].text ?? "", /photo/i);
  assert.match(contents[2].parts[0].text ?? "", /now/);
  assert.ok((requests[0].tools ?? []).length > 0);
});

Deno.test("at most MAX_TOOL_CALLS tools run per message; extra calls are refused", async () => {
  const many = Array.from({ length: 10 }, () => call("log_recycling", { item: "Can" }));
  const { generate, requests } = script([many, [text("done")]]);
  const { runTool, ran } = fakeTools({ log_recycling: { ok: true, card: { kind: "logged", title: "Logged", points: 10 } } });
  const out = await runAgent({ ctx: ctx({ lang: "en" }), history: [], message: "I recycled 10 cans one by one", hasImage: false }, { generate, runTool });
  assert.equal(ran.length, 6);
  assert.equal(out.actions.length, 6);
  const responses = requests[1].contents.at(-1)!.parts;
  assert.equal(responses.length, 10);
  assert.equal(responses[9].functionResponse?.response.error, "too_many_actions");
});

Deno.test("the prompt keeps Arabic replies in Modern Standard Arabic", () => {
  assert.match(buildSystemPrompt(ctx()), /Modern Standard Arabic, even if the user writes in a dialect/);
});
