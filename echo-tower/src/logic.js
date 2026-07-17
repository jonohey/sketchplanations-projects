// Core game logic for Echo Tower.
// Pure functions only: no DOM, no canvas, no audio. Everything here is
// exercised by the tests in ../tests and by the level solver.
//
// A level is parsed from an ASCII map into a `state` object. `step(state, dir)`
// returns a brand new state plus a list of events (for sound/animation).
//
// Map legend
//   #  wall            .  floor           (space) void — impassable, drawn as paper
//   @  player start    >  stairs (exit)
//   E  echo statue     M  mirror statue (moves opposite to you)
//   $  crate (pushable by the player; sinks into water to fill it)
//   ~  water (blocks everyone until filled by a crate)
//   a b c   momentary buttons on channels a/b/c (active only while weighted)
//   p q r   latching buttons on channels a/b/c (stay pressed forever once pressed)
//   A B C   doors on channels a/b/c (open while their channel is active)
//
// Movement rules (kept deliberately simple and predictable):
//   - The player resolves first, then statues in their listed order.
//   - Statues copy the player's ATTEMPTED direction (echo = same, mirror = opposite),
//     even if the player was blocked. Walking into a wall is a legitimate tactic.
//   - Nothing may move into a cell currently occupied by anything else.
//   - Statues cannot step onto stairs or into water; they cannot push crates.
//   - The player pushes crates Sokoban-style (one at a time). A crate pushed
//     into water sinks and permanently fills that cell, making it walkable.
//   - A door is open while any button on its channel is weighted (or latched).
//     When checking whether a mover may enter a door, the mover's own vacated
//     cell(s) are excluded — you cannot hold a door open for yourself.
//   - A door never closes on an occupant: while an entity stands in a doorway
//     the door stays open (visually and for passability of that entity's cell,
//     which is occupied anyway).

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const DIR_NAMES = Object.keys(DIRS);

const BUTTON_CHANNELS = { a: 'a', b: 'b', c: 'c' };
const LATCH_CHANNELS = { p: 'a', q: 'b', r: 'c' };
const DOOR_CHANNELS = { A: 'a', B: 'b', C: 'c' };

const key = (x, y) => `${x},${y}`;

// ---------------------------------------------------------------------------
// Parsing

