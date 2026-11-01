import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, asUser, asAnon, asService, member, addUniversity, one, DEMO_UNI, LOC_ENG } from './helpers.mjs';

const A = '50000000-0000-4000-8000-00000000000a';
const B = '50000000-0000-4000-8000-00000000000b';
const snap = (tx, uni) => one(tx, 'select campus_snapshot($1) s', [uni]).then((x) => x.s);

test('members get their campus', async () => {
  const db = await freshDb();
  await member(db, A);
  const s = await asUser(db, A, (tx) => snap(tx, DEMO_UNI));
  assert.equal(s.university.id, DEMO_UNI);
  assert.equal(s.locations.length, 8);
  assert.ok(s.faculties.some((f) => f.faculty === 'Engineering'));
  assert.ok(s.events_7d.length > 0);
  assert.ok(s.open_reports.length >= 1);
});

test("another university's member is refused", async () => {
  const db = await freshDb();
  const other = await addUniversity(db);
  await member(db, B, { uni: other.id });
  await db.query('update universities set public_demo = false where id = $1', [DEMO_UNI]);
  await assert.rejects(asUser(db, B, (tx) => snap(tx, DEMO_UNI)), /insufficient_privilege/);
});

test('anon reads the public demo campus', async () => {
  const db = await freshDb();
  const s = await asAnon(db, (tx) => snap(tx, DEMO_UNI));
  assert.equal(s.university.name, 'EcoWaste Demo University');
});

test('anon is refused a non-demo university', async () => {
  const db = await freshDb();
  const other = await addUniversity(db);
  await assert.rejects(asAnon(db, (tx) => snap(tx, other.id)), /insufficient_privilege/);
});

test('snapshot never contains user ids', async () => {
  const db = await freshDb();
  const s = await asAnon(db, (tx) => snap(tx, DEMO_UNI));
  const text = JSON.stringify(s);
  assert.doesNotMatch(text, /user_id|reporter_id|resolved_by|dddddddd-/);
});

test('events_7d is capped at 500 and newest first', async () => {
  const db = await freshDb();
  await member(db, A);
  await asService(db, async (tx) => {
    for (let i = 0; i < 520; i++) {
      await tx.query("select log_recycling_event($1,'Can','metal','metal',1,$2,'chat',null)", [A, LOC_ENG]);
    }
  });
  const s = await asUser(db, A, (tx) => snap(tx, DEMO_UNI));
  assert.equal(s.events_7d.length, 500);
  const times = s.events_7d.map((e) => Date.parse(e.created_at));
  assert.ok(times.every((t, i) => i === 0 || times[i - 1] >= t));
});

test('faculties sums match recycling_events for 30 days', async () => {
  const db = await freshDb();
  const s = await asAnon(db, (tx) => snap(tx, DEMO_UNI));
  const eng = s.faculties.find((f) => f.faculty === 'Engineering');
  const truth = await asService(db, (tx) => one(tx, `select sum(points)::int p, sum(quantity)::int q,
    sum(quantity) filter (where not correct_bin)::int w from recycling_events
    where faculty = 'Engineering' and created_at > now() - interval '30 days'`));
  assert.deepEqual([eng.points_30d, eng.items_30d, eng.wrong_items_30d], [truth.p, truth.q, truth.w]);
});
