import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, answer, initialState, isOver } from '../game/rules.js';

test('eight items in the approved order with their bins', () => {
  assert.deepEqual(ITEMS.map((i) => [i.id, i.bin]), [
    ['bottle', 'plastic'], ['chips', 'general'], ['can', 'metal'], ['pizza', 'general'],
    ['paper', 'paper'], ['tissue', 'general'], ['cardboard', 'paper'], ['banana', 'general'],
  ]);
  for (const i of ITEMS) {
    assert.equal(i.image, `/items/${i.id}.webp`);
    assert.ok(i.name.ar && i.name.en && i.rule.ar && i.rule.en);
  }
});

test('a right answer adds ten and moves on', () => {
  const r = answer(initialState(), 'plastic');
  assert.equal(r.correct, true);
  assert.equal(r.points, 10);
  assert.equal(r.state.score, 10);
  assert.equal(r.state.round, 1);
});

test('a wrong answer adds nothing and names the right bin', () => {
  const r = answer(initialState(), 'metal');
  assert.equal(r.correct, false);
  assert.equal(r.points, 0);
  assert.equal(r.rightBin, 'plastic');
  assert.equal(r.state.score, 0);
  assert.equal(r.state.round, 1);
});

test('the game ends after eight answers and ignores more', () => {
  let s = initialState();
  for (const item of ITEMS) s = answer(s, item.bin).state;
  assert.equal(isOver(s), true);
  assert.equal(s.score, 80);
  assert.equal(answer(s, 'general').state, s);
});

test('the initial state is a fresh game', () => {
  assert.deepEqual(initialState(), { round: 0, score: 0, right: 0 });
});
