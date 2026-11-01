// Small helpers shared by the agent tools.
import { HttpError } from "../../_shared/security.ts";
import type { Bin, ToolContext, ToolResult } from "../types.ts";

export const MAX_IMAGE_BASE64_CHARS = 4_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

// Picks the Arabic or English string for the user's language.
export const t = (ctx: ToolContext, ar: string, en: string) => (ctx.lang === "en" ? en : ar);

export const fail = (error: string): ToolResult => ({ ok: false, error });

export function binLabel(ctx: ToolContext, binId: string): string {
  const bin = ctx.university.bins.find((b) => b.id === binId);
  if (!bin) return binId;
  return ctx.lang === "en" ? bin.label_en : bin.label_ar;
}

export function binsFor(ctx: ToolContext, category: string): Bin[] {
  return ctx.university.bins.filter((b) => b.accepts.includes(category));
}

// Describes the university's bins for prompts, in both languages.
export function binsText(ctx: ToolContext): string {
  return ctx.university.bins
    .map((b) => `- ${b.id}: ${b.label_en} / ${b.label_ar} (accepts: ${b.accepts.join(", ")})`)
    .join("\n");
}

// Runs a tool body; database/model errors become { ok:false, error:code } for the agent.
export async function guarded(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return fail(err.code);
    console.error("tool error:", err);
    return fail("tool_failed");
  }
}

export function imageProblem(ctx: ToolContext): string | null {
  if (!ctx.image?.data) return "no_image";
  if (ctx.image.data.length > MAX_IMAGE_BASE64_CHARS) return "too_large";
  return null;
}

export function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function daysArg(v: unknown): 7 | 30 {
  return Number(v) === 30 ? 30 : 7;
}

export function period(days: number, now = new Date()) {
  return { p_from: new Date(now.getTime() - days * 86_400_000).toISOString(), p_to: now.toISOString() };
}
