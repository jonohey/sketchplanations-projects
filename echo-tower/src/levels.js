// Level definitions for Echo Tower.
//
// Each level is an ASCII map (see src/logic.js for the legend) plus a name and
// an optional hint shown at the bottom of the screen. To add a level, add an
// entry here — the test suite automatically checks it parses and is solvable.
//
// Design intent, floor by floor:
//   1  movement                     6  crates push onto buttons
//   2  echo statues copy your moves 7  crates sink into water
//   3  use walls to pin an echo     8  mirror statues move opposite
//   4  latching buttons + doors     9  echo + mirror together
//   5  park a statue on a button   10  finale: everything combined

export const LEVELS = [
  {
    name: 'First Steps',
    hint: 'Reach the stairs. Move with arrow keys or WASD.',
    map: [
      '##########',
      '#@.......#',
      '#...##...#',
      '#...##...#',
      '#.......>#',
      '##########',
    ],
  },
  {
    name: 'Copycat',
    hint: 'The statue echoes your every move. Walls stop it — use them.',
    map: [
      '###########',
      '#....#....#',
      '#.@..E...>#',
      '#....#....#',
      '###########',
    ],
  },
  {
    name: 'The Gatekeeper',
    hint: 'It cannot follow where walls forbid.',
    map: [
      '##########',
      '##>......#',
      '##.####.##',
      '#........#',
      '#..E.....#',
      '#..@.....#',
      '#........#',
      '##########',
    ],
  },
  {
    name: 'The Switch',
    hint: 'Square switches stay pressed forever.',
    map: [
      '##########',
      '#....#...#',
      '#.@....p.#',
      '#....#...#',
      '#..#######',
      '#..#....>#',
      '#..A.....#',
      '#..#.....#',
      '##########',
    ],
  },
  {
    name: 'Hold It Down',
    hint: 'Round buttons only work while something stands on them.',
    map: [
      '############',
      '#........a##',
      '#.@.E....A>#',
      '#..........#',
      '############',
    ],
  },
  {
    name: 'Boxed In',
    hint: 'Crates can be pushed — and they are heavy.',
    map: [
      '##########',
      '#........#',
      '#.@.$..a.#',
      '#........#',
      '####A#####',
      '#........#',
      '#.......>#',
      '##########',
    ],
  },
  {
    name: 'Sink or Swim',
    hint: 'Nobody can cross water. A crate might change that.',
    map: [
      '############',
      '#....#..~..#',
      '#.@..#..~..#',
      '#..$....~.>#',
      '#.......~..#',
      '############',
    ],
  },
  {
    name: 'Contrary',
    hint: 'This one does the exact opposite of you.',
    map: [
      '###########',
      '#a........#',
      '#.M...@...#',
      '#.........#',
      '########A##',
      '########>##',
      '###########',
    ],
  },
  {
    name: 'Twin Trouble',
    hint: 'One copies, one opposes. Both doors must open.',
    map: [
      '#############',
      '#......#...a#',
      '#..E......BA>',
      '#.........###',
      '#.....@.....#',
      '#...........#',
      '#..M........#',
      '#b..........#',
      '#############',
    ],
  },
  {
    name: 'The Penthouse',
    hint: 'Everything you have learned, all at once.',
    map: [
      '#############',
      '#.......~..a#',
      '#..E....~...#',
      '#.@..$..~...#',
      '#.......~#A##',
      '#.......~#.>#',
      '#############',
    ],
  },
];
