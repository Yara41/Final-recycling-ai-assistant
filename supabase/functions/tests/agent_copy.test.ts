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
