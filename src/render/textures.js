// Procedural canvas textures. Nothing is downloaded: every surface in the game
// is painted here at load time.

import * as THREE from 'three';
import { RNG } from '../core/rng.js';

const cache = new Map();

function make(key, size, draw, { repeat = true, srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  draw(g, size, new RNG(key));
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

const css = (hex, a = 1) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;

function speckle(g, s, rng, n, colors, maxR = 1.6, alpha = 0.08) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = css(rng.pick(colors), rng.range(alpha * 0.3, alpha));
    const r = rng.range(0.4, maxR);
    g.fillRect(rng.range(0, s), rng.range(0, s), r, r);
  }
}

function vGradient(g, s, stops) {
  const gr = g.createLinearGradient(0, 0, 0, s);
  stops.forEach(([p, c]) => gr.addColorStop(p, c));
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
}

// ------------------------------------------------------------------ floors

const FLOORS = {
  teak(g, s, rng) {
    g.fillStyle = '#b9824a';
    g.fillRect(0, 0, s, s);
    const planks = 8;
    const ph = s / planks;
    for (let i = 0; i < planks; i++) {
      const tone = rng.range(-14, 14);
      g.fillStyle = `rgb(${186 + tone},${131 + tone * 0.8},${76 + tone * 0.5})`;
      g.fillRect(0, i * ph, s, ph);
      for (let k = 0; k < 26; k++) {
        g.strokeStyle = `rgba(90,50,20,${rng.range(0.03, 0.12)})`;
        g.lineWidth = rng.range(0.5, 1.6);
        const y = i * ph + rng.range(2, ph - 2);
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(s * 0.3, y + rng.range(-3, 3), s * 0.7, y + rng.range(-3, 3), s, y);
        g.stroke();
      }
      g.fillStyle = '#2a1a10';
      g.fillRect(0, i * ph, s, 2.5);
      const jx = rng.range(0, s);
      g.fillRect(jx, i * ph, 2.5, ph);
    }
  },
  carpet(g, s, rng) {
    g.fillStyle = '#39485e';
    g.fillRect(0, 0, s, s);
    speckle(g, s, rng, 9000, [0x4c5f7a, 0x2c3849, 0x566a88], 2, 0.35);
    g.strokeStyle = 'rgba(20,26,36,0.55)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,200,120,0.10)';
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(0, (i + 0.5) * (s / 4));
      g.lineTo(s, (i + 0.5) * (s / 4));
      g.stroke();
    }
  },
  tile(g, s, rng) {
    g.fillStyle = '#dfe7ea';
    g.fillRect(0, 0, s, s);
    const n = 4;
    const t = s / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = rng.range(-7, 7);
        g.fillStyle = `rgb(${222 + v},${231 + v},${235 + v})`;
        g.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
        const gr = g.createLinearGradient(x * t, y * t, x * t + t, y * t + t);
        gr.addColorStop(0, 'rgba(255,255,255,0.35)');
        gr.addColorStop(1, 'rgba(120,150,170,0.10)');
        g.fillStyle = gr;
        g.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
      }
    g.fillStyle = '#9fb3bd';
    for (let i = 0; i <= n; i++) {
      g.fillRect(i * t - 1.5, 0, 3, s);
      g.fillRect(0, i * t - 1.5, s, 3);
    }
    speckle(g, s, rng, 500, [0x7d97a5], 1.5, 0.2);
  },
  sandstone(g, s, rng) {
    g.fillStyle = '#c9a476';
    g.fillRect(0, 0, s, s);
    const n = 2;
    const t = s / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = rng.range(-12, 12);
        g.fillStyle = `rgb(${201 + v},${164 + v},${118 + v * 0.8})`;
        g.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
      }
    speckle(g, s, rng, 7000, [0x8a6a44, 0xe6c79a, 0xa98558], 2.4, 0.3);
    g.strokeStyle = 'rgba(80,55,30,0.6)';
    g.lineWidth = 4;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(i * t, 0);
      g.lineTo(i * t, s);
      g.moveTo(0, i * t);
      g.lineTo(s, i * t);
      g.stroke();
    }
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = 'rgba(70,45,25,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      let x = rng.range(0, s);
      let y = rng.range(0, s);
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += rng.range(-18, 18);
        y += rng.range(-18, 18);
        g.lineTo(x, y);
      }
      g.stroke();
    }
  },
  marble(g, s, rng) {
    const n = 2;
    const t = s / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const dark = (x + y) % 2 === 0;
        g.fillStyle = dark ? '#1b1c26' : '#2b2a36';
        g.fillRect(x * t, y * t, t, t);
        g.save();
        g.beginPath();
        g.rect(x * t, y * t, t, t);
        g.clip();
        for (let i = 0; i < 9; i++) {
          g.strokeStyle = `rgba(${dark ? '190,170,130' : '220,215,230'},${rng.range(0.05, 0.22)})`;
          g.lineWidth = rng.range(0.6, 2.2);
          g.beginPath();
          let px = x * t + rng.range(0, t);
          let py = y * t;
          g.moveTo(px, py);
          for (let k = 0; k < 7; k++) {
            px += rng.range(-30, 30);
            py += t / 6;
            g.lineTo(px, py);
          }
          g.stroke();
        }
        g.restore();
      }
    g.strokeStyle = 'rgba(214,170,90,0.55)';
    g.lineWidth = 2;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(i * t, 0);
      g.lineTo(i * t, s);
      g.moveTo(0, i * t);
      g.lineTo(s, i * t);
      g.stroke();
    }
  },
  vrgrid(g, s) {
    g.fillStyle = '#03131a';
    g.fillRect(0, 0, s, s);
    const n = 2;
    const t = s / n;
    for (let i = 0; i <= n; i++) {
      for (const [lw, a] of [
        [10, 0.08],
        [5, 0.2],
        [1.6, 0.95],
      ]) {
        g.strokeStyle = `rgba(60,255,225,${a})`;
        g.lineWidth = lw;
        g.beginPath();
        g.moveTo(i * t, 0);
        g.lineTo(i * t, s);
        g.moveTo(0, i * t);
        g.lineTo(s, i * t);
        g.stroke();
      }
    }
    g.strokeStyle = 'rgba(60,255,225,0.14)';
    g.lineWidth = 1;
    for (let i = 0; i < n * 4; i++) {
      g.beginPath();
      g.moveTo((i * t) / 4, 0);
      g.lineTo((i * t) / 4, s);
      g.moveTo(0, (i * t) / 4);
      g.lineTo(s, (i * t) / 4);
      g.stroke();
    }
  },
};

