import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayFrames } from '../replay.js';
import { shouldUse3D } from '../gate.js';

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
