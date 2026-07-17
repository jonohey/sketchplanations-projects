// Canvas renderer for Echo Tower.
// Hand-drawn "pencil on paper" look: every line gets a small deterministic
// wobble (seeded per cell, stable between frames so nothing shimmers).
// Sprites are drawn procedurally — swap this file out later for real art
// without touching game logic.

import { cellAt, doorOpenVisual, isFilled } from './logic.js';

export const TILE = 64;

const PAPER = '#f8f4ea';
const INK = '#3a3733';
const INK_SOFT = '#8b857c';
const WALL_FILL = '#e7e0d1';
const WATER = '#5d8fa8';
const CRATE = '#b98a4e';
const STONE = '#9a958c';
const MIRROR_STONE = '#8d7fa8';
const PLAYER_COLOR = '#e0645c';

const CHANNEL_COLORS = { a: '#d96a5f', b: '#4f9d9b', c: '#d9a441' };

// Deterministic pseudo-random in [-1, 1] from integer coordinates.
function jitter(x, y, salt = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
  }

  resizeFor(state) {
    const w = state.width * TILE;
    const h = state.height * TILE;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.aspectRatio = `${state.width} / ${state.height}`;
  }

  // view = { state, player: {x,y}, statues: [{x,y,type,moving}], crates: [{x,y}],
  //          time, playerMoving, playerFacing }
  // Entity coordinates are in fractional tiles (already tweened by the caller).
  draw(view) {
    const { state, time } = view;
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, state.width * TILE, state.height * TILE);

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        this.drawCell(state, x, y, time);
      }
    }

    for (const c of view.crates) this.drawCrate(c.x, c.y);
    for (const s of view.statues) this.drawStatue(s, time);
    this.drawPlayer(view.player, view.playerMoving, view.playerFacing, time);

    ctx.restore();
  }

  // --- terrain ---------------------------------------------------------

  drawCell(state, x, y, time) {
    const ctx = this.ctx;
    const cell = cellAt(state, x, y);
    const px = x * TILE;
    const py = y * TILE;

    switch (cell.type) {
      case 'void':
        return;
      case 'wall':
        this.drawWall(x, y);
        return;
      case 'floor':
        this.drawFloor(x, y);
        return;
      case 'stairs':
        this.drawFloor(x, y);
        this.drawStairs(px, py);
        return;
      case 'water':
        if (isFilled(state, x, y)) this.drawFilledWater(x, y);
        else this.drawWater(px, py, x, y, time);
        return;
      case 'button':
        this.drawFloor(x, y);
        this.drawButton(state, cell, x, y);
        return;
      case 'door':
        this.drawFloor(x, y);
        this.drawDoor(cell, x, y, doorOpenVisual(state, x, y));
        return;
    }
  }

  drawFloor(x, y) {
    const ctx = this.ctx;
    // Faint pencil dot at each tile corner — enough to read the grid.
    ctx.fillStyle = INK_SOFT;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(x * TILE + 2, y * TILE + 2, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawWall(x, y) {
    const ctx = this.ctx;
    const px = x * TILE;
    const py = y * TILE;
    const j = (s) => jitter(x, y, s) * 2;

    ctx.fillStyle = WALL_FILL;
    ctx.fillRect(px, py, TILE, TILE);

    // Sketchy outline
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 3 + j(1), py + 3 + j(2));
    ctx.lineTo(px + TILE - 3 + j(3), py + 3 + j(4));
    ctx.lineTo(px + TILE - 3 + j(5), py + TILE - 3 + j(6));
    ctx.lineTo(px + 3 + j(7), py + TILE - 3 + j(8));
    ctx.closePath();
    ctx.stroke();

    // Diagonal hatching
    ctx.strokeStyle = INK_SOFT;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let i = 1; i <= 3; i++) {
      const o = (i * TILE) / 4;
      ctx.beginPath();
      ctx.moveTo(px + o + j(i * 9), py + 5);
      ctx.lineTo(px + 5, py + o + j(i * 11));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + TILE - 5, py + o + j(i * 13));
      ctx.lineTo(px + o + j(i * 17), py + TILE - 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawStairs(px, py) {
    const ctx = this.ctx;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    // Steps ascending from left to right
    const steps = 4;
    const w = (TILE - 16) / steps;
    for (let i = 0; i < steps; i++) {
      const h = 9 + i * 10;
      ctx.strokeRect(px + 8 + i * w, py + TILE - 9 - h, w, h);
    }
    // Small arrow pointing up the staircase
    ctx.beginPath();
    ctx.moveTo(px + 12, py + 26);
    ctx.lineTo(px + 26, py + 12);
    ctx.moveTo(px + 17, py + 12);
    ctx.lineTo(px + 26, py + 12);
    ctx.lineTo(px + 26, py + 21);
    ctx.stroke();
  }

  drawWater(px, py, x, y, time) {
    const ctx = this.ctx;
    ctx.fillStyle = WATER;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.globalAlpha = 1;
    // Animated wavy pencil lines
    ctx.strokeStyle = WATER;
    ctx.lineWidth = 2;
    for (let row = 0; row < 3; row++) {
      const wy = py + 16 + row * 16;
      const phase = time / 700 + x * 1.3 + row * 2.1;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const wx = px + 8 + i * ((TILE - 16) / 8);
        const dy = Math.sin(phase + i * 0.9) * 3;
        if (i === 0) ctx.moveTo(wx, wy + dy);
        else ctx.lineTo(wx, wy + dy);
      }
      ctx.stroke();
    }
  }

  drawFilledWater(x, y) {
    const ctx = this.ctx;
    const px = x * TILE;
    const py = y * TILE;
    // A sunken crate acting as a bridge: darker wood planks.
    ctx.fillStyle = WATER;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#8a6b42';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 6, py + 6, TILE - 12, TILE - 12);
    for (let i = 1; i < 4; i++) {
      const ly = py + 6 + i * ((TILE - 12) / 4);
      ctx.beginPath();
      ctx.moveTo(px + 6, ly + jitter(x, y, i));
      ctx.lineTo(px + TILE - 6, ly + jitter(x, y, i + 5));
      ctx.stroke();
    }
  }

  drawButton(state, cell, x, y) {
    const ctx = this.ctx;
    const px = x * TILE;
    const py = y * TILE;
    const color = CHANNEL_COLORS[cell.channel];
    const pressed = cell.latching
      ? state.latched.has(`${x},${y}`)
      : false; // momentary "pressed" look comes from the entity standing on it
    const cx = px + TILE / 2;
    const cy = py + TILE / 2;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    if (cell.latching) {
      // Square plate
      const s = pressed ? 18 : 22;
      ctx.globalAlpha = pressed ? 0.9 : 0.35;
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
      ctx.globalAlpha = 1;
      ctx.strokeRect(cx - 11, cy - 11, 22, 22);
      if (pressed) {
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy);
        ctx.lineTo(cx - 1, cy + 4);
        ctx.lineTo(cx + 6, cy - 5);
        ctx.stroke();
      }
    } else {
      // Round button
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawDoor(cell, x, y, open) {
    const ctx = this.ctx;
    const px = x * TILE;
    const py = y * TILE;
    const color = CHANNEL_COLORS[cell.channel];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    if (open) {
      // Retracted: two stubs at the cell edges
      ctx.globalAlpha = 0.9;
      ctx.fillRect(px + 4, py + TILE / 2 - 5, 8, 10);
      ctx.fillRect(px + TILE - 12, py + TILE / 2 - 5, 8, 10);
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([4, 5]);
      ctx.strokeRect(px + 6, py + 6, TILE - 12, TILE - 12);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    } else {
      // Closed: barred gate
      ctx.globalAlpha = 0.25;
      ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      ctx.globalAlpha = 1;
      ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
      for (let i = 1; i < 4; i++) {
        const lx = px + 4 + i * ((TILE - 8) / 4);
        ctx.beginPath();
        ctx.moveTo(lx, py + 6);
        ctx.lineTo(lx, py + TILE - 6);
        ctx.stroke();
      }
    }
  }

  // --- entities --------------------------------------------------------

  drawCrate(fx, fy) {
    const ctx = this.ctx;
    const px = fx * TILE;
    const py = fy * TILE;
    ctx.fillStyle = CRATE;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#7d5a2e';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(px + 8, py + 8, TILE - 16, TILE - 16);
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 8);
    ctx.lineTo(px + TILE - 8, py + TILE - 8);
    ctx.moveTo(px + TILE - 8, py + 8);
    ctx.lineTo(px + 8, py + TILE - 8);
    ctx.stroke();
  }

  drawStatue(s, time) {
    const ctx = this.ctx;
    const px = s.x * TILE;
    const py = s.y * TILE;
    const color = s.type === 'mirror' ? MIRROR_STONE : STONE;
    const hop = s.moving ? Math.sin(time / 40) * 1.5 : 0;
    const cx = px + TILE / 2;

    ctx.save();
    ctx.translate(0, hop);

    // Pedestal
    ctx.strokeStyle = INK;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(px + 14, py + TILE - 18, TILE - 28, 10);
    ctx.globalAlpha = 1;
    ctx.strokeRect(px + 14, py + TILE - 18, TILE - 28, 10);

    // Body
    ctx.globalAlpha = 0.6;
    ctx.fillRect(px + 18, py + 24, TILE - 36, TILE - 44);
    ctx.globalAlpha = 1;
    ctx.strokeRect(px + 18, py + 24, TILE - 36, TILE - 44);

    // Head
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(cx, py + 17, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();

    // Eyes: echo looks the way you face; mirror gets crossed "opposite" brows
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx - 3.5, py + 16, 1.6, 0, Math.PI * 2);
    ctx.arc(cx + 3.5, py + 16, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Marker on the chest: = for echo, ⇄ for mirror
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    if (s.type === 'mirror') {
      ctx.beginPath();
      ctx.moveTo(cx - 7, py + 33);
      ctx.lineTo(cx + 7, py + 33);
      ctx.moveTo(cx + 3, py + 30);
      ctx.lineTo(cx + 7, py + 33);
      ctx.lineTo(cx + 3, py + 36);
      ctx.moveTo(cx + 7, py + 41);
      ctx.lineTo(cx - 7, py + 41);
      ctx.moveTo(cx - 3, py + 38);
      ctx.lineTo(cx - 7, py + 41);
      ctx.lineTo(cx - 3, py + 44);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - 6, py + 34);
      ctx.lineTo(cx + 6, py + 34);
      ctx.moveTo(cx - 6, py + 40);
      ctx.lineTo(cx + 6, py + 40);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPlayer(p, moving, facing, time) {
    const ctx = this.ctx;
    const px = p.x * TILE;
    const py = p.y * TILE;
    const cx = px + TILE / 2;
    const bob = moving ? Math.sin(time / 50) * 2 : Math.sin(time / 400) * 1.2;
    const fx = facing?.dx ?? 0;

    ctx.save();
    ctx.translate(0, bob);

    // Legs (simple two-frame walk)
    const legSwing = moving ? Math.sin(time / 60) * 5 : 0;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 6, py + TILE - 24);
    ctx.lineTo(cx - 6 + legSwing, py + TILE - 12);
    ctx.moveTo(cx + 6, py + TILE - 24);
    ctx.lineTo(cx + 6 - legSwing, py + TILE - 12);
    ctx.stroke();

    // Body
    ctx.fillStyle = PLAYER_COLOR;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.roundRect(cx - 11, py + 22, 22, 20, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Head
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(cx, py + 14, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Face looks where you're going
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx - 3 + fx * 2, py + 13, 1.7, 0, Math.PI * 2);
    ctx.arc(cx + 3 + fx * 2, py + 13, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + fx * 2, py + 17, 3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }
}
