// Screenshots the site on real phone sizes and reports overlaps between text, the top bar and the scene cards.
// Run after `npm run build`:  node scripts/phone-audit.mjs <outDir>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { launch, openApp, profile, startServer } from '../tests/e2e/harness.mjs';

const { devices } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'phone-audit';
mkdirSync(out, { recursive: true });
const PHONES = { se: devices['iPhone SE'], i13: devices['iPhone 13'], max: devices['iPhone 15 Pro Max'], s8: devices['Galaxy S8'] };
const agent = () => [200, { reply: 'أحسنت.', conversationId: 'c1', actions: [{ kind: 'logged', title: 'سُجّلت عبوة', detail: '', bin: 'plastic', points: 10 }] }];

const server = await startServer();
const browser = await launch();
const report = [];
try {
  for (const [name, device] of Object.entries(PHONES)) {
    const opts = { lang: 'ar', query: '?3d=1&sky=day', snap: true, reducedMotion: 'no-preference', device };
    const { page, context } = await openApp(browser, { profile: profile(), agent, impact: { points: 120 } }, opts);
    await page.locator('.scene-wrap[data-ready="true"]').waitFor({ timeout: 120000 });
    for (let s = 0; s < 5; s++) {
      await page.evaluate((s) => window.scrollTo(0, s * innerHeight), s);
      await page.waitForTimeout(1200);
      const m = await page.evaluate((s) => {
        const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right) }; };
        const vis = (el) => el && getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0.05;
        const text = r(document.querySelector(`section[data-screen="${s}"] .screen-text`));
        const bar = r(document.querySelector('.topbar, header'));
        const card = vis(document.querySelector('.snap-card')) ? r(document.querySelector('.snap-card')) : null;
        const tags = [...document.querySelectorAll('.story-tag')].filter(vis).map(r);
        const hit = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
        return { vh: innerHeight, vw: innerWidth, sw: document.documentElement.scrollWidth, text, bar, card, cardHitsText: hit(card, text), barHitsText: hit(bar, text), tagHitsText: tags.some((t) => hit(t, text)) };
      }, s);
      report.push({ name, screen: s, ...m });
      await page.screenshot({ path: join(out, `${name}-home${s}.png`) });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: /ابدأ مع الوكيل/ }).first().click();
    await page.locator('.campus-agent .scene-wrap[data-ready="true"]').waitFor({ timeout: 120000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(out, `${name}-agent.png`) });
    await page.getByRole('navigation').getByRole('button', { name: 'لعبة الفرز' }).click();
    await page.locator('.game .scene-wrap[data-ready="true"]').waitFor({ timeout: 120000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(out, `${name}-game.png`) });
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(JSON.stringify(report.map((r) => [r.name, r.screen, `${r.vw}x${r.vh}`, r.sw > r.vw ? 'HSCROLL' : '', r.cardHitsText ? 'CARD/TEXT' : '', r.barHitsText ? 'BAR/TEXT' : '', r.tagHitsText ? 'TAG/TEXT' : '', JSON.stringify(r.text), JSON.stringify(r.card)].join(' '))).replace(/","/g, '"\n"'));
