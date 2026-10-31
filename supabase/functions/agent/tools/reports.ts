// Bin problems: report (everyone), list and resolve (facilities/admin), photo audit (everyone).
import { generate, partsText } from "../../_shared/gemini.ts";
import { restGet, serviceRpc } from "../../_shared/supabase.ts";
import type { Tool, ToolContext } from "../types.ts";
import { CATEGORIES } from "../types.ts";
import { binsText, fail, guarded, imageProblem, isUuid, str, t } from "./util.ts";

const ISSUES = ["full", "contaminated", "damaged", "missing"] as const;
export const CONTAMINATION_THRESHOLD = 25;

type Filed = { report_id: string; duplicate: boolean };

async function file(ctx: ToolContext, location: string, issue: string, note: string, pct: number | null): Promise<Filed> {
  return await serviceRpc<Filed>("file_bin_report", {
    p_user: ctx.userId,
    p_location: location,
    p_issue: issue,
    p_note: note || null,
    p_contamination_pct: pct,
  });
}

export const reportBinIssue: Tool = {
  name: "report_bin_issue",
  roles: ["student", "faculty", "staff", "facilities", "admin"],
  declaration: {
    name: "report_bin_issue",
    description: "Send a problem with a bin (full, contaminated with wrong items, damaged, missing) to the facilities team.",
    parameters: {
      type: "OBJECT",
      properties: {
        location_id: { type: "STRING", description: "Location id of the bin station" },
        issue: { type: "STRING", enum: [...ISSUES] },
        note: { type: "STRING", description: "Short description" },
      },
      required: ["location_id", "issue"],
    },
  },
  run: (args, ctx) =>
    guarded(async () => {
      if (!isUuid(args.location_id)) return fail("invalid_location");
      const issue = String(args.issue ?? "");
      if (!(ISSUES as readonly string[]).includes(issue)) return fail("invalid_issue");
      const r = await file(ctx, args.location_id, issue, str(args.note, 500), null);
      return {
        ok: true,
        data: r,
        card: {
          kind: "report",
          title: r.duplicate
            ? t(ctx, "البلاغ موجود أصلاً عند فريق المرافق", "Already reported to facilities")
            : t(ctx, "أرسلت بلاغاً لفريق المرافق", "Report sent to facilities"),
          detail: issue,
        },
      };
    }),
};

const AUDIT_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, category: { type: "STRING", enum: [...CATEGORIES] }, belongs: { type: "BOOLEAN" } },
        required: ["name", "category", "belongs"],
      },
    },
    contamination_pct: { type: "NUMBER" },
    summary: { type: "STRING" },
  },
  required: ["items", "contamination_pct", "summary"],
};

export const auditBinPhoto: Tool = {
  name: "audit_bin_photo",
  roles: ["student", "faculty", "staff", "facilities", "admin"],
  declaration: {
    name: "audit_bin_photo",
    description:
      "Audit a photo of an OPEN BIN (many items): list visible items, estimate the share that does not belong, and automatically report the bin when contamination is 25% or more.",
    parameters: {
      type: "OBJECT",
      properties: {
        bin: { type: "STRING", description: "Bin id the photo shows, if known" },
        location_id: { type: "STRING", description: "Location id of the bin station, if known" },
      },
    },
  },
  run: (args, ctx) =>
    guarded(async () => {
      const problem = imageProblem(ctx);
      if (problem) return fail(problem);
      const location = isUuid(args.location_id) ? args.location_id : null;
      const bin = str(args.bin, 40);
      const language = ctx.lang === "en" ? "English" : "Arabic";
      const prompt = `Audit this photo of an open recycling bin at ${ctx.university.name}.
${bin ? `This is the "${bin}" bin.` : "Infer which bin it is from its contents and colour."}
Bins at this university:
${binsText(ctx)}
Rules: ${ctx.university.sorting_rules || "none provided"}
List the visible items, mark belongs=false for items that do not belong in this bin, and estimate contamination_pct (0-100) as the share of visible items that do not belong. Write "summary" in ${language}, one sentence.`;
      const { parts } = await generate({
        system: "You audit bin contents from photos. Answer with JSON only.",
        contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: ctx.image!.mimeType, data: ctx.image!.data } }] }],
        json: true,
        schema: AUDIT_SCHEMA,
        timeoutMs: 40_000,
      });
      const raw = JSON.parse(partsText(parts).replace(/^```(?:json)?\s*|\s*```$/g, ""));
      let pct = Number(raw.contamination_pct);
      if (!Number.isFinite(pct)) pct = 0;
      pct = Math.round(Math.min(100, Math.max(0, pct)));
      const items = Array.isArray(raw.items) ? raw.items.slice(0, 30) : [];
      const summary = str(raw.summary, 300);

      let report: Filed | null = null;
      if (location && pct >= CONTAMINATION_THRESHOLD) {
        report = await file(ctx, location, "contaminated", summary, pct);
      }
      const reported = report
        ? t(ctx, " — أرسلت بلاغاً لفريق المرافق", " — reported to facilities")
        : pct >= CONTAMINATION_THRESHOLD && !location
        ? t(ctx, " — حدّد مكان الحاوية لأرسل بلاغاً", " — tell me where the bin is to report it")
        : "";
      return {
        ok: true,
        data: { items, contamination_pct: pct, summary, report },
        card: {
          kind: "audit",
          title: t(ctx, `فحص الحاوية: ${pct}% مفروز غلط`, `Bin audit: ${pct}% wrong items`),
          detail: summary + reported,
          data: { contamination_pct: pct, items },
        },
      };
    }),
};

type ReportRow = { id: string; issue: string; note: string | null; contamination_pct: number | null; created_at: string; locations: { name: string } | null };

export const listOpenReports: Tool = {
  name: "list_open_reports",
  roles: ["facilities", "admin"],
  declaration: {
    name: "list_open_reports",
    description: "List open bin reports at this university, most urgent first (contaminated with high %, then oldest).",
    parameters: { type: "OBJECT", properties: {} },
  },
  run: (_args, ctx) =>
    guarded(async () => {
      const rows = await restGet<ReportRow[]>(
        ctx.jwt,
        "bin_reports?status=eq.open&select=id,issue,note,contamination_pct,created_at,locations(name)&order=created_at.asc&limit=30",
      );
      const ranked = [...rows].sort((a, b) => (b.contamination_pct ?? 0) - (a.contamination_pct ?? 0));
      return {
        ok: true,
        data: ranked,
        card: { kind: "reports", title: t(ctx, `${ranked.length} بلاغ مفتوح`, `${ranked.length} open reports`), data: ranked },
      };
    }),
};

export const resolveReport: Tool = {
  name: "resolve_report",
  roles: ["facilities", "admin"],
  declaration: {
    name: "resolve_report",
    description: "Mark an open bin report as resolved (bin emptied, cleaned or fixed).",
    parameters: {
      type: "OBJECT",
      properties: { report_id: { type: "STRING" }, note: { type: "STRING" } },
      required: ["report_id"],
    },
  },
  run: (args, ctx) =>
    guarded(async () => {
      if (!isUuid(args.report_id)) return fail("report_not_found");
      const r = await serviceRpc("resolve_bin_report", { p_user: ctx.userId, p_report: args.report_id, p_note: str(args.note, 500) || null });
      return { ok: true, data: r, card: { kind: "resolved", title: t(ctx, "تم إغلاق البلاغ ✔", "Report resolved ✔") } };
    }),
};
