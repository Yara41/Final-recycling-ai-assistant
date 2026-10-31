import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listConversations, loadMessages } from '../history.js';

function fakeClient(rows) {
  const q = { calls: [] };
  const builder = {
    select(s) { q.calls.push(['select', s]); return builder; },
    eq(c, v) { q.calls.push(['eq', c, v]); return builder; },
    order(c, o) { q.calls.push(['order', c, o]); return builder; },
    limit(n) { q.calls.push(['limit', n]); return Promise.resolve({ data: rows, error: null }); },
  };
  return { q, from: (t) => { q.calls.push(['from', t]); return builder; } };
}

test('listConversations returns newest first, limited to 30', async () => {
  const c = fakeClient([{ id: 'a', title: 'x', updated_at: '2026-10-31' }]);
  const list = await listConversations(c);
  assert.equal(list[0].id, 'a');
  assert.deepEqual(c.q.calls.find((x) => x[0] === 'order'), ['order', 'updated_at', { ascending: false }]);
  assert.deepEqual(c.q.calls.find((x) => x[0] === 'limit'), ['limit', 30]);
});

test('loadMessages maps rows to chat messages with action cards', async () => {
  const c = fakeClient([
    { id: 1, role: 'user', content: 'hi', actions: [] },
    { id: 2, role: 'assistant', content: 'hello', actions: [{ kind: 'logged', title: 't' }] },
  ]);
  const msgs = await loadMessages('conv', c);
  assert.deepEqual(msgs.map((m) => m.role), ['user', 'ai']);
  assert.equal(msgs[1].actions[0].kind, 'logged');
  assert.deepEqual(c.q.calls.find((x) => x[0] === 'eq'), ['eq', 'conversation_id', 'conv']);
});
