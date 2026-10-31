import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, asUser, asService, member, addUser, addUniversity, rows, one, DEMO_UNI, LOC_ENG } from './helpers.mjs';

const A = '10000000-0000-4000-8000-00000000000a';
const B = '10000000-0000-4000-8000-00000000000b';
const C = '10000000-0000-4000-8000-00000000000c';

test('member reads only own recycling_events', async () => {
  const db = await freshDb();
  await member(db, A); await member(db, B);
  await asService(db, async (tx) => {
    await tx.query("select log_recycling_event($1,'Bottle','plastic','plastic',1,$2,'chat')", [A, LOC_ENG]);
    await tx.query("select log_recycling_event($1,'Can','metal','metal',1,$2,'chat')", [B, LOC_ENG]);
  });
  const seen = await asUser(db, A, (tx) => rows(tx, 'select user_id, item from recycling_events'));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].user_id, A);
});

test('admin of university X cannot read university Y stats', async () => {
  const db = await freshDb();
  const other = await addUniversity(db);
  await addUser(db, A);
  await asUser(db, A, (tx) => tx.query("select redeem_invite('DEMO-ADMIN')"));
  const own = await asUser(db, A, (tx) => one(tx, "select university_stats($1, now() - interval '30 days', now()) s", [DEMO_UNI]));
  assert.ok(own.s.totals.events > 0, 'admin sees demo stats');
  await assert.rejects(
    asUser(db, A, (tx) => tx.query("select university_stats($1, now() - interval '30 days', now())", [other.id])),
    /insufficient_privilege/,
  );
});

test('member cannot self-assign admin', async () => {
  const db = await freshDb();
  await addUser(db, A);
  await assert.rejects(
    asUser(db, A, (tx) => tx.query("select create_profile($1,'admin','Engineering','X')", [DEMO_UNI])),
    /insufficient_privilege/,
  );
  await member(db, B);
  await assert.rejects(
    asUser(db, B, (tx) => tx.query("update profiles set role = 'admin' where user_id = $1", [B])),
    /permission denied/,
  );
  const p = await asService(db, (tx) => one(tx, 'select role from profiles where user_id = $1', [B]));
  assert.equal(p.role, 'student');
});

test('authenticated cannot call log_recycling_event', async () => {
  const db = await freshDb();
  await member(db, A);
  await assert.rejects(
    asUser(db, A, (tx) => tx.query("select log_recycling_event($1,'Bottle','plastic','plastic',1,null,'chat')", [A])),
    /permission denied/,
  );
});

test('facilities sees open reports of own university only', async () => {
  const db = await freshDb();
  const other = await addUniversity(db);
  await member(db, A);
  await member(db, B, { uni: other.id });
  await asService(db, async (tx) => {
    await tx.query("select file_bin_report($1,$2,'full','demo',null)", [A, LOC_ENG]);
    await tx.query("select file_bin_report($1,$2,'full','other',null)", [B, other.loc]);
  });
  await addUser(db, C);
  await asUser(db, C, (tx) => tx.query("select redeem_invite('DEMO-FACILITIES')"));
  const seen = await asUser(db, C, (tx) => rows(tx, "select university_id from bin_reports where status = 'open'"));
  assert.ok(seen.length >= 1);
  assert.ok(seen.every((r) => r.university_id === DEMO_UNI));
});
