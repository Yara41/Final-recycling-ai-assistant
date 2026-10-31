// Starts `vite preview` on the built site and gives each test a page whose Supabase
// calls (Auth, PostgREST, Edge Functions) are answered by an in-test fake backend.
// Build first:  npm run build   (needs VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

export const BASE = 'http://localhost:4173';
export const UNI = { id: '00000000-0000-4000-8000-000000000001', name: 'EcoWaste Demo University', country: 'AE' };

export function profile(role = 'student') {
  return {
    role, faculty: 'Engineering', display_name: 'Test', university_id: UNI.id,
    universities: { ...UNI, default_language: 'en', bins: [] },
  };
}

export async function startServer() {
  const proc = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE)).ok) return proc; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  proc.kill();
  throw new Error('vite preview did not start (did you run npm run build?)');
}

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

// backend: { profile: object|null, agent: (body) => [status, json], stats, insights, reports, impact, board }
export async function openApp(browser, backend, { speech = true, lang = 'en' } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const state = { profile: backend.profile ?? null, agentCalls: [], rpc: [] };
  await page.addInitScript(({ speech, lang }) => {
    localStorage.setItem('eco_lang', lang);
    if (!speech) { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; }
    else if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      window.webkitSpeechRecognition = class { start() {} stop() {} };
    }
  }, { speech, lang });

  await page.route('**/auth/v1/**', (route) => json(route, {
    access_token: 'tok', refresh_token: 'ref', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'u1', aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {} },
  }));
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    const body = route.request().postDataJSON?.() ?? null;
    if (url.includes('/rpc/')) {
      const fn = url.split('/rpc/')[1].split('?')[0];
      state.rpc.push([fn, body]);
      if (fn === 'create_profile') { state.profile = profile(body.p_role); return json(route, state.profile); }
      if (fn === 'faculty_leaderboard') return json(route, backend.board ?? []);
      if (fn === 'university_stats') return json(route, backend.stats ?? { totals: {} });
      return json(route, {});
    }
    if (url.includes('/profiles')) return json(route, state.profile ? [state.profile] : []);
    if (url.includes('/universities')) return json(route, [UNI]);
    if (url.includes('/conversations')) return json(route, []);
    if (url.includes('/messages')) return json(route, []);
    if (url.includes('/my_impact')) return json(route, [backend.impact ?? { items: 0, est_kg: 0, est_co2e_kg: 0, points: 0, correct_pct: 0, streak_days: 0 }]);
    if (url.includes('/insights')) return json(route, backend.insights ?? []);
    if (url.includes('/bin_reports')) return json(route, backend.reports ?? []);
    return json(route, []);
  });
  await page.route('**/functions/v1/agent', async (route) => {
    const body = route.request().postDataJSON();
    state.agentCalls.push(body);
    const [status, payload] = backend.agent ? backend.agent(body, state) : [200, { reply: 'ok', actions: [], conversationId: 'c1' }];
    return json(route, payload, status);
  });
  await page.goto(BASE);
  return { page, state, context };
}

export async function launch() {
  return chromium.launch();
}
