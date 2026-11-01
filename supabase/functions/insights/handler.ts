// Weekly proactive analysis. Called by pg_cron (see supabase/migrations/*_weekly_insights_cron.sql)
// with header x-cron-secret. The secret lives only in Supabase Vault; the database checks it
// (verify_cron_secret), so it is never copied into function settings. For every active university it analyses the last
// 7 days and stores a short report with exactly 3 recommendations in `insights`.
import { serviceGet, serviceRpc } from "../_shared/supabase.ts";
import { json } from "../_shared/security.ts";
import { analyzeStats } from "../agent/tools/admin.ts";
import { period } from "../agent/tools/util.ts";

type Uni = { id: string; name: string; default_language: "ar" | "en" };

const NO_DATA = {
  ar: "لا توجد بيانات تدوير مسجّلة هذا الأسبوع بعد. شجّعوا الطلاب والموظفين على تصوير نفاياتهم وتسجيلها مع EcoWasteAI.",
  en: "No recycling activity was recorded this week yet. Encourage students and staff to snap and log their waste with EcoWasteAI.",
};

function report(summary: string, recommendations: string[]): string {
  return [summary, "", ...recommendations.map((r, i) => `${i + 1}. ${r}`)].join("\n");
}

export async function handleInsights(req: Request): Promise<Response> {
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!given) return json({ error: "Unauthorized", code: "unauthorized" }, 401, {});
  try {
    const valid = await serviceRpc<boolean>("verify_cron_secret", { p_secret: given });
    if (valid !== true) return json({ error: "Unauthorized", code: "unauthorized" }, 401, {});

    const body = await req.json().catch(() => ({}));
    const only = typeof body?.universityId === "string" ? `&id=eq.${encodeURIComponent(body.universityId)}` : "";
    const unis = await serviceGet<Uni[]>(`universities?select=id,name,default_language&active=eq.true${only}`);
    const { p_from, p_to } = period(7);
    let created = 0;
    for (const uni of unis) {
      try {
        const stats = await serviceRpc<Record<string, any>>("university_stats", { p_university: uni.id, p_from, p_to });
        const lang = uni.default_language === "ar" ? "ar" : "en";
        const text = (stats?.totals?.events ?? 0) > 0
          ? (({ summary, recommendations }) => report(summary, recommendations))(await analyzeStats(stats, uni.name, lang))
          : NO_DATA[lang];
        await serviceRpc("save_insight", {
          p_university: uni.id,
          p_start: p_from.slice(0, 10),
          p_end: p_to.slice(0, 10),
          p_stats: stats,
          p_report: text,
        });
        created++;
      } catch (err) {
        console.error(`insight for ${uni.id} failed:`, err);
      }
    }
    return json({ created }, 200, {});
  } catch (err) {
    console.error("insights error:", err);
    return json({ error: "Something went wrong", code: "server_error" }, 500, {});
  }
}
