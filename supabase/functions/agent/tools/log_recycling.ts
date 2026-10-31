import { serviceRpc } from "../../_shared/supabase.ts";
import type { Tool } from "../types.ts";
import { CATEGORIES } from "../types.ts";
import { binLabel, fail, guarded, isUuid, str, t } from "./util.ts";

type Logged = { event_id: string; correct_bin: boolean; points: number; est_kg: number; est_co2e_kg: number; correct_bins: string[] };

export const logRecycling: Tool = {
  name: "log_recycling",
  roles: ["student", "faculty", "staff", "facilities", "admin"],
  declaration: {
    name: "log_recycling",
    description:
      "Record that the user disposed of an item (they said they threw/recycled it, or confirmed after a photo). Awards points when the bin is correct.",
    parameters: {
      type: "OBJECT",
      properties: {
        item: { type: "STRING", description: "Short item name, e.g. 'Plastic water bottle'" },
        category: { type: "STRING", enum: [...CATEGORIES] },
        bin: { type: "STRING", description: "Id of the bin the user used (one of the university's bin ids)" },
        quantity: { type: "INTEGER", description: "How many items, 1-50. Default 1." },
        location_id: { type: "STRING", description: "Optional location id from find_drop_off or the known locations" },
      },
      required: ["item", "category", "bin"],
    },
  },
  run: (args, ctx) =>
    guarded(async () => {
      const item = str(args.item, 120);
      const category = String(args.category ?? "");
      const bin = String(args.bin ?? "");
      const quantity = args.quantity === undefined ? 1 : Number(args.quantity);
      const location = args.location_id ?? null;
      if (!item) return fail("missing_item");
      if (!(CATEGORIES as readonly string[]).includes(category)) return fail("invalid_category");
      if (!ctx.university.bins.some((b) => b.id === bin)) return fail("invalid_bin");
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) return fail("invalid_quantity");
      if (location !== null && !isUuid(location)) return fail("invalid_location");

      const r = await serviceRpc<Logged>("log_recycling_event", {
        p_user: ctx.userId,
        p_item: item,
        p_category: category,
        p_bin: bin,
        p_quantity: quantity,
        p_location: location,
        p_source: ctx.image ? "photo" : "chat",
      });
      const right = (r.correct_bins ?? []).map((id) => binLabel(ctx, id)).join(" / ");
      return {
        ok: true,
        data: r,
        card: {
          kind: "logged",
          title: t(ctx, `سجّلت ${quantity} × ${item}`, `Logged ${quantity} × ${item}`),
          detail: r.correct_bin
            ? t(ctx, `فرز صحيح ✔ وفّرت تقريباً ${Number(r.est_co2e_kg).toFixed(2)} كغ CO₂e (تقديري)`, `Correctly sorted ✔ about ${Number(r.est_co2e_kg).toFixed(2)} kg CO₂e saved (estimate)`)
            : t(ctx, `الحاوية الصحيحة: ${right}`, `Right bin: ${right}`),
          points: r.points,
        },
      };
    }),
};
