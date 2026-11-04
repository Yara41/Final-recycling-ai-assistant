// Photographs every page in every scene phase at phone and desktop size, for a visual review before release.
// Run after `npm run build`:  node scripts/review-shots.mjs <outDir> [phases]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, openApp, profile, startServer } from '../tests/e2e/harness.mjs';

const out = process.argv[2] ?? 'review-shots';
const phases = (process.argv[3] ?? 'dawn,day,sunset,night').split(',');
mkdirSync(out, { recursive: true });
const SIZES = { phone: { width: 390, height: 844 }, wide: { width: 1366, height: 820 } };
const agent = () => [200, { reply: 'أحسنت. العبوات البلاستيكية النظيفة مكانها حاوية البلاستيك، وأضفت ١٠ نقاط إلى رصيدك ورصيد كليتك.', conversationId: 'c1', actions: [{ kind: 'logged', title: 'سُجّلت ١ × عبوة بلاستيكية', detail: 'فرز صحيح ✔ موثّقة بصورة', bin: 'plastic', points: 10 }] }];

const server = await startServer();
const browser = await launch();
const shot = (page, name) => page.screenshot({ path: join(out, `${name}.png`) });
try {
  for (const phase of phases) {
    for (const [size, viewport] of Object.entries(SIZES)) {
      const opts = { lang: 'ar', query: `?3d=1&sky=${phase}`, snap: true, reducedMotion: 'no-preference', viewport };
      let { page, context } = await openApp(browser, { profile: profile(), agent, impact: { points: 120 } }, opts);
      await page.locator('.scene-wrap[data-ready="true"]').waitFor({ timeout: 120000 });
      for (let s = 0; s < 5; s++) {
        await page.evaluate((s) => window.scrollTo(0, s * innerHeight), s);
        await page.waitForFunction((s) => document.querySelector('.home').dataset.screen === String(s), s);
        await page.waitForTimeout(1500);
        await shot(page, `${phase}-${size}-home${s}`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByRole('button', { name: /ابدأ مع الوكيل/ }).first().click();
      await page.locator('.campus-agent .scene-wrap[data-ready="true"]').waitFor({ timeout: 120000 });
      await page.waitForTimeout(1200);
      await shot(page, `${phase}-${size}-agent`);
      await page.getByPlaceholder(/رسالتك/).fill('رميت عبوة');
      await page.getByRole('button', { name: 'إرسال', exact: true }).click();
      await page.locator('.agent-tag.plus').waitFor({ state: 'visible' });
      await shot(page, `${phase}-${size}-agent-logged`);
      await context.close();

      ({ page, context } = await openApp(browser, {}, opts));
      await page.getByRole('navigation').getByRole('button', { name: 'لعبة الفرز' }).click();
      await page.locator('.game .scene-wrap[data-ready="true"]').waitFor({ timeout: 120000 });
      await page.waitForTimeout(1200);
      await shot(page, `${phase}-${size}-game`);
      for (let i = 0; i < 8; i++) {
        await page.waitForFunction((i) => document.querySelector('.game').dataset.round === String(i), i);
        await page.locator('.game-bins button').nth(i === 0 ? 3 : 0).click();
      }
      await page.locator('.game-end').waitFor({ timeout: 30000 });
      await shot(page, `${phase}-${size}-game-end`);
      await context.close();
      console.log(phase, size);
    }
  }
  const { page, context } = await openApp(browser, {}, { lang: 'en', query: '?3d=1&sky=day', snap: true, reducedMotion: 'no-preference', viewport: SIZES.phone });
  await page.locator('.scene-wrap[data-ready="true"]').waitFor({ timeout: 120000 });
  await shot(page, 'en-phone-home0');
  await context.close();
} finally {
  await browser.close();
  server.kill();
}
