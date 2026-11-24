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
  // emerald casino carpet: a lattice of teal diamonds with gold trim
  baize(g, s, rng) {
    shade(g, s, '#1a6a54', '#145a4a');
    const n = 4;
    const t = s / n;
    const lw = Math.max(1, Math.round(s / 256));
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const cx = (x + 0.5) * t;
        const cy = (y + 0.5) * t;
        const diamond = (r, c) => {
          g.fillStyle = c;
          g.beginPath();
          g.moveTo(cx, cy - r);
          g.lineTo(cx + r, cy);
          g.lineTo(cx, cy + r);
          g.lineTo(cx - r, cy);
          g.closePath();
          g.fill();
        };
        diamond(t * 0.5, (x + y) % 2 ? '#0f4c4a' : '#136052');
        diamond(t * 0.3, 'rgba(226,180,80,0.5)');
        diamond(t * 0.3 - lw * 2, (x + y) % 2 ? '#17705a' : '#0e4a48');
        diamond(t * 0.07, '#e2b450');
      }
    // gold trim where the diamonds meet
    g.strokeStyle = 'rgba(226,180,80,0.34)';
    g.lineWidth = lw;
    g.beginPath();
    for (let i = -n; i <= n * 2; i++) {
      g.moveTo(i * t, 0);
      g.lineTo(i * t + s, s);
      g.moveTo(i * t, 0);
      g.lineTo(i * t - s, s);
    }
    g.stroke();
    for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) rect(g, '#b0182c', x * t - lw * 2, y * t - lw * 2, lw * 4, lw * 4);
    hatch(g, s, rng, 4, 0.1);
    grit(g, s, rng, { stains: 3, cracks: 0 });
  },
  // terracotta and slate conservatory pavers, moss in the mortar
  flagstone(g, s, rng) {
    fill(g, s, '#3f6a3c');
    const rows = 4;
    const rh = s / rows;
    const gap = Math.max(2, Math.round(s / 128));
    for (let y = 0; y < rows; y++) {
      const cols = y % 2 ? 3 : 2;
      const off = y % 2 ? -s / 6 : 0;
      for (let x = 0; x <= cols; x++) {
        const cw = s / cols;
        const slate = rng.chance(0.3);
        const v = rng.int(-8, 8);
        const [r, gg, b] = slate ? [84 + v, 96 + v, 108 + v] : [176 + v, 104 + v, 72 + v];
        const px = off + x * cw;
        g.fillStyle = `rgb(${r},${gg},${b})`;
        g.fillRect(R(px + gap / 2), R(y * rh + gap / 2), R(cw - gap), R(rh - gap));
        const gr = g.createLinearGradient(px, y * rh, px + cw, y * rh + rh);
        gr.addColorStop(0, 'rgba(255,255,255,0.08)');
        gr.addColorStop(1, 'rgba(0,0,0,0.12)');
        g.fillStyle = gr;
        g.fillRect(R(px + gap / 2), R(y * rh + gap / 2), R(cw - gap), R(rh - gap));
      }
    }
    // moss creeping out of a few joints
    for (let i = 0; i < 10; i++) {
      g.fillStyle = `rgba(88,150,72,${rng.range(0.25, 0.5)})`;
      g.beginPath();
      g.ellipse(rng.range(0, s), R(rng.int(0, rows) * rh), rng.range(s * 0.02, s * 0.06), rng.range(s * 0.006, s * 0.014), 0, 0, 7);
      g.fill();
    }
    hatch(g, s, rng, 6, 0.12);
    grit(g, s, rng, { stains: 6, cracks: 3 });
  },
  // honey and walnut herringbone lodge planks
  herringbone(g, s, rng) {
    fill(g, s, '#3a2212');
    const n = 4; // chevron columns
    const cw = s / n;
    const ph = s / 8; // plank thickness along v
    const lw = Math.max(1, Math.round(s / 256));
    for (let c = 0; c < n; c++) {
      const up = c % 2 === 0;
      for (let k = -2; k < 10; k++) {
        const v = rng.int(-10, 10);
        const walnut = rng.chance(0.3);
        const [r, gg, b] = walnut ? [124 + v, 76 + v, 42 + v] : [196 + v, 138 + v, 70 + v];
        const x0 = c * cw;
        const y0 = k * ph;
        const rise = up ? -cw : cw;
        g.fillStyle = `rgb(${r},${gg},${b})`;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x0 + cw, y0 + rise);
        g.lineTo(x0 + cw, y0 + rise + ph);
        g.lineTo(x0, y0 + ph);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(52,26,10,0.8)';
        g.lineWidth = lw;
        g.stroke();
        // one soft grain line down each plank
        g.strokeStyle = 'rgba(70,36,14,0.2)';
        g.beginPath();
        g.moveTo(x0 + lw, y0 + ph * 0.5);
        g.lineTo(x0 + cw - lw, y0 + rise + ph * 0.5);
        g.stroke();
      }
      rect(g, 'rgba(40,20,8,0.85)', c * cw, 0, lw, s);
    }
    grit(g, s, rng, { stains: 5, cracks: 0 });
  },
  // gritty transit chequer with a yellow platform-edge stripe
  metro(g, s, rng) {
    panels(g, s, rng, 4, [[62, 68, 76], [92, 98, 104]], 'rgba(14,16,20,0.85)', 5);
    const lw = Math.max(1, Math.round(s / 256));
    const y = s * 0.44;
    const band = s * 0.12;
    rect(g, '#f2c230', 0, y, s, band);
    rect(g, 'rgba(14,16,20,0.85)', 0, y, s, lw * 2);
    rect(g, 'rgba(14,16,20,0.85)', 0, y + band - lw * 2, s, lw * 2);
    // tactile studs along the stripe
    g.fillStyle = 'rgba(120,84,10,0.55)';
    for (let x = s / 32; x < s; x += s / 16)
      for (const yy of [y + band * 0.32, y + band * 0.68]) {
        g.beginPath();
        g.arc(x, yy, s / 110, 0, 7);
        g.fill();
      }
    hatch(g, s, rng, 8, 0.16);
    grit(g, s, rng, { stains: 9, cracks: 6 });
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
  // burgundy damask above brass-trimmed art-deco wainscoting
  casinowall(g, s, rng) {
    wallBase(g, s, rng, '#8a1c34', '#5a1228', { base: '#3a0e22', baseY: 0.58 });
    const lw = Math.max(1, Math.round(s / 256));
    // faint damask diamonds on the upper wall
    g.fillStyle = 'rgba(255,170,150,0.07)';
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 4; x++) {
        const cx = (x + (y % 2 ? 0.5 : 0)) * (s / 4) + s / 8;
        const cy = s * 0.1 + y * s * 0.17;
        g.beginPath();
        g.moveTo(cx, cy - s * 0.06);
        g.lineTo(cx + s * 0.04, cy);
        g.lineTo(cx, cy + s * 0.06);
        g.lineTo(cx - s * 0.04, cy);
        g.fill();
      }
    // brass chair rail, then stepped deco panels in the wainscot
    rect(g, '#e2b450', 0, s * 0.56, s, lw * 5);
    rect(g, '#7a5a1c', 0, s * 0.56 + lw * 5, s, lw * 2);
    g.strokeStyle = '#c89a3a';
    g.lineWidth = lw * 2;
    for (let i = 0; i < 2; i++) {
      const x0 = i * (s / 2) + s * 0.06;
      const pw = s / 2 - s * 0.12;
      g.strokeRect(R(x0), R(s * 0.64), R(pw), R(s * 0.26));
      // sunburst fan rising from the panel foot
      g.lineWidth = lw;
      for (let k = -3; k <= 3; k++) {
        g.beginPath();
        g.moveTo(x0 + pw / 2, s * 0.9);
        g.lineTo(x0 + pw / 2 + k * pw * 0.13, s * 0.68 + Math.abs(k) * s * 0.022);
        g.stroke();
      }
      g.lineWidth = lw * 2;
    }
    rect(g, '#e2b450', 0, s * 0.955, s, lw * 4);
  },
  // wrought-iron mullions over misty teal glass, on a low brick plinth
  glasshouse(g, s, rng) {
    const gr = g.createLinearGradient(0, 0, 0, s);
    gr.addColorStop(0, '#2f6a66');
    gr.addColorStop(0.55, '#3f8a80');
    gr.addColorStop(1, '#245650');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    // condensation: pale mist pooling low on each pane, a few runs
    for (let i = 0; i < 2; i++) {
      const m = g.createLinearGradient(0, s * 0.3, 0, s * 0.8);
      m.addColorStop(0, 'rgba(200,255,240,0)');
      m.addColorStop(1, 'rgba(200,255,240,0.2)');
      g.fillStyle = m;
      g.fillRect(i * (s / 2), s * 0.3, s / 2, s * 0.5);
    }
    g.strokeStyle = 'rgba(210,255,245,0.22)';
    g.lineWidth = Math.max(1, s / 256);
    for (let i = 0; i < 9; i++) {
      const x = rng.range(0, s);
      const y = rng.range(s * 0.08, s * 0.5);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rng.range(-3, 3), y + rng.range(s * 0.05, s * 0.2));
      g.stroke();
    }
    // leaf shadows pressed against the glass
    for (let i = 0; i < 7; i++) {
      g.fillStyle = `rgba(12,48,36,${rng.range(0.25, 0.45)})`;
      g.beginPath();
      g.ellipse(rng.range(0, s), rng.range(s * 0.45, s * 0.8), rng.range(s * 0.03, s * 0.07), rng.range(s * 0.012, s * 0.025), rng.range(-1, 1), 0, 7);
      g.fill();
    }
    const iron = '#141c1c';
    const bar = Math.max(3, Math.round(s / 48));
    for (let i = 0; i <= 2; i++) rect(g, iron, Math.min(s - bar, i * (s / 2) - bar / 2), 0, bar, s);
    for (const y of [0.0, 0.26, 0.54]) rect(g, iron, 0, s * y, s, bar);
    // arched heads on the top lights
    g.strokeStyle = iron;
    g.lineWidth = bar * 0.7;
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      g.arc(i * (s / 2) + s / 4, s * 0.26, s / 4 - bar, Math.PI, 0);
      g.stroke();
    }
    rect(g, '#5a3a30', 0, s * 0.82, s, s * 0.18);
    rect(g, iron, 0, s * 0.82, s, bar);
    const lw = Math.max(1, Math.round(s / 256));
    for (let r = 0; r < 3; r++) {
      rect(g, 'rgba(70,110,70,0.6)', 0, s * (0.88 + r * 0.045), s, lw);
      for (let x = (r % 2) * (s / 8); x < s; x += s / 4) rect(g, 'rgba(70,110,70,0.6)', x, s * (0.835 + r * 0.045), lw, s * 0.045);
    }
  },
  // dark cedar beams over rough alpine slate
  timber(g, s, rng) {
    wallBase(g, s, rng, '#8a6a4a', '#6a4c34');
    const lw = Math.max(1, Math.round(s / 256));
    // horizontal cedar boards
    for (let i = 0; i < 5; i++) {
      const y = (i * s * 0.6) / 5;
      const v = rng.int(-10, 10);
      rect(g, `rgb(${116 + v},${76 + v},${46 + v})`, 0, y, s, (s * 0.6) / 5);
      rect(g, 'rgba(36,18,8,0.75)', 0, y, s, lw);
      g.strokeStyle = 'rgba(50,26,10,0.22)';
      g.lineWidth = lw;
      g.beginPath();
      const gy = y + rng.range(s * 0.03, s * 0.09);
      g.moveTo(0, gy);
      g.bezierCurveTo(s * 0.3, gy + rng.range(-5, 5), s * 0.7, gy + rng.range(-5, 5), s, gy);
      g.stroke();
    }
    // slate stonework below the dado
    const y0 = s * 0.6;
    rect(g, '#2c3440', 0, y0, s, s - y0);
    for (let r = 0; r < 3; r++) {
      const rh = (s - y0) / 3;
      let x = r % 2 ? -s * 0.1 : 0;
      while (x < s) {
        const sw = rng.range(s * 0.16, s * 0.3);
        const v = rng.int(-10, 10);
        g.fillStyle = `rgb(${74 + v},${84 + v},${98 + v})`;
        g.fillRect(R(x + lw), R(y0 + r * rh + lw), R(sw - lw * 2), R(rh - lw * 2));
        x += sw;
      }
    }
    // heavy dark posts and the dado beam
    const post = Math.round(s / 14);
    rect(g, '#2e1a10', 0, 0, post, s);
    rect(g, '#2e1a10', s / 2 - post / 2, 0, post, y0);
    rect(g, '#2e1a10', 0, y0 - post / 2, s, post);
    rect(g, '#2e1a10', 0, 0, s, post * 0.8);
    rect(g, 'rgba(255,200,140,0.14)', 0, y0 - post / 2, s, lw * 2);
    hatch(g, s, rng, 5, 0.14);
  },
  // glazed off-white subway brick, dark grout, one amber-and-slate line band
  subwaytile(g, s, rng) {
    fill(g, s, '#23282e');
    const rows = 10;
    const th = s / rows;
    const tw = s / 4;
    const gap = Math.max(1, Math.round(s / 200));
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? -tw / 2 : 0;
      const low = y >= rows - 2;
      for (let x = 0; x <= 4; x++) {
        const v = rng.int(-7, 5);
        const [r, gg, b] = low ? [78 + v, 90 + v, 102 + v] : [226 + v, 224 + v, 210 + v];
        g.fillStyle = `rgb(${r},${gg},${b})`;
        g.fillRect(R(off + x * tw + gap), R(y * th + gap), R(tw - gap * 2), R(th - gap * 2));
        // the glaze: a pale catch-light along the top edge of each brick
        g.fillStyle = low ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)';
        g.fillRect(R(off + x * tw + gap), R(y * th + gap), R(tw - gap * 2), Math.max(1, R(th * 0.12)));
      }
    }
    // the line colour: an amber band with slate keylines at eye level
    rect(g, '#23282e', 0, th * 3 - gap, s, th + gap * 2);
    rect(g, '#ffa820', 0, th * 3 + gap, s, th - gap * 2);
    rect(g, '#3ad8e8', 0, th * 4 + gap * 2, s, Math.max(2, gap * 2));
    // decades of soot gathering toward the floor
    const soot = g.createLinearGradient(0, s * 0.5, 0, s);
    soot.addColorStop(0, 'rgba(10,12,16,0)');
    soot.addColorStop(1, 'rgba(10,12,16,0.3)');
    g.fillStyle = soot;
    g.fillRect(0, s * 0.5, s, s * 0.5);
    hatch(g, s, rng, 4, 0.14);
    grit(g, s, rng, { stains: 6, cracks: 3 });
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

