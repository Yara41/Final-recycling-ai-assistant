import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendAgentMessage } from '../agent.js';

const client = { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } };
const cfg = { url: 'https://p.supabase.co', anonKey: 'anon' };

test('sendAgentMessage posts to the agent function with the user token', async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, init };
    return new Response(JSON.stringify({ reply: 'hi', actions: [], conversationId: 'c1' }), { status: 200 });
  };
  const out = await sendAgentMessage({ message: 'hello', conversationId: null, lang: 'en' }, { client, fetchImpl, ...cfg });
  assert.equal(out.conversationId, 'c1');
  assert.equal(seen.url, 'https://p.supabase.co/functions/v1/agent');
  assert.equal(seen.init.headers.Authorization, 'Bearer tok');
  assert.equal(seen.init.headers.apikey, 'anon');
  assert.deepEqual(JSON.parse(seen.init.body), { message: 'hello', conversationId: null, lang: 'en' });
});

test('sendAgentMessage maps 409 to code needs_onboarding', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: 'x', code: 'needs_onboarding' }), { status: 409 });
  await assert.rejects(
    sendAgentMessage({ message: 'hi', lang: 'ar' }, { client, fetchImpl, ...cfg }),
    (e) => e.code === 'needs_onboarding' && e.status === 409,
  );
});

test('sendAgentMessage sends image and mimeType when a photo is attached', async () => {
  let body;
  const fetchImpl = async (_u, init) => { body = JSON.parse(init.body); return new Response('{"reply":"","actions":[]}', { status: 200 }); };
  await sendAgentMessage({ message: '', image: { data: 'AAAA', mimeType: 'image/jpeg' }, lang: 'ar' }, { client, fetchImpl, ...cfg });
  assert.equal(body.image, 'AAAA');
  assert.equal(body.mimeType, 'image/jpeg');
});
