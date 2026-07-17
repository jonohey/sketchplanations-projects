// Level design helper. Run with:
//   node tools/check-levels.js            — parse + solve every level
//   node tools/check-levels.js 3          — just level 3, with its solution replayed
//   node tools/check-levels.js 3 right,up — replay a custom move sequence on level 3
//
// Prints the shortest solution the BFS solver finds, so you can judge
// difficulty and spot accidental shortcuts while designing levels.

import { LEVELS } from '../src/levels.js';
import { parseLevel, step, cellAt, doorOpenVisual, isFilled } from '../src/logic.js';
import { solve } from '../src/solver.js';

export function renderAscii(state) {
  const lines = [];
  for (let y = 0; y < state.height; y++) {
    let line = '';
    for (let x = 0; x < state.width; x++) {
      const cell = cellAt(state, x, y);
      let ch;
      switch (cell.type) {
        case 'void': ch = ' '; break;
        case 'wall': ch = '#'; break;
        case 'floor': ch = '.'; break;
        case 'stairs': ch = '>'; break;
        case 'water': ch = isFilled(state, x, y) ? '=' : '~'; break;
        case 'button': ch = cell.latching ? 'pqr'['abc'.indexOf(cell.channel)] : cell.channel; break;
        case 'door': ch = doorOpenVisual(state, x, y) ? '/' : 'ABC'['abc'.indexOf(cell.channel)]; break;
      }
      const ent =
        state.player.x === x && state.player.y === y ? '@' :
        state.statues.find((s) => s.x === x && s.y === y) ? (state.statues.find((s) => s.x === x && s.y === y).type === 'echo' ? 'E' : 'M') :
        state.crates.find((c) => c.x === x && c.y === y) ? '$' : null;
      line += ent ?? ch;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

const arg = process.argv[2];
const movesArg = process.argv[3];

const indices = arg ? [Number(arg) - 1] : LEVELS.map((_, i) => i);

for (const i of indices) {
  const def = LEVELS[i];
  console.log(`\n=== Level ${i + 1}: ${def.name} ===`);
  let state;
  try {
    state = parseLevel(def);
  } catch (err) {
    console.log(`PARSE ERROR: ${err.message}`);
    continue;
  }
  console.log(renderAscii(state));

  if (movesArg) {
    for (const dir of movesArg.split(',')) {
      const r = step(state, dir.trim());
      state = r.state;
      console.log(`\nafter ${dir} (events: ${r.events.join(', ') || 'none'})`);
      console.log(renderAscii(state));
    }
    console.log(state.won ? '\nWON' : '\nnot won');
    continue;
  }

  const t0 = Date.now();
  const solution = solve(state);
  const ms = Date.now() - t0;
  if (!solution) {
    console.log(`UNSOLVABLE (searched in ${ms}ms)`);
  } else {
    console.log(`solvable in ${solution.length} moves (${ms}ms): ${solution.join(' ')}`);
  }
}
