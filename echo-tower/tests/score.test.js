import { test } from 'node:test';
import assert from 'node:assert/strict';
import { floorScore } from '../src/score.js';

test('fewer moves score higher', () => {
  assert.ok(floorScore(8, 10) > floorScore(30, 10));
});

test('quicker solves score higher', () => {
  assert.ok(floorScore(10, 5) > floorScore(10, 60));
});

test('score never drops below the floor value', () => {
  assert.equal(floorScore(500, 9999), 150);
});

test('score is always a round multiple of ten', () => {
  for (const [m, s] of [[8, 3], [17, 42], [123, 7], [1, 1]]) {
    assert.equal(floorScore(m, s) % 10, 0);
  }
});