export function parseLevel(def) {
  const rows = def.map;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Level "${def.name}": map must be a non-empty array of strings`);
  }
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));

  const grid = [];
  let player = null;
  const statues = [];
  const crates = [];

  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x] ?? ' ';
      let cell;
      switch (ch) {
        case ' ': cell = { type: 'void' }; break;
        case '#': cell = { type: 'wall' }; break;
        case '.': cell = { type: 'floor' }; break;
        case '>': cell = { type: 'stairs' }; break;
        case '~': cell = { type: 'water' }; break;
        case '@':
          if (player) throw new Error(`Level "${def.name}": more than one player start`);
          player = { x, y };
          cell = { type: 'floor' };
          break;
        case 'E':
          statues.push({ x, y, type: 'echo' });
          cell = { type: 'floor' };
          break;
        case 'M':
          statues.push({ x, y, type: 'mirror' });
          cell = { type: 'floor' };
          break;
        case '$':
          crates.push({ id: crates.length, x, y });
          cell = { type: 'floor' };
          break;
        default:
          if (BUTTON_CHANNELS[ch]) {
            cell = { type: 'button', channel: BUTTON_CHANNELS[ch], latching: false };
          } else if (LATCH_CHANNELS[ch]) {
            cell = { type: 'button', channel: LATCH_CHANNELS[ch], latching: true };
          } else if (DOOR_CHANNELS[ch]) {
            cell = { type: 'door', channel: DOOR_CHANNELS[ch] };
          } else {
            throw new Error(`Level "${def.name}": unknown map character "${ch}" at ${x},${y}`);
          }
      }
      row.push(cell);
    }
    grid.push(row);
  }

  if (!player) throw new Error(`Level "${def.name}": no player start (@)`);
  const hasStairs = grid.some((row) => row.some((c) => c.type === 'stairs'));
  if (!hasStairs) throw new Error(`Level "${def.name}": no stairs (>)`);

  // Every door channel must have at least one button on it.
  const buttonChannels = new Set();
  const doorChannels = new Set();
  for (const row of grid) {
    for (const c of row) {
      if (c.type === 'button') buttonChannels.add(c.channel);
      if (c.type === 'door') doorChannels.add(c.channel);
    }
  }
  for (const ch of doorChannels) {
    if (!buttonChannels.has(ch)) {
      throw new Error(`Level "${def.name}": door channel "${ch}" has no button`);
    }
  }

  const state = {
    name: def.name ?? 'Untitled',
    hint: def.hint ?? '',
    width,
    height,
    grid, // static — shared between cloned states, never mutated after parse
    player,
    statues,
    crates,
    filled: new Set(), // water cells filled by sunken crates, 'x,y'
    latched: new Set(), // latching buttons that have been pressed, 'x,y'
    moves: 0,
    won: false,
  };
  updateLatches(state);
  return state;
}

// ---------------------------------------------------------------------------
// Queries

export function cellAt(state, x, y) {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return { type: 'void' };
  return state.grid[y][x];
}

export function isFilled(state, x, y) {
  return state.filled.has(key(x, y));
}

export function entityAt(state, x, y) {
  if (state.player.x === x && state.player.y === y) return { kind: 'player', entity: state.player };
  for (const s of state.statues) {
    if (s.x === x && s.y === y) return { kind: 'statue', entity: s };
  }
  for (const c of state.crates) {
    if (c.x === x && c.y === y) return { kind: 'crate', entity: c };
  }
  return null;
}

// Is the channel active? `exclude` is a Set of 'x,y' positions to treat as
// vacated (the mover's own cells) when counting weight on buttons.
export function channelActive(state, channel, exclude = null) {
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const cell = state.grid[y][x];
      if (cell.type !== 'button' || cell.channel !== channel) continue;
      if (cell.latching && state.latched.has(key(x, y))) return true;
      if (exclude && exclude.has(key(x, y))) continue;
      if (entityAt(state, x, y)) return true;
    }
  }
  return false;
}

// Whether a door cell is open for a mover whose vacated cells are `exclude`.
function doorOpenFor(state, x, y, exclude) {
  const cell = cellAt(state, x, y);
  if (cell.type !== 'door') return true;
  return channelActive(state, cell.channel, exclude);
}

// Whether a door should be DRAWN open (channel active, or jammed by an occupant).
export function doorOpenVisual(state, x, y) {
  const cell = cellAt(state, x, y);
  if (cell.type !== 'door') return false;
  return channelActive(state, cell.channel) || entityAt(state, x, y) !== null;
}

function isWalkableTerrain(state, x, y) {
  const cell = cellAt(state, x, y);
  switch (cell.type) {
    case 'floor':
    case 'button':
    case 'stairs':
    case 'door': // openness checked separately
      return true;
    case 'water':
      return isFilled(state, x, y);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Stepping

function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    statues: state.statues.map((s) => ({ ...s })),
    crates: state.crates.map((c) => ({ ...c })),
    filled: new Set(state.filled),
    latched: new Set(state.latched),
  };
}

function updateLatches(state) {
  let changed = false;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const cell = state.grid[y][x];
      if (cell.type === 'button' && cell.latching && !state.latched.has(key(x, y))) {
        if (entityAt(state, x, y)) {
          state.latched.add(key(x, y));
          changed = true;
        }
      }
    }
  }
  return changed;
}

function tryMovePlayer(state, dx, dy, events) {
  const p = state.player;
  const tx = p.x + dx;
  const ty = p.y + dy;

  if (!isWalkableTerrain(state, tx, ty)) {
    // Special case: pushing a crate into water is allowed even though water
    // isn't walkable — handled below only when a crate occupies the cell.
    if (!entityAt(state, tx, ty)) {
      events.push('bump');
      return false;
    }
  }

  const occupant = entityAt(state, tx, ty);
  if (occupant?.kind === 'statue') {
    events.push('bump');
    return false;
  }

  if (occupant?.kind === 'crate') {
    const crate = occupant.entity;
    const cx = tx + dx;
    const cy = ty + dy;
    const destCell = cellAt(state, cx, cy);
    const vacated = new Set([key(p.x, p.y), key(tx, ty)]);

    if (destCell.type === 'water' && !isFilled(state, cx, cy)) {
      // Crate sinks and fills the water.
      state.crates = state.crates.filter((c) => c !== crate);
      state.filled.add(key(cx, cy));
      p.x = tx; p.y = ty;
      events.push('splash');
      return true;
    }
    const pushable =
      isWalkableTerrain(state, cx, cy) &&
      destCell.type !== 'stairs' &&
      doorOpenFor(state, cx, cy, vacated) &&
      !entityAt(state, cx, cy);
    if (!pushable) {
      events.push('bump');
      return false;
    }
    crate.x = cx; crate.y = cy;
    p.x = tx; p.y = ty;
    events.push('push');
    return true;
  }

  // Plain move (terrain already checked walkable above unless entity path taken)
  if (!isWalkableTerrain(state, tx, ty)) {
    events.push('bump');
    return false;
  }
  if (!doorOpenFor(state, tx, ty, new Set([key(p.x, p.y)]))) {
    events.push('bump');
    return false;
  }
  p.x = tx; p.y = ty;
  events.push('step');
  return true;
}

function tryMoveStatue(state, statue, dx, dy, events) {
  const tx = statue.x + dx;
  const ty = statue.y + dy;
  const cell = cellAt(state, tx, ty);
  if (cell.type === 'stairs') return false; // statues never climb the stairs
  if (!isWalkableTerrain(state, tx, ty)) return false;
  if (!doorOpenFor(state, tx, ty, new Set([key(statue.x, statue.y)]))) return false;
  if (entityAt(state, tx, ty)) return false;
  statue.x = tx;
  statue.y = ty;
  events.push('statue-step');
  return true;
}

// Advance the game one turn. Returns { state, events }.
// `dirName` is one of 'up' | 'down' | 'left' | 'right'.
export function step(state, dirName) {
  const dir = DIRS[dirName];
  if (!dir) throw new Error(`Unknown direction "${dirName}"`);
  if (state.won) return { state, events: [] };

  const s = cloneState(state);
  const events = [];
  const { dx, dy } = dir;

  const doorsBefore = doorSnapshot(s);

  tryMovePlayer(s, dx, dy, events);

  for (const statue of s.statues) {
    const sx = statue.type === 'mirror' ? -dx : dx;
    const sy = statue.type === 'mirror' ? -dy : dy;
    tryMoveStatue(s, statue, sx, sy, events);
  }

  if (updateLatches(s)) events.push('latch');

  const doorsAfter = doorSnapshot(s);
  if (doorsAfter > doorsBefore) events.push('door-open');
  if (doorsAfter < doorsBefore) events.push('door-close');

  s.moves += 1;
  const pcell = cellAt(s, s.player.x, s.player.y);
  if (pcell.type === 'stairs') {
    s.won = true;
    events.push('win');
  }

  return { state: s, events };
}

function doorSnapshot(state) {
  let open = 0;
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (state.grid[y][x].type === 'door' && doorOpenVisual(state, x, y)) open++;
    }
  }
  return open;
}

// Canonical serialisation of the dynamic parts of a state — used by the
// solver's visited-set and handy for debugging.
export function serialize(state) {
  const statues = state.statues.map((s) => `${s.type[0]}${s.x},${s.y}`).join(';');
  const crates = state.crates.map((c) => key(c.x, c.y)).sort().join(';');
  const filled = [...state.filled].sort().join(';');
  const latched = [...state.latched].sort().join(';');
  return `${key(state.player.x, state.player.y)}|${statues}|${crates}|${filled}|${latched}`;
}
