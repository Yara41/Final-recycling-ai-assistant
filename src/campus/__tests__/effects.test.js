import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectsForCards } from '../effects.js';

const layout = {
  size: 20,
  buildings: [
    { id: 'b-Business', faculty: 'Business' },
    { id: 'b-Engineering', faculty: 'Engineering' },
  ],
  kiosks: [
    { id: 'k-l1', locationId: 'l1', buildingId: 'b-Engineering' },
    { id: 'k-l2', locationId: 'l2', buildingId: 'b-Business' },
  ],
};

test('logged with points gives a flight to the bin building, and Eco follows', () => {
  const fx = effectsForCards([{ kind: 'logged', title: 'Logged', points: 10, location_id: 'l2' }], { layout, profileFaculty: 'Engineering' });
  assert.deepEqual(fx.map((e) => [e.type, e.buildingId]), [['flight', 'b-Business'], ['eco', 'b-Business']]);
  assert.equal(fx[0].points, 10);
});

test('logged with points and no location flies to the faculty building', () => {
  const fx = effectsForCards([{ kind: 'logged', title: 'Logged', points: 10 }], { layout, profileFaculty: 'Engineering' });
  assert.equal(fx[0].buildingId, 'b-Engineering');
});

test('unknown location falls back to faculty then first building', () => {
  const a = effectsForCards([{ kind: 'logged', points: 5, location_id: 'zz' }], { layout, profileFaculty: 'Engineering' });
  assert.equal(a[0].buildingId, 'b-Engineering');
  const b = effectsForCards([{ kind: 'logged', points: 5, location_id: 'zz' }], { layout, profileFaculty: 'Arts' });
  assert.equal(b[0].buildingId, 'b-Business');
});

test('logged with 0 points gives only an eco effect', () => {
  const fx = effectsForCards([{ kind: 'logged', title: 'Recorded', points: 0 }], { layout, profileFaculty: 'Engineering' });
  assert.deepEqual(fx.map((e) => e.type), ['eco']);
});

test('report gives a warn pin on that bin', () => {
  const fx = effectsForCards([{ kind: 'report', title: 'Reported', location_id: 'l1' }], { layout });
  assert.deepEqual(fx[0], { type: 'pin', buildingId: 'b-Engineering', locationId: 'l1', tone: 'warn' });
  assert.equal(fx[1].type, 'eco');
  assert.equal(fx[1].tone, 'warn');
});

test('resolved gives unpin', () => {
  const fx = effectsForCards([{ kind: 'resolved', title: 'Done', location_id: 'l1' }], { layout });
  assert.deepEqual(fx[0], { type: 'unpin', buildingId: 'b-Engineering', locationId: 'l1' });
});

test('cards that do not touch the campus give no effects, and an empty campus gives none', () => {
  assert.deepEqual(effectsForCards([{ kind: 'knowledge', title: 'x' }], { layout }), []);
  assert.deepEqual(effectsForCards([{ kind: 'logged', points: 10 }], { layout: { buildings: [], kiosks: [] } }), []);
});
