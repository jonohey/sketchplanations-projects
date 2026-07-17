import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, step, channelActive, doorOpenVisual, isFilled, serialize } from '../src/logic.js';

// Helper: build a state from a map, then apply moves. Returns final state.
function play(map, moves = []) {
  let state = parseLevel({ name: 'test', map });
  const allEvents = [];
  for (const dir of moves) {
    const r = step(state, dir);
    state = r.state;
    allEvents.push(...r.events);
  }
  return { state, events: allEvents };
}

// ---------------------------------------------------------------------------
// Parsing

test('parse rejects a map with no player', () => {
  assert.throws(() => parseLevel({ name: 'x', map: ['###', '#>#', '###'] }), /no player/);
});

test('parse rejects a map with no stairs', () => {
  assert.throws(() => parseLevel({ name: 'x', map: ['###', '#@#', '###'] }), /no stairs/);
});

test('parse rejects two players', () => {
  assert.throws(() => parseLevel({ name: 'x', map: ['#####', '#@@>#', '#####'] }), /more than one/);
});

test('parse rejects a door with no button on its channel', () => {
  assert.throws(() => parseLevel({ name: 'x', map: ['#####', '#@A>#', '#####'] }), /no button/);
});

test('parse rejects unknown characters', () => {
  assert.throws(() => parseLevel({ name: 'x', map: ['#####', '#@?>#', '#####'] }), /unknown map character/);
});

test('ragged rows are padded with void, which is impassable', () => {
  const { state } = play(['####', '#@>#', '##'], ['down']);
  assert.equal(state.player.y, 1, 'player cannot walk into void');
});

// ---------------------------------------------------------------------------
// Basic movement

test('player moves onto floor and is blocked by walls', () => {
  const { state } = play(['#####', '#@.>#', '#####'], ['up', 'right']);
  assert.deepEqual({ x: state.player.x, y: state.player.y }, { x: 2, y: 1 });
});

test('reaching the stairs wins', () => {
  const { state, events } = play(['#####', '#@.>#', '#####'], ['right', 'right']);
  assert.equal(state.won, true);
  assert.ok(events.includes('win'));
});

test('moves are counted even when blocked', () => {
  const { state } = play(['#####', '#@.>#', '#####'], ['up', 'up', 'right']);
  assert.equal(state.moves, 3);
});

test('input after winning is ignored', () => {
  const { state } = play(['#####', '#@>.#', '#####'], ['right']);
  const after = step(state, 'right').state;
  assert.equal(after.player.x, state.player.x);
});

test('player cannot enter water', () => {
  const { state } = play(['#####', '#@~>#', '#####'], ['right']);
  assert.equal(state.player.x, 1);
});

// ---------------------------------------------------------------------------
// Echo statues

test('echo statue copies the player direction', () => {
  const { state } = play(['#######', '#@..E.#', '#....>#', '#######'], ['down']);
  assert.deepEqual(state.statues[0], { x: 4, y: 2, type: 'echo' });
});

test('echo statue moves even when the player is blocked (wall-bump steering)', () => {
  const { state } = play(['#######', '#@..E.#', '#....>#', '#######'], ['up', 'right']);
  // Player blocked by wall going up; statue also blocked. Going right moves both.
  assert.equal(state.player.x, 2);
  assert.equal(state.statues[0].x, 5);
});

test('echo statue is blocked by walls, creating an offset', () => {
  const { state } = play(['######', '#@..E#', '#...>#', '######'], ['right']);
  assert.equal(state.player.x, 2, 'player moved');
  assert.equal(state.statues[0].x, 4, 'statue pinned against wall');
});

test('statues cannot step onto stairs', () => {
  const { state } = play(['######', '#@.E>#', '######'], ['right']);
  assert.equal(state.statues[0].x, 3);
});

test('statues cannot enter water', () => {
  const { state } = play(['######', '#..E~#', '#.@.>#', '######'], ['right']);
  assert.equal(state.statues[0].x, 3);
});

test('player cannot walk into a statue, statue cannot walk into player', () => {
  const a = play(['#####', '#@E.#', '#..>#', '#####'], ['right']);
  assert.equal(a.state.player.x, 1, 'player blocked by statue');
  // Player blocked by a wall; the statue behind cannot move into the player.
  const b = play(['#####', '#E@##', '#..>#', '#####'], ['right']);
  assert.equal(b.state.statues[0].x, 1, 'statue blocked by player (player resolves first)');
});

test('statue can move into the cell the player just vacated', () => {
  const { state } = play(['#####', '#E@.#', '#..>#', '#####'], ['right', 'right']);
  // Player 2->3->stairs? No: 5-wide, so player 2->3, statue 1->2, then again.
  assert.ok(state.statues[0].x >= 2);
});

test('two statues cannot occupy the same cell (first in list wins)', () => {
  const { state } = play(['#######', '#E.E..#', '#..@.>#', '#######'], ['right']);
  const [s1, s2] = state.statues;
  assert.notDeepEqual({ x: s1.x, y: s1.y }, { x: s2.x, y: s2.y });
});

// ---------------------------------------------------------------------------
// Mirror statues

test('mirror statue moves opposite to the player', () => {
  const { state } = play(['#######', '#.M...#', '#...@.#', '#..>..#', '#######'], ['right', 'down']);
  assert.deepEqual({ x: state.statues[0].x, y: state.statues[0].y }, { x: 1, y: 1 });
  // player moved right+down; mirror tried left (ok) then up (blocked by wall row 0)? y=1 up is row 0 wall -> stays
});

// ---------------------------------------------------------------------------
// Crates

