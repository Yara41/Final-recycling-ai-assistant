import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openApp, startServer } from './harness.mjs';

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); server?.kill(); });

test('home shows the headline over the campus', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'ar' });
  assert.match(await page.getByRole('heading', { level: 1 }).textContent(), /جامعتك/);
  await page.locator('.campus').first().waitFor();
  await context.close();
});

test('language toggle switches direction to ltr and back', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'ar' });
  assert.equal(await page.locator('.site').getAttribute('dir'), 'rtl');
  await page.getByRole('button', { name: 'English' }).click();
  assert.equal(await page.locator('.site').getAttribute('dir'), 'ltr');
  assert.match(await page.getByRole('heading', { level: 1 }).textContent(), /campus/i);
  await page.getByRole('button', { name: 'العربية' }).click();
  assert.equal(await page.locator('.site').getAttribute('dir'), 'rtl');
  await context.close();
});

test('navigation reaches the agent and learn pages', async () => {
  const { page, context } = await openApp(browser, { profile: null }, { lang: 'en' });
  await page.getByRole('navigation').getByRole('button', { name: 'Sorting game' }).click();
  await page.getByRole('heading', { name: /where does it go/i }).waitFor();
  await page.getByRole('navigation').getByRole('button', { name: 'Agent' }).click();
  await page.getByRole('button', { name: 'EcoWaste Demo University' }).waitFor();
  await context.close();
});

test('the live scene mounts when forced', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'en', query: '?3d=1' });
  await page.locator('.campus[data-renderer="3d"] .scene-wrap[data-ready="true"] canvas').first().waitFor({ timeout: 60000 });
  await context.close();
});

test('losing the WebGL context shows the still image', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'en', query: '?3d=1' });
  const canvas = page.locator('.campus .scene-wrap[data-ready="true"] canvas').first();
  await canvas.waitFor({ timeout: 60000 });
  await canvas.evaluate((c) => c.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await page.locator('.campus[data-renderer="still"] img.campus-still').first().waitFor();
  assert.match(await page.locator('img.campus-still').first().getAttribute('src'), /^\/campus\/(dawn|day|sunset|night)-(wide|phone)\.webp$/);
  await context.close();
});

test('reduced motion shows the still image instead of the live scene', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'en', reducedMotion: 'reduce' });
  await page.locator('.campus[data-renderer="still"] img.campus-still').first().waitFor();
  assert.equal(await page.locator('.campus canvas').count(), 0);
  await context.close();
});

test('the still follows the scene time chosen with the clock button', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'en' });
  const clock = page.getByRole('button', { name: /scene time/i });
  for (let i = 0; i < 5 && (await page.locator('html').getAttribute('data-phase')) !== 'night'; i++) await clock.click();
  assert.equal(await page.locator('html').getAttribute('data-phase'), 'night');
  assert.ok(await page.locator('html').evaluate((h) => h.classList.contains('dark')));
  assert.match(await page.locator('img.campus-still').first().getAttribute('src'), /night/);
  await context.close();
});

test('a failed snapshot shows the offline chip and still draws a campus', async () => {
  const { page, context } = await openApp(browser, { snapshotError: true }, { lang: 'en' });
  await page.getByText('Offline').waitFor();
  await page.locator('.campus img.campus-still').first().waitFor();
  await context.close();
});

test('three.js stays out of the first download', async () => {
  const { readFile } = await import('node:fs/promises');
  const manifest = JSON.parse(await readFile(new URL('../../dist/.vite/manifest.json', import.meta.url), 'utf8'));
  const entry = Object.values(manifest).find((c) => c.isEntry);
  const initial = new Set();
  const walk = (key) => {
    if (initial.has(key)) return;
    initial.add(key);
    for (const k of manifest[key]?.imports ?? []) walk(k);
  };
  walk(Object.keys(manifest).find((k) => manifest[k] === entry));
  const files = [...initial].map((k) => `${k} ${manifest[k].file}`).join('\n');
  assert.doesNotMatch(files, /three|@react-three/i);
  assert.ok(Object.keys(manifest).some((k) => /scene\/Scene/.test(k)), 'the scene is its own chunk');
});
