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

test('logging an item flies it into the campus and shows +10', async () => {
  const { page, context } = await openAgent({
    profile: profile(),
    agent: () => [200, { reply: 'Nice!', conversationId: 'c1', actions: [
      { kind: 'logged', title: 'Logged 1 × Plastic bottle', detail: 'Correctly sorted', points: 10, location_id: 'l1' },
    ] }],
  });
  await page.locator('.campus-agent .campus-fallback .building').first().waitFor();
  await page.getByPlaceholder(/message/i).fill('bottle');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.locator('.campus-agent .flight').waitFor();
  assert.equal(await page.locator('.campus-agent .flight .flight-points').textContent(), '+10');
  await page.locator('.campus-agent .flight').waitFor({ state: 'detached', timeout: 5000 });
  await context.close();
});

test('a report from the agent puts a warning pin on the campus', async () => {
  const { page, context } = await openAgent({
    profile: profile(),
    snapshot: { university: {}, locations: [{ id: 'l2', name: 'Lobby', kind: 'bin_station', faculty: 'Business', lat: null, lng: null }],
      faculties: [], events_7d: [], open_reports: [] },
    agent: () => [200, { reply: 'Reported.', conversationId: 'c1', actions: [{ kind: 'report', title: 'Report sent to facilities', location_id: 'l2' }] }],
  });
  await page.locator('.campus-agent .campus-fallback .building').first().waitFor();
  assert.equal(await page.locator('.campus-agent .pin.warn').count(), 0);
  await page.getByPlaceholder(/message/i).fill('the lobby bin is full');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.locator('.campus-agent .pin.warn').waitFor();
  await context.close();
});

test('the chat sheet expands to show history and collapses back', async () => {
  const { page, context } = await openAgent({
    profile: profile(),
    agent: (body) => [200, { reply: `Reply to ${body.message}`, conversationId: 'c1', actions: [] }],
  });
  const toggle = page.getByRole('button', { name: /expand chat/i });
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  for (const m of ['one', 'two', 'three']) {
    await page.getByPlaceholder(/message/i).fill(m);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText(`Reply to ${m}`).waitFor();
  }
  // collapsed: only the latest exchange is shown
  assert.equal(await page.getByText('Reply to one').isVisible(), false);
  await toggle.click();
  const collapse = page.getByRole('button', { name: /collapse chat/i });
  assert.equal(await collapse.getAttribute('aria-expanded'), 'true');
  await page.getByText('Reply to one').waitFor();
  await collapse.click();
  await page.getByRole('button', { name: /expand chat/i }).waitFor();
  await context.close();
});

test('the top bar shows my points and adds new ones', async () => {
  const { page, context } = await openAgent({
    profile: profile(),
    impact: { items: 12, est_kg: 0.3, est_co2e_kg: 0.4, points: 120, correct_pct: 90, streak_days: 2, verified_items: 12 },
    agent: () => [200, { reply: 'Nice!', conversationId: 'c1', actions: [{ kind: 'logged', title: 'Logged', points: 10 }] }],
  });
  const chip = page.locator('.points-chip');
  await chip.getByText('120').waitFor();
  await page.getByPlaceholder(/message/i).fill('bottle');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await chip.getByText('130').waitFor();
  await context.close();
});

test('on a 360px phone in Arabic the expanded chat never scrolls sideways', async () => {
  const long = 'هذه رسالة طويلة جداً '.repeat(30) + 'https://example.com/' + 'a'.repeat(120);
  const { page, context } = await openApp(browser, {
    profile: profile(),
    agent: () => [200, { reply: long, conversationId: 'c1', actions: [{ kind: 'logged', title: 'سجّلت 1 × عبوة بلاستيك طويلة الاسم جداً جداً', detail: long.slice(0, 200), points: 10 }] }],
  }, { lang: 'ar' });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByRole('button', { name: /تحدث مع الإيجنت/ }).first().click();
  await page.getByPlaceholder(/رسالتك/).fill('رميت عبوة');
  await page.getByRole('button', { name: 'إرسال', exact: true }).click();
  await page.locator('.action-card').waitFor();
  await page.getByRole('button', { name: /توسيع المحادثة/ }).click();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(width <= 360, `page is ${width}px wide`);
  await context.close();
});

test('"Your week" replays the last 7 days on the campus and sums them up', async () => {
  const { page, context } = await openAgent({ profile: profile() });
  await page.locator('.campus-agent .campus-fallback .building').first().waitFor();
  await page.clock.install();
  await page.getByRole('button', { name: 'Your week' }).click();
  const replay = page.getByRole('dialog', { name: 'Your week' });
  await replay.waitFor();
  await page.clock.runFor(1000);
  await replay.locator('.replay-day').waitFor();
  await page.clock.runFor(21000);
  await replay.getByText('2 items').waitFor();
  await replay.getByText('50% correctly sorted').waitFor();
  await replay.getByRole('button', { name: 'Close' }).click();
  await replay.waitFor({ state: 'detached' });
  await page.getByPlaceholder(/message/i).waitFor();
  await context.close();
});

test('"Your week" with no activity says so', async () => {
  const { page, context } = await openAgent({
    profile: profile(),
    snapshot: { university: {}, locations: [{ id: 'l1', name: 'A', kind: 'bin_station', faculty: 'Engineering', lat: null, lng: null }], faculties: [], events_7d: [], open_reports: [] },
  });
  await page.locator('.campus-agent .campus-fallback .building').first().waitFor();
  await page.getByRole('button', { name: 'Your week' }).click();
  await page.getByText('No activity this week yet').waitFor();
  await context.close();
});
