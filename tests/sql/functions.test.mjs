import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, asUser, asService, member, addUser, addUniversity, rows, one, DEMO_UNI, LOC_ENG } from './helpers.mjs';

const A = '20000000-0000-4000-8000-00000000000a';
const B = '20000000-0000-4000-8000-00000000000b';
const log = (db, ...args) => asService(db, (tx) => one(tx,
  'select log_recycling_event($1,$2,$3,$4,$5,$6,$7) r', args)).then((x) => x.r);

test('correct bin awards points_per_item × quantity', async () => {
  const db = await freshDb();
  await member(db, A);
  const r = await log(db, A, 'Plastic bottle', 'plastic', 'plastic', 3, LOC_ENG, 'chat');
  assert.equal(r.correct_bin, true);
  assert.equal(r.points, 30);
  assert.equal(Number(r.est_kg), 0.075);
  assert.equal(Number(r.est_co2e_kg), 0.075);
});

test('wrong bin awards 0 and correct_bin=false', async () => {
  const db = await freshDb();
  await member(db, A);
  const r = await log(db, A, 'Chips bag', 'general', 'plastic', 1, null, 'photo');
  assert.equal(r.correct_bin, false);
  assert.equal(r.points, 0);
  assert.equal(Number(r.est_co2e_kg), 0);
});

test('quantity outside 1..50 is rejected', async () => {
  const db = await freshDb();
  await member(db, A);
  await assert.rejects(log(db, A, 'Bottle', 'plastic', 'plastic', 0, null, 'chat'), /invalid_quantity/);
  await assert.rejects(log(db, A, 'Bottle', 'plastic', 'plastic', 51, null, 'chat'), /invalid_quantity/);
});

test('unknown category or bin is rejected', async () => {
  const db = await freshDb();
  await member(db, A);
  await assert.rejects(log(db, A, 'Plank', 'wood', 'plastic', 1, null, 'chat'), /invalid_category/);
  await assert.rejects(log(db, A, 'Bottle', 'plastic', 'blue_box', 1, null, 'chat'), /invalid_bin/);
});

test('location of another university is rejected', async () => {
  const db = await freshDb();
  const other = await addUniversity(db);
  await member(db, A);
  await assert.rejects(log(db, A, 'Bottle', 'plastic', 'plastic', 1, other.loc, 'chat'), /invalid_location/);
});

test('second report of same issue for same location within 24h is a duplicate', async () => {
  const db = await freshDb();
  await member(db, A);
  const file = () => asService(db, (tx) => one(tx, "select file_bin_report($1,$2,'contaminated','x',40) r", [A, LOC_ENG])).then((x) => x.r);
  const first = await file();
  const second = await file();
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.report_id, first.report_id);
  const n = await asService(db, (tx) => one(tx, "select count(*)::int n from bin_reports where location_id = $1 and issue = 'contaminated' and status = 'open' and created_at > now() - interval '24 hours'", [LOC_ENG]));
  assert.equal(n.n, 1);
});

test('redeem_invite grants facilities and decrements uses_left; expired code fails', async () => {
  const db = await freshDb();
  await addUser(db, A);
  const before = await asService(db, (tx) => one(tx, "select uses_left from role_invites where role = 'facilities'"));
  const p = await asUser(db, A, (tx) => one(tx, "select * from redeem_invite(' demo-facilities ')"));
  assert.equal(p.role, 'facilities');
  assert.equal(p.university_id, DEMO_UNI);
  const after = await asService(db, (tx) => one(tx, "select uses_left from role_invites where role = 'facilities'"));
  assert.equal(after.uses_left, before.uses_left - 1);
  await asService(db, (tx) => tx.query("update role_invites set expires_at = now() - interval '1 day'"));
  await addUser(db, B);
  await assert.rejects(asUser(db, B, (tx) => tx.query("select redeem_invite('DEMO-ADMIN')")), /invalid_invite/);
});

