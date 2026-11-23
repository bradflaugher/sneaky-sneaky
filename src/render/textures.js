// Procedural painted textures. Nothing is downloaded: every surface is painted
// here at load time, at high resolution, and sampled smoothly (trilinear +
// anisotropic). No pixelation, no static.
//
// The style is a printed graphic novel: flat tonal washes, clean seams, a
// little architectural ink hatching in the corners. Surfaces stay calm so the
// inked characters and the lighting carry the frame.

import * as THREE from 'three';
import { RNG } from '../core/rng.js';

const cache = new Map();

function make(key, size, draw, { repeat = true, pixel = false } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, size, new RNG(key));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (pixel) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapNearestFilter;
  } else t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

const css = (hex, a = 1) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
const R = Math.round;

/**
 * The wear pass: barely-there texel variation plus a few large, soft tonal
 * blooms. `hatch`, `drips` and `scratches` are accepted for older callers but
 * intentionally do very little; busy surfaces fight the characters.
 */
function grit(g, s, rng, { noise = 16, stains = 5, cracks = 2 } = {}) {
  const amp = 0; // painted washes only: no texel noise
  void noise;
  const img = g.getImageData(0, 0, s, s);
  const d = img.data;
  for (let y = 0; amp && y < s; y += 2)
    for (let x = 0; x < s; x += 2) {
      const n = (rng.next() - 0.5) * 2 * amp;
      for (const o of [0, 4, s * 4, s * 4 + 4]) {
        const i = (y * s + x) * 4 + o;
        if (i + 2 >= d.length) continue;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
      }
    }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < Math.min(3, Math.ceil(stains / 3)); i++) {
    const cx = rng.range(0, s);
    const cy = rng.range(0, s);
    const r = rng.range(s * 0.18, s * 0.4);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    const dark = rng.chance(0.7);
    gr.addColorStop(0, dark ? 'rgba(0,0,0,0.11)' : 'rgba(255,255,255,0.04)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  }
  for (let i = 0; i < Math.floor(cracks / 3); i++) {
    g.fillStyle = 'rgba(0,0,0,0.22)';
    let x = rng.range(0, s);
    let y = rng.range(0, s);
    let dx = rng.range(-1, 1);
    let dy = rng.range(-1, 1);
    for (let k = 0; k < s * 0.3; k++) {
      g.fillRect(R(x), R(y), 1, 1);
      if (rng.chance(0.2)) dx += rng.range(-0.5, 0.5);
      if (rng.chance(0.2)) dy += rng.range(-0.5, 0.5);
      const m = Math.hypot(dx, dy) || 1;
      x += dx / m;
      y += dy / m;
    }
  }
}

/** A few clusters of short parallel ink strokes: the inker shading a corner. */
function hatch(g, s, rng, clusters = 4, alpha = 0.13) {
  g.strokeStyle = `rgba(8,10,16,${alpha})`;
  g.lineWidth = Math.max(1, s / 256);
  g.lineCap = 'round';
  for (let i = 0; i < clusters; i++) {
    const x = rng.range(0, s);
    const y = rng.range(0, s);
    const len = rng.range(s * 0.03, s * 0.07);
    const n = rng.int(3, 6);
    const dir = rng.chance(0.5) ? 1 : -1;
    for (let k = 0; k < n; k++) {
      g.beginPath();
      g.moveTo(x + k * s * 0.012, y);
      g.lineTo(x + k * s * 0.012 + len * 0.6 * dir, y + len);
      g.stroke();
    }
  }
}

const fill = (g, s, c) => {
  g.fillStyle = c;
  g.fillRect(0, 0, s, s);
};
const rect = (g, c, x, y, w, h) => {
  g.fillStyle = c;
  g.fillRect(R(x), R(y), Math.max(1, R(w)), Math.max(1, R(h)));
};
function shade(g, s, top, bottom) {
  const gr = g.createLinearGradient(0, 0, 0, s);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bottom);
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
}

// ------------------------------------------------------------------ floors
// One texture spans 4 m x 4 m, so its 2 m panels read as architecture.

