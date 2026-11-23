import './style.css';
import { Game } from './game/game.js';

const canvas = document.getElementById('game');
try {
  const game = new Game(canvas);
  // Handy for debugging a seed from the console.
  window.__sneaky = game;
} catch (err) {
  console.error(err);
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;padding:24px;text-align:center;font:16px system-ui;color:#eaf2f6;background:#070b12';
  el.textContent = 'Sneaky Sneaky needs WebGL to run, and this browser would not start it. Try another browser or enable hardware acceleration.';
  document.body.append(el);
}
