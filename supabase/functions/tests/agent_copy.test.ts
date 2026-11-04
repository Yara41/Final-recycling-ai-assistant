// The agent's own card text is shown in the chat, so its Arabic must be Modern Standard Arabic too.
import { assertEquals } from "jsr:@std/assert";

const DIALECT = /الإيجنت|إيجنت|الجاية|غلط|وين|هيك|هلق|بدك|مليان|كتير|منيح/;
const FILES = ["admin.ts", "classify_item.ts", "community.ts", "log_recycling.ts", "reports.ts"];

Deno.test("agent card text has no dialect", async () => {
  const bad: string[] = [];
  for (const f of FILES) {
    const src = await Deno.readTextFile(new URL(`../agent/tools/${f}`, import.meta.url));
    src.split("\n").forEach((line, i) => { if (DIALECT.test(line)) bad.push(`${f}:${i + 1}`); });
  }
  for (const f of ["../agent/loop.ts", "../agent/handler.ts"]) {
    const src = await Deno.readTextFile(new URL(f, import.meta.url));
    src.split("\n").forEach((line, i) => { if (DIALECT.test(line)) bad.push(`${f}:${i + 1}`); });
  }
  assertEquals(bad, []);
});

// "30 يوم" or "${n} بلاغ" break Arabic number agreement; card titles avoid a bare number before a singular noun.
const BARE_COUNT = /(\$\{[^}]+\}|\d+) (يوم|مكان|بلاغ|غرض|نقطة|مستخدم)(?![اً])/;

Deno.test("agent card text keeps Arabic number agreement", async () => {
  const bad: string[] = [];
  for (const f of FILES) {
    const src = await Deno.readTextFile(new URL(`../agent/tools/${f}`, import.meta.url));
    src.split("\n").forEach((line, i) => { if (BARE_COUNT.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`); });
  }
  assertEquals(bad, []);
});
