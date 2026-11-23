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

// ------------------------------------------------------------------ illustrated backdrops
// Wide painted panoramas wrapped around the horizon, plus the sea. These are
// what you see past the walls: a harbour, a city, canyon mesas, a hall.

function backdropCanvas(key, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 512;
  const g = c.getContext('2d');
  draw(g, c.width, c.height, new RNG(key));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

/** A jagged silhouette band along the bottom of the panorama. */
function ridge(g, W, H, rng, base, rough, color, step = 40) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, H);
  let y = base;
  const first = y;
  for (let x = 0; x <= W; x += step) {
    y = Math.max(base - rough, Math.min(base + rough, y + rng.range(-rough * 0.45, rough * 0.45)));
    g.lineTo(x, x + step > W ? first : y);
  }
  g.lineTo(W, H);
  g.closePath();
  g.fill();
}

const BACKDROPS = {
  // moonlit harbour: hills, a town of warm windows, one lighthouse
  harbor(g, W, H, rng) {
    ridge(g, W, H, rng, H * 0.66, 40, '#141c44');
    ridge(g, W, H, rng, H * 0.76, 26, '#0e1434', 30);
    for (let i = 0; i < 70; i++) {
      const x = rng.range(0, W);
      const bw = rng.range(14, 40);
      const bh = rng.range(14, 52);
      g.fillStyle = '#0a0f2a';
      g.fillRect(x, H * 0.86 - bh, bw, bh + 80);
      g.fillStyle = rng.chance(0.75) ? '#ffc860' : '#ffe8b0';
      for (let k = 0; k < 3; k++) if (rng.chance(0.6)) g.fillRect(x + rng.range(2, bw - 5), H * 0.86 - rng.range(4, bh - 4), 3, 4);
    }
    for (const lx of [W * 0.21, W * 0.71]) {
      g.fillStyle = '#e8e2d2';
      g.beginPath();
      g.moveTo(lx - 9, H * 0.84);
      g.lineTo(lx - 5, H * 0.52);
      g.lineTo(lx + 5, H * 0.52);
      g.lineTo(lx + 9, H * 0.84);
      g.fill();
      g.fillStyle = '#c0283a';
      g.fillRect(lx - 7, H * 0.62, 14, 12);
      g.fillRect(lx - 8, H * 0.74, 16, 12);
      g.fillStyle = '#0a0f2a';
      g.fillRect(lx - 8, H * 0.49, 16, 5);
      const beam = g.createLinearGradient(lx, 0, lx + 380, 0);
      beam.addColorStop(0, 'rgba(255,236,170,0.75)');
      beam.addColorStop(1, 'rgba(255,236,170,0)');
      g.fillStyle = beam;
      g.beginPath();
      g.moveTo(lx, H * 0.5);
      g.lineTo(lx + 380, H * 0.4);
      g.lineTo(lx + 380, H * 0.56);
      g.fill();
      g.fillStyle = '#fff2c0';
      g.beginPath();
      g.arc(lx, H * 0.5, 6, 0, 7);
      g.fill();
    }
    g.fillStyle = '#080c24';
    g.fillRect(0, H * 0.86, W, H);
  },
  // midnight city: three ranks of towers, lit windows, rooftop masts
  city(g, W, H, rng) {
    for (let layer = 0; layer < 3; layer++) {
      let x = 0;
      const shadeL = ['#1c2460', '#131a48', '#0a0e2c'][layer];
      while (x < W) {
        const bw = rng.range(36, 110) * (1 + layer * 0.25);
        const bh = rng.range(H * 0.25, H * (0.86 - layer * 0.16));
        g.fillStyle = shadeL;
        g.fillRect(x, H - bh, bw, bh);
        if (rng.chance(0.35)) g.fillRect(x + bw * 0.3, H - bh - rng.range(10, 34), bw * 0.4, 40);
        if (rng.chance(0.3)) {
          g.fillRect(x + bw / 2 - 1.5, H - bh - 46, 3, 46);
          g.fillStyle = '#ff4a5a';
          g.fillRect(x + bw / 2 - 2.5, H - bh - 50, 5, 5);
        }
        const cols = Math.floor(bw / 11);
        for (let wy = H - bh + 10; wy < H - 8; wy += 15)
          for (let k = 0; k < cols; k++) {
            if (!rng.chance(0.3 + layer * 0.06)) continue;
            g.fillStyle = rng.chance(0.7) ? '#ffcf70' : '#6fe0f0';
            g.fillRect(x + 5 + k * 11, wy, 6, 8);
          }
        x += bw + rng.range(0, 12);
      }
    }
  },
  // twilight canyon: layered mesas with sun-caught rims
  mesas(g, W, H, rng) {
    const layers = [
      [H * 0.52, '#5a3a8a', '#f09a4a'],
      [H * 0.66, '#3a2668', '#c8683a'],
      [H * 0.8, '#22164a', '#7a3a4a'],
    ];
    for (const [base, color, rim] of layers) {
      g.beginPath();
      g.moveTo(0, H);
      let x = 0;
      let y = base;
      const y0 = y;
      const pts = [];
      while (x < W) {
        const flat = rng.range(60, 220);
        pts.push([x, y], [Math.min(W, x + flat), y]);
        x += flat + rng.range(10, 30);
        y = base + rng.range(-70, 46);
      }
      pts.push([W, y0]);
      pts[0][1] = y0;
      for (const [px, py] of pts) g.lineTo(px, py);
      g.lineTo(W, H);
      g.closePath();
      g.fillStyle = color;
      g.fill();
      g.strokeStyle = rim;
      g.lineWidth = 3;
      g.beginPath();
      pts.forEach(([px, py], i) => g[i ? 'lineTo' : 'moveTo'](px, py));
      g.stroke();
      g.strokeStyle = 'rgba(10,6,30,0.3)';
      g.lineWidth = 2;
      for (let i = 0; i < 60; i++) {
        const hx = rng.range(0, W);
        const hy = rng.range(base - 20, H);
        g.beginPath();
        g.moveTo(hx, hy);
        g.lineTo(hx + rng.range(-6, 6), hy + rng.range(20, 60));
        g.stroke();
      }
    }
  },
  // sub-level industrial hall: catwalks, glowing conduits, stencilled sectors
  sublevel(g, W, H, rng) {
    g.fillStyle = '#0a1e28';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 128) {
      g.fillStyle = '#0f2c38';
      g.fillRect(x + 4, 0, 120, H);
      g.fillStyle = '#081820';
      g.fillRect(x, 0, 8, H);
    }
    for (let i = 0; i < 26; i++) {
      const x = rng.range(0, W);
      const w = rng.range(8, 22);
      g.fillStyle = '#163a46';
      g.fillRect(x, 0, w, H);
      if (rng.chance(0.55)) {
        const col = rng.chance(0.7) ? '79,232,192' : '79,200,240';
        const gr = g.createLinearGradient(x - 14, 0, x + w + 14, 0);
        gr.addColorStop(0, `rgba(${col},0)`);
        gr.addColorStop(0.5, `rgba(${col},0.5)`);
        gr.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = gr;
        g.fillRect(x - 14, 0, w + 28, H);
        g.fillStyle = `rgba(${col},0.95)`;
        g.fillRect(x + w / 2 - 1.5, 0, 3, H);
      }
    }
    for (const y of [H * 0.34, H * 0.68]) {
      g.fillStyle = '#06141a';
      g.fillRect(0, y, W, 12);
      g.strokeStyle = '#06141a';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, y - 34);
      g.lineTo(W, y - 34);
      for (let x = 0; x < W; x += 32) {
        g.moveTo(x, y - 34);
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(240,194,58,0.6)';
    g.font = '700 54px Bangers, Impact, sans-serif';
    for (let i = 0; i < 4; i++) g.fillText(`SECTOR ${'ABCD'[i]}-${rng.int(2, 31)}`, i * (W / 4) + 60, H * 0.56);
  },
  // museum outer hall: colonnade and tall moonlit windows
  hall(g, W, H, rng) {
    g.fillStyle = '#150a22';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 256) {
      const gr = g.createLinearGradient(0, H * 0.1, 0, H);
      gr.addColorStop(0, 'rgba(150,170,255,0.75)');
      gr.addColorStop(1, 'rgba(80,60,160,0.2)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x + 78, H);
      g.lineTo(x + 78, H * 0.34);
      g.quadraticCurveTo(x + 128, H * 0.06, x + 178, H * 0.34);
      g.lineTo(x + 178, H);
      g.fill();
      g.strokeStyle = '#150a22';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x + 128, H * 0.1);
      g.lineTo(x + 128, H);
      for (const yy of [0.4, 0.6, 0.8]) {
        g.moveTo(x + 78, H * yy);
        g.lineTo(x + 178, H * yy);
      }
      g.stroke();
      g.fillStyle = '#2a1840';
      g.fillRect(x - 22, 0, 44, H);
      g.fillStyle = '#e2b450';
      g.fillRect(x - 28, H * 0.08, 56, 8);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x + 6, 0, 16, H);
      if (rng.chance(0.5)) {
        g.fillStyle = '#7a1424';
        g.fillRect(x + 196, H * 0.2, 40, H * 0.55);
        g.fillStyle = '#e2b450';
        g.fillRect(x + 196, H * 0.2, 40, 6);
      }
    }
  },
  // VR horizon: glow bands and receding verticals
  vr(g, W, H) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(58,232,255,0)');
    gr.addColorStop(0.72, 'rgba(58,232,255,0.1)');
    gr.addColorStop(0.9, 'rgba(255,58,200,0.5)');
    gr.addColorStop(1, 'rgba(58,232,255,0.9)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(58,232,255,0.5)';
    for (let x = 0; x < W; x += 64) g.fillRect(x, H * 0.55, 2, H);
    for (let i = 0; i < 6; i++) g.fillRect(0, H * (0.62 + i * 0.07), W, 2);
    g.fillStyle = '#ff3ac8';
    g.fillRect(0, H - 6, W, 6);
  },
};