test('player pushes a crate; crate is blocked by walls', () => {
  const { state, events } = play(['######', '#@$.>#', '######'], ['right']);
  assert.equal(state.crates[0].x, 3);
  assert.equal(state.player.x, 2);
  assert.ok(events.includes('push'));
  const blocked = play(['#####', '#@$##', '#..>#', '#####'], ['right']);
  assert.equal(blocked.state.crates[0].x, 2, 'crate blocked by wall');
  assert.equal(blocked.state.player.x, 1, 'player blocked too');
});

test('crate cannot be pushed into a statue or another crate', () => {
  const a = play(['#######', '#@$E.>#', '#######'], ['right']);
  assert.equal(a.state.player.x, 1);
  const b = play(['#######', '#@$$.>#', '#######'], ['right']);
  assert.equal(b.state.player.x, 1);
});

test('crate cannot be pushed onto the stairs', () => {
  const { state } = play(['######', '#@$>.#', '######'], ['right']);
  assert.equal(state.crates[0].x, 2);
});

test('crate pushed into water sinks, fills it, and everyone can cross', () => {
  const { state, events } = play(['######', '#@$~>#', '######'], ['right']);
  assert.equal(state.crates.length, 0, 'crate sank');
  assert.ok(isFilled(state, 3, 1), 'water filled');
  assert.ok(events.includes('splash'));
  const after = step(step(state, 'right').state, 'right').state;
  assert.equal(after.won, true, 'player crossed the filled water to the stairs');
});

test('statues do not push crates', () => {
  const { state } = play(['#######', '#.E$..#', '#@...>#', '#######'], ['right']);
  assert.equal(state.statues[0].x, 2, 'statue blocked by crate');
  assert.equal(state.crates[0].x, 3, 'crate did not move');
});

// ---------------------------------------------------------------------------
// Buttons and doors

test('momentary button opens its door only while weighted', () => {
  const map = ['#######', '#@a.A>#', '#######'];
  let state = parseLevel({ name: 't', map });
  assert.equal(channelActive(state, 'a'), false);
  state = step(state, 'right').state; // stand on button
  assert.equal(channelActive(state, 'a'), true);
  assert.equal(doorOpenVisual(state, 4, 1), true);
  state = step(state, 'left').state; // step off
  assert.equal(channelActive(state, 'a'), false);
});

test('you cannot hold a door open for yourself (self-exclusion rule)', () => {
  // Button directly beside the door: stepping off the button closes the door
  // before you can enter it.
  const map = ['######', '#@aA>#', '######'];
  let state = parseLevel({ name: 't', map });
  state = step(state, 'right').state; // onto button
  state = step(state, 'right').state; // try to walk into the door
  assert.equal(state.player.x, 2, 'blocked: own weight does not count');
});

test('a statue on a momentary button holds the door open for the player', () => {
  const map = [
    '#######',
    '#a..A>#',
    '#E.@..#',
    '#######',
  ];
  let state = parseLevel({ name: 't', map });
  state = step(state, 'up').state; // player to (3,1); echo statue up onto the button (1,1)
  assert.equal(channelActive(state, 'a'), true, 'statue weight activates channel');
  state = step(state, 'right').state; // player enters the door at (4,1)
  assert.deepEqual({ x: state.player.x, y: state.player.y }, { x: 4, y: 1 });
  state = step(state, 'right').state;
  assert.equal(state.won, true, 'player passed through to the stairs');
});

test('latching button stays pressed after stepping off', () => {
  const map = ['#######', '#@p.A>#', '#######'];
  let state = parseLevel({ name: 't', map });
  state = step(state, 'right').state; // press latch
  state = step(state, 'left').state; // step off
  assert.equal(channelActive(state, 'a'), true, 'latch holds');
  state = step(state, 'right').state;
  state = step(state, 'right').state;
  state = step(state, 'right').state; // through the door
  state = step(state, 'right').state;
  assert.equal(state.won, true);
});

test('crate weight presses a button', () => {
  const map = ['#######', '#@$a..#', '#...A>#', '#######'];
  let state = parseLevel({ name: 't', map });
  state = step(state, 'right').state; // push crate onto button
  assert.equal(channelActive(state, 'a'), true);
});

test('a door never closes on an occupant (jam rule)', () => {
  // Player holds a button in a pocket; wall-bumps steer a mirror statue into
  // the doorway; player then steps off the button. The statue is inside the
  // door with the channel inactive: the door must stay (visually) open.
  const map = [
    '##########',
    '###a######',
    '##.@M..A>#',
    '##########',
  ];
  let state = parseLevel({ name: 't', map });
  state = step(state, 'up').state; // player onto button (3,1); mirror tries down, blocked
  state = step(state, 'left').state; // player blocked (stays on button); mirror right to (5,2)
  state = step(state, 'left').state; // mirror to (6,2)
  state = step(state, 'left').state; // mirror enters the open door (7,2)
  assert.deepEqual(
    { x: state.statues[0].x, y: state.statues[0].y },
    { x: 7, y: 2 },
    'mirror statue entered the doorway'
  );
  state = step(state, 'down').state; // player steps off the button; mirror tries up, blocked
  assert.equal(channelActive(state, 'a'), false, 'channel released');
  assert.equal(doorOpenVisual(state, 7, 2), true, 'door jammed open by its occupant');
});

test('serialize distinguishes states and ignores move count', () => {
  const map = ['######', '#@..>#', '######'];
  const a = parseLevel({ name: 't', map });
  const b = step(step(a, 'right').state, 'left').state;
  assert.equal(serialize(a), serialize(b), 'same positions serialize equally');
  const c = step(a, 'right').state;
  assert.notEqual(serialize(a), serialize(c));
});
