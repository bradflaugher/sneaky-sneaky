// Procedural articulated humanoids: the agent (driven by the customizer) and
// every guard variant. Built from primitives, posed by code. No model files.
//
// A character faces +Z at rotation.y = 0. Positive rotation.x on a limb swings
// it backwards, negative swings it forwards.

import * as THREE from 'three';
import { miscTexture } from './textures.js';

const HIP_Y = 0.9;
const THIGH = 0.42;
const TORSO = 0.52;

const geoCache = new Map();
function geo(key, build) {
  if (!geoCache.has(key)) geoCache.set(key, build());
  return geoCache.get(key);
}
const capsule = (r, len) => geo(`cap:${r}:${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 10));
const sphere = (r, ws = 14, hs = 10) => geo(`sph:${r}:${ws}:${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const box = (w, h, d) => geo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, seg = 14, open = false) =>
  geo(`cyl:${rt}:${rb}:${h}:${seg}:${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));

/** Fresnel rim light, the cheap trick that makes characters pop off the floor. */
export function rimify(mat, color = 0xffffff, strength = 0.55) {
  const rim = new THREE.Color(color).multiplyScalar(strength);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: rim };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 uRim;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        `float rimF = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.6);
         outgoingLight += uRim * rimF;
         #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => `rim:${rim.getHexString()}`;
  return mat;
}

export const SKIN_TONES = [0xf6d3b3, 0xe8b88f, 0xd09a6a, 0xa9744a, 0x7c4f30, 0x4f3220];
export const BUILDS = {
  slim: { name: 'Slim', w: 0.9, h: 1.0 },
  standard: { name: 'Standard', w: 1.0, h: 1.0 },
  stocky: { name: 'Stocky', w: 1.2, h: 0.94 },
  tall: { name: 'Tall', w: 0.97, h: 1.1 },
  compact: { name: 'Compact', w: 1.0, h: 0.86 },
};
export const OUTFITS = {
  sneak: 'Sneaking Suit',
  burglar: 'Velvet Burglar',
  tourist: 'Resort Tourist',
  labcoat: 'Lab Coat',
  recon: 'Desert Recon',
  trench: 'Trenchcoat',
};
export const HEADGEAR = {
  bandana: 'Tactical Bandana',
  nvg: 'NVG Goggles',
  beanie: 'Knit Beanie',
  hair: 'Sleek Hair',
  shades: 'Shades',
  beret: 'Beret',
};
export const DEFAULT_AGENT = {
  codename: 'Quiet Otter',
  outfit: 'sneak',
  primary: 0x2c4a6e,
  accent: 0xffb347,
  head: 'bandana',
  skin: 2,
  build: 'standard',
};

const darken = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

/**
 * Build a humanoid from a spec:
 * { skin, build, outfit, primary, accent, head, hairColor, mustache, shades, holo }
 */
