// One small procedural 3D prop per loot item, roughly 0.35 m tall, origin at
// its base. Keyed by the `prop` field in src/core/loot.js.

import * as THREE from 'three';

const S = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
const GOLD = () => S(0xf2c14e, { metalness: 0.9, roughness: 0.22, emissive: 0x4a3200 });

function kit() {
  const g = new THREE.Group();
  const put = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  return {
    g,
    put,
    box: (w, h, d, mat, ...r) => put(new THREE.BoxGeometry(w, h, d), mat, ...r),
    sph: (r, mat, ...rest) => put(new THREE.SphereGeometry(r, 16, 12), mat, ...rest),
    cyl: (rt, rb, h, mat, ...rest) => put(new THREE.CylinderGeometry(rt, rb, h, 18), mat, ...rest),
    cone: (r, h, mat, ...rest) => put(new THREE.ConeGeometry(r, h, 14), mat, ...rest),
    torus: (r, t, mat, ...rest) => put(new THREE.TorusGeometry(r, t, 10, 22), mat, ...rest),
  };
}

const H = Math.PI / 2;

const PROPS = {
  jar(k) {
    k.cyl(0.11, 0.11, 0.22, S(0xcfe8f0, { transparent: true, opacity: 0.45, roughness: 0.05 }), 0, 0.11);
    k.cyl(0.1, 0.1, 0.13, S(0xe9d9b0, { roughness: 1 }), 0, 0.075);
    k.sph(0.1, S(0xf1e4c2, { roughness: 1 }), 0, 0.14, 0, 0, 0, 0, 1, 0.35, 1);
    k.cyl(0.115, 0.115, 0.03, S(0xd9432f), 0, 0.235);
    k.box(0.1, 0.06, 0.005, S(0xfff8e0), 0, 0.1, 0.112);
  },
  beanie(k) {
    const m = S(0x8a4fd0, { roughness: 1 });
    k.sph(0.11, m, 0, 0.1, 0, 0, 0, 0, 1.15, 0.85, 0.9);
    k.sph(0.075, m, 0, 0.22, 0.02);
    for (const s of [1, -1]) {
      k.sph(0.03, m, s * 0.055, 0.285, 0.02);
      k.sph(0.045, m, s * 0.12, 0.04, 0.06, 0, 0, 0, 1, 0.6, 1.3);
      k.sph(0.012, S(0x111111, { roughness: 0.1 }), s * 0.028, 0.235, 0.085);
    }
    k.box(0.05, 0.05, 0.004, S(0xd9432f), 0.1, 0.2, 0, 0, 0, 0.5);
  },
  blueprint(k) {
    const b = S(0x2f6fd0, { roughness: 0.9 });
    k.cyl(0.045, 0.045, 0.34, b, 0, 0.05, 0, 0, 0.4, H);
    k.cyl(0.04, 0.04, 0.3, b, 0.02, 0.12, 0.03, 0, -0.3, H);
    k.box(0.3, 0.004, 0.2, S(0x3a7de0), 0, 0.006, 0.1, 0, 0.2);
    k.box(0.2, 0.005, 0.02, S(0xffffff), 0, 0.01, 0.1, 0, 0.2);
    k.box(0.02, 0.005, 0.12, S(0xffffff), 0.05, 0.01, 0.1, 0, 0.2);
    k.torus(0.047, 0.006, S(0xd9432f), 0, 0.05, 0, 0, H + 0.4);
  },
  stapler(k) {
    const r = S(0xd9432f, { roughness: 0.3 });
    k.box(0.3, 0.035, 0.085, S(0x22242a), 0, 0.02);
    k.box(0.29, 0.05, 0.075, r, 0.005, 0.11, 0, 0, 0, 0.16);
    k.box(0.06, 0.07, 0.075, r, -0.12, 0.06);
    k.box(0.25, 0.012, 0.05, S(0xc8d0d4, { metalness: 0.8, roughness: 0.25 }), 0.01, 0.075, 0, 0, 0, 0.16);
  },
  duck(k) {
    const y = S(0xffd12e, { roughness: 0.35 });
    k.sph(0.13, y, 0, 0.11, 0, 0, 0, 0, 1.2, 0.85, 1);
    k.sph(0.085, y, 0.07, 0.24);
    k.cone(0.07, 0.12, y, -0.15, 0.15, 0, 0, 0, 1.0);
    k.box(0.08, 0.025, 0.07, S(0xff7a1a), 0.16, 0.225);
    for (const s of [1, -1]) k.sph(0.014, S(0x111111, { roughness: 0.1 }), 0.125, 0.265, s * 0.05);
  },
  frog(k) {
    const gr = S(0x58b86a, { roughness: 0.15, metalness: 0.1 });
    k.sph(0.13, gr, 0, 0.09, 0, 0, 0, 0, 1.15, 0.75, 1);
    k.sph(0.09, gr, 0.07, 0.17, 0, 0, 0, 0, 1.1, 0.8, 1.15);
    for (const s of [1, -1]) {
      k.sph(0.04, gr, 0.09, 0.245, s * 0.065);
      k.sph(0.018, S(0x111111, { roughness: 0.05 }), 0.115, 0.255, s * 0.07);
      k.sph(0.06, gr, -0.07, 0.045, s * 0.13, 0, 0, 0, 1.4, 0.6, 0.8);
    }
    k.cone(0.03, 0.05, GOLD(), 0.05, 0.3, 0);
  },
  croissant(k) {
    const m = GOLD();
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.34;
      const r = 0.105 - Math.abs(i) * 0.02;
      k.sph(r, m, Math.sin(a) * 0.17, 0.09 - Math.abs(i) * 0.008, Math.cos(a) * 0.17 - 0.14, 0, a, 0, 0.75, 0.85, 1.05);
    }
  },
  usb(k) {
    k.box(0.1, 0.05, 0.24, S(0x23262e, { roughness: 0.3 }), 0, 0.14, 0, 0.5);
    k.box(0.075, 0.03, 0.09, S(0xc8d0d4, { metalness: 0.9, roughness: 0.2 }), 0, 0.222, 0.143, 0.5);
    k.box(0.07, 0.004, 0.11, S(0xfff8e0), 0, 0.152, -0.02, 0.5);
    k.sph(0.012, S(0x33ff88, { emissive: 0x33ff88, emissiveIntensity: 3 }), 0.03, 0.1, -0.1);
  },
  mug(k) {
    const w = S(0xf5f1e6, { roughness: 0.3 });
    k.cyl(0.1, 0.085, 0.2, w, 0, 0.1);
    k.torus(0.06, 0.018, w, 0.12, 0.1);
    k.cyl(0.088, 0.088, 0.01, S(0x3a2414), 0, 0.196);
    k.box(0.1, 0.07, 0.005, S(0xd9432f), 0, 0.1, 0.097);
  },
  cactus(k) {
    const g = S(0x4f9a52, { roughness: 0.8 });
    k.cyl(0.1, 0.075, 0.12, S(0xc2643a), 0, 0.06);
    k.put(new THREE.CapsuleGeometry(0.06, 0.18, 4, 10), g, 0, 0.26);
    k.put(new THREE.CapsuleGeometry(0.03, 0.07, 4, 8), g, 0.09, 0.27, 0, 0, 0, -0.9);
    k.put(new THREE.CapsuleGeometry(0.028, 0.06, 4, 8), g, -0.085, 0.24, 0, 0, 0, 0.9);
    k.sph(0.03, S(0xff6fa8), 0.02, 0.41, 0.01);
  },
  snowglobe(k) {
    k.cyl(0.11, 0.13, 0.08, S(0x5a3a26), 0, 0.04);
    k.sph(0.13, S(0xd6f0ff, { transparent: true, opacity: 0.35, roughness: 0.02 }), 0, 0.2);
    k.cyl(0.035, 0.045, 0.03, S(0x5a3a26), 0, 0.11);
    k.sph(0.045, S(0xd6f0ff, { transparent: true, opacity: 0.6, roughness: 0.02 }), 0, 0.165);
    k.sph(0.1, S(0xffffff, { roughness: 1 }), 0, 0.09, 0, 0, 0, 0, 1, 0.25, 1);
  },
  banana(k) {
    const y = S(0xffd83a, { roughness: 0.5 });
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.26;
      k.sph(0.05 - Math.abs(i) * 0.006, y, Math.sin(a) * 0.3, 0.33 - Math.cos(a) * 0.3 + 0.03, 0, 0, 0, a, 1.5, 1, 1);
    }
    k.box(0.2, 0.06, 0.012, S(0xb8bcc2, { roughness: 0.7 }), 0, 0.075, 0.05, 0, 0, 0.5);
  },
  cheese(k) {
    const c = S(0xf2b632, { roughness: 0.7 });
    const w = k.put(new THREE.CylinderGeometry(0.17, 0.17, 0.13, 20, 1, false, 0.5, Math.PI * 1.65), c, 0, 0.065);
    w.material.side = THREE.DoubleSide;
    k.cyl(0.172, 0.172, 0.05, S(0xc0392b, { roughness: 0.4 }), 0, 0.04, 0, 0, 0, 0, 1, 1, 1).geometry = new THREE.CylinderGeometry(0.172, 0.172, 0.05, 20, 1, true, 0.5, Math.PI * 1.65);
    for (const [x, z] of [
      [0.06, 0.08],
      [-0.08, 0.02],
      [0.0, -0.09],
    ])
      k.sph(0.022, S(0xb8861c), x, 0.13, z);
  },
  trophy(k) {
    const g = GOLD();
    k.box(0.14, 0.05, 0.14, S(0x1c1c22), 0, 0.025);
    k.cyl(0.02, 0.035, 0.1, g, 0, 0.1);
    k.cyl(0.1, 0.035, 0.16, g, 0, 0.23);
    for (const s of [1, -1]) k.torus(0.045, 0.012, g, s * 0.11, 0.24);
    k.box(0.09, 0.02, 0.005, S(0xfff8e0), 0, 0.03, 0.071);
  },
  gnome(k) {
    k.cyl(0.085, 0.1, 0.16, S(0x2f6fd0), 0, 0.08);
    k.sph(0.07, S(0xf2c8a0), 0, 0.2);
    k.cone(0.075, 0.2, S(0xd9432f), 0, 0.34);
    k.cone(0.06, 0.12, S(0xffffff, { roughness: 1 }), 0, 0.15, 0.045, Math.PI);
    k.box(0.05, 0.02, 0.01, GOLD(), 0.04, 0.13, 0.095);
  },
  teapot(k) {
    const p = S(0xf7f2e6, { roughness: 0.15 });
    k.sph(0.12, p, 0, 0.12, 0, 0, 0, 0, 1.1, 0.9, 1.1);
    k.cyl(0.025, 0.04, 0.16, p, 0.16, 0.16, 0, 0, 0, -0.9);
    k.torus(0.065, 0.015, p, -0.15, 0.13);
    k.sph(0.06, S(0x2f6fd0, { roughness: 0.15 }), 0, 0.225, 0, 0, 0, 0, 1, 0.35, 1);
    k.sph(0.022, GOLD(), 0, 0.26, 0);
    k.torus(0.125, 0.008, S(0x2f6fd0), 0, 0.12, 0, H);
  },
  cube(k) {
    const cols = [0xd9432f, 0x2f6fd0, 0x3fb24f, 0xffd12e, 0xff8a1a, 0xf5f5f5];
    const g = new THREE.BoxGeometry(0.068, 0.068, 0.068);
    const mats = cols.map((c) => S(c, { roughness: 0.3, emissive: c, emissiveIntensity: 0.15 }));
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) k.put(g, mats, x * 0.074, 0.13 + y * 0.074, z * 0.074);
  },
  cartridge(k) {
    k.box(0.22, 0.26, 0.04, S(0x8a8f98, { roughness: 0.6 }), 0, 0.15);
    k.box(0.17, 0.13, 0.008, S(0xffb347, { emissive: 0x552a00 }), 0, 0.18, 0.022);
    k.box(0.13, 0.03, 0.008, S(0xd9432f), 0, 0.2, 0.027);
    k.box(0.18, 0.03, 0.03, S(0x33363c), 0, 0.02);
  },
  pineapple(k) {
    k.sph(0.11, S(0xe2a52c, { roughness: 0.8, flatShading: true }), 0, 0.14, 0, 0, 0, 0, 1, 1.3, 1).geometry = new THREE.IcosahedronGeometry(0.11, 1);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      k.cone(0.03, 0.18, S(0x3f8a3a), Math.cos(a) * 0.035, 0.36, Math.sin(a) * 0.035, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    }
    k.cone(0.03, 0.2, S(0x4fa24a), 0, 0.4, 0);
  },
  flask(k) {
    const gl = S(0xd6f0ff, { transparent: true, opacity: 0.4, roughness: 0.02 });
    k.cone(0.13, 0.2, gl, 0, 0.1);
    k.cyl(0.035, 0.035, 0.14, gl, 0, 0.26);
    k.cone(0.115, 0.1, S(0x4fd8ff, { emissive: 0x1c7aa8, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 }), 0, 0.055);
    k.torus(0.037, 0.008, gl, 0, 0.33, 0, H);
  },
  toaster(k) {
    const c = S(0xd8dde0, { metalness: 0.85, roughness: 0.25 });
    k.box(0.28, 0.18, 0.16, c, 0, 0.11);
    k.box(0.3, 0.03, 0.18, S(0x22242a), 0, 0.015);
    for (const s of [1, -1]) {
      k.box(0.2, 0.01, 0.03, S(0x111111), 0, 0.201, s * 0.035);
      k.box(0.16, 0.1, 0.022, S(0xd9a05a, { roughness: 1 }), 0.01 * s, 0.24, s * 0.035, 0, 0, s * 0.05);
      k.sph(0.016, S(0xff4a3a, { emissive: 0xff2a1a, emissiveIntensity: 2 }), s * 0.06, 0.13, 0.082);
    }
    k.box(0.07, 0.012, 0.01, S(0xff4a3a, { emissive: 0xff2a1a }), 0, 0.085, 0.082, 0, 0, 0);
  },
  helmet(k) {
    const g = S(0x5c6a3c, { roughness: 0.7 });
    const dome = k.put(new THREE.SphereGeometry(0.14, 18, 10, 0, Math.PI * 2, 0, H), g, 0, 0.05);
    dome.material.side = THREE.DoubleSide;
    k.cyl(0.17, 0.165, 0.02, g, 0, 0.055);
    k.box(0.05, 0.03, 0.01, GOLD(), 0, 0.12, 0.128, -0.5);
    k.torus(0.1, 0.008, S(0x2b2118), 0, 0.03, 0, H);
  },
  vase(k) {
    const pts = [
      [0.05, 0],
      [0.09, 0.03],
      [0.13, 0.13],
      [0.1, 0.24],
      [0.045, 0.31],
      [0.07, 0.36],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const v = k.put(new THREE.LatheGeometry(pts, 20), S(0x2f6fd0, { roughness: 0.15, side: THREE.DoubleSide }));
    v.castShadow = true;
    k.torus(0.125, 0.007, GOLD(), 0, 0.14, 0, H);
    k.box(0.006, 0.2, 0.006, S(0xf7f2e6), 0.105, 0.2, 0.05, 0, 0, 0.35);
    k.box(0.006, 0.12, 0.006, S(0xf7f2e6), -0.09, 0.12, 0.08, 0.3, 0, -0.4);
  },
  anchor(k) {
    const m = S(0x8fa2ac, { metalness: 0.85, roughness: 0.3 });
    k.box(0.035, 0.3, 0.035, m, 0, 0.2);
    k.box(0.16, 0.03, 0.03, m, 0, 0.3);
    k.torus(0.035, 0.012, m, 0, 0.385);
    const arc = k.put(new THREE.TorusGeometry(0.12, 0.02, 8, 16, Math.PI), m, 0, 0.16, 0, 0, 0, Math.PI);
    arc.castShadow = true;
    for (const s of [1, -1]) k.cone(0.035, 0.07, m, s * 0.12, 0.185, 0, 0, 0, s * -0.4);
  },
  donut(k) {
    k.cyl(0.17, 0.15, 0.02, S(0xf5f1e6, { roughness: 0.3 }), 0, 0.01);
    k.torus(0.085, 0.05, S(0xd9a05a, { roughness: 0.8 }), 0, 0.07, 0, H);
    k.torus(0.085, 0.044, S(0xa8612a, { roughness: 0.25 }), 0, 0.085, 0, H, 0, 0, 1, 1, 0.75);
    const cols = [0xffffff, 0xff6fa8, 0x4fd8ff, 0xffd12e];
    for (let i = 0; i < 12; i++) {
      const a = i * 0.9;
      k.box(0.022, 0.008, 0.008, S(cols[i % 4]), Math.cos(a) * 0.085, 0.127, Math.sin(a) * 0.085, 0, a * 2.3, 0);
    }
  },
  crown(k) {
    const g = GOLD();
    const band = k.put(new THREE.CylinderGeometry(0.11, 0.1, 0.09, 18, 1, true), g, 0, 0.1);
    band.material.side = THREE.DoubleSide;
    const gems = [0xd9432f, 0x2f6fd0, 0x3fb24f];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.cone(0.03, 0.09, g, Math.cos(a) * 0.105, 0.185, Math.sin(a) * 0.105);
      k.sph(0.016, S(gems[i % 3], { emissive: gems[i % 3], emissiveIntensity: 0.6, roughness: 0.1 }), Math.cos(a) * 0.108, 0.1, Math.sin(a) * 0.108);
    }
    k.cyl(0.13, 0.13, 0.05, S(0x7a1f4a, { roughness: 1 }), 0, 0.025);
  },
  floppy(k) {
    k.box(0.24, 0.25, 0.018, S(0x2a3f8a, { roughness: 0.5 }), 0, 0.16, 0, -0.25);
    k.box(0.13, 0.085, 0.006, S(0xc8d0d4, { metalness: 0.85, roughness: 0.25 }), 0.01, 0.235, -0.008, -0.25);
    k.box(0.18, 0.1, 0.006, S(0xfff8e0), 0, 0.105, 0.036, -0.25);
    k.box(0.12, 0.012, 0.004, S(0x2a3f8a), 0, 0.12, 0.037, -0.25);
  },
  canteen(k) {
    const g = S(0x6a7448, { roughness: 0.8 });
    k.cyl(0.12, 0.12, 0.09, g, 0, 0.15, 0, H);
    k.cyl(0.035, 0.035, 0.06, S(0xc8d0d4, { metalness: 0.8, roughness: 0.3 }), 0, 0.29);
    k.cyl(0.04, 0.04, 0.025, S(0x22242a), 0, 0.325);
    k.torus(0.123, 0.012, S(0x2b2118), 0, 0.15, 0);
    k.box(0.06, 0.04, 0.005, S(0xfff8e0), 0, 0.15, 0.047);
  },
};

export const PROP_KEYS = Object.keys(PROPS);

export function buildLootProp(prop) {
  const k = kit();
  (PROPS[prop] || PROPS.duck)(k);
  return k.g;
}