// ------------------------------------------------------------------ walls
// Wall textures span the full wall height (v 0..1) and tile every 2 m along u.

const WALLS = {
  hull(g, s, rng) {
    vGradient(g, s, [
      [0, '#fbfbf6'],
      [0.7, '#eef0ee'],
      [1, '#d6dcdf'],
    ]);
    g.fillStyle = '#21405f';
    g.fillRect(0, s * 0.86, s, s * 0.035);
    g.fillStyle = '#c9a14a';
    g.fillRect(0, s * 0.845, s, s * 0.012);
    g.strokeStyle = 'rgba(120,135,150,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      g.moveTo((i + 0.5) * (s / 2), 0);
      g.lineTo((i + 0.5) * (s / 2), s * 0.84);
      g.stroke();
    }
    speckle(g, s, rng, 300, [0x8090a0], 1.4, 0.15);
  },
  officewall(g, s, rng) {
    vGradient(g, s, [
      [0, '#cfc6b8'],
      [0.6, '#bfb5a6'],
      [1, '#a79c8c'],
    ]);
    // walnut wainscot
    g.fillStyle = '#5a3a26';
    g.fillRect(0, s * 0.62, s, s * 0.38);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(30,15,8,${rng.range(0.05, 0.2)})`;
      g.lineWidth = rng.range(0.5, 2);
      const y = s * 0.62 + rng.range(0, s * 0.38);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(s, y + rng.range(-3, 3));
      g.stroke();
    }
    g.fillStyle = '#c9a14a';
    g.fillRect(0, s * 0.615, s, 3);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    g.strokeRect(s * 0.06, s * 0.67, s * 0.38, s * 0.27);
    g.strokeRect(s * 0.56, s * 0.67, s * 0.38, s * 0.27);
  },
  labwall(g, s, rng) {
    vGradient(g, s, [
      [0, '#eef3f5'],
      [1, '#cdd8dd'],
    ]);
    g.strokeStyle = 'rgba(120,145,160,0.5)';
    g.lineWidth = 2;
    for (let i = 0; i < 2; i++) g.strokeRect(i * (s / 2) + 3, 3, s / 2 - 6, s * 0.78);
    g.fillStyle = '#39c6e8';
    g.fillRect(0, s * 0.3, s, s * 0.02);
    // hazard stripe along the base
    g.save();
    g.beginPath();
    g.rect(0, s * 0.86, s, s * 0.08);
    g.clip();
    g.fillStyle = '#f2c230';
    g.fillRect(0, s * 0.86, s, s * 0.08);
    g.fillStyle = '#1c1c1c';
    const sw = s / 8;
    for (let i = -2; i < 10; i++) {
      g.beginPath();
      g.moveTo(i * sw, s * 0.94);
      g.lineTo(i * sw + sw * 0.5, s * 0.94);
      g.lineTo(i * sw + sw, s * 0.86);
      g.lineTo(i * sw + sw * 0.5, s * 0.86);
      g.fill();
    }
    g.restore();
    g.fillStyle = '#8fa2ac';
    g.fillRect(0, s * 0.94, s, s * 0.06);
    speckle(g, s, rng, 200, [0x6f8792], 1.4, 0.2);
  },
  blocks(g, s, rng) {
    g.fillStyle = '#b08e62';
    g.fillRect(0, 0, s, s);
    const rows = 5;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? s / 4 : 0;
      for (let k = -1; k < 2; k++) {
        const v = rng.range(-16, 16);
        g.fillStyle = `rgb(${184 + v},${150 + v},${106 + v * 0.8})`;
        g.fillRect(k * (s / 2) + off + 2, r * rh + 2, s / 2 - 4, rh - 4);
      }
    }
    speckle(g, s, rng, 6000, [0x7a5c3a, 0xe2c497], 2.2, 0.28);
    vGradient(g, s, [
      [0, 'rgba(255,220,160,0.12)'],
      [1, 'rgba(40,20,5,0.35)'],
    ]);
  },
  gallery(g, s, rng) {
    vGradient(g, s, [
      [0, '#3a1f2b'],
      [0.6, '#2c1822'],
      [1, '#1f1119'],
    ]);
    g.fillStyle = 'rgba(214,170,90,0.07)';
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const px = (x + (y % 2) * 0.5) * (s / 8);
        const py = y * (s / 12);
        g.beginPath();
        g.moveTo(px, py - 9);
        g.lineTo(px + 7, py);
        g.lineTo(px, py + 9);
        g.lineTo(px - 7, py);
        g.fill();
      }
    g.fillStyle = '#15121a';
    g.fillRect(0, s * 0.7, s, s * 0.3);
    g.fillStyle = '#d6aa5a';
    g.fillRect(0, s * 0.695, s, 3);
    g.fillRect(0, s * 0.955, s, 2);
    speckle(g, s, rng, 200, [0xd6aa5a], 1.2, 0.12);
  },
  vrwall(g, s) {
    g.fillStyle = '#041b22';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(60,255,225,0.22)';
    g.lineWidth = 1.5;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo((i * s) / 4, 0);
      g.lineTo((i * s) / 4, s);
      g.moveTo(0, (i * s) / 4);
      g.lineTo(s, (i * s) / 4);
      g.stroke();
    }
    vGradient(g, s, [
      [0, 'rgba(60,255,225,0.18)'],
      [0.25, 'rgba(60,255,225,0)'],
      [0.8, 'rgba(60,255,225,0)'],
      [1, 'rgba(60,255,225,0.25)'],
    ]);
  },
};

// ------------------------------------------------------------------ misc surfaces

const MISC = {
  wood(g, s, rng) {
    g.fillStyle = '#6b4329';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 120; i++) {
      g.strokeStyle = `rgba(${rng.chance(0.5) ? '30,15,5' : '150,100,60'},${rng.range(0.05, 0.2)})`;
      g.lineWidth = rng.range(0.5, 2.5);
      const y = rng.range(0, s);
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y + rng.range(-6, 6), s * 0.7, y + rng.range(-6, 6), s, y);
      g.stroke();
    }
  },
  crate(g, s, rng) {
    g.fillStyle = '#a57a48';
    g.fillRect(0, 0, s, s);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const v = rng.range(-14, 14);
      g.fillStyle = `rgb(${165 + v},${122 + v},${72 + v})`;
      g.fillRect(0, (i * s) / n + 1, s, s / n - 2);
    }
    speckle(g, s, rng, 2500, [0x5a3d20, 0xd0a878], 2, 0.25);
    g.strokeStyle = '#6e4c28';
    g.lineWidth = s * 0.09;
    g.strokeRect(s * 0.045, s * 0.045, s * 0.91, s * 0.91);
    g.beginPath();
    g.moveTo(s * 0.08, s * 0.08);
    g.lineTo(s * 0.92, s * 0.92);
    g.stroke();
    g.fillStyle = '#3d2a14';
    for (const [x, y] of [
      [0.06, 0.06],
      [0.94, 0.06],
      [0.06, 0.94],
      [0.94, 0.94],
    ]) {
      g.beginPath();
      g.arc(x * s, y * s, s * 0.018, 0, 7);
      g.fill();
    }
  },
  ammo(g, s, rng) {
    g.fillStyle = '#5c6a3c';
    g.fillRect(0, 0, s, s);
    speckle(g, s, rng, 2500, [0x3d4a26, 0x7b8a52], 2, 0.3);
    g.strokeStyle = '#2c3520';
    g.lineWidth = s * 0.05;
    g.strokeRect(s * 0.03, s * 0.03, s * 0.94, s * 0.94);
    g.fillStyle = 'rgba(240,230,190,0.85)';
    g.font = `bold ${s * 0.16}px monospace`;
    g.textAlign = 'center';
    g.fillText('SNACKS', s / 2, s * 0.48);
    g.font = `bold ${s * 0.09}px monospace`;
    g.fillText('THIS SIDE UP?', s / 2, s * 0.66);
  },
  fabric(g, s, rng) {
    g.fillStyle = '#8a8f98';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 3) {
      g.fillStyle = `rgba(255,255,255,${rng.range(0, 0.06)})`;
      g.fillRect(i, 0, 1, s);
      g.fillStyle = `rgba(0,0,0,${rng.range(0, 0.07)})`;
      g.fillRect(0, i, s, 1);
    }
  },
  sand(g, s, rng) {
    g.fillStyle = '#d8b582';
    g.fillRect(0, 0, s, s);
    speckle(g, s, rng, 12000, [0xb89464, 0xf0d4a4, 0xc8a070], 2.6, 0.3);
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = 'rgba(150,110,70,0.12)';
      g.lineWidth = 3;
      const y = rng.range(0, s);
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y + 14, s * 0.6, y - 14, s, y);
      g.stroke();
    }
  },
  hawaiian(g, s, rng) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x = rng.range(0, s);
      const y = rng.range(0, s);
      const r = rng.range(s * 0.05, s * 0.1);
      g.fillStyle = `rgba(0,0,0,${rng.range(0.25, 0.5)})`;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 + i;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, r * 0.3, a, 0, 7);
        g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.arc(x, y, r * 0.2, 0, 7);
      g.fill();
    }
  },
  stripes(g, s) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(0,0,0,0.62)';
    for (let i = 0; i < 6; i++) g.fillRect(0, (i * s) / 6, s, s / 12);
  },
  camo(g, s, rng) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${rng.pick([0.18, 0.32, 0.45])})`;
      g.beginPath();
      g.ellipse(rng.range(0, s), rng.range(0, s), rng.range(10, 34), rng.range(6, 18), rng.range(0, 3), 0, 7);
      g.fill();
    }
  },
  skyline(g, s, rng) {
    g.clearRect(0, 0, s, s);
    for (let layer = 0; layer < 3; layer++) {
      let x = 0;
      while (x < s) {
        const bw = rng.range(s * 0.03, s * 0.09);
        const bh = rng.range(s * 0.15, s * (0.75 - layer * 0.18));
        const shade = 10 + layer * 9;
        g.fillStyle = `rgb(${shade},${shade + 4},${shade + 16})`;
        g.fillRect(x, s - bh, bw, bh);
        for (let wy = s - bh + 5; wy < s - 4; wy += 7) {
          for (let wx = x + 3; wx < x + bw - 3; wx += 6) {
            if (rng.chance(0.42)) {
              g.fillStyle = rng.chance(0.75) ? 'rgba(255,214,140,0.9)' : 'rgba(150,220,255,0.9)';
              g.fillRect(wx, wy, 3, 4);
            }
          }
        }
        if (rng.chance(0.3)) {
          g.fillStyle = 'rgba(255,60,60,0.9)';
          g.fillRect(x + bw / 2, s - bh - 6, 2, 6);
        }
        x += bw + rng.range(0, 6);
      }
    }
  },
};

