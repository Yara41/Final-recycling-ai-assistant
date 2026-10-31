import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureSession, createProfile, getProfile } from '../session.js';

function fakeClient({ session = null, rpcResult = { data: null, error: null }, profile = null } = {}) {
  const calls = [];
  return {
    calls,
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      signInAnonymously: async () => { calls.push('anon'); return { data: { session: { access_token: 'new' } }, error: null }; },
    },
    rpc: async (fn, args) => { calls.push([fn, args]); return rpcResult; },
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }),
  };
}

test('ensureSession signs in anonymously only when there is no session', async () => {
  const fresh = fakeClient();
  assert.equal((await ensureSession(fresh)).access_token, 'new');
  assert.deepEqual(fresh.calls, ['anon']);
  const existing = fakeClient({ session: { access_token: 'old' } });
  assert.equal((await ensureSession(existing)).access_token, 'old');
  assert.deepEqual(existing.calls, []);
});

test('createProfile passes the role through to create_profile', async () => {
  const c = fakeClient({ rpcResult: { data: { role: 'faculty' }, error: null } });
  const p = await createProfile({ universityId: 'u', role: 'faculty', faculty: 'Medicine', displayName: 'Dr X' }, c);
  assert.equal(p.role, 'faculty');
  assert.deepEqual(c.calls[0], ['create_profile', { p_university: 'u', p_role: 'faculty', p_faculty: 'Medicine', p_display_name: 'Dr X' }]);
});

test('createProfile surfaces insufficient_privilege as an ApiError code', async () => {
  const c = fakeClient({ rpcResult: { data: null, error: { message: 'insufficient_privilege', code: '42501' } } });
  await assert.rejects(createProfile({ universityId: 'u', role: 'admin' }, c), (e) => e.code === 'insufficient_privilege');
});

test('getProfile returns null when the user has no profile', async () => {
  assert.equal(await getProfile(fakeClient()), null);
});
