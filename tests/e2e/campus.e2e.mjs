import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openApp, startServer } from './harness.mjs';

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); server?.kill(); });

test('home shows the headline and a campus fallback before 3D', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'ar' });
  await page.getByRole('heading', { level: 1 }).waitFor();
  assert.match(await page.getByRole('heading', { level: 1 }).textContent(), /جامعتك/);
  await page.locator('.campus-fallback').first().waitFor();
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
  await page.getByRole('navigation').getByRole('button', { name: 'Learn' }).click();
  await page.getByRole('heading', { name: /sort it right/i }).waitFor();
  await page.getByRole('navigation').getByRole('button', { name: 'Agent' }).click();
  await page.getByRole('button', { name: 'EcoWaste Demo University' }).waitFor();
  await context.close();
});

test('the illustrated campus draws one building per faculty from the snapshot', async () => {
  const { page, context } = await openApp(browser, {}, { lang: 'en' });
  await page.locator('.campus-fallback .building').first().waitFor();
  assert.equal(await page.locator('.campus-fallback .building').count(), 4); // Engineering, Business, Medicine, Campus
  assert.ok(await page.locator('.campus-fallback .tree').count() > 0);
  assert.equal(await page.locator('.campus-fallback .pin.warn').count(), 1);
  await context.close();
});

test('a failed snapshot shows the offline chip', async () => {
  const { page, context } = await openApp(browser, { snapshotError: true }, { lang: 'en' });
  await page.getByText('Offline').waitFor();
  await page.locator('.campus-fallback').first().waitFor();
  await context.close();
});

test('a university with no buildings says so', async () => {
  const { page, context } = await openApp(browser, { snapshot: { university: {}, locations: [], faculties: [], events_7d: [], open_reports: [] } }, { lang: 'en' });
  await page.getByText('No buildings yet').waitFor();
  await context.close();
});
