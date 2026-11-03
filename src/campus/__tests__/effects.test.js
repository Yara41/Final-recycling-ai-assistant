import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectsForCards } from '../effects.js';

const plazaBins = [{ id: 'general' }, { id: 'plastic' }, { id: 'paper' }, { id: 'metal' }];

test('logged with points flies to its bin', () => {
  assert.deepEqual(effectsForCards([{ kind: 'logged', bin: 'paper', points: 10 }], { plazaBins }), [{ type: 'flight', binId: 'paper', points: 10 }]);
});

test('an unknown or missing bin flies to the first plaza bin', () => {
  assert.equal(effectsForCards([{ kind: 'logged', bin: 'glass', points: 10 }], { plazaBins })[0].binId, 'general');
  assert.equal(effectsForCards([{ kind: 'logged', points: 5 }], { plazaBins })[0].binId, 'general');
});

test('logged with no points gives no flight', () => {
  assert.deepEqual(effectsForCards([{ kind: 'logged', bin: 'plastic', points: 0 }], { plazaBins }), []);
});

test('a report, or an audit that filed one, shows the report bin', () => {
  assert.deepEqual(effectsForCards([{ kind: 'report', location_id: 'l1' }], { plazaBins }), [{ type: 'report' }]);
  assert.deepEqual(effectsForCards([{ kind: 'audit', location_id: 'l1' }], { plazaBins }), [{ type: 'report' }]);
  assert.deepEqual(effectsForCards([{ kind: 'audit', location_id: null }], { plazaBins }), []);
});

test('resolved clears the report bin', () => {
  assert.deepEqual(effectsForCards([{ kind: 'resolved' }], { plazaBins }), [{ type: 'resolved' }]);
});

test('other cards and an empty plaza give nothing', () => {
  assert.deepEqual(effectsForCards([{ kind: 'knowledge' }], { plazaBins }), []);
  assert.deepEqual(effectsForCards([{ kind: 'logged', points: 10 }], { plazaBins: [] }), []);
  assert.deepEqual(effectsForCards(null, { plazaBins }), []);
});
