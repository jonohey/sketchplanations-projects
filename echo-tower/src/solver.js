// Breadth-first solver for Echo Tower levels.
// Used by the tests to guarantee every shipped level is actually solvable,
// and by tools/check-levels.js to help design new levels.

import { step, serialize, DIR_NAMES } from './logic.js';

// Returns the shortest solution as an array of direction names, or null if
// the level cannot be solved within `maxNodes` explored states.
export function solve(initialState, { maxNodes = 500_000 } = {}) {
  if (initialState.won) return [];
  const visited = new Set([serialize(initialState)]);
  let frontier = [{ state: initialState, path: [] }];
  let explored = 0;

  while (frontier.length > 0) {
    const next = [];
    for (const { state, path } of frontier) {
      for (const dir of DIR_NAMES) {
        const { state: s } = step(state, dir);
        const k = serialize(s);
        if (visited.has(k)) continue;
        visited.add(k);
        explored++;
        if (explored > maxNodes) return null;
        const newPath = [...path, dir];
        if (s.won) return newPath;
        next.push({ state: s, path: newPath });
      }
    }
    frontier = next;
  }
  return null; // exhausted every reachable state without winning
}
