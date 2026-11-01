import { generate, partsText } from "../../_shared/gemini.ts";
import { normalize } from "../../classify/handler.ts";
import type { Tool } from "../types.ts";
import { CATEGORIES } from "../types.ts";
import { binLabel, binsFor, binsText, fail, guarded, imageProblem, t } from "./util.ts";

const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_waste: { type: "BOOLEAN" },
    item: { type: "STRING" },
    category: { type: "STRING", enum: [...CATEGORIES] },
    recyclable: { type: "BOOLEAN" },
    tip: { type: "STRING" },
    confidence: { type: "NUMBER" },
    bin: { type: "STRING" },
  },
  required: ["is_waste", "item", "category", "recyclable", "tip", "confidence", "bin"],
};

export const classifyItem: Tool = {
  name: "classify_item",
  roles: ["student", "faculty", "staff", "facilities", "admin"],
  declaration: {
    name: "classify_item",
    description:
      "Identify the main waste item in the photo the user attached and say which of this university's bins it goes in. Use whenever a photo of a single item is attached.",
    parameters: { type: "OBJECT", properties: {} },
  },
  run: (_args, ctx) =>
    guarded(async () => {
      const problem = imageProblem(ctx);
      if (problem) return fail(problem);
      const language = ctx.lang === "en" ? "English" : "Arabic";
      const prompt = `You classify waste for ${ctx.university.name}. Identify the main item in the photo.
Bins at this university (use the bin id in "bin"):
${binsText(ctx)}
University sorting rules: ${ctx.university.sorting_rules || "none provided"}
Write "item" and "tip" in ${language}. If the photo is unclear, set a low confidence. If it is not waste, set is_waste=false.`;
      const { parts } = await generate({
        system: "You are a precise waste-sorting vision system. Answer with JSON only.",
        contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: ctx.image!.mimeType, data: ctx.image!.data } }] }],
        json: true,
        schema: SCHEMA,
        timeoutMs: 40_000,
      });
      const raw = JSON.parse(partsText(parts).replace(/^```(?:json)?\s*|\s*```$/g, ""));
      const base = normalize(raw, ctx.lang);
      const suggested = ctx.university.bins.some((b) => b.id === raw.bin) ? String(raw.bin) : binsFor(ctx, base.category)[0]?.id ?? "general";
      const data = { ...base, bin: suggested };
      return {
        ok: true,
        data,
        card: {
          kind: "classified",
          title: base.is_waste ? `${base.item} → ${binLabel(ctx, suggested)}` : t(ctx, "لم أجد نفاية واضحة في الصورة", "No clear waste item in the photo"),
          detail: base.tip,
          data,
        },
      };
    }),
};