export function buildCharacter(spec) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const build = BUILDS[spec.build] || BUILDS.standard;
  root.scale.set(build.w, build.h, build.w);

  const holo = !!spec.holo;
  const mats = new Map();
  const M = (color, opts = {}) => {
    const key = `${color}:${JSON.stringify(opts)}`;
    if (mats.has(key)) return mats.get(key);
    let m;
    if (holo) {
      m = new THREE.MeshStandardMaterial({
        color: 0x0b3a40,
        emissive: opts.hot ? 0xaaffff : 0x22e6d2,
        emissiveIntensity: opts.hot ? 1.6 : 0.75,
        transparent: true,
        opacity: 0.62,
        roughness: 0.4,
      });
    } else {
      const { tex, hot: _hot, ...rest } = opts;
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...rest });
      if (tex) {
        m.map = miscTexture(tex);
      }
      rimify(m, spec.rim ?? 0xbfd8ff, spec.rimStrength ?? 0.5);
    }
    mats.set(key, m);
    return m;
  };
  const add = (parent, g, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    parent.add(o);
    return o;
  };
  const group = (parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };

  const o = spec.outfit;
  const P = spec.primary;
  const A = spec.accent;
  const skin = M(spec.skin, { roughness: 0.6 });
  const dark = M(0x1b1d24, { roughness: 0.6 });

  // What each body part is made of, per outfit.
  let torsoM = M(P);
  let armM = M(P);
  let foreM = M(P);
  let legM = M(darken(P, 0.7));
  let shinM = legM;
  let handM = skin;
  let shoeM = dark;
  if (o === 'sneak') {
    torsoM = armM = foreM = M(P, { roughness: 0.45, metalness: 0.15 });
    legM = shinM = M(darken(P, 0.8), { roughness: 0.45, metalness: 0.15 });
    handM = dark;
  } else if (o === 'burglar') {
    torsoM = armM = foreM = M(P, { tex: 'stripes', roughness: 1 });
    legM = shinM = M(0x1e1a26, { roughness: 1 });
    handM = M(0x222222);
  } else if (o === 'tourist') {
    torsoM = armM = M(P, { tex: 'hawaiian' });
    foreM = skin;
    legM = M(A);
    shinM = skin;
    shoeM = M(0x8a5a34);
  } else if (o === 'labcoat') {
    torsoM = armM = foreM = M(P, { roughness: 0.9 });
    legM = shinM = M(A);
  } else if (o === 'recon') {
    torsoM = armM = foreM = M(P, { tex: 'camo', roughness: 0.95 });
    legM = shinM = M(darken(P, 0.85), { tex: 'camo', roughness: 0.95 });
    shoeM = M(0x5a4630);
    handM = M(0x3a3226);
  } else if (o === 'trench') {
    torsoM = armM = foreM = M(P, { roughness: 0.85 });
    legM = shinM = M(0x23232b);
  } else if (o === 'polo') {
    torsoM = armM = M(P);
    foreM = skin;
    legM = shinM = M(0x1d2c4a);
    shoeM = M(0xf2efe6);
  } else if (o === 'rentacop') {
    torsoM = armM = foreM = M(P);
    legM = shinM = M(0x1c2233);
  } else if (o === 'hazmat') {
    torsoM = armM = foreM = legM = shinM = M(P, { roughness: 0.5 });
    handM = shoeM = M(0x4a5560);
  } else if (o === 'fatigues') {
    torsoM = armM = foreM = M(P, { tex: 'camo', roughness: 0.95 });
    legM = shinM = M(darken(P, 0.9), { tex: 'camo', roughness: 0.95 });
    shoeM = M(0x2b2118);
  } else if (o === 'tux') {
    torsoM = armM = foreM = M(0x15151b, { roughness: 0.5 });
    legM = shinM = M(0x121217, { roughness: 0.5 });
    shoeM = M(0x08080a, { roughness: 0.2 });
    handM = M(0xf4f4f4);
  }

  // ---- skeleton
  const pelvis = group(body, 0, HIP_Y, 0);
  const pelvisMesh = add(pelvis, sphere(0.17), legM, 0, 0.02, 0);
  pelvisMesh.scale.set(1.08, 0.78, 0.8);
  const torso = group(pelvis);
  const chest = add(torso, cyl(0.215, 0.165, TORSO, 14), torsoM, 0, TORSO / 2 + 0.02, 0);
  chest.scale.z = 0.64;
  const shoulders = add(torso, sphere(0.2), torsoM, 0, TORSO - 0.03, 0);
  shoulders.scale.set(1.12, 0.42, 0.66);
  add(torso, cyl(0.055, 0.06, 0.09, 10), skin, 0, TORSO + 0.05, 0);
  const head = group(torso, 0, TORSO + 0.21, 0);

  const makeArm = (side) => {
    const sh = group(torso, side * 0.255, TORSO - 0.05, 0);
    add(sh, capsule(0.058, 0.2), armM, 0, -0.13, 0);
    const el = group(sh, 0, -0.27, 0);
    add(el, capsule(0.05, 0.18), foreM, 0, -0.11, 0);
    add(el, sphere(0.062, 10, 8), handM, 0, -0.26, 0);
    return { sh, el };
  };
  const makeLeg = (side) => {
    const hip = group(pelvis, side * 0.095, 0, 0);
    add(hip, capsule(0.078, 0.27), legM, 0, -0.2, 0);
    const knee = group(hip, 0, -THIGH, 0);
    add(knee, capsule(0.064, 0.26), shinM, 0, -0.19, 0);
    const foot = add(knee, sphere(0.075, 10, 8), shoeM, 0, -0.415, 0.045);
    foot.scale.set(0.95, 0.62, 1.7);
    return { hip, knee };
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);
  const legL = makeLeg(1);
  const legR = makeLeg(-1);

  // ---- head
  const skull = add(head, sphere(0.155, 18, 14), skin);
  skull.scale.set(0.96, 1.05, 1);
  if (!holo) {
    const eyeM = M(0x121212, { roughness: 0.2 });
    add(head, sphere(0.021, 8, 6), eyeM, 0.056, 0.015, 0.14);
    add(head, sphere(0.021, 8, 6), eyeM, -0.056, 0.015, 0.14);
    const nose = add(head, sphere(0.026, 8, 6), skin, 0, -0.025, 0.152);
    nose.scale.set(0.9, 1, 1);
  } else {
    add(head, box(0.2, 0.035, 0.05), M(0, { hot: true }), 0, 0.02, 0.14);
  }
  const hairColor = spec.hairColor ?? 0x2a1c14;
  const hairM = M(hairColor, { roughness: 0.5 });
  const accentM = M(A, { roughness: 0.7 });
  const tails = [];
  const hairCap = (sy = 1) => {
    const h = add(head, geo('haircap', () => new THREE.SphereGeometry(0.165, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), hairM, 0, 0.012, -0.012);
    h.scale.set(1, sy, 1.03);
    return h;
  };
  const glasses = () => {
    const gm = M(0x0c0c10, { roughness: 0.15, metalness: 0.6 });
    add(head, box(0.11, 0.05, 0.02), gm, 0.058, 0.02, 0.15);
    add(head, box(0.11, 0.05, 0.02), gm, -0.058, 0.02, 0.15);
    add(head, box(0.31, 0.014, 0.014), gm, 0, 0.035, 0.143);
  };
  switch (spec.head) {
    case 'bandana': {
      hairCap(0.96);
      const band = add(head, cyl(0.162, 0.162, 0.055, 18, true), accentM, 0, 0.07, 0);
      band.material.side = THREE.DoubleSide;
      add(head, sphere(0.03, 8, 6), accentM, 0, 0.07, -0.165);
      for (const s of [1, -1]) {
        const t = group(head, s * 0.02, 0.07, -0.17);
        add(t, box(0.045, 0.3, 0.012), accentM, 0, -0.15, 0);
        t.rotation.set(0.5, 0, s * 0.18);
        tails.push({ g: t, s });
      }
      break;
    }
    case 'nvg': {
      hairCap();
      const strap = add(head, cyl(0.162, 0.162, 0.04, 18, true), dark, 0, 0.06, 0);
      strap.material.side = THREE.DoubleSide;
      const lens = holo ? M(0, { hot: true }) : M(0x0a2a12, { emissive: 0x4dff7a, emissiveIntensity: 2.2 });
      for (const s of [1, -1]) {
        const tube = add(head, cyl(0.04, 0.045, 0.1, 10), dark, s * 0.056, 0.085, 0.17);
        tube.rotation.x = Math.PI / 2 - 0.25;
        const l = add(head, cyl(0.032, 0.032, 0.012, 10), lens, s * 0.056, 0.098, 0.218);
        l.rotation.x = Math.PI / 2 - 0.25;
      }
      break;
    }
    case 'beanie': {
      const b = add(head, geo('beanie', () => new THREE.SphereGeometry(0.168, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)), accentM, 0, 0.03, -0.005);
      b.scale.y = 1.15;
      add(head, cyl(0.172, 0.172, 0.06, 18), M(darken(A, 0.75)), 0, 0.045, -0.005);
      add(head, sphere(0.04, 8, 6), M(0xf4f0e6, { roughness: 1 }), 0, 0.235, -0.005);
      break;
    }
    case 'shades':
      hairCap();
      glasses();
      break;
    case 'beret': {
      hairCap(0.9);
      const b = add(head, sphere(0.19, 16, 10), accentM, 0.03, 0.14, -0.01);
      b.scale.set(1, 0.3, 1);
      b.rotation.z = -0.25;
      add(head, cyl(0.01, 0.01, 0.04, 6), accentM, 0.02, 0.2, 0);
      break;
    }
    case 'cap': {
      const c = add(head, geo('capdome', () => new THREE.SphereGeometry(0.166, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45)), accentM, 0, 0.04, 0);
      c.scale.y = 0.95;
      add(head, box(0.2, 0.018, 0.13), M(darken(A, 0.6)), 0, 0.075, 0.17);
      add(head, box(0.05, 0.04, 0.01), M(0xe9c25a, { metalness: 0.8, roughness: 0.3 }), 0, 0.12, 0.158);
      break;
    }
    case 'hood': {
      const h = add(head, sphere(0.2, 16, 12), M(P, { roughness: 0.5 }), 0, 0.01, -0.01);
      h.scale.set(1, 1.08, 1);
      const v = add(head, box(0.24, 0.13, 0.08), holo ? M(0, { hot: true }) : M(0x10242e, { roughness: 0.1, metalness: 0.7, emissive: 0x2ad4ff, emissiveIntensity: 0.5 }), 0, 0.02, 0.15);
      v.rotation.x = -0.08;
      add(head, cyl(0.045, 0.045, 0.06, 8), M(0x4a5560), 0, -0.1, 0.17).rotation.x = Math.PI / 2;
      break;
    }
    case 'helmet': {
      const h = add(head, geo('helmet', () => new THREE.SphereGeometry(0.175, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52)), accentM, 0, 0.03, 0);
      h.scale.y = 1;
      break;
    }
    case 'bald':
      break;
    default:
      hairCap();
  }
  if (spec.shades && spec.head !== 'shades' && spec.head !== 'hood') glasses();
  if (spec.mustache && !holo) {
    const m = add(head, box(0.085, 0.022, 0.02), hairM, 0, -0.058, 0.148);
    m.rotation.x = -0.2;
  }
  if (o === 'burglar') add(head, cyl(0.159, 0.159, 0.058, 18, true), M(0x0d0d10), 0, 0.02, 0).material.side = THREE.DoubleSide;

  // ---- outfit dressing
  const coat = (len, flare) => {
    const c = add(pelvis, cyl(0.185, 0.185 + flare, len, 14, true), torsoM, 0, -len / 2 + 0.06, 0);
    c.material.side = THREE.DoubleSide;
    c.scale.z = 0.72;
  };
  const belt = (m) => {
    const b = add(pelvis, cyl(0.178, 0.178, 0.055, 14), m, 0, 0.07, 0);
    b.scale.z = 0.7;
  };
  if (o === 'sneak') {
    belt(accentM);
    for (const s of [1, -1]) {
      const strap = add(torso, box(0.045, 0.5, 0.02), accentM, s * 0.06, 0.3, 0.125);
      strap.rotation.z = s * 0.42;
      const leg = s === 1 ? legL : legR;
      add(leg.knee, sphere(0.07, 8, 6), accentM, 0, -0.01, 0.03).scale.set(1, 1, 0.7);
      const arm = s === 1 ? armL : armR;
      add(arm.el, sphere(0.058, 8, 6), accentM, 0, 0, -0.02);
    }
    add(torso, box(0.16, 0.2, 0.07), M(darken(P, 0.55)), 0, 0.32, -0.15);
  } else if (o === 'burglar') {
    const sack = add(torso, sphere(0.17, 12, 10), M(0x8b7a5a, { roughness: 1 }), 0.05, 0.3, -0.24);
    sack.scale.set(1, 1.15, 0.9);
    add(torso, cyl(0.03, 0.06, 0.07, 8), M(0x6e6046), 0.05, 0.5, -0.24);
    add(torso, box(0.1, 0.12, 0.01), accentM, 0.05, 0.3, -0.39);
    belt(accentM);
  } else if (o === 'tourist') {
    add(torso, box(0.11, 0.08, 0.07), dark, 0, 0.26, 0.17);
    add(torso, cyl(0.03, 0.03, 0.03, 10), M(0x9fd8ff, { metalness: 0.5, roughness: 0.2 }), 0, 0.26, 0.21).rotation.x = Math.PI / 2;
    add(torso, box(0.3, 0.012, 0.012), dark, 0, 0.44, 0.13);
    for (const leg of [legL, legR]) add(leg.knee, cyl(0.068, 0.066, 0.12, 10), M(0xffffff), 0, -0.3, 0);
  } else if (o === 'labcoat') {
    coat(0.5, 0.05);
    add(torso, box(0.07, 0.06, 0.012), accentM, 0.1, 0.36, 0.138);
    add(torso, box(0.012, 0.07, 0.012), M(0xd23a3a), 0.085, 0.4, 0.14);
    add(torso, box(0.012, 0.07, 0.012), M(0x3a6fd2), 0.11, 0.4, 0.14);
  } else if (o === 'recon') {
    const vest = add(torso, cyl(0.225, 0.19, 0.36, 12), accentM, 0, 0.3, 0);
    vest.scale.z = 0.7;
    const scarf = add(torso, geo('scarf', () => new THREE.TorusGeometry(0.1, 0.045, 8, 14)), M(darken(A, 1.25), { roughness: 1 }), 0, TORSO + 0.03, 0.01);
    scarf.rotation.x = Math.PI / 2;
    belt(M(0x3a3226));
    for (const s of [1, -1]) add(pelvis, box(0.08, 0.1, 0.06), M(0x3a3226), s * 0.13, 0.03, 0.11);
  } else if (o === 'trench') {
    coat(0.72, 0.09);
    belt(accentM);
    const collar = add(torso, cyl(0.15, 0.11, 0.12, 12, true), torsoM, 0, TORSO + 0.07, -0.01);
    collar.material.side = THREE.DoubleSide;
    for (const s of [1, -1]) add(torso, box(0.016, 0.3, 0.012), M(darken(P, 0.6)), s * 0.03, 0.26, 0.14);
  } else if (o === 'polo') {
    add(torso, box(0.2, 0.05, 0.03), M(0xffffff), 0, TORSO + 0.005, 0.1).rotation.x = 0.5;
    for (const s of [1, -1]) add(torso, box(0.09, 0.02, 0.07), accentM, s * 0.2, TORSO + 0.035, 0);
    belt(M(0x6b4a2a));
    add(torso, box(0.06, 0.03, 0.012), accentM, 0.1, 0.38, 0.137);
  } else if (o === 'rentacop') {
    add(torso, box(0.04, 0.3, 0.012), M(0x1a1a22), 0, 0.33, 0.14);
    add(torso, box(0.055, 0.065, 0.014), M(0xe9c25a, { metalness: 0.8, roughness: 0.3 }), 0.1, 0.4, 0.132);
    belt(dark);
    add(pelvis, box(0.07, 0.11, 0.05), dark, -0.17, 0.02, 0.03);
    add(pelvis, cyl(0.02, 0.02, 0.16, 8), M(0xd8c060, { emissive: 0x554400 }), 0.18, -0.03, 0.02);
  } else if (o === 'hazmat') {
    add(torso, box(0.18, 0.2, 0.07), M(0x4a5560), 0, 0.3, 0.15);
    add(torso, box(0.04, 0.04, 0.012), M(0x33ff88, { emissive: 0x33ff88, emissiveIntensity: 2 }), 0.04, 0.34, 0.188);
    const tank = add(torso, cyl(0.07, 0.07, 0.3, 10), M(0xc8d0d4, { metalness: 0.6, roughness: 0.3 }), 0, 0.3, -0.18);
    tank.rotation.z = 0;
    belt(M(0x1c1c1c));
  } else if (o === 'fatigues') {
    belt(M(0x2b2118));
    add(torso, box(0.3, 0.03, 0.012), M(0x2b2118), 0, 0.3, 0.14).rotation.z = 0.5;
    for (const s of [1, -1]) add(torso, box(0.09, 0.07, 0.03), M(darken(P, 0.7)), s * 0.1, 0.37, 0.13);
  } else if (o === 'tux') {
    const shirt = add(torso, box(0.13, 0.36, 0.02), M(0xf7f7f2), 0, 0.3, 0.128);
    shirt.rotation.x = -0.04;
    for (const s of [1, -1]) {
      const bow = add(torso, geo('bow', () => new THREE.ConeGeometry(0.035, 0.07, 4)), accentM, s * 0.035, TORSO - 0.03, 0.145);
      bow.rotation.z = s * (Math.PI / 2);
    }
    belt(accentM);
    coat(0.22, 0.02);
  }

  if (holo) {
    const wire = new THREE.MeshBasicMaterial({ color: 0x7dfff0, wireframe: true, transparent: true, opacity: 0.35 });
    const meshes = [];
    root.traverse((m) => m.isMesh && meshes.push(m));
    for (const m of meshes) {
      m.castShadow = false;
      const w = new THREE.Mesh(m.geometry, wire);
      m.add(w);
    }
  }

  const rig = {
    root,
    body,
    pelvis,
    torso,
    head,
    armL,
    armR,
    legL,
    legR,
    tails,
    phase: 0,
    j: null,
    height: 1.78 * build.h,
    holo,
  };
  rig.j = restPose();
  applyPose(rig, rig.j);
  return rig;
}

