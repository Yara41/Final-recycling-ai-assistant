import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openApp, profile, startServer } from './harness.mjs';

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); server?.kill(); });

async function openAgent(backend, opts) {
  const app = await openApp(browser, backend, opts);
  await app.page.getByRole('button', { name: /talk to the agent/i }).first().click();
  return app;
}

test('first visit shows onboarding, then the chat', async () => {
  const { page, state, context } = await openAgent({ profile: null });
  await page.getByRole('button', { name: 'EcoWaste Demo University' }).click();
  await page.getByRole('button', { name: /^faculty member$/i }).click();
  await page.getByRole('button', { name: /start/i }).click();
  await page.getByPlaceholder(/message/i).waitFor();
  const call = state.rpc.find(([fn]) => fn === 'create_profile');
  assert.equal(call[1].p_role, 'faculty');
  await context.close();
});

test('a logged action shows a card with a points badge', async () => {
  const { page, state, context } = await openAgent({
    profile: profile(),
    agent: () => [200, { reply: 'Great job!', conversationId: 'c1', actions: [
      { kind: 'logged', title: 'Logged 1 × Plastic bottle', detail: 'Correctly sorted', points: 10 },
      { kind: 'knowledge', title: 'Checked the recycling guide', points: 0 },
    ] }],
  });
  await page.getByPlaceholder(/message/i).fill('I threw a plastic bottle in the plastic bin');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByText('Logged 1 × Plastic bottle').waitFor();
  assert.equal(await page.locator('.action-card .points-badge').count(), 1);
  assert.equal(await page.locator('.action-card .points-badge').first().textContent(), '+10');
  await page.getByText('Great job!').waitFor();
  assert.equal(state.agentCalls[0].lang, 'en');
  await context.close();
});

test('needs_onboarding from the agent returns to onboarding', async () => {
  const { page, context } = await openAgent({
    profile: profile(),
    agent: (_b, state) => { state.profile = null; return [409, { error: 'x', code: 'needs_onboarding' }]; },
  });
  await page.getByPlaceholder(/message/i).fill('hello');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'EcoWaste Demo University' }).waitFor();
  await context.close();
});

test('voice button is hidden when the browser has no speech recognition', async () => {
  const withVoice = await openAgent({ profile: profile() }, { speech: true });
  await withVoice.page.getByPlaceholder(/message/i).waitFor();
  assert.equal(await withVoice.page.getByRole('button', { name: /voice/i }).count(), 1);
  await withVoice.context.close();
  const noVoice = await openAgent({ profile: profile() }, { speech: false });
  await noVoice.page.getByPlaceholder(/message/i).waitFor();
  assert.equal(await noVoice.page.getByRole('button', { name: /voice/i }).count(), 0);
  await noVoice.context.close();
});

test('a photo is resized and sent as JPEG', async () => {
  const { page, state, context } = await openAgent({ profile: profile() });
  await page.getByPlaceholder(/message/i).waitFor();
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
    c.getContext('2d').fillRect(0, 0, 3000, 2000);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForFunction(() => document.querySelectorAll('.chat-user').length > 0);
  await page.waitForTimeout(300);
  assert.equal(state.agentCalls[0].mimeType, 'image/jpeg');
  const dims = await page.evaluate((b64) => new Promise((r) => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.src = 'data:image/jpeg;base64,' + b64; }), state.agentCalls[0].image);
  assert.deepEqual(dims, [1024, 683]);
  await context.close();
});

test('the "agent is working" text stays on one line (Arabic, RTL)', async () => {
  const { page, context } = await openApp(browser, { profile: profile() }, { lang: 'ar' });
  await page.setViewportSize({ width: 1530, height: 800 });
  await page.getByRole('button', { name: /تحدث مع الإيجنت/ }).first().click();
  await page.route('**/functions/v1/agent', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'تمام', actions: [], conversationId: 'c1' }) });
  });
  await page.getByPlaceholder(/رسالتك/).fill('رميت عبوة ماء في حاوية البلاستيك');
  await page.getByRole('button', { name: 'إرسال', exact: true }).click();
  const box = await page.locator('.loading-text').boundingBox();
  assert.ok(box && box.height < 30, `loading text height ${box?.height}`);
  await context.close();
});

test('My impact shows how many items were verified by photo', async () => {
  const { page, context } = await openAgent({
    profile: profile(),
    impact: { items: 5, est_kg: 0.1, est_co2e_kg: 0.2, points: 30, correct_pct: 100, streak_days: 1, verified_items: 3 },
  });
  await page.getByRole('tab', { name: 'My impact' }).click();
  await page.getByText(/verified by photo/i).waitFor();
  assert.equal(await page.locator('.stat-tile', { hasText: /verified by photo/i }).locator('strong').textContent(), '3');
  await context.close();
});
