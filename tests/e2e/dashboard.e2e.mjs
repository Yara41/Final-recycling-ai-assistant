import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openApp, profile, startServer } from './harness.mjs';

let server, browser;
before(async () => { server = await startServer(); browser = await launch(); });
after(async () => { await browser?.close(); server?.kill(); });

async function openAgent(backend, opts) {
  const app = await openApp(browser, backend, opts);
  await app.page.getByRole('button', { name: /ask the agent/i }).first().click();
  await app.page.getByRole('tab', { name: 'Agent' }).waitFor();
  return app;
}

test('a student sees My impact but not Reports or Campus', async () => {
  const { page, context } = await openAgent({ profile: profile('student') });
  assert.equal(await page.getByRole('tab', { name: 'My impact' }).count(), 1);
  assert.equal(await page.getByRole('tab', { name: 'Campus' }).count(), 0);
  assert.equal(await page.getByRole('tab', { name: 'Reports' }).count(), 0);
  await context.close();
});

test('My impact shows points, the estimate label and the faculty ranking', async () => {
  const { page, context } = await openAgent({
    profile: profile('student'),
    impact: { items: 12, est_kg: 0.4, est_co2e_kg: 1.25, points: 120, correct_pct: 83, streak_days: 3 },
    board: [{ faculty: 'Engineering', points: 300, items: 40, members: 2 }, { faculty: 'Arts', points: 120, items: 15, members: 2 }],
  });
  await page.getByRole('tab', { name: 'My impact' }).click();
  await page.locator('.stat-tile strong', { hasText: /^120$/ }).waitFor();
  await page.getByText(/estimate/i).first().waitFor();
  await page.getByText('Engineering').waitFor();
  await context.close();
});

test('the admin sees the latest weekly insight and campus numbers', async () => {
  const { page, context } = await openAgent({
    profile: profile('admin'),
    stats: { totals: { items: 230, correct_rate: 0.71, active_users: 6, est_co2e_kg: 4.2 }, top_missorted: [{ item: 'Chips bag', count: 21 }] },
    insights: [{ id: 'i1', report: 'Chips bags in Engineering are the main problem.', period_start: '2026-10-24', period_end: '2026-10-31', created_at: '2026-10-31T06:17:00Z' }],
  });
  await page.getByRole('tab', { name: 'Campus' }).click();
  await page.getByText('Chips bags in Engineering are the main problem.').waitFor();
  await page.getByText('230').waitFor();
  await page.getByText('Chips bag').first().waitFor();
  await context.close();
});

test('facilities resolve goes through the agent and removes the row', async () => {
  const reportId = '33333333-3333-4333-8333-333333333333';
  const { page, state, context } = await openAgent({
    profile: profile('facilities'),
    reports: [{ id: reportId, issue: 'contaminated', note: 'Chips bags', contamination_pct: 45, created_at: '2026-10-30T10:00:00Z', locations: { name: 'Engineering cafeteria bin station' } }],
    agent: () => [200, { reply: 'Done', actions: [{ kind: 'resolved', title: 'Report resolved ✔' }], conversationId: 'c1' }],
  });
  await page.getByRole('tab', { name: 'Reports' }).click();
  await page.getByText('Engineering cafeteria bin station').waitFor();
  await page.getByRole('button', { name: /resolve/i }).click();
  await page.getByText('Engineering cafeteria bin station').waitFor({ state: 'detached' });
  assert.match(state.agentCalls[0].message, new RegExp(reportId));
  await context.close();
});
