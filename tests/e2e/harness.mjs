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
export const SNAPSHOT = {
  university: {
    id: UNI.id, name: UNI.name,
    bins: [
      { id: 'general', label_ar: 'نفايات عامة', label_en: 'General waste', color: '#6b7280', accepts: ['general', 'organic'] },
      { id: 'plastic', label_ar: 'بلاستيك', label_en: 'Plastic', color: '#2563eb', accepts: ['plastic'] },
      { id: 'paper', label_ar: 'ورق وكرتون', label_en: 'Paper & cardboard', color: '#16a34a', accepts: ['paper'] },
      { id: 'metal', label_ar: 'معادن', label_en: 'Metals', color: '#ca8a04', accepts: ['metal'] },
      { id: 'drop_off', label_ar: 'نقطة تسليم خاصة', label_en: 'Special drop-off point', color: '#dc2626', accepts: ['glass', 'hazardous'] },
    ],
  },
  locations: [
    { id: 'l1', name: 'Engineering cafeteria', kind: 'bin_station', faculty: 'Engineering', lat: 25.1012, lng: 55.1621 },
    { id: 'l2', name: 'Business lobby', kind: 'bin_station', faculty: 'Business', lat: 25.1021, lng: 55.161 },
    { id: 'l3', name: 'Medicine entrance', kind: 'bin_station', faculty: 'Medicine', lat: 25.103, lng: 55.1632 },
    { id: 'l4', name: 'Battery drop-off', kind: 'drop_off', faculty: null, lat: null, lng: null },
  ],
  faculties: [
    { faculty: 'Engineering', points_30d: 300, items_30d: 60, correct_rate_30d: 0.55, wrong_items_30d: 27 },
    { faculty: 'Business', points_30d: 200, items_30d: 25, correct_rate_30d: 0.9, wrong_items_30d: 2 },
    { faculty: 'Medicine', points_30d: 90, items_30d: 12, correct_rate_30d: 0.8, wrong_items_30d: 2 },
  ],
  events_7d: [
    { created_at: '2026-11-01T10:00:00Z', location_id: 'l1', faculty: 'Engineering', category: 'plastic', correct_bin: true, verification: 'photo', quantity: 1 },
    { created_at: '2026-10-29T10:00:00Z', location_id: 'l2', faculty: 'Business', category: 'general', correct_bin: false, verification: 'photo', quantity: 1 },
  ],
  open_reports: [{ location_id: 'l1', issue: 'contaminated', contamination_pct: 45 }],
};

export async function openApp(browser, backend, { speech = true, lang = 'en', reducedMotion = 'reduce', query = '', viewport, snap = false } = {}) {
  const context = await browser.newContext({ reducedMotion, ...(viewport ? { viewport } : {}) });
  const page = await context.newPage();
  const state = { profile: backend.profile ?? null, agentCalls: [], rpc: [] };
  await page.addInitScript(({ speech, lang, snap }) => {
    localStorage.setItem('eco_lang', lang);
    if (snap) window.__snap = 1;
    if (!speech) { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; }
    else if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      window.webkitSpeechRecognition = class { start() {} stop() {} };
    }
  }, { speech, lang, snap });

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
      if (fn === 'campus_snapshot') {
        if (backend.snapshotError) return json(route, { message: 'boom' }, 500);
        return json(route, backend.snapshot ?? SNAPSHOT);
      }
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
  await page.goto(BASE + query);
  return { page, state, context };
}

export async function launch() {
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}
