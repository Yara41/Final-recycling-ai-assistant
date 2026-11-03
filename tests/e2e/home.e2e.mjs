import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openApp, startServer } from './harness.mjs';

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); server?.kill(); });

const live = { query: '?3d=1', snap: true, reducedMotion: 'no-preference' };
async function toScreen(page, n) {
  await page.evaluate((n) => window.scrollTo(0, n * innerHeight), n);
  await page.waitForFunction((n) => document.querySelector('.home')?.dataset.screen === String(n), n);
}

test('home has five screens with the approved headline', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'ar' });
  assert.match(await page.getByRole('heading', { level: 1 }).textContent(), /تتنفّس/);
  assert.equal(await page.locator('section[data-screen]').count(), 5);
  await context.close();
});

test('nothing covers the hero headline', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'ar', ...live });
  await page.locator('.scene-wrap[data-ready="true"]').waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.snap-card').evaluate((el) => getComputedStyle(el).visibility), 'hidden');
  await context.close();
});

test('screen 2 shows the photo being recognised', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'ar', ...live });
  await page.locator('.scene-wrap[data-ready="true"]').waitFor({ timeout: 60000 });
  await toScreen(page, 1);
  await page.locator('.snap-card').waitFor({ state: 'visible' });
  await page.getByText('عبوة بلاستيكية ← الحاوية الزرقاء').waitFor();
  await context.close();
});

test('screen 3 drops the bottle in the bin and shows +10', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'en', ...live });
  await page.locator('.scene-wrap[data-ready="true"]').waitFor({ timeout: 60000 });
  await toScreen(page, 2);
  await page.locator('.story-tag.plus').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.story-tag.plus').textContent(), '+10');
  await context.close();
});

test('screen 4 shows the report tag on the full bin', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'ar', ...live });
  await page.locator('.scene-wrap[data-ready="true"]').waitFor({ timeout: 60000 });
  await toScreen(page, 3);
  await page.locator('.story-tag.warn').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.story-tag.warn').textContent(), 'تم إرسال البلاغ ✓');
  await context.close();
});

test('the last screen opens the agent and the game', async () => {
  const { page, context } = await openApp(browser, { profile: null }, { lang: 'en' });
  await toScreen(page, 4);
  await page.getByRole('button', { name: 'Play the sorting game' }).click();
  await page.locator('.learn').waitFor();
  await page.getByRole('navigation').getByRole('button', { name: 'Home' }).click();
  await toScreen(page, 4);
  await page.getByRole('button', { name: 'Talk to the agent' }).click();
  await page.getByRole('button', { name: 'EcoWaste Demo University' }).waitFor();
  await context.close();
});

test('the progress rail marks the current screen', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'en' });
  await toScreen(page, 3);
  assert.equal(await page.locator('.rail i.on').count(), 1);
  assert.equal(await page.locator('.rail i').nth(3).getAttribute('class'), 'on');
  await context.close();
});

for (const [w, lang] of [[360, 'ar'], [390, 'ar'], [1366, 'ar'], [360, 'en'], [1366, 'en']]) {
  test(`no horizontal scroll at ${w}px (${lang})`, async () => {
    const { page, context } = await openApp(browser, {}, { lang, viewport: { width: w, height: 800 } });
    for (const n of [0, 2, 4]) {
      await toScreen(page, n);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(sw <= w, `screen ${n}: page is ${sw}px wide`);
    }
    await context.close();
  });
}

for (const lang of ['ar', 'en']) {
  test(`every top bar button fits a 360px phone (${lang})`, async () => {
    const { page, context } = await openApp(browser, {}, { lang, viewport: { width: 360, height: 760 } });
    const boxes = await page.locator('.topbar button:visible').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.height]; }));
    assert.ok(boxes.length >= 4);
    for (const [l, r, h] of boxes) { assert.ok(l >= 0 && r <= 360, `button at ${l}..${r}`); assert.ok(h <= 48, `button wraps (${h}px tall)`); }
    await context.close();
  });
}
