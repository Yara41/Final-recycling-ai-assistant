import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutFor, SHOTS, shotAt } from '../camera.js';

test('phones up to 640px use the phone shots', () => {
  assert.equal(layoutFor(360), 'phone');
  assert.equal(layoutFor(640), 'phone');
  assert.equal(layoutFor(641), 'wide');
});

test('every layout has the approved shots', () => {
  for (const l of ['phone', 'wide']) {
    assert.equal(SHOTS[l].home.length, 5);
    for (const k of ['agent', 'report', 'game']) assert.equal(SHOTS[l][k].p.length, 3);
  }
  assert.deepEqual(SHOTS.phone.home[0], { p: [4, 22, 40], l: [0, 1, -10] });
  assert.deepEqual(SHOTS.wide.agent, { p: [-3, 7.5, 19], l: [3.5, 1.2, 1] });
});

test('shotAt clamps to the first and last shot', () => {
  const s = SHOTS.phone.home;
  assert.deepEqual(shotAt(s, -1), s[0]);
  assert.deepEqual(shotAt(s, 99), s[4]);
});

test('shotAt halfway between two shots is their midpoint', () => {
  const s = [{ p: [0, 0, 0], l: [0, 0, 0] }, { p: [10, 20, -4], l: [2, 2, 2] }];
  assert.deepEqual(shotAt(s, 0.5), { p: [5, 10, -2], l: [1, 1, 1] });
});

test('shotAt eases near the ends of a segment', () => {
  const s = [{ p: [0, 0, 0], l: [0, 0, 0] }, { p: [10, 0, 0], l: [0, 0, 0] }];
  assert.ok(shotAt(s, 0.1).p[0] < 1);
});
