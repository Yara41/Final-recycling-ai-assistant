import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, asService, asUser, member, one, rows, DEMO_UNI, LOC_ENG, addUser } from './helpers.mjs';

const A = '30000000-0000-4000-8000-00000000000a';
const B = '30000000-0000-4000-8000-00000000000b';
const log = (db, user, hash, qty = 1) => asService(db, (tx) => one(tx,
  "select log_recycling_event($1,'Bottle','plastic','plastic',$2,$3,'photo',$4) r", [user, qty, LOC_ENG, hash])).then((x) => x.r);

test('a photo-verified item earns points and is marked photo', async () => {
  const db = await freshDb();
  await member(db, A);
  const r = await log(db, A, 'hash-1');
  assert.equal(r.verification, 'photo');
  assert.equal(r.points, 10);
});

test('a claim without a photo is self_reported with 0 points but still recorded', async () => {
  const db = await freshDb();
  await member(db, A);
  const r = await log(db, A, null);
  assert.equal(r.verification, 'self_reported');
  assert.equal(r.points, 0);
  assert.equal(r.correct_bin, true);
  const e = await asService(db, (tx) => one(tx, 'select verification, points from recycling_events where id = $1', [r.event_id]));
  assert.deepEqual([e.verification, e.points], ['self_reported', 0]);
});

test('the same photo cannot be used twice, even by another user', async () => {
  const db = await freshDb();
  await member(db, A); await member(db, B);
  await log(db, A, 'same-hash');
  await assert.rejects(log(db, A, 'same-hash'), /duplicate_photo/);
  await assert.rejects(log(db, B, 'same-hash'), /duplicate_photo/);
});

test('points stop at the daily cap; the item is still recorded', async () => {
  const db = await freshDb();
  await member(db, A);
  await db.query('update universities set daily_points_cap = 25 where id = $1', [DEMO_UNI]);
  const first = await log(db, A, 'h1', 2);   // 20
  const second = await log(db, A, 'h2', 1);  // 10 -> capped to 5
  const third = await log(db, A, 'h3', 1);   // 0
  assert.deepEqual([first.points, second.points, third.points], [20, 5, 0]);
  assert.equal(third.capped, true);
});

test('my_impact and university_stats report verified items', async () => {
  const db = await freshDb();
  await member(db, A);
  await addUser(db, B);
  await asUser(db, B, (tx) => tx.query("select redeem_invite('DEMO-ADMIN')"));
  const verified = () => asUser(db, B, (tx) => one(tx,
    "select university_stats($1, now() - interval '1 day', now() + interval '1 minute') s", [DEMO_UNI]))
    .then((x) => Number(x.s.totals.verified_items));
  const before = await verified();
  await log(db, A, 'v1', 3);
  await log(db, A, null, 2);
  const me = await asUser(db, A, (tx) => one(tx, 'select items, verified_items from my_impact'));
  assert.deepEqual([Number(me.items), Number(me.verified_items)], [5, 3]);
  assert.equal(await verified(), before + 3);
});

test('seeded demo events count as photo-verified', async () => {
  const db = await freshDb();
  const r = await asService(db, (tx) => rows(tx, "select distinct verification from recycling_events"));
  assert.deepEqual(r.map((x) => x.verification), ['photo']);
});