/** Draw the character again where it is hidden by walls, as a ghostly silhouette. */
export function addSilhouette(rig, color = 0x19d8ff) {
  // Inverted depth test: draws only where something nearer hides the body.
  // The depth used for that test is pulled 0.7 m towards the camera so the
  // character's own limbs never count as "something nearer".
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
       vec4 mvNear = mvPosition;
       mvNear.z += 0.7;
       vec4 pNear = projectionMatrix * mvNear;
       gl_Position.z = pNear.z / pNear.w * gl_Position.w;`,
    );
  };
  mat.customProgramCacheKey = () => 'silhouette';
  const meshes = [];
  rig.root.traverse((m) => m.isMesh && meshes.push(m));
  for (const m of meshes) {
    const s = new THREE.Mesh(m.geometry, mat);
    s.renderOrder = 50;
    m.add(s);
  }
}

function restPose() {
  return {
    py: HIP_Y,
    bodyRX: 0,
    torsoRX: 0,
    torsoRY: 0,
    headRX: 0,
    headRY: 0,
    aLx: 0,
    aLz: 0.08,
    eL: -0.15,
    aRx: 0,
    aRz: 0.08,
    eR: -0.15,
    lLx: 0,
    kL: 0,
    lRx: 0,
    kR: 0,
    lz: 0,
  };
}

function applyPose(rig, j) {
  rig.pelvis.position.y = j.py;
  rig.body.rotation.x = j.bodyRX;
  rig.torso.rotation.set(j.torsoRX, j.torsoRY, 0);
  rig.head.rotation.set(j.headRX, j.headRY, 0);
  rig.armL.sh.rotation.set(j.aLx, 0, j.aLz);
  rig.armL.el.rotation.x = j.eL;
  rig.armR.sh.rotation.set(j.aRx, 0, -j.aRz);
  rig.armR.el.rotation.x = j.eR;
  rig.legL.hip.rotation.set(j.lLx, 0, j.lz);
  rig.legL.knee.rotation.x = j.kL;
  rig.legR.hip.rotation.set(j.lRx, 0, -j.lz);
  rig.legR.knee.rotation.x = j.kR;
}

/**
 * Advance and apply the procedural animation.
 * p: { speed (m/s), crouch (bool), mode, t (seconds) }
 * modes: 'normal' | 'choking' | 'held' | 'sleep' | 'alert' | 'look' | 'suspicious'
 */
export function animateCharacter(rig, p, dt) {
  const T = restPose();
  const t = p.t || 0;
  const speed = p.speed || 0;
  const moving = speed > 0.08;
  rig.phase += speed * dt * (p.crouch ? 5.4 : 4.3);
  const ph = rig.phase;
  const amp = moving ? Math.min(1, 0.3 + speed / 3.6) : 0;
  let k = 14;

  if (p.mode === 'sleep') {
    k = 5.5;
    T.py = 0.16;
    T.bodyRX = -Math.PI / 2;
    T.aLz = 1.1;
    T.aRz = 0.7;
    T.aLx = 0.1;
    T.eL = -0.5;
    T.eR = -1.2;
    T.lz = 0.16;
    T.kL = 0.5;
    T.headRY = 0.5;
    T.torsoRX = Math.sin(t * 1.3) * 0.02;
  } else {
    if (p.crouch) {
      T.py = 0.47 + Math.abs(Math.sin(ph)) * 0.025 * amp;
      T.torsoRX = 0.8;
      T.headRX = -0.62;
      T.lLx = -1.15 - Math.sin(ph) * 0.42 * amp;
      T.lRx = -1.15 + Math.sin(ph) * 0.42 * amp;
      T.kL = 2.0 + Math.cos(ph) * 0.3 * amp;
      T.kR = 2.0 - Math.cos(ph) * 0.3 * amp;
      T.aLx = -0.75 + Math.sin(ph) * 0.35 * amp;
      T.aRx = -0.75 - Math.sin(ph) * 0.35 * amp;
      T.eL = T.eR = -1.15;
      T.aLz = T.aRz = 0.22;
    } else {
      T.py = HIP_Y - 0.015 + Math.abs(Math.cos(ph)) * 0.035 * amp;
      T.torsoRX = 0.05 + amp * 0.1 + Math.sin(t * 1.7) * 0.012;
      T.torsoRY = Math.sin(ph) * 0.14 * amp;
      T.lLx = -Math.sin(ph) * 0.72 * amp;
      T.lRx = Math.sin(ph) * 0.72 * amp;
      T.kL = Math.max(0, Math.cos(ph)) * 1.15 * amp;
      T.kR = Math.max(0, -Math.cos(ph)) * 1.15 * amp;
      T.aLx = Math.sin(ph) * 0.62 * amp;
      T.aRx = -Math.sin(ph) * 0.62 * amp;
      T.eL = T.eR = -0.2 - amp * 0.75;
    }
    if (p.mode === 'choking') {
      T.aLx = -1.45;
      T.aRx = -1.25;
      T.eL = -1.5;
      T.eR = -1.6;
      T.aLz = -0.25;
      T.aRz = -0.2;
      T.torsoRX = 0.22;
      T.py = HIP_Y - 0.08;
      T.lLx = -0.3;
      T.kL = 0.5;
      T.lRx = 0.25;
      T.kR = 0.3;
      k = 22;
    } else if (p.mode === 'held') {
      const f = Math.sin(t * 26);
      T.torsoRX = -0.3;
      T.headRX = -0.35;
      T.aLx = -2.3 + f * 0.35;
      T.aRx = -2.3 - f * 0.35;
      T.eL = T.eR = -1.3;
      T.aLz = T.aRz = 0.5;
      T.py = HIP_Y - 0.1;
      T.kL = T.kR = 0.5;
      T.lLx = T.lRx = -0.3;
      k = 22;
    } else if (p.mode === 'alert') {
      T.torsoRX = -0.18;
      T.headRX = -0.1;
      T.aLx = T.aRx = -0.4;
      T.aLz = T.aRz = 1.0;
      T.eL = T.eR = -0.9;
      T.lz = 0.14;
      k = 26;
    } else if (p.mode === 'look') {
      T.headRY = Math.sin(t * 2.1) * 0.95;
      T.torsoRY = Math.sin(t * 2.1) * 0.25;
      T.aRx = -2.2;
      T.eR = -1.9;
      T.aRz = 0.5;
    } else if (p.mode === 'suspicious') {
      T.headRX = 0.12;
      T.torsoRX = 0.16;
      T.aRx = -1.1;
      T.eR = -2.1;
    }
  }

  const a = 1 - Math.exp(-k * dt);
  const j = rig.j;
  for (const key in T) j[key] += (T[key] - j[key]) * a;
  applyPose(rig, j);
  for (const tl of rig.tails) {
    tl.g.rotation.x = 0.35 + Math.min(1.1, speed * 0.3) + Math.sin(t * 5 + tl.s) * (0.06 + amp * 0.15);
    tl.g.rotation.z = tl.s * 0.18 + Math.sin(t * 3.3 + tl.s * 2) * 0.08;
  }
}

/** Snap straight to the pose animateCharacter is heading for (no blending). */
export function settleCharacter(rig, p) {
  animateCharacter(rig, p, 10);
}

/** three.js yaw for a core heading angle (direction = cos a, sin a in XZ). */
export const yawOf = (ang) => Math.PI / 2 - ang;

/** Guard look for a theme, with randomised accessories. */
export function guardSpec(themeId, rng) {
  const skin = rng.pick(SKIN_TONES);
  const build = rng.pick(['standard', 'standard', 'stocky', 'tall', 'slim']);
  const hairColor = rng.pick([0x2a1c14, 0x111111, 0x6b4a2a, 0xb08a4a, 0x8a8a8a, 0x7a2e1a]);
  const base = { skin, build, hairColor, mustache: rng.chance(0.35), shades: rng.chance(0.3), rim: 0xffe2c0, rimStrength: 0.45 };
  switch (themeId) {
    case 'yacht':
      return { ...base, outfit: 'polo', primary: rng.pick([0xffffff, 0xf2f6ff, 0xfff4e0]), accent: rng.pick([0x1d3f7a, 0xc9a14a, 0xd9432f]), head: rng.pick(['cap', 'cap', 'hair', 'bald']), shades: rng.chance(0.75) };
    case 'office':
      return { ...base, outfit: 'rentacop', primary: rng.pick([0x9cc3e8, 0xb7d0ea, 0xe8e2d0]), accent: rng.pick([0x1c2233, 0x2a2a2a, 0x30405a]), head: rng.pick(['cap', 'cap', 'hair', 'bald']) };
    case 'lab':
      return { ...base, outfit: 'hazmat', primary: rng.pick([0xf2c230, 0xf08a2a, 0xe8e8e8, 0x8fd43a]), accent: 0x4a5560, head: 'hood', mustache: false };
    case 'bunker':
      return { ...base, outfit: 'fatigues', primary: rng.pick([0x7c8650, 0x9a8a5c, 0x6a7448]), accent: rng.pick([0x8a1f1f, 0x1f4a2a, 0x2a2a5a, 0x3a2a1a]), head: rng.pick(['beret', 'beret', 'beret', 'helmet']), mustache: rng.chance(0.6) };
    case 'museum':
      return { ...base, outfit: 'tux', primary: 0x15151b, accent: rng.pick([0x8a1f2f, 0x15151b, 0xc9a14a, 0x1f3a6a]), head: rng.pick(['hair', 'hair', 'bald', 'shades']), mustache: rng.chance(0.55) };
    default:
      return { ...base, outfit: 'holo', primary: 0x22e6d2, accent: 0x22e6d2, head: rng.pick(['helmet', 'bald', 'nvg', 'cap']), holo: true, build: rng.pick(['standard', 'tall', 'stocky']) };
  }
}

/** Convert saved agent settings into a character spec. */
export function agentSpec(agent) {
  return {
    skin: SKIN_TONES[agent.skin] ?? SKIN_TONES[2],
    build: agent.build,
    outfit: agent.outfit,
    primary: agent.primary,
    accent: agent.accent,
    head: agent.head,
    hairColor: 0x2a1c14,
    rim: 0x9fe8ff,
    rimStrength: 0.45,
  };
}
