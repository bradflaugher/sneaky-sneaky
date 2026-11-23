// Self-hosted comic fonts (SIL OFL), bundled by Vite: no external requests.
import '@fontsource/bangers/latin-400.css';
import '@fontsource/comic-neue/latin-400.css';
import '@fontsource/comic-neue/latin-700.css';
import './style.css';
import { Game } from './game/game.js';

const canvas = document.getElementById('game');

function start() {
  try {
    const game = new Game(canvas);
    // Handy for debugging a seed from the console.
    window.__sneaky = game;
  } catch (err) {
    console.error(err);
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;padding:24px;text-align:center;font:16px system-ui;color:#f6efdc;background:#0b0d12';
    el.textContent = 'Sneaky Sneaky needs WebGL to run, and this browser would not start it. Try another browser or enable hardware acceleration.';
    document.body.append(el);
  }
}

// The in-world lettering (TAP! TAP!, ZZZ..., ?!) is painted to canvas, so the
// display font has to be ready before the game draws its first stamp. Never
// wait long: a slow font must not hold up the game.
const fonts = document.fonts ? Promise.all([document.fonts.load('400 64px Bangers'), document.fonts.load('700 16px "Comic Neue"')]).catch(() => {}) : Promise.resolve();
Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).then(start);
