import { Game } from './game.js';

new Game({
  canvas: document.getElementById('game'),
  overlay: document.getElementById('overlay'),
  floorLabel: document.getElementById('floor-label'),
  movesLabel: document.getElementById('moves-label'),
  hintLabel: document.getElementById('hint'),
});