/** n x n panels with a soft tonal drift and clean inked seams. */
function panels(g, s, rng, n, tones, seam, drift = 4) {
  const t = s / n;
  const lw = Math.max(1, Math.round(s / 256));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const base = tones[(x + y) % tones.length];
      const v = rng.int(-drift, drift);
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`;
      g.fillRect(x * t, y * t, t, t);
      const gr = g.createLinearGradient(x * t, y * t, x * t + t, y * t + t);
      gr.addColorStop(0, 'rgba(255,255,255,0.07)');
      gr.addColorStop(1, 'rgba(0,0,0,0.09)');
      g.fillStyle = gr;
      g.fillRect(x * t, y * t, t, t);
    }
  g.fillStyle = seam;
  for (let i = 0; i <= n; i++) {
    g.fillRect(Math.min(s - lw, R(i * t)), 0, lw, s);
    g.fillRect(0, Math.min(s - lw, R(i * t)), s, lw);
  }
}

const FLOORS = {
  // warm mahogany deck planking
  teak(g, s, rng) {
    const planks = 8;
    const ph = s / planks;
    const lw = Math.max(1, Math.round(s / 256));
    for (let i = 0; i < planks; i++) {
      const v = rng.int(-9, 9);
      g.fillStyle = `rgb(${158 + v},${96 + v},${54 + v})`;
      g.fillRect(0, i * ph, s, ph);
      g.strokeStyle = 'rgba(70,34,14,0.18)';
      g.lineWidth = lw;
      for (let k = 0; k < 3; k++) {
        const y = i * ph + rng.range(ph * 0.2, ph * 0.8);
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(s * 0.3, y + rng.range(-4, 4), s * 0.7, y + rng.range(-4, 4), s, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(40,18,8,0.85)';
      g.fillRect(0, R(i * ph), s, lw);
      g.fillRect(R(rng.range(0, s)), R(i * ph), lw, ph);
    }
    grit(g, s, rng, { stains: 6, cracks: 0 });
  },
  // twilight cobalt carpet in broad panels
  carpet(g, s, rng) {
    panels(g, s, rng, 2, [[44, 62, 118], [50, 70, 130]], 'rgba(16,22,48,0.8)', 2);
    hatch(g, s, rng, 5, 0.1);
    grit(g, s, rng, { stains: 3, cracks: 0 });
  },
  // slate-teal cleanroom tile with mint seams
  tile(g, s, rng) {
    panels(g, s, rng, 2, [[70, 108, 116], [78, 118, 126]], 'rgba(170,255,230,0.45)', 3);
    hatch(g, s, rng, 4, 0.1);
    grit(g, s, rng, { stains: 5, cracks: 0 });
  },
  // burnt-sienna flagstones
  sandstone(g, s, rng) {
    panels(g, s, rng, 2, [[156, 104, 84], [168, 114, 90]], 'rgba(60,30,40,0.85)', 6);
    hatch(g, s, rng, 7, 0.14);
    grit(g, s, rng, { stains: 7, cracks: 6 });
  },
  // plum and emerald marble chequer, gold inlay
  marble(g, s, rng) {
    panels(g, s, rng, 2, [[74, 46, 86], [34, 88, 74]], 'rgba(226,180,80,0.85)', 2);
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = `rgba(255,255,255,${rng.range(0.05, 0.11)})`;
      g.lineWidth = Math.max(1, s / 256);
      g.beginPath();
      let x = rng.range(0, s);
      let y = 0;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += rng.range(-s * 0.12, s * 0.12);
        y += s / 6;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    grit(g, s, rng, { stains: 4, cracks: 0 });
  },
  // navy-black void with electric cyan lines and a faint magenta sub-grid
  vrgrid(g, s) {
    fill(g, s, '#050818');
    const t = s / 2;
    const lw = Math.max(1, Math.round(s / 256));
    for (let i = 0; i < 4; i++) {
      rect(g, 'rgba(255,58,200,0.16)', (i * s) / 4, 0, lw, s);
      rect(g, 'rgba(255,58,200,0.16)', 0, (i * s) / 4, s, lw);
    }
    for (let i = 0; i <= 2; i++) {
      rect(g, '#3ae8ff', Math.min(s - lw * 2, i * t), 0, lw * 2, s);
      rect(g, '#3ae8ff', 0, Math.min(s - lw * 2, i * t), s, lw * 2);
    }
  },
};

// ------------------------------------------------------------------ walls
// Wall textures span the full wall height (v 0..1) and tile every 2 m along u.
// A flat wash, one accent line, a base band and a touch of hatching.

function wallBase(g, s, rng, top, bottom, { seam = 'rgba(0,0,0,0.22)', line = null, lineY = 0.3, base = null, baseY = 0.82 } = {}) {
  const lw = Math.max(1, Math.round(s / 256));
  shade(g, s, top, bottom);
  rect(g, seam, 0, 0, lw, s);
  if (base) {
    rect(g, base, 0, s * baseY, s, s * (1 - baseY));
    rect(g, 'rgba(8,10,16,0.7)', 0, s * baseY, s, lw * 2);
  }
  if (line) rect(g, line, 0, s * lineY, s, lw * 2);
  hatch(g, s, rng, 4, 0.12);
  grit(g, s, rng, { stains: 4, cracks: 0 });
}

const WALLS = {
  hull(g, s, rng) {
    wallBase(g, s, rng, '#efe6cf', '#cfc2a2', { line: '#d9a520', lineY: 0.74, base: '#6e3a1e', baseY: 0.76 });
  },
  officewall(g, s, rng) {
    wallBase(g, s, rng, '#4a5c94', '#2e3a66', { line: '#5fd8e8', lineY: 0.2, base: '#5a3622', baseY: 0.72 });
  },
  labwall(g, s, rng) {
    wallBase(g, s, rng, '#5e8a92', '#3a5c66', { line: '#8affe0', lineY: 0.3, base: '#243a42', baseY: 0.86 });
  },
  blocks(g, s, rng) {
    wallBase(g, s, rng, '#c98a62', '#8a5648', { base: '#4a2c3c', baseY: 0.84 });
    const lw = Math.max(1, Math.round(s / 256));
    for (let r = 1; r < 4; r++) rect(g, 'rgba(60,26,14,0.3)', 0, (r * s * 0.84) / 4, s, lw);
  },
  gallery(g, s, rng) {
    wallBase(g, s, rng, '#5c3a6e', '#3a2448', { line: '#e2b450', lineY: 0.7, base: '#27162f', baseY: 0.71 });
    rect(g, '#b0182c', 0, s * 0.95, s, s * 0.02);
  },
  vrwall(g, s) {
    const lw = Math.max(1, Math.round(s / 256));
    fill(g, s, '#070b20');
    rect(g, 'rgba(58,232,255,0.2)', 0, 0, lw, s);
    rect(g, 'rgba(255,58,200,0.22)', 0, s / 2, s, lw);
    rect(g, '#3ae8ff', 0, 0, s, lw * 3);
    rect(g, '#ff3ac8', 0, s - lw * 3, s, lw * 3);
  },
};

// ------------------------------------------------------------------ misc surfaces (64px)

const MISC = {
  wood(g, s, rng) {
    fill(g, s, '#2e1a0f');
    for (let k = 0; k < 26; k++) rect(g, rng.chance(0.6) ? 'rgba(0,0,0,0.28)' : 'rgba(150,90,40,0.16)', rng.range(-8, s), rng.range(0, s), rng.range(8, 40), 1);
    grit(g, s, rng, { noise: 8, stains: 3, cracks: 1, hatch: 0.15, scratches: 6 });
  },
  crate(g, s, rng) {
    fill(g, s, '#4a3320');
    for (let i = 0; i < 5; i++) {
      const v = rng.int(-10, 10);
      rect(g, `rgb(${78 + v},${54 + v},${32 + v})`, 0, (i * s) / 5 + 1, s, s / 5 - 1);
    }
    grit(g, s, rng, { noise: 11, stains: 4, cracks: 2, hatch: 0.25 });
    const b = Math.max(3, R(s * 0.09));
    rect(g, '#22150b', 0, 0, s, b);
    rect(g, '#22150b', 0, s - b, s, b);
    rect(g, '#22150b', 0, 0, b, s);
    rect(g, '#22150b', s - b, 0, b, s);
    for (let i = 0; i < s; i++) rect(g, '#22150b', i, i - 1, 2, 3);
    for (const [x, y] of [
      [1, 1],
      [s - 3, 1],
      [1, s - 3],
      [s - 3, s - 3],
    ])
      rect(g, '#8a8f95', x, y, 2, 2);
  },
  ammo(g, s, rng) {
    fill(g, s, '#2e3620');
    grit(g, s, rng, { noise: 10, stains: 4, cracks: 0, hatch: 0.3, scratches: 8 });
    rect(g, '#10140b', 0, 0, s, 2);
    rect(g, '#10140b', 0, s - 2, s, 2);
    rect(g, '#10140b', 0, 0, 2, s);
    rect(g, '#10140b', s - 2, 0, 2, s);
    g.fillStyle = '#c9bd8a';
    g.font = `bold ${R(s * 0.2)}px monospace`;
    g.textAlign = 'center';
    g.fillText('SNACKS', s / 2, s * 0.5);
    g.font = `bold ${R(s * 0.11)}px monospace`;
    g.fillText('THIS SIDE UP?', s / 2, s * 0.72);
  },
  fabric(g, s, rng) {
    fill(g, s, '#8a8a8a');
    for (let i = 0; i < s; i += 2) {
      rect(g, 'rgba(0,0,0,0.16)', i, 0, 1, s);
      rect(g, 'rgba(0,0,0,0.12)', 0, i, s, 1);
    }
    grit(g, s, rng, { noise: 12, stains: 3, cracks: 0, hatch: 0.2 });
  },
  metal(g, s, rng) {
    shade(g, s, '#6a7076', '#3c4146');
    grit(g, s, rng, { noise: 10, stains: 5, cracks: 0, drips: 4, hatch: 0.2, scratches: 14 });
    for (let i = 0; i < 5; i++) rect(g, 'rgba(130,56,14,0.4)', rng.range(0, s), rng.range(0, s), rng.range(2, 9), rng.range(2, 6));
  },
  sand(g, s, rng) {
    fill(g, s, '#2a2019');
    grit(g, s, rng, { noise: 9, stains: 6, cracks: 0, hatch: 0.3 });
    for (let i = 0; i < 6; i++) rect(g, 'rgba(0,0,0,0.25)', rng.range(0, s), rng.range(0, s), rng.range(10, 30), 1);
  },
  hawaiian(g, s, rng) {
    fill(g, s, '#ffffff');
    for (let i = 0; i < 10; i++) {
      const x = R(rng.range(2, s - 6));
      const y = R(rng.range(2, s - 6));
      rect(g, 'rgba(0,0,0,0.55)', x, y + 2, 7, 3);
      rect(g, 'rgba(0,0,0,0.55)', x + 2, y, 3, 7);
      rect(g, 'rgba(255,255,255,0.9)', x + 3, y + 3, 1, 1);
    }
    grit(g, s, rng, { noise: 8, stains: 2, cracks: 0, hatch: 0.1 });
  },
  stripes(g, s, rng) {
    fill(g, s, '#ffffff');
    for (let i = 0; i < 4; i++) rect(g, 'rgba(0,0,0,0.75)', 0, (i * s) / 4, s, s / 8);
    grit(g, s, rng, { noise: 8, stains: 2, cracks: 0, hatch: 0.15 });
  },
  camo(g, s, rng) {
    fill(g, s, '#ffffff');
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(0,0,0,${rng.pick([0.25, 0.42, 0.6])})`;
      const x = R(rng.range(0, s));
      const y = R(rng.range(0, s));
      for (let k = 0; k < 6; k++) g.fillRect(x + rng.int(-5, 5), y + rng.int(-4, 4), rng.int(3, 9), rng.int(2, 6));
    }
    grit(g, s, rng, { noise: 9, stains: 0, cracks: 0, hatch: 0.2 });
  },
  skyline(g, s, rng) {
    g.clearRect(0, 0, s, s);
    for (let layer = 0; layer < 3; layer++) {
      let x = 0;
      while (x < s) {
        const bw = R(rng.range(s * 0.03, s * 0.09));
        const bh = R(rng.range(s * 0.15, s * (0.75 - layer * 0.18)));
        const sh = 3 + layer * 4;
        rect(g, `rgb(${sh},${sh + 1},${sh + 7})`, x, s - bh, bw, bh);
        for (let wy = s - bh + 2; wy < s - 2; wy += 3)
          for (let wx = x + 1; wx < x + bw - 1; wx += 3)
            if (rng.chance(0.16)) rect(g, rng.chance(0.7) ? '#c9a24a' : '#3ec8d8', wx, wy, 1, 2);
        if (rng.chance(0.3)) rect(g, '#d0202a', x + (bw >> 1), s - bh - 3, 1, 3);
        x += bw + rng.int(0, 3);
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
export function miscTexture(name) {
  return make(`misc:${name}`, 256, MISC[name]);
}
export function skylineTexture() {
  return make('misc:skyline', 1024, MISC.skyline);
}

/** Soft radial glow sprite / light-pool decal (the one deliberately smooth texture). */
export function glowTexture() {
  return make(
    'glow',
    64,
    (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    },
    { repeat: false, pixel: false },
  );
}

/** Hard-edged spotlight pool: stepped rings, like a cel-painted light. */
export function poolTexture() {
  return make(
    'pool',
    64,
    (g, s) => {
      g.clearRect(0, 0, s, s);
      for (const [r, a] of [
        [0.5, 0.22],
        [0.4, 0.38],
        [0.27, 0.62],
        [0.13, 1],
      ]) {
        g.fillStyle = `rgba(255,255,255,${a})`;
        g.beginPath();
        g.arc(s / 2, s / 2, s * r, 0, 7);
        g.fill();
      }
    },
    { repeat: false },
  );
}

/** Vertical gradient for light shafts and loot beams, banded rather than smooth. */
export function shaftTexture() {
  return make(
    'shaft',
    32,
    (g, s) => {
      g.clearRect(0, 0, s, s);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = `rgba(255,255,255,${[0.08, 0.22, 0.45, 0.8][i]})`;
        g.fillRect(0, (i * s) / 4, s, s / 4);
      }
    },
    { repeat: false },
  );
}

/** Sky dome gradient: array of [stop, cssColour], top to bottom. */
export function skyTexture(key, stops, stars = 0) {
  return make(
    `sky:${key}`,
    256,
    (g, s, rng) => {
      const gr = g.createLinearGradient(0, 0, 0, s);
      stops.forEach(([p, c]) => gr.addColorStop(p, c));
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
      for (let i = 0; i < stars; i++) {
        g.fillStyle = `rgba(255,255,255,${rng.range(0.25, 0.9)})`;
        g.fillRect(R(rng.range(0, s)), R(rng.range(0, s * 0.5)), 1, 1);
      }
    },
    { repeat: false },
  );
}

function burst(g, cx, cy, r0, r1, spikes, rot = 0) {
  g.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = rot + (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 ? r0 : r1 * (0.88 + 0.12 * Math.sin(i * 7.3));
    g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

/**
 * Comic-book stamp: a hand-lettered glyph or word, heavy black ink outline,
 * hard offset shadow, optionally on a jagged impact burst.
 */
export function stampTexture(text, color, { burstColor = null, w = 128, h = 128 } = {}) {
  const key = `stamp:${text}:${color}:${burstColor}:${w}x${h}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const cx = w / 2;
  const cy = h / 2;
  if (burstColor) {
    g.lineJoin = 'miter';
    burst(g, cx + 4, cy + 4, Math.min(w, h) * 0.3, Math.min(w, h) * 0.5 - 4, 11, 0.2);
    g.fillStyle = '#000';
    g.fill();
    burst(g, cx, cy, Math.min(w, h) * 0.3, Math.min(w, h) * 0.5 - 4, 11, 0.2);
    g.fillStyle = burstColor;
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#000';
    g.stroke();
  }
  let size = h * (burstColor ? 0.6 : 0.82);
  g.font = `italic 900 ${size}px Bangers, "Marker Felt", "Chalkboard SE", "Comic Sans MS", Impact, "Arial Black", sans-serif`;
  const tw = g.measureText(text).width;
  if (tw > w * 0.84) size *= (w * 0.84) / tw;
  g.font = `italic 900 ${size}px Bangers, "Marker Felt", "Chalkboard SE", "Comic Sans MS", Impact, "Arial Black", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.fillStyle = '#000';
  g.fillText(text, cx + size * 0.07, cy + size * 0.1);
  g.lineWidth = Math.max(5, size * 0.16);
  g.strokeStyle = '#000';
  g.strokeText(text, cx, cy + size * 0.03);
  g.fillStyle = color;
  g.fillText(text, cx, cy + size * 0.03);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Small painted panel texture (screens, signs, paintings). */
export function paintedTexture(key, draw, size = 64) {
  return make(`paint:${key}`, size, draw, { repeat: false });
}

export { css };
