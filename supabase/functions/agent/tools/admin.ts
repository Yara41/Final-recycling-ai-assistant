// Sustainability-office tools: campus statistics, trend analysis, data-grounded campaigns.
import { generate, partsText } from "../../_shared/gemini.ts";
import { rpcAsUser } from "../../_shared/supabase.ts";
import type { Tool, ToolContext } from "../types.ts";
import { daysArg, guarded, period, str, t } from "./util.ts";

export function campusStats(ctx: ToolContext, days: number): Promise<Record<string, unknown>> {
  return rpcAsUser(ctx.jwt, "university_stats", { p_university: ctx.university.id, ...period(days) });
}

export const getCampusStats: Tool = {
  name: "get_campus_stats",
  roles: ["admin"],
  declaration: {
    name: "get_campus_stats",
    description: "Recycling statistics for this university for the last 7 or 30 days (totals, by category and faculty, top mis-sorted items, worst locations, open reports, previous period).",
    parameters: { type: "OBJECT", properties: { days: { type: "INTEGER", enum: [7, 30] } } },
  },
  run: (args, ctx) =>
    guarded(async () => {
      const days = daysArg(args.days);
      const stats = await campusStats(ctx, days);
      const totals = (stats.totals ?? {}) as Record<string, number>;
      return {
        ok: true,
        data: stats,
        card: {
          kind: "stats",
          title: t(ctx, `${days === 7 ? "آخر 7 أيام" : "آخر 30 يوماً"}: عدد الأغراض ${totals.items ?? 0}`, `Last ${days} days: ${totals.items ?? 0} items`),
          detail: t(
            ctx,
            `فرز صحيح ${Math.round((totals.correct_rate ?? 0) * 100)}% • المستخدمون النشطون: ${totals.active_users ?? 0}`,
            `${Math.round((totals.correct_rate ?? 0) * 100)}% correctly sorted • ${totals.active_users ?? 0} active users`,
          ),
          data: stats,
        },
      };
    }),
};

const ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: { summary: { type: "STRING" }, recommendations: { type: "ARRAY", items: { type: "STRING" } } },
  required: ["summary", "recommendations"],
};

// Shared with the weekly insights job.
export async function analyzeStats(stats: unknown, universityName: string, lang: "ar" | "en") {
  const language = lang === "en" ? "English" : "Arabic";
  const { parts } = await generate({
    system: "You are a university sustainability analyst. Use only the numbers given. Answer with JSON only.",
    contents: [{
      role: "user",
      parts: [{
        text: `Campus recycling statistics for ${universityName}:\n${JSON.stringify(stats)}\n\n` +
          `Write in ${language}: "summary" (2-3 sentences: the biggest problem, where, and the trend vs the previous period) and ` +
          `"recommendations": exactly 3 specific, practical interventions for this week (who, where, what).`,
      }],
    }],
    json: true,
    schema: ANALYSIS_SCHEMA,
  });
  const raw = JSON.parse(partsText(parts).replace(/^```(?:json)?\s*|\s*```$/g, ""));
  const recommendations = (Array.isArray(raw.recommendations) ? raw.recommendations : []).map((r: unknown) => String(r)).slice(0, 3);
  return { summary: String(raw.summary ?? ""), recommendations };
}

export const analyzeTrends: Tool = {
  name: "analyze_trends",
  roles: ["admin"],
  declaration: {
    name: "analyze_trends",
    description: "Analyse this university's recent recycling data and propose exactly 3 interventions.",
    parameters: { type: "OBJECT", properties: { days: { type: "INTEGER", enum: [7, 30] } } },
  },
  run: (args, ctx) =>
    guarded(async () => {
      const stats = await campusStats(ctx, daysArg(args.days));
      const analysis = await analyzeStats(stats, ctx.university.name, ctx.lang);
      return {
        ok: true,
        data: { ...analysis, stats },
        card: {
          kind: "insight",
          title: t(ctx, "تحليل الوكيل", "Agent analysis"),
          detail: analysis.summary,
          data: analysis,
        },
      };
    }),
};

export const draftCampaign: Tool = {
  name: "draft_campaign",
  roles: ["admin"],
  declaration: {
    name: "draft_campaign",
    description: "Write a short awareness campaign (poster text + social post) grounded in this university's data.",
    parameters: {
      type: "OBJECT",
      properties: {
        topic: { type: "STRING", description: "e.g. 'chips bags in plastic bins'" },
        audience: { type: "STRING", description: "e.g. 'Engineering students'" },
      },
      required: ["topic"],
    },
  },
  run: (args, ctx) =>
    guarded(async () => {
      const topic = str(args.topic, 200);
      const audience = str(args.audience, 120) || t(ctx, "مجتمع الجامعة", "the university community");
      const stats = await campusStats(ctx, 30);
      const { parts } = await generate({
        system: "You write short, friendly, accurate university recycling campaigns. Use only numbers present in the data.",
        contents: [{
          role: "user",
          parts: [{
            text: `University: ${ctx.university.name}\nData (30 days): ${JSON.stringify(stats)}\nTopic: ${topic}\nAudience: ${audience}\n` +
              `Write in ${ctx.lang === "en" ? "English" : "Arabic"}: a poster headline, 2 lines of poster text, and one social media post (max 280 characters).`,
          }],
        }],
      });
      const text = partsText(parts);
      return {
        ok: true,
        data: { campaign: text },
        card: { kind: "campaign", title: t(ctx, `حملة: ${topic}`, `Campaign: ${topic}`), detail: text.slice(0, 400), data: { campaign: text } },
      };
    }),
};
