import { Game } from './game.js';

// Exposed on window for debugging and automated playtesting.
window.echoTower = new Game({
  canvas: document.getElementById('game'),
  overlay: document.getElementById('overlay'),
  floorLabel: document.getElementById('floor-label'),
  scoreLabel: document.getElementById('score-label'),
  hintLabel: document.getElementById('hint'),
});
