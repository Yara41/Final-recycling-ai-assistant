import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeCampus, GAME_BINS, SLOTS } from '../compose.js';

const BINS = [
  { id: 'general', label_ar: 'نفايات عامة', label_en: 'General waste', color: '#6b7280', accepts: ['general', 'organic'] },
  { id: 'plastic', label_ar: 'بلاستيك', label_en: 'Plastic', color: '#2563eb', accepts: ['plastic'] },
  { id: 'paper', label_ar: 'ورق وكرتون', label_en: 'Paper & cardboard', color: '#16a34a', accepts: ['paper'] },
  { id: 'metal', label_ar: 'معادن', label_en: 'Metals', color: '#ca8a04', accepts: ['metal'] },
  { id: 'drop_off', label_ar: 'نقطة تسليم خاصة', label_en: 'Special drop-off point', color: '#dc2626', accepts: ['glass', 'hazardous'] },
];
const fac = (faculty, points) => ({ faculty, points_30d: points, items_30d: 1, correct_rate_30d: 1, wrong_items_30d: 0 });
const snap = (over = {}) => ({ university: { id: 'u', name: 'U', bins: BINS }, locations: [], faculties: [], events_7d: [], open_reports: [], ...over });

test('six fixed slots around the plaza', () => {
  assert.equal(SLOTS.length, 6);
  assert.deepEqual(SLOTS[0], { x: 0, z: -16, ry: 0, w: 22, d: 9, h: 9.5, arches: 7 });
});

test('faculties fill slots by points', () => {
  const c = composeCampus(snap({ faculties: [fac('Business', 200), fac('Engineering', 300)] }), 'en');
  assert.equal(c.buildings[0].faculty, 'Engineering');
  assert.equal(c.buildings[0].slot, 0);
  assert.equal(c.buildings[1].faculty, 'Business');
  assert.equal(c.buildings[0].id, 'b-0');
  assert.equal(c.buildings.length, 6);
  assert.equal(c.buildings[2].label, null);
});

test('more than six faculties keeps the top six', () => {
  const many = Array.from({ length: 8 }, (_, i) => fac(`F${i}`, i * 10));
  const c = composeCampus(snap({ faculties: many }), 'en');
  assert.deepEqual(c.buildings.map((b) => b.faculty), ['F7', 'F6', 'F5', 'F4', 'F3', 'F2']);
});

test('no faculties gives six unnamed halls', () => {
  const c = composeCampus(snap(), 'ar');
  assert.equal(c.buildings.length, 6);
  assert.ok(c.buildings.every((b) => b.faculty === null && b.label === null));
});

test('the general Campus bucket is not shown as a faculty', () => {
  const c = composeCampus(snap({ faculties: [fac('Campus', 500), fac('Engineering', 10)] }), 'en');
  assert.equal(c.buildings[0].faculty, 'Engineering');
});

test('plaza bins skip drop-off bins and keep the configured order', () => {
  const c = composeCampus(snap(), 'en');
  assert.deepEqual(c.plazaBins.map((b) => b.id), ['general', 'plastic', 'paper', 'metal']);
  assert.equal(c.plazaBins[1].color, '#2563eb');
  assert.equal(c.plazaBins[1].label, 'Plastic');
});

test('labels follow the language', () => {
  const c = composeCampus(snap(), 'ar');
  assert.equal(c.plazaBins[0].label, 'نفايات عامة');
});

test('no usable bins falls back to the game bins', () => {
  const c = composeCampus(snap({ university: { id: 'u', name: 'U', bins: [BINS[4]] } }), 'en');
  assert.deepEqual(c.plazaBins.map((b) => b.id), GAME_BINS.map((b) => b.id));
  const none = composeCampus(snap({ university: { id: 'u', name: 'U' } }), 'en');
  assert.equal(none.plazaBins.length, 4);
});

test('at most four plaza bins', () => {
  const extra = [...BINS.slice(0, 4), { id: 'organic', label_ar: 'عضوي', label_en: 'Organic', color: '#7c5', accepts: ['organic'] }];
  const c = composeCampus(snap({ university: { id: 'u', name: 'U', bins: extra } }), 'en');
  assert.equal(c.plazaBins.length, 4);
});

test('an open report adds the overflowing bin', () => {
  assert.equal(composeCampus(snap(), 'en').reportBin, null);
  const c = composeCampus(snap({ open_reports: [{ location_id: 'l1', issue: 'full' }] }), 'en');
  assert.deepEqual(c.reportBin, { locationId: 'l1' });
});

test('a missing snapshot still gives a full campus', () => {
  const c = composeCampus(null, 'ar');
  assert.equal(c.buildings.length, 6);
  assert.equal(c.plazaBins.length, 4);
  assert.equal(c.reportBin, null);
});

test('game bins are the four standard bins', () => {
  assert.deepEqual(GAME_BINS.map((b) => [b.id, b.color]), [['general', '#4b5563'], ['paper', '#2f8f4e'], ['plastic', '#1f6fd1'], ['metal', '#d9a514']]);
});
