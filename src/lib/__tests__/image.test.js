import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitSize } from '../image.js';

test('fitSize scales 4000x3000 down to 1024x768', () => {
  assert.deepEqual(fitSize(4000, 3000, 1024), { width: 1024, height: 768 });
});

test('fitSize scales portrait photos by their height', () => {
  assert.deepEqual(fitSize(3024, 4032, 1024), { width: 768, height: 1024 });
});

test('fitSize never enlarges small images', () => {
  assert.deepEqual(fitSize(640, 480, 1024), { width: 640, height: 480 });
});
