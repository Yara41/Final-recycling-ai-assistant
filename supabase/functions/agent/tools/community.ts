// Read-only tools for every member: knowledge, drop-off points, personal impact, leaderboard.
import { embed } from "../../_shared/gemini.ts";
import { restGet, rpcAsUser, serviceRpc } from "../../_shared/supabase.ts";
import { buildContext } from "../../chat/handler.ts";
import type { Tool } from "../types.ts";
import { fail, guarded, str, t } from "./util.ts";

export const searchKnowledge: Tool = {
  name: "search_knowledge",
  roles: ["student", "faculty", "staff", "facilities", "admin"],
  declaration: {
    name: "search_knowledge",
    description: "Search the recycling and waste-management knowledge base (general + this university). Use for any factual question about recycling.",
    parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] },
  },
  run: (args, ctx) =>
    guarded(async () => {
      const query = str(args.query, 500);
      if (!query) return fail("missing_query");
      const rows = await serviceRpc<{ content: string; similarity: number }[]>("match_documents_scoped", {
        query_embedding: await embed(query),
        match_count: 30,
        p_university: ctx.university.id,
      });
      const passages = buildContext(rows ?? []);
      if (!passages) return { ok: true, data: { passages: "", note: "nothing found in the knowledge base" } };
      return {
        ok: true,
        data: { passages },
        card: { kind: "knowledge", title: t(ctx, "بحثت في دليل إعادة التدوير", "Checked the recycling guide") },
      };
    }),
};

type Location = { id: string; name: string; kind: string; materials: string[]; lat: number | null; lng: number | null };

export const findDropOff: Tool = {
  name: "find_drop_off",
  roles: ["student", "faculty", "staff", "facilities", "admin"],
  declaration: {
    name: "find_drop_off",
    description:
      "Find where on campus to take a material (e.g. hazardous for batteries and e-waste, glass) or list bin stations. Also returns location ids for other tools.",
    parameters: {
      type: "OBJECT",
      properties: { material: { type: "STRING", description: "plastic | paper | metal | glass | organic | hazardous | general | any" } },
      required: ["material"],
    },
  },
  run: (args, ctx) =>
    guarded(async () => {
      const material = str(args.material, 30).toLowerCase() || "any";
      const all = await restGet<Location[]>(ctx.jwt, "locations?select=id,name,kind,materials,lat,lng&order=name");
      const hits = material === "any" ? all : all.filter((l) => l.materials.includes(material));
      return {
        ok: true,
        data: hits,
        card: {
          kind: "dropoff",
          title: hits.length
            ? t(ctx, `${hits.length} مكان مناسب`, `${hits.length} matching places`)
            : t(ctx, "لا يوجد مكان مسجّل لهذه المادة", "No place registered for this material"),
          detail: hits.slice(0, 3).map((h) => h.name).join(" • "),
          data: hits,
        },
      };
    }),
};

type Impact = { items: number; est_kg: number; est_co2e_kg: number; points: number; correct_pct: number; streak_days: number };

export const getMyImpact: Tool = {
  name: "get_my_impact",
  roles: ["student", "faculty", "staff", "facilities", "admin"],
  declaration: {
    name: "get_my_impact",
    description: "The user's own totals: items recycled, estimated kg and kg CO2e saved, points, correct-sorting %, streak.",
    parameters: { type: "OBJECT", properties: {} },
  },
  run: (_args, ctx) =>
    guarded(async () => {
      const [me] = await restGet<Impact[]>(ctx.jwt, "my_impact?select=*");
      const d = me ?? { items: 0, est_kg: 0, est_co2e_kg: 0, points: 0, correct_pct: 0, streak_days: 0 };
      return {
        ok: true,
        data: d,
        card: {
          kind: "impact",
          title: t(ctx, `${d.points} نقطة • ${d.items} غرض`, `${d.points} points • ${d.items} items`),
          detail: t(
            ctx,
            `≈ ${Number(d.est_co2e_kg).toFixed(2)} كغ CO₂e (تقديري) • فرز صحيح ${d.correct_pct}% • ${d.streak_days} يوم متتالي`,
            `≈ ${Number(d.est_co2e_kg).toFixed(2)} kg CO₂e (estimate) • ${d.correct_pct}% correct • ${d.streak_days}-day streak`,
          ),
          data: d,
        },
      };
    }),
};

type Row = { faculty: string; points: number; items: number; members: number };

export const getLeaderboard: Tool = {
  name: "get_leaderboard",
  roles: ["student", "faculty", "staff", "facilities", "admin"],
  declaration: {
    name: "get_leaderboard",
    description: "Ranking of faculties/colleges at this university by recycling points in the last 30 days.",
    parameters: { type: "OBJECT", properties: {} },
  },
  run: (_args, ctx) =>
    guarded(async () => {
      const rows = await rpcAsUser<Row[]>(ctx.jwt, "faculty_leaderboard", { p_university: ctx.university.id });
      return {
        ok: true,
        data: rows,
        card: {
          kind: "leaderboard",
          title: t(ctx, "ترتيب الكليات (30 يوم)", "Faculty ranking (30 days)"),
          detail: rows.slice(0, 3).map((r, i) => `${i + 1}. ${r.faculty} (${r.points})`).join(" • "),
          data: rows,
        },
      };
    }),
};
