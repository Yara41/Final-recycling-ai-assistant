import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openApp, startServer } from './harness.mjs';

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); server?.kill(); });

const ANSWERS = ['plastic', 'general', 'metal', 'general', 'paper', 'general', 'paper', 'general'];
const BIN_AR = { general: 'نفايات عامة', paper: 'ورق وكرتون', plastic: 'بلاستيك', metal: 'معادن' };

async function openGame(lang = 'ar', opts = {}) {
  const app = await openApp(browser, {}, { lang, ...opts });
  await app.page.getByRole('navigation').getByRole('button', { name: lang === 'ar' ? 'لعبة الفرز' : 'Sorting game' }).click();
  await app.page.locator('.game').waitFor();
  return app;
}
async function waitRound(page, n) {
  await page.waitForFunction((n) => document.querySelector('.game')?.dataset.round === String(n), n, { timeout: 15000 });
}

test('play a full game with every answer right', async () => {
  const { page, context } = await openGame('ar');
  await page.getByText('الجولة ١ من ٨').waitFor();
  for (let i = 0; i < 8; i++) {
    await waitRound(page, i);
    await page.locator('.game-bins').getByRole('button', { name: BIN_AR[ANSWERS[i]] }).click();
  }
  await page.getByRole('heading', { name: 'النتيجة ٨ من ٨' }).waitFor({ timeout: 20000 });
  await context.close();
});

test('a wrong answer shows the right bin and the rule', async () => {
  const { page, context } = await openGame('ar');
  await page.locator('.game-bins').getByRole('button', { name: 'معادن' }).click();
  const status = page.getByRole('status');
  await status.getByText('الحاوية الصحيحة: بلاستيك').waitFor();
  await status.getByText('العبوات البلاستيكية النظيفة تُعاد تدويرها في حاوية البلاستيك.').waitFor();
  await page.locator('.game-tag.bad').waitFor({ state: 'attached' });
  await context.close();
});

test('play again starts over at round one', async () => {
  const { page, context } = await openGame('en');
  for (let i = 0; i < 8; i++) {
    await waitRound(page, i);
    await page.locator('.game-bins button').first().click();
  }
  await page.getByRole('button', { name: 'Play again' }).click();
  await page.getByText('Round 1 of 8').waitFor();
  await context.close();
});

test('the bin buttons line up with the bins from left to right', async () => {
  const { page, context } = await openGame('ar');
  const names = await page.locator('.game-bins button').allTextContents();
  const xs = await page.locator('.game-bins button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().left));
  assert.deepEqual(names, ['نفايات عامة', 'ورق وكرتون', 'بلاستيك', 'معادن']);
  assert.ok(xs[0] < xs[1] && xs[1] < xs[2] && xs[2] < xs[3]);
  await context.close();
});

test('dragging the item onto its bin answers', async () => {
  const { page, context } = await openGame('en', { query: '?3d=1', snap: true, reducedMotion: 'no-preference' });
  await page.locator('.scene-wrap[data-ready="true"]').waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  const zone = await page.locator('.game-drop[data-bin="plastic"]').boundingBox();
  assert.ok(zone, 'there is a drop zone over the plastic bin');
  const target = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
  const card = await page.locator('.game-item').boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
  await page.locator('.game-tag.good').waitFor({ state: 'attached' });
  assert.equal(await page.locator('.game-tag.good').textContent(), '+10');
  await context.close();
});

test('the game fits a 360px phone without sideways scroll', async () => {
  const { page, context } = await openGame('ar', { viewport: { width: 360, height: 740 } });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 360);
  const box = await page.locator('.game-bins').boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 360);
  await context.close();
});