export function backdropTexture(kind) {
  return backdropCanvas(`backdrop:${kind}`, BACKDROPS[kind]);
}

/** The city seen from the 88th floor: dark blocks, glowing streets, window specks. */
export function cityBelowTexture() {
  return make('citybelow', 512, (g, s, rng) => {
    g.fillStyle = '#0a0e2a';
    g.fillRect(0, 0, s, s);
    const n = 4;
    const t = s / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        g.fillStyle = `rgb(${rng.int(16, 30)},${rng.int(22, 38)},${rng.int(60, 92)})`;
        const pad = rng.range(10, 20);
        g.fillRect(x * t + pad, y * t + pad, t - pad * 2, t - pad * 2);
        for (let k = 0; k < 14; k++) {
          g.fillStyle = rng.chance(0.7) ? 'rgba(255,207,112,0.9)' : 'rgba(111,224,240,0.9)';
          g.fillRect(x * t + rng.range(pad + 3, t - pad - 6), y * t + rng.range(pad + 3, t - pad - 6), 3, 3);
        }
      }
    for (let i = 0; i <= n; i++) {
      const gr = g.createLinearGradient(i * t - 9, 0, i * t + 9, 0);
      gr.addColorStop(0, 'rgba(255,170,70,0)');
      gr.addColorStop(0.5, 'rgba(255,190,90,0.85)');
      gr.addColorStop(1, 'rgba(255,170,70,0)');
      g.fillStyle = gr;
      g.fillRect(i * t - 9, 0, 18, s);
      const gr2 = g.createLinearGradient(0, i * t - 9, 0, i * t + 9);
      gr2.addColorStop(0, 'rgba(255,170,70,0)');
      gr2.addColorStop(0.5, 'rgba(255,190,90,0.85)');
      gr2.addColorStop(1, 'rgba(255,170,70,0)');
      g.fillStyle = gr2;
      g.fillRect(0, i * t - 9, s, 18);
    }
  });
}

/** Moonlit sea: a deep wash with inked wave crests and scattered glints. */
export function oceanTexture() {
  return make('ocean', 512, (g, s, rng) => {
    const gr = g.createLinearGradient(0, 0, s, s);
    gr.addColorStop(0, '#102a5a');
    gr.addColorStop(1, '#0c2048');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const x = rng.range(0, s);
      const y = rng.range(0, s);
      const w = rng.range(18, 60);
      g.strokeStyle = rng.chance(0.3) ? 'rgba(190,225,255,0.55)' : 'rgba(70,140,200,0.5)';
      g.lineWidth = rng.range(1.5, 3);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + w / 2, y - w * 0.22, x + w, y);
      g.stroke();
    }
  });
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
  g.font = `400 ${size}px Bangers, Impact, "Arial Black", sans-serif`;
  const tw = g.measureText(text).width;
  if (tw > w * 0.84) size *= (w * 0.84) / tw;
  g.font = `400 ${size}px Bangers, Impact, "Arial Black", sans-serif`;
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
