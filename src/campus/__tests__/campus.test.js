import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutCampus } from '../layout.js';
import { growthFor } from '../growth.js';
import { replayFrames } from '../replay.js';
import { shouldUse3D } from '../gate.js';

const loc = (id, faculty, lat, lng, kind = 'bin_station') => ({ id, name: id, kind, faculty, lat, lng });
const demo = {
  locations: [
    loc('l1', 'Engineering', 25.1012, 55.1621), loc('l2', 'Engineering', 25.1016, 55.1626),
    loc('l3', 'Business', 25.1021, 55.1610), loc('l4', 'Medicine', 25.1030, 55.1632),
    loc('l5', 'Arts', 25.1008, 55.1602), loc('l6', null, 25.1018, 55.1615),
    loc('l7', null, null, null, 'drop_off'), loc('l8', null, 25.1002, 55.1630, 'drop_off'),
  ],
};
const overlaps = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w + 2 && Math.abs(a.z - b.z) * 2 < a.d + b.d + 2;
const footprints = (l) => [...l.buildings, ...l.kiosks.map((k) => ({ x: k.x, z: k.z, w: 1, d: 1 }))];

test('layout is deterministic', () => {
  assert.deepEqual(layoutCampus(demo), layoutCampus(structuredClone(demo)));
});

test('one building per faculty (null faculty grouped as Campus)', () => {
  const l = layoutCampus(demo);
  assert.deepEqual(l.buildings.map((b) => b.faculty).sort(), ['Arts', 'Business', 'Campus', 'Engineering', 'Medicine']);
  assert.equal(l.kiosks.length, 8);
});

test('no overlapping footprints for 40 locations', () => {
  const many = { locations: Array.from({ length: 40 }, (_, i) => loc(`m${i}`, `F${i % 9}`, 25.1 + (i % 7) * 0.0003, 55.16 + Math.floor(i / 7) * 0.0003)) };
  const fp = footprints(layoutCampus(many));
  for (let i = 0; i < fp.length; i++) for (let j = i + 1; j < fp.length; j++) assert.ok(!overlaps(fp[i], fp[j]), `${i} overlaps ${j}`);
});

test('locations without coordinates are still placed without overlap', () => {
  const l = layoutCampus({ locations: [loc('a', 'X', null, null), loc('b', 'Y', null, null), loc('c', 'X', 25.1, 55.16)] });
  assert.equal(l.kiosks.length, 3);
  for (const k of l.kiosks) assert.ok(Number.isFinite(k.x) && Number.isFinite(k.z));
  const fp = footprints(l);
  for (let i = 0; i < fp.length; i++) for (let j = i + 1; j < fp.length; j++) assert.ok(!overlaps(fp[i], fp[j]));
});

test('empty snapshot gives no buildings and size 20', () => {
  assert.deepEqual(layoutCampus({ locations: [] }), { size: 20, buildings: [], kiosks: [] });
  assert.deepEqual(layoutCampus(null), { size: 20, buildings: [], kiosks: [] });
});

test('growth caps at 12 trees and 4 litter', () => {
  assert.deepEqual(growthFor({ points_30d: 10_000, wrong_items_30d: 999, correct_rate_30d: 1 }), { trees: 12, treeScale: 1.3, litter: 4 });
  assert.equal(growthFor({ points_30d: 119, wrong_items_30d: 19, correct_rate_30d: 0.5 }).trees, 2);
  assert.equal(growthFor({ points_30d: 119, wrong_items_30d: 19, correct_rate_30d: 0.5 }).litter, 1);
});

test('growth with zero data is 0 trees 0 litter scale 0.7', () => {
  assert.deepEqual(growthFor(undefined), { trees: 0, treeScale: 0.7, litter: 0 });
});

test('replay orders oldest first and last frame at 20000 ms', () => {
  const events = [
    { created_at: '2026-11-01T10:00:00Z', location_id: 'a', faculty: 'X', correct_bin: true, verification: 'photo' },
    { created_at: '2026-10-28T10:00:00Z', location_id: 'b', faculty: 'Y', correct_bin: false, verification: 'photo' },
    { created_at: '2026-10-30T10:00:00Z', location_id: 'c', faculty: 'Z', correct_bin: true, verification: 'self_reported' },
  ];
  const f = replayFrames(events);
  assert.deepEqual(f.map((x) => x.locationId), ['b', 'c', 'a']);
  assert.deepEqual(f.map((x) => x.kind), ['wrong', 'self', 'good']);
  assert.equal(f[0].atMs, 0);
  assert.equal(f.at(-1).atMs, 20000);
});

test('replay of empty week is []', () => {
  assert.deepEqual(replayFrames([]), []);
});

test('device gate', () => {
  assert.equal(shouldUse3D({ webgl2: true, reducedMotion: true, cores: 8 }), false);
  assert.equal(shouldUse3D({ webgl2: false, reducedMotion: false, cores: 8 }), false);
  assert.equal(shouldUse3D({ webgl2: true, reducedMotion: false, cores: 2 }), false);
  assert.equal(shouldUse3D({ webgl2: true, reducedMotion: false, cores: undefined }), true);
});