export const FLOOR_KEYS = Object.keys(FLOORS);
export const WALL_KEYS = Object.keys(WALLS);

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
  // the conservatory grounds: layered canopies, palms, lamp-lit paths in the mist
  garden(g, W, H, rng) {
    const layers = [
      [H * 0.42, 60, '#143c38'],
      [H * 0.56, 46, '#0e2e2a'],
      [H * 0.72, 34, '#08201c'],
    ];
    layers.forEach(([base, rough, color], li) => {
      g.fillStyle = color;
      // rounded tree crowns shouldering along the horizon
      const first = base + rng.range(-rough, rough) * 0.3;
      g.beginPath();
      g.moveTo(0, H);
      g.lineTo(0, first);
      for (let x = 0; x < W; ) {
        const cw = rng.range(50, 130);
        const top = base + rng.range(-rough, rough * 0.4);
        const end = Math.min(W, x + cw);
        g.quadraticCurveTo(x + (end - x) / 2, top - cw * 0.35, end, end >= W ? first : base + rng.range(-rough * 0.3, rough * 0.3));
        x = end;
      }
      g.lineTo(W, H);
      g.closePath();
      g.fill();
      // a few palms standing proud of the canopy
      for (let i = 0; i < 5; i++) {
        const px = rng.range(40, W - 40);
        const top = base - rng.range(40, 90);
        g.strokeStyle = color;
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(px, base + 20);
        g.quadraticCurveTo(px + rng.range(-14, 14), (base + top) / 2, px, top);
        g.stroke();
        g.lineWidth = 4;
        for (let k = 0; k < 7; k++) {
          const a = Math.PI + (k / 6) * Math.PI;
          g.beginPath();
          g.moveTo(px, top);
          g.quadraticCurveTo(px + Math.cos(a) * 26, top + Math.sin(a) * 26 - 10, px + Math.cos(a) * 46, top + Math.sin(a) * 14 + 16);
          g.stroke();
        }
      }
      // mist lying between the layers, and warm path lamps in the nearest
      const mist = g.createLinearGradient(0, base, 0, base + 90);
      mist.addColorStop(0, 'rgba(140,230,200,0)');
      mist.addColorStop(1, `rgba(140,230,200,${0.1 + li * 0.04})`);
      g.fillStyle = mist;
      g.fillRect(0, base, W, 90);
    });
    for (let i = 0; i < 16; i++) {
      const lx = rng.range(0, W);
      const ly = rng.range(H * 0.74, H * 0.92);
      const gl = g.createRadialGradient(lx, ly, 0, lx, ly, 26);
      gl.addColorStop(0, 'rgba(255,190,110,0.85)');
      gl.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = gl;
      g.fillRect(lx - 26, ly - 26, 52, 52);
    }
  },
  // moonlit peaks: snowfields, blue shadow faces, a black line of pines
  peaks(g, W, H, rng) {
    const layers = [
      [H * 0.34, 120, '#5a78b8', '#e8f0ff'],
      [H * 0.52, 90, '#34508e', '#c8d8f8'],
      [H * 0.7, 50, '#1e2f62', '#9ab4e8'],
    ];
    for (const [base, rough, color, snow] of layers) {
      const pts = [];
      let y = base;
      const y0 = y;
      for (let x = 0; x <= W; x += rng.range(70, 150)) {
        pts.push([x, y]);
        y = base + rng.range(-rough, rough * 0.5);
      }
      pts.push([W, y0]);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, H);
      for (const [px, py] of pts) g.lineTo(px, py);
      g.lineTo(W, H);
      g.closePath();
      g.fill();
      // moonlit snow on the left face of every summit
      g.fillStyle = snow;
      for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i];
        if (py > pts[i - 1][1] || py > pts[i + 1][1]) continue;
        const [lx, ly] = pts[i - 1];
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + (lx - px) * 0.55, py + (ly - py) * 0.55);
        g.lineTo(px + (lx - px) * 0.3, py + (ly - py) * 0.55 + 14);
        g.lineTo(px - 6, py + (ly - py) * 0.4 + 26);
        g.lineTo(px + 10, py + 30);
        g.closePath();
        g.fill();
      }
    }
    // the treeline: ink-dark pines, a few lit chalet windows among them
    for (let x = 0; x < W; x += rng.range(12, 26)) {
      const th = rng.range(34, 84);
      const by = H * 0.86 + rng.range(-10, 10);
      g.fillStyle = '#0a1230';
      g.beginPath();
      g.moveTo(x, by - th);
      g.lineTo(x + th * 0.24, by);
      g.lineTo(x - th * 0.24, by);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#0a1230';
    g.fillRect(0, H * 0.86, W, H * 0.14);
    for (let i = 0; i < 22; i++) {
      g.fillStyle = 'rgba(255,186,96,0.9)';
      g.fillRect(R(rng.range(0, W)), R(rng.range(H * 0.82, H * 0.9)), 6, 5);
    }
  },
  // the running tunnels: tiled arches, a dead platform, signal lamps in the dark
  tunnel(g, W, H, rng) {
    g.fillStyle = '#0c1118';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 256) {
      // tunnel mouth
      const gr = g.createRadialGradient(x + 128, H * 0.66, 10, x + 128, H * 0.66, 130);
      gr.addColorStop(0, '#02030a');
      gr.addColorStop(0.7, '#060a12');
      gr.addColorStop(1, '#141c26');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x + 40, H);
      g.lineTo(x + 40, H * 0.56);
      g.quadraticCurveTo(x + 128, H * 0.2, x + 216, H * 0.56);
      g.lineTo(x + 216, H);
      g.fill();
      // tiled arch ring, amber line band above it
      g.strokeStyle = '#c8c6b8';
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(x + 40, H);
      g.lineTo(x + 40, H * 0.56);
      g.quadraticCurveTo(x + 128, H * 0.2, x + 216, H * 0.56);
      g.lineTo(x + 216, H);
      g.stroke();
      g.strokeStyle = 'rgba(10,12,16,0.6)';
      g.lineWidth = 2;
      for (let k = 0; k < 9; k++) {
        const yy = H * (0.6 + k * 0.045);
        g.beginPath();
        g.moveTo(x + 35, yy);
        g.lineTo(x + 45, yy);
        g.moveTo(x + 211, yy);
        g.lineTo(x + 221, yy);
        g.stroke();
      }
      // rails converging into the dark, a signal lamp at the mouth
      g.strokeStyle = 'rgba(160,180,200,0.4)';
      g.beginPath();
      g.moveTo(x + 86, H);
      g.lineTo(x + 122, H * 0.68);
      g.moveTo(x + 170, H);
      g.lineTo(x + 134, H * 0.68);
      g.stroke();
      const sig = rng.chance(0.3) ? '255,70,60' : rng.chance(0.5) ? '58,216,232' : '255,168,32';
      const gl = g.createRadialGradient(x + 128, H * 0.62, 0, x + 128, H * 0.62, 30);
      gl.addColorStop(0, `rgba(${sig},0.95)`);
      gl.addColorStop(1, `rgba(${sig},0)`);
      g.fillStyle = gl;
      g.fillRect(x + 98, H * 0.62 - 30, 60, 60);
      // the pier between arches: tile, an amber band, a roundel sign
      g.fillStyle = '#1c242e';
      g.fillRect(x - 40, 0, 80, H);
      g.fillStyle = '#ffa820';
      g.fillRect(x - 40, H * 0.3, 80, 12);
      g.fillStyle = '#3ad8e8';
      g.beginPath();
      g.arc(x, H * 0.46, 22, 0, 7);
      g.fill();
      g.fillStyle = '#0c1118';
      g.beginPath();
      g.arc(x, H * 0.46, 13, 0, 7);
      g.fill();
      g.fillStyle = '#e8e4d8';
      g.fillRect(x - 30, H * 0.46 - 5, 60, 10);
    }
    // conduit runs and the lamp line along the crown
    g.fillStyle = 'rgba(255,168,48,0.5)';
    for (let x = 60; x < W; x += 128) g.fillRect(x, H * 0.1, 26, 5);
    g.fillStyle = '#05070c';
    g.fillRect(0, H * 0.14, W, 4);
    g.fillRect(0, H * 0.17, W, 3);
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

export const BACKDROP_KEYS = Object.keys(BACKDROPS);

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