test('resolve_bin_report needs facilities or admin of the same university', async () => {
  const db = await freshDb();
  await member(db, A);
  const rep = await asService(db, (tx) => one(tx, "select file_bin_report($1,$2,'full',null,null) r", [A, LOC_ENG]));
  await assert.rejects(asService(db, (tx) => tx.query('select resolve_bin_report($1,$2,null)', [A, rep.r.report_id])), /insufficient_privilege/);
  await addUser(db, B);
  await asUser(db, B, (tx) => tx.query("select redeem_invite('DEMO-FACILITIES')"));
  const done = await asService(db, (tx) => one(tx, "select resolve_bin_report($1,$2,'emptied') r", [B, rep.r.report_id]));
  assert.equal(done.r.status, 'resolved');
});

test('save_agent_turn stores messages and actions and reuses only own conversation', async () => {
  const db = await freshDb();
  await member(db, A); await member(db, B);
  const actions = JSON.stringify([{ tool: 'log_recycling', input: {}, result: {}, ok: true, card: { kind: 'logged', title: 't' } }]);
  const c1 = await asService(db, (tx) => one(tx, 'select save_agent_turn($1,null,$2,$3,$4::jsonb) id', [A, 'hi', 'hello', actions]));
  const again = await asService(db, (tx) => one(tx, 'select save_agent_turn($1,$2,$3,$4,$5::jsonb) id', [A, c1.id, 'q2', 'a2', '[]']));
  assert.equal(again.id, c1.id);
  const foreign = await asService(db, (tx) => one(tx, 'select save_agent_turn($1,$2,$3,$4,$5::jsonb) id', [B, c1.id, 'x', 'y', '[]']));
  assert.notEqual(foreign.id, c1.id);
  const msgs = await asUser(db, A, (tx) => rows(tx, 'select role from messages order by id'));
  assert.deepEqual(msgs.map((m) => m.role), ['user', 'assistant', 'user', 'assistant']);
  const acts = await asUser(db, A, (tx) => rows(tx, 'select tool from agent_actions'));
  assert.deepEqual(acts.map((a) => a.tool), ['log_recycling']);
});

test('my_impact and faculty_leaderboard', async () => {
  const db = await freshDb();
  await member(db, A);
  await log(db, A, 'Can', 'metal', 'metal', 2, null, 'chat');
  const me = await asUser(db, A, (tx) => one(tx, 'select * from my_impact'));
  assert.equal(Number(me.items), 2);
  assert.equal(Number(me.points), 20);
  assert.equal(Number(me.streak_days), 1);
  const board = await asUser(db, A, (tx) => rows(tx, 'select * from faculty_leaderboard($1)', [DEMO_UNI]));
  assert.ok(board.length >= 2);
  assert.ok(board.some((r) => r.faculty === 'Engineering'));
});

test('match_documents_scoped returns general + own-university rows only', async () => {
  const db = await freshDb();
  const other = await addUniversity(db);
  await db.query(`insert into documents (content, embedding, university_id) values
    ('general', '[1,0,0]', null), ('demo', '[1,0,0]', $1), ('other', '[1,0,0]', $2)`, [DEMO_UNI, other.id]);
  const res = await asService(db, (tx) => rows(tx, "select content from match_documents_scoped('[1,0,0]', 10, $1)", [DEMO_UNI]));
  assert.deepEqual(res.map((r) => r.content).sort(), ['demo', 'general']);
});

test('seed demo story: Engineering mis-sorts chips bags into plastic', async () => {
  const db = await freshDb();
  await addUser(db, A);
  await asUser(db, A, (tx) => tx.query("select redeem_invite('DEMO-ADMIN')"));
  const s = await asUser(db, A, (tx) => one(tx, "select university_stats($1, now() - interval '30 days', now()) s", [DEMO_UNI]));
  assert.ok(s.s.totals.events >= 100);
  assert.match(s.s.top_missorted[0].item, /chips/i);
});
