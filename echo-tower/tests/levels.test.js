import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels.js';
import { parseLevel, step } from '../src/logic.js';
import { solve } from '../src/solver.js';

test('there is at least one level', () => {
  assert.ok(LEVELS.length >= 1);
});

for (const [i, def] of LEVELS.entries()) {
  const label = `level ${i + 1} (${def.name})`;

  test(`${label} parses and has a name`, () => {
    assert.ok(def.name?.length > 0, 'level needs a name');
    const state = parseLevel(def);
    assert.ok(state.width > 0 && state.height > 0);
  });

  test(`${label} is solvable`, () => {
    const state = parseLevel(def);
    const solution = solve(state);
    assert.ok(solution, `solver found no solution for ${label}`);
    // Replay the solution through step() to double-check it really wins.
    let s = state;
    for (const dir of solution) s = step(s, dir).state;
    assert.equal(s.won, true, 'replayed solution must win');
  });

  test(`${label} is not accidentally trivial`, () => {
    const state = parseLevel(def);
    const solution = solve(state);
    assert.ok(solution.length >= 3, 'a level should take at least a few moves');
  });
}

test('levels are roughly ordered by difficulty (first level is the shortest)', () => {
  const first = solve(parseLevel(LEVELS[0])).length;
  const last = solve(parseLevel(LEVELS[LEVELS.length - 1])).length;
  assert.ok(first <= last, 'floor 1 should not be harder than the top floor');
});
