// Procedural pixel-art textures. Nothing is downloaded: every surface is
// painted here at load time, at deliberately low resolution (64-128 px) and
// sampled with nearest-neighbour filtering so texels stay crisp and chunky,
// PS1 style. Palettes are dark and dirty: grime, stains, cracks, ink hatching.

import * as THREE from 'three';
import { RNG } from '../core/rng.js';

const cache = new Map();

function make(key, size, draw, { repeat = true, pixel = true } = {}) {
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
  } else t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

const css = (hex, a = 1) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
const R = Math.round;

/**
 * The grime pass every surface gets: chunky per-texel noise, diagonal ink
 * hatching, dark stains, hairline cracks and drips.
 */
function grit(g, s, rng, { noise = 16, hatch = 0.2, stains = 5, cracks = 2, drips = 0, scratches = 0 } = {}) {
  const img = g.getImageData(0, 0, s, s);
  const d = img.data;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      // three-level noise reads as texture rather than fuzz
      let n = (Math.floor(rng.next() * 3) - 1) * noise;
      if ((x + y) % 4 === 0 && rng.chance(hatch)) n -= noise * 1.6;
      if ((x - y + s) % 6 === 0 && rng.chance(hatch * 0.5)) n -= noise;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < stains; i++) {
    g.fillStyle = `rgba(0,0,0,${rng.range(0.12, 0.3)})`;
    const cx = rng.range(0, s);
    const cy = rng.range(0, s);
    for (let k = 0; k < 14; k++) {
      const r = rng.range(1, s * 0.07);
      g.fillRect(R(cx + rng.range(-s * 0.08, s * 0.08)), R(cy + rng.range(-s * 0.08, s * 0.08)), R(r), R(r * rng.range(0.5, 1.5)));
    }
  }
  for (let i = 0; i < cracks; i++) {
    g.fillStyle = 'rgba(0,0,0,0.7)';
    let x = rng.range(0, s);
    let y = rng.range(0, s);
    let dx = rng.range(-1, 1);
    let dy = rng.range(-1, 1);
    for (let k = 0; k < s * 0.6; k++) {
      g.fillRect(R(x), R(y), 1, 1);
      if (rng.chance(0.3)) dx += rng.range(-0.6, 0.6);
      if (rng.chance(0.3)) dy += rng.range(-0.6, 0.6);
      const m = Math.hypot(dx, dy) || 1;
      x += dx / m;
      y += dy / m;
    }
  }
  for (let i = 0; i < drips; i++) {
    const x = R(rng.range(0, s));
    const y0 = R(rng.range(0, s * 0.5));
    const len = R(rng.range(s * 0.1, s * 0.45));
    for (let k = 0; k < len; k++) {
      g.fillStyle = `rgba(0,0,0,${0.4 * (1 - k / len)})`;
      g.fillRect(x, y0 + k, k < len * 0.3 ? 2 : 1, 1);
    }
  }
  for (let i = 0; i < scratches; i++) {
    g.fillStyle = `rgba(255,255,255,${rng.range(0.06, 0.16)})`;
    const x = R(rng.range(0, s));
    const y = R(rng.range(0, s));
    const len = R(rng.range(3, s * 0.2));
    const diag = rng.chance(0.5);
    for (let k = 0; k < len; k++) g.fillRect(x + k, y + (diag ? k >> 1 : 0), 1, 1);
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

// ------------------------------------------------------------------ floors (128px = 2m)

const FLOORS = {
  // rain-slicked dark teak
  teak(g, s, rng) {
    fill(g, s, '#3a2416');
    const planks = 8;
    const ph = s / planks;
    for (let i = 0; i < planks; i++) {
      const v = rng.int(-10, 10);
      rect(g, `rgb(${62 + v},${38 + v},${22 + v})`, 0, i * ph, s, ph);
      for (let k = 0; k < 5; k++) rect(g, 'rgba(0,0,0,0.22)', rng.range(0, s), i * ph + rng.range(2, ph - 2), rng.range(8, 40), 1);
      for (let k = 0; k < 2; k++) rect(g, 'rgba(160,190,220,0.13)', rng.range(0, s), i * ph + rng.range(2, ph - 2), rng.range(6, 26), 1);
      rect(g, '#0b0705', 0, i * ph, s, 1);
      rect(g, '#0b0705', rng.range(0, s), i * ph, 1, ph);
    }
    grit(g, s, rng, { noise: 9, stains: 7, cracks: 0, hatch: 0.12 });
  },
  // charcoal office carpet tiles
  carpet(g, s, rng) {
    fill(g, s, '#2c3146');
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) rect(g, (x + y) % 2 ? '#292e41' : '#31374e', x * (s / 2), y * (s / 2), s / 2, s / 2);
    grit(g, s, rng, { noise: 12, stains: 4, cracks: 0, hatch: 0.35 });
    for (let i = 0; i <= 2; i++) {
      rect(g, '#07080c', i * (s / 2) - 1, 0, 1, s);
      rect(g, '#07080c', 0, i * (s / 2) - 1, s, 1);
    }
  },
  // cracked, stained bio-bunker concrete
  tile(g, s, rng) {
    fill(g, s, '#3d4541');
    const n = 2;
    const t = s / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = rng.int(-9, 9);
        rect(g, `rgb(${64 + v},${72 + v},${68 + v})`, x * t + 1, y * t + 1, t - 2, t - 2);
      }
    grit(g, s, rng, { noise: 13, stains: 10, cracks: 5, hatch: 0.18 });
    for (let i = 0; i < 3; i++) rect(g, 'rgba(70,200,140,0.10)', rng.range(0, s), rng.range(0, s), rng.range(6, 18), rng.range(4, 12));
    for (let i = 0; i <= n; i++) {
      rect(g, '#121615', i * t - 1, 0, 2, s);
      rect(g, '#121615', 0, i * t - 1, s, 2);
    }
  },
  // scorched canyon stone
  sandstone(g, s, rng) {
    fill(g, s, '#4a3526');
    const n = 2;
    const t = s / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = rng.int(-12, 12);
        rect(g, `rgb(${84 + v},${60 + v},${42 + v})`, x * t + 1, y * t + 1, t - 2, t - 2);
      }
    grit(g, s, rng, { noise: 15, stains: 9, cracks: 4, hatch: 0.25 });
    for (let i = 0; i <= n; i++) {
      rect(g, '#150d08', i * t - 1, 0, 2, s);
      rect(g, '#150d08', 0, i * t - 1, s, 2);
    }
  },
  // pitch slate with thin gold seams
  marble(g, s, rng) {
    const n = 2;
    const t = s / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) rect(g, (x + y) % 2 ? '#15151c' : '#1d1c26', x * t, y * t, t, t);
    grit(g, s, rng, { noise: 7, stains: 4, cracks: 6, hatch: 0.1, scratches: 14 });
    for (let i = 0; i <= n; i++) {
      rect(g, '#8a6a2c', i * t, 0, 1, s);
      rect(g, '#8a6a2c', 0, i * t, s, 1);
    }
  },
  // 1998 VR Missions grid
  vrgrid(g, s) {
    fill(g, s, '#010a0d');
    const t = s / 2;
    for (let i = 0; i < 8; i++) {
      rect(g, 'rgba(40,255,225,0.10)', (i * s) / 8, 0, 1, s);
      rect(g, 'rgba(40,255,225,0.10)', 0, (i * s) / 8, s, 1);
    }
    for (let i = 0; i <= 2; i++) {
      rect(g, '#0c6a66', i * t - 1, 0, 3, s);
      rect(g, '#0c6a66', 0, i * t - 1, s, 3);
      rect(g, '#5cfff0', i * t, 0, 1, s);
      rect(g, '#5cfff0', 0, i * t, s, 1);
    }
  },
};

