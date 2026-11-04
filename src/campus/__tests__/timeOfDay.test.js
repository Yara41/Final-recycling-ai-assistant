import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, nextMode, phaseAt, skyAt, skyFor } from '../timeOfDay.js';
import { readMode, writeMode } from '../skyMode.js';

test('phase boundaries', () => {
  assert.equal(phaseAt(4.7), 'night');
  assert.equal(phaseAt(4.75), 'dawn');
  assert.equal(phaseAt(6.99), 'dawn');
  assert.equal(phaseAt(7), 'day');
  assert.equal(phaseAt(16.49), 'day');
  assert.equal(phaseAt(16.5), 'sunset');
  assert.equal(phaseAt(19.49), 'sunset');
  assert.equal(phaseAt(19.5), 'night');
  assert.equal(phaseAt(23.9), 'night');
});

test('sky is continuous through the day and wraps at midnight', () => {
  let prev = skyAt(0);
  for (let h = 0.01; h <= 24.0001; h += 0.01) {
    const s = skyAt(h);
    assert.ok(Math.abs(s.sunIntensity - prev.sunIntensity) < 0.05, `jump at ${h.toFixed(2)}`);
    assert.ok(Math.abs(s.windows - prev.windows) < 0.05, `window jump at ${h.toFixed(2)}`);
    prev = s;
  }
  assert.deepEqual(skyAt(0), skyAt(24));
  assert.match(skyAt(12).top, /^#[0-9a-f]{6}$/);
});

test('daytime is light and night is dark', () => {
  assert.equal(skyAt(12).dark, false);
  assert.equal(skyAt(12).windows, 0);
  assert.equal(skyAt(23).dark, true);
});

test('manual modes return their key state at any hour', () => {
  assert.equal(skyFor('night', 12).dark, true);
  assert.equal(skyFor('day', 2).windows, 0);
  assert.deepEqual(skyFor('auto', 12), skyAt(12));
});

test('nextMode cycles through all modes', () => {
  assert.deepEqual(MODES, ['auto', 'day', 'sunset', 'night', 'dawn']);
  let m = 'auto';
  const seen = [];
  for (let i = 0; i < 5; i++) { m = nextMode(m); seen.push(m); }
  assert.deepEqual(seen, ['day', 'sunset', 'night', 'dawn', 'auto']);
});

test('mode storage survives a browser that blocks storage', () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  try {
    assert.equal(readMode(), 'auto');
    assert.doesNotThrow(() => writeMode('night'));
  } finally { globalThis.localStorage = saved; }
});

test('mode storage keeps a valid mode and ignores junk', () => {
  const store = {};
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  try {
    writeMode('sunset');
    assert.equal(readMode(), 'sunset');
    store['ecowaste-sky-mode'] = 'purple';
    assert.equal(readMode(), 'auto');
  } finally { globalThis.localStorage = saved; }
});