export function floorTexture(name) {
  return make(`floor:${name}`, 512, FLOORS[name]);
}
export function wallTexture(name) {
  return make(`wall:${name}`, 512, WALLS[name]);
}
export function miscTexture(name, opts) {
  return make(`misc:${name}`, 256, MISC[name], opts);
}
export function skylineTexture() {
  return make('misc:skyline', 1024, MISC.skyline, { srgb: true });
}

/** Soft radial glow sprite / light-pool decal. */
export function glowTexture() {
  return make(
    'glow',
    128,
    (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    },
    { repeat: false },
  );
}

/** Vertical gradient used for light shafts and loot beams (bright at the bottom). */
export function shaftTexture() {
  return make(
    'shaft',
    64,
    (g, s) => {
      const gr = g.createLinearGradient(0, 0, 0, s);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(1, 'rgba(255,255,255,0.9)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    },
    { repeat: false },
  );
}

/** Sky dome gradient: array of [stop, cssColour], top to bottom. */
export function skyTexture(key, stops, stars = 0) {
  return make(
    `sky:${key}`,
    512,
    (g, s, rng) => {
      vGradient(g, s, stops);
      for (let i = 0; i < stars; i++) {
        g.fillStyle = `rgba(255,255,255,${rng.range(0.2, 0.9)})`;
        const r = rng.range(0.4, 1.4);
        g.fillRect(rng.range(0, s), rng.range(0, s * 0.55), r, r);
      }
    },
    { repeat: false },
  );
}

/** A square glyph sprite texture: '!', '?', 'Z', etc. */
export function glyphTexture(ch, color, glow) {
  return make(
    `glyph:${ch}:${color}`,
    128,
    (g, s) => {
      g.clearRect(0, 0, s, s);
      g.font = `900 ${s * 0.86}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = glow;
      g.shadowBlur = s * 0.12;
      g.lineWidth = s * 0.09;
      g.strokeStyle = '#101010';
      g.strokeText(ch, s / 2, s * 0.54);
      g.fillStyle = color;
      g.fillText(ch, s / 2, s * 0.54);
    },
    { repeat: false },
  );
}

/** Small label plate texture (screens, signs, paintings). */
export function paintedTexture(key, draw, size = 128) {
  return make(`paint:${key}`, size, draw, { repeat: false });
}

export { css };