// ------------------------------------------------------------------ walls
// Wall textures span the full wall height (v 0..1) and tile every 2 m along u.

const WALLS = {
  // riveted, rust-streaked hull plating
  hull(g, s, rng) {
    shade(g, s, '#5d6468', '#33383c');
    for (let i = 0; i < 2; i++) {
      rect(g, '#16181a', i * (s / 2), 0, 1, s);
      rect(g, 'rgba(255,255,255,0.10)', i * (s / 2) + 1, 0, 1, s);
      for (let y = 6; y < s; y += 12) rect(g, '#1c1f21', i * (s / 2) + 4, y, 2, 2);
    }
    rect(g, '#11161c', 0, s * 0.8, s, s * 0.2);
    rect(g, '#7a5a1e', 0, s * 0.79, s, 2);
    grit(g, s, rng, { noise: 11, stains: 6, cracks: 1, drips: 9, hatch: 0.2 });
    for (let i = 0; i < 6; i++) rect(g, 'rgba(120,52,14,0.35)', rng.range(0, s), rng.range(0, s * 0.7), 1, rng.range(6, 30));
  },
  // 2AM boardroom: charcoal panels over dark walnut
  officewall(g, s, rng) {
    shade(g, s, '#2c2e3a', '#1c1d27');
    for (let i = 0; i < 4; i++) rect(g, '#0e0f15', i * (s / 4), 0, 1, s * 0.6);
    rect(g, '#2a170d', 0, s * 0.6, s, s * 0.4);
    for (let k = 0; k < 16; k++) rect(g, 'rgba(0,0,0,0.3)', 0, s * 0.6 + rng.range(0, s * 0.4), s, 1);
    rect(g, '#7a5a1e', 0, s * 0.6, s, 1);
    rect(g, '#0a0604', s * 0.06, s * 0.66, s * 0.38, 1);
    rect(g, '#0a0604', s * 0.56, s * 0.66, s * 0.38, 1);
    rect(g, '#0a0604', s * 0.06, s * 0.92, s * 0.38, 1);
    rect(g, '#0a0604', s * 0.56, s * 0.92, s * 0.38, 1);
    grit(g, s, rng, { noise: 9, stains: 4, cracks: 0, hatch: 0.22, scratches: 8 });
  },
  // grimy sub-level concrete with a chewed-up hazard stripe
  labwall(g, s, rng) {
    shade(g, s, '#4a5450', '#2c3331');
    for (let i = 0; i < 2; i++) rect(g, '#131716', i * (s / 2), 0, 2, s);
    rect(g, '#1d6a5a', 0, s * 0.3, s, 2);
    const y0 = R(s * 0.84);
    const hh = R(s * 0.09);
    for (let x = 0; x < s; x++)
      for (let y = 0; y < hh; y++) {
        const on = Math.floor((x + y) / 8) % 2 === 0;
        g.fillStyle = on ? '#b8901c' : '#121212';
        g.fillRect(x, y0 + y, 1, 1);
      }
    rect(g, '#161a19', 0, y0 + hh, s, s);
    grit(g, s, rng, { noise: 13, stains: 9, cracks: 4, drips: 12, hatch: 0.22 });
    for (let i = 0; i < 4; i++) rect(g, 'rgba(60,220,150,0.16)', rng.range(0, s), rng.range(s * 0.3, s * 0.8), 1, rng.range(8, 30));
  },
  // scorched stronghold blockwork
  blocks(g, s, rng) {
    fill(g, s, '#1a100a');
    const rows = 5;
    const rh = s / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? s / 4 : 0;
      for (let k = -1; k < 2; k++) {
        const v = rng.int(-13, 13);
        rect(g, `rgb(${78 + v},${56 + v},${40 + v})`, k * (s / 2) + off + 1, r * rh + 1, s / 2 - 2, rh - 2);
        rect(g, 'rgba(255,200,140,0.10)', k * (s / 2) + off + 1, r * rh + 1, s / 2 - 2, 1);
      }
    }
    grit(g, s, rng, { noise: 15, stains: 10, cracks: 5, drips: 5, hatch: 0.28 });
    shade(g, s, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.45)');
  },
  // noir gallery: slate panels, blood-crimson wainscot, gold pin line
  gallery(g, s, rng) {
    shade(g, s, '#23222c', '#14131a');
    for (let y = 0; y < s * 0.66; y += 8)
      for (let x = (y / 8) % 2 ? 4 : 0; x < s; x += 8) rect(g, 'rgba(180,140,60,0.10)', x, y, 1, 1);
    rect(g, '#3a0a10', 0, s * 0.68, s, s * 0.32);
    rect(g, '#8a6a2c', 0, s * 0.68, s, 1);
    rect(g, '#8a6a2c', 0, s * 0.95, s, 1);
    for (let i = 0; i < 2; i++) rect(g, '#1c0407', i * (s / 2) + 6, s * 0.74, s / 2 - 12, 1);
    grit(g, s, rng, { noise: 8, stains: 5, cracks: 1, drips: 3, hatch: 0.25 });
  },
  vrwall(g, s) {
    fill(g, s, '#01090c');
    for (let i = 0; i <= 4; i++) {
      rect(g, '#0b4a48', (i * s) / 4, 0, 1, s);
      rect(g, '#0b4a48', 0, (i * s) / 4, s, 1);
    }
    rect(g, '#5cfff0', 0, 0, s, 2);
    rect(g, '#1fb5a8', 0, s - 3, s, 3);
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
  return make(`floor:${name}`, 128, FLOORS[name]);
}
export function wallTexture(name) {
  return make(`wall:${name}`, 128, WALLS[name]);
}
export function miscTexture(name) {
  return make(`misc:${name}`, 64, MISC[name]);
}
export function skylineTexture() {
  return make('misc:skyline', 256, MISC.skyline);
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
  g.font = `italic 900 ${size}px Impact, "Arial Black", "Helvetica Neue", sans-serif`;
  const tw = g.measureText(text).width;
  if (tw > w * 0.84) size *= (w * 0.84) / tw;
  g.font = `italic 900 ${size}px Impact, "Arial Black", "Helvetica Neue", sans-serif`;
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
