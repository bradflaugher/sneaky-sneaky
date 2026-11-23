// Procedural low-poly humanoids in the spirit of 1998: chiselled, flat-shaded,
// angular, hand-inked. The agent (driven by the customizer) and every guard
// variant are built here from tapered boxes and low-sided prisms. No spheres,
// no capsules, no model files.
//
// A character faces +Z at rotation.y = 0. Positive rotation.x on a limb swings
// it backwards, negative swings it forwards.

import * as THREE from 'three';
import { miscTexture } from './textures.js';
import { toon, rimify, inkAll } from './toon.js';
import { SKIN_TONES, HAIR_COLORS, BUILDS, OUTFITS, HEADGEAR } from '../core/agent.js';

const HIP_Y = 0.92;
const THIGH = 0.43;
const HEAD_Y = 0.78;

const geoCache = new Map();
function geo(key, build) {
  if (!geoCache.has(key)) geoCache.set(key, build());
  return geoCache.get(key);
}
const box = (w, h, d) => geo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
/** A box whose top and bottom faces are different sizes: the basic PS1 limb. */
const taper = (wt, wb, h, dt, db, lean = 0) =>
  geo(`tap:${wt}:${wb}:${h}:${dt}:${db}:${lean}`, () => {
    const g = new THREE.BoxGeometry(1, h, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const top = p.getY(i) > 0;
      p.setX(i, p.getX(i) * (top ? wt : wb));
      p.setZ(i, p.getZ(i) * (top ? dt : db) + (top ? lean : -lean));
    }
    g.computeVertexNormals();
    g.computeBoundingBox();
    return g;
  });
/** Low-sided prism / frustum. */
const prism = (rt, rb, h, n = 6) => geo(`pri:${rt}:${rb}:${h}:${n}`, () => new THREE.CylinderGeometry(rt, rb, h, n));

export { SKIN_TONES, HAIR_COLORS, BUILDS, OUTFITS, HEADGEAR };

const mul = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

/**
 * Build a humanoid from a spec:
 * { skin, build, outfit, primary, accent, head, hairColor, stubble, shades, holo }
 */
export function buildCharacter(spec) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const build = BUILDS[spec.build] || BUILDS.standard;
  root.scale.set(build.w, build.h, build.w);

  const holo = !!spec.holo;
  const mats = new Map();
  const holoFill = holo ? new THREE.MeshBasicMaterial({ color: 0x031c1e, transparent: true, opacity: 0.78 }) : null;
  const holoHot = holo ? new THREE.MeshBasicMaterial({ color: 0xb8fff6 }) : null;
  const M = (color, opts = {}) => {
    if (holo) return opts.hot ? holoHot : holoFill;
    const key = `${color}:${JSON.stringify(opts)}`;
    if (mats.has(key)) return mats.get(key);
    const { tex, hot: _hot, glow, ...rest } = opts;
    const m = toon(color, rest);
    if (tex) m.map = miscTexture(tex);
    if (glow) {
      m.emissive = new THREE.Color(glow);
      m.emissiveIntensity = 2.2;
    }
    rimify(m, spec.rim ?? 0xbfd8ff, spec.rimStrength ?? 0.4);
    mats.set(key, m);
    return m;
  };
  const add = (parent, g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    o.castShadow = !holo;
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
  const skin = M(spec.skin);
  const skinDark = M(mul(spec.skin, 0.62));
  const ink = M(0x0b0b0e);
  const gear = M(0x1a1c20);
  const steel = M(0x6c737a);
  const accentM = M(A);
  const hairColor = spec.hairColor ?? 0x15110e;
  const hairM = M(hairColor);

  // What each body part is made of, per outfit.
  let torsoM = M(P);
  let armM = torsoM;
  let foreM = torsoM;
  let legM = M(mul(P, 0.72));
  let shinM = legM;
  let handM = gear;
  let shoeM = ink;
  const dark = M(0x15161b);
  if (o === 'longcoat' || o === 'moto') {
    legM = shinM = dark;
  } else if (o === 'parka') {
    legM = shinM = M(mul(P, 0.45));
  } else if (o === 'suit') {
    legM = shinM = torsoM;
    handM = skin;
  } else if (o === 'techvest') {
    torsoM = armM = foreM = M(mul(P, 0.5));
    legM = shinM = dark;
  } else if (o === 'jumpsuit') {
    legM = shinM = torsoM;
    foreM = skin; // sleeves rolled
  } else if (o === 'poncho') {
    torsoM = armM = foreM = dark;
    legM = shinM = M(0x1c1d22);
  } else if (o === 'polo') {
    foreM = skin;
    handM = skin;
    legM = shinM = M(0x10141c);
  } else if (o === 'rentacop') {
    legM = shinM = M(0x10131c);
    handM = skin;
  } else if (o === 'hazmat') {
    legM = shinM = torsoM;
    handM = shoeM = M(0x23282c);
  } else if (o === 'fatigues') {
    torsoM = armM = foreM = M(P, { tex: 'camo' });
    legM = shinM = M(mul(P, 0.85), { tex: 'camo' });
  } else if (o === 'tux') {
    torsoM = armM = foreM = M(0x0e0e12);
    legM = shinM = M(0x0a0a0d);
    handM = M(0xd8d2c4);
  }

  // ---- skeleton: every part is a tapered box
  const pelvis = group(body, 0, HIP_Y, 0);
  add(pelvis, taper(0.34, 0.3, 0.17, 0.21, 0.19), legM, 0, 0.01, 0);
  const torso = group(pelvis);
  add(torso, taper(0.37, 0.33, 0.2, 0.21, 0.2), torsoM, 0, 0.18, 0);
  add(torso, taper(0.52, 0.37, 0.3, 0.27, 0.21), torsoM, 0, 0.43, 0); // the V
  add(torso, taper(0.26, 0.52, 0.07, 0.17, 0.27), torsoM, 0, 0.615, 0); // traps
  add(torso, prism(0.052, 0.062, 0.1, 6), o === 'hazmat' ? torsoM : skin, 0, 0.67, 0);
  const head = group(torso, 0, HEAD_Y, 0);

  const makeArm = (side) => {
    const sh = group(torso, side * 0.31, 0.55, 0);
    add(sh, taper(0.15, 0.13, 0.13, 0.16, 0.13), armM, 0, -0.02, 0); // deltoid
    add(sh, taper(0.115, 0.095, 0.22, 0.125, 0.1), armM, 0, -0.18, 0);
    const el = group(sh, 0, -0.29, 0);
    add(el, taper(0.1, 0.08, 0.24, 0.105, 0.085), foreM, 0, -0.12, 0);
    add(el, box(0.09, 0.105, 0.105), handM, 0, -0.29, 0.005);
    return { sh, el };
  };
  const makeLeg = (side) => {
    const hip = group(pelvis, side * 0.1, 0, 0);
    add(hip, taper(0.165, 0.125, THIGH, 0.185, 0.14), legM, 0, -THIGH / 2, 0);
    const knee = group(hip, 0, -THIGH, 0);
    add(knee, taper(0.12, 0.095, 0.34, 0.135, 0.105), shinM, 0, -0.17, 0);
    add(knee, taper(0.125, 0.135, 0.13, 0.15, 0.17), shoeM, 0, -0.37, 0.005); // boot shaft
    add(knee, taper(0.11, 0.13, 0.085, 0.2, 0.27), shoeM, 0, -0.445, 0.06); // boot toe
    return { hip, knee };
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);
  const legL = makeLeg(1);
  const legR = makeLeg(-1);
  const arms = [armL, armR];
  const legs = [legL, legR];

  // ---- head: hard planes, heavy brow, eyes lost in shadow
  const masked = spec.head === 'balaclava' || spec.head === 'gasmask' || o === 'hazmat';
  const faceM = masked ? M(spec.head === 'gasmask' || o === 'hazmat' ? P : 0x121316) : skin;
  const faceDark = masked ? faceM : skinDark;
  add(head, taper(0.235, 0.265, 0.15, 0.265, 0.29), faceM, 0, 0.07, -0.005); // cranium
  add(head, taper(0.265, 0.16, 0.17, 0.285, 0.19, 0.012), faceM, 0, -0.09, 0); // cheeks to chin
  if (!holo) {
    add(head, taper(0.27, 0.25, 0.04, 0.08, 0.05), faceDark, 0, 0.005, 0.125); // brow ridge
    add(head, box(0.235, 0.042, 0.03), masked && spec.head === 'balaclava' ? skinDark : ink, 0, -0.032, 0.132); // eye shadow
    for (const s of [1, -1]) add(head, box(0.036, 0.011, 0.012), M(0xe8e2d0), s * 0.058, -0.034, 0.146).userData.noInk = true;
    add(head, taper(0.026, 0.056, 0.09, 0.03, 0.07), faceM, 0, -0.075, 0.152); // nose wedge
    add(head, box(0.085, 0.011, 0.012), ink, 0, -0.135, 0.118).userData.noInk = true; // mouth
    for (const s of [1, -1]) add(head, box(0.025, 0.07, 0.05), faceDark, s * 0.137, -0.025, 0);
    if (spec.stubble && !masked) add(head, taper(0.262, 0.165, 0.09, 0.2, 0.15), M(mul(spec.skin, 0.45)), 0, -0.132, 0.045);
  } else {
    add(head, box(0.24, 0.035, 0.03), M(0, { hot: true }), 0, -0.03, 0.135);
  }

  const tails = [];
  // style: 'cropped' | 'fringe' | 'long' | 'spiky'
  const hair = (style) => {
    add(head, taper(0.225, 0.275, style === 'cropped' ? 0.05 : 0.075, 0.26, 0.305), hairM, 0, style === 'cropped' ? 0.137 : 0.15, -0.012);
    add(head, taper(0.28, 0.25, 0.15, 0.13, 0.1), hairM, 0, 0.05, -0.105);
    if (style === 'long') add(head, taper(0.25, 0.16, 0.16, 0.09, 0.04, -0.02), hairM, 0, -0.09, -0.135);
    if (style === 'spiky') {
      for (const [x, z, rx, rz, h] of [
        [-0.08, 0.06, 0.3, 0.45, 0.13],
        [0.0, 0.08, 0.45, 0.0, 0.16],
        [0.08, 0.05, 0.3, -0.45, 0.13],
        [-0.05, -0.05, -0.2, 0.3, 0.15],
        [0.06, -0.06, -0.25, -0.3, 0.14],
        [0.0, -0.13, -0.6, 0.0, 0.12],
      ])
        add(head, taper(0.012, 0.085, h, 0.012, 0.085), hairM, x, 0.19 + h * 0.3, z, rx, 0, rz);
    } else if (style !== 'cropped') {
      for (const [x, rz] of [
        [-0.07, 0.35],
        [0.0, -0.1],
        [0.075, -0.4],
      ])
        add(head, taper(0.07, 0.015, 0.075, 0.05, 0.02), hairM, x, 0.085, 0.135, 0.25, 0, rz);
    }
  };
  const shades = () => {
    add(head, taper(0.285, 0.265, 0.05, 0.05, 0.04), M(0x050507), 0, -0.03, 0.14);
    add(head, box(0.06, 0.008, 0.01), M(0xcfd8e0), 0.07, -0.02, 0.164).userData.noInk = true;
    for (const s of [1, -1]) add(head, box(0.012, 0.02, 0.15), M(0x050507), s * 0.14, -0.025, 0.06);
  };
  switch (spec.head) {
    case 'bandana': {
      hair('long');
      add(head, taper(0.262, 0.285, 0.055, 0.29, 0.31), accentM, 0, 0.062, -0.003); // band gripping the brow
      add(head, box(0.06, 0.05, 0.045), accentM, 0.03, 0.06, -0.165, 0, 0, 0.4); // knot
      for (const s of [1, -1]) {
        const t = group(head, 0.03 + s * 0.022, 0.06, -0.175);
        add(t, box(0.042, 0.2, 0.012), accentM, 0, -0.1, 0);
        const t2 = group(t, 0, -0.2, 0);
        add(t2, taper(0.042, 0.03, 0.2, 0.012, 0.012), accentM, 0, -0.1, 0);
        t.rotation.set(0.5, 0, s * 0.2);
        tails.push({ g: t, g2: t2, s });
      }
      break;
    }
    case 'nvg': {
      hair('fringe');
      add(head, taper(0.262, 0.285, 0.04, 0.29, 0.31), gear, 0, 0.065, -0.003);
      add(head, box(0.2, 0.075, 0.07), gear, 0, 0.012, 0.165);
      const lens = holo ? holoHot : M(0x061a0c, { glow: 0x4dff7a });
      for (const [x, y] of [
        [-0.062, 0.0],
        [0.062, 0.0],
        [0, 0.045],
      ]) {
        add(head, prism(0.034, 0.04, 0.09, 6), steel, x, y, 0.225, Math.PI / 2);
        add(head, prism(0.026, 0.026, 0.012, 6), lens, x, y, 0.274, Math.PI / 2).userData.noInk = true;
      }
      break;
    }
    case 'beanie': {
      add(head, taper(0.2, 0.285, 0.13, 0.22, 0.31), accentM, 0, 0.14, -0.005);
      add(head, taper(0.29, 0.29, 0.05, 0.315, 0.315), M(mul(A, 0.7)), 0, 0.065, -0.005);
      add(head, taper(0.25, 0.2, 0.1, 0.06, 0.04), hairM, 0, -0.03, -0.14);
      break;
    }
    case 'shades':
      hair('fringe');
      shades();
      break;
    case 'beret': {
      hair('fringe');
      add(head, taper(0.262, 0.28, 0.035, 0.29, 0.305), M(mul(A, 0.6)), 0, 0.085, -0.003);
      add(head, prism(0.2, 0.17, 0.055, 6), accentM, 0.04, 0.135, -0.01, 0.05, 0.3, -0.24);
      add(head, box(0.035, 0.04, 0.012), M(0xc9a24a), -0.07, 0.1, 0.15).userData.noInk = true;
      break;
    }
    case 'cap': {
      add(head, taper(0.24, 0.28, 0.085, 0.27, 0.305), accentM, 0, 0.13, -0.008);
      add(head, taper(0.26, 0.28, 0.018, 0.12, 0.16), M(mul(A, 0.5)), 0, 0.09, 0.2, 0.2);
      add(head, box(0.045, 0.04, 0.012), M(0xc9a24a), 0, 0.135, 0.148).userData.noInk = true;
      add(head, taper(0.25, 0.2, 0.1, 0.06, 0.04), hairM, 0, -0.03, -0.14);
      break;
    }
    case 'helmet': {
      add(head, taper(0.24, 0.31, 0.13, 0.27, 0.34), accentM, 0, 0.125, -0.008);
      add(head, taper(0.33, 0.33, 0.025, 0.36, 0.36), M(mul(A, 0.6)), 0, 0.058, -0.008);
      for (const s of [1, -1]) add(head, box(0.015, 0.16, 0.03), gear, s * 0.135, -0.04, 0.03);
      break;
    }
    case 'visor': {
      add(head, taper(0.26, 0.32, 0.17, 0.29, 0.35), accentM, 0, 0.1, -0.008);
      add(head, taper(0.29, 0.25, 0.1, 0.05, 0.04), holo ? holoHot : M(0x1a0406, { glow: 0xff2a2a }), 0, -0.03, 0.165);
      add(head, taper(0.25, 0.17, 0.09, 0.2, 0.16), gear, 0, -0.125, 0.04);
      break;
    }
    case 'balaclava': {
      add(head, taper(0.25, 0.3, 0.07, 0.28, 0.32), accentM, 0, 0.14, -0.006); // rolled watch cap
      break;
    }
    case 'gasmask': {
      add(head, taper(0.25, 0.3, 0.2, 0.28, 0.33), M(P), 0, 0.08, -0.02); // hood
      add(head, taper(0.2, 0.15, 0.13, 0.1, 0.08), gear, 0, -0.07, 0.16); // snout
      const lens = holo ? holoHot : M(0x06141a, { glow: 0x3ad8ff });
      for (const s of [1, -1]) {
        add(head, prism(0.042, 0.042, 0.03, 6), steel, s * 0.062, -0.012, 0.145, Math.PI / 2);
        add(head, prism(0.03, 0.03, 0.012, 6), lens, s * 0.062, -0.012, 0.165, Math.PI / 2).userData.noInk = true;
        add(head, prism(0.045, 0.045, 0.07, 6), steel, s * 0.1, -0.12, 0.15, Math.PI / 2, 0, s * 0.5);
      }
      break;
    }
    case 'fedora': {
      add(head, taper(0.42, 0.42, 0.02, 0.46, 0.46), accentM, 0, 0.1, 0, 0.06);
      add(head, taper(0.2, 0.26, 0.12, 0.24, 0.29), accentM, 0, 0.17, -0.01, 0.06);
      add(head, taper(0.265, 0.268, 0.03, 0.295, 0.298), ink, 0, 0.122, -0.008, 0.06);
      break;
    }
    case 'hood': {
      const hm = M(P);
      add(head, taper(0.27, 0.34, 0.2, 0.3, 0.35), hm, 0, 0.095, -0.03);
      add(head, taper(0.34, 0.3, 0.17, 0.22, 0.17), hm, 0, -0.085, -0.1);
      for (const s of [1, -1]) add(head, box(0.03, 0.21, 0.2), hm, s * 0.155, -0.04, 0.02);
      add(head, taper(0.31, 0.34, 0.03, 0.07, 0.05), M(mul(P, 0.55)), 0, 0.085, 0.145);
      break;
    }
    case 'bucket': {
      add(head, taper(0.25, 0.29, 0.11, 0.27, 0.31), accentM, 0, 0.135, -0.005);
      add(head, taper(0.33, 0.45, 0.05, 0.36, 0.48), accentM, 0, 0.068, -0.005);
      add(head, taper(0.29, 0.295, 0.022, 0.31, 0.315), M(mul(A, 0.55)), 0, 0.1, -0.005);
      add(head, taper(0.25, 0.2, 0.1, 0.06, 0.04), hairM, 0, -0.03, -0.14);
      break;
    }
    case 'roundshades': {
      hair('fringe');
      for (const s of [1, -1]) {
        add(head, prism(0.047, 0.047, 0.014, 8), M(0x050507), s * 0.062, -0.03, 0.15, Math.PI / 2);
        add(head, box(0.012, 0.02, 0.15), M(0x050507), s * 0.14, -0.025, 0.07);
      }
      add(head, box(0.04, 0.01, 0.012), steel, 0, -0.022, 0.152).userData.noInk = true;
      add(head, box(0.025, 0.008, 0.008), M(0xdfe8f0), 0.075, -0.015, 0.16).userData.noInk = true;
      break;
    }
    case 'visorcap': {
      add(head, taper(0.24, 0.28, 0.085, 0.27, 0.305), accentM, 0, 0.13, -0.008);
      add(head, taper(0.25, 0.28, 0.016, 0.13, 0.17), M(mul(A, 0.5)), 0, 0.09, 0.2, 0.18);
      add(head, taper(0.285, 0.265, 0.045, 0.045, 0.035), holo ? holoHot : M(0x060a0c, { glow: A }), 0, -0.03, 0.142).userData.noInk = true;
      add(head, taper(0.25, 0.2, 0.1, 0.06, 0.04), hairM, 0, -0.03, -0.14);
      break;
    }
    case 'headphones': {
      hair('cropped');
      add(head, taper(0.3, 0.33, 0.028, 0.05, 0.05), gear, 0, 0.172, 0);
      for (const s of [1, -1]) {
        add(head, box(0.022, 0.13, 0.035), gear, s * 0.158, 0.1, 0);
        add(head, taper(0.06, 0.06, 0.12, 0.1, 0.1), accentM, s * 0.165, -0.01, 0);
      }
      add(head, box(0.012, 0.012, 0.12), gear, 0.165, -0.07, 0.06, 0.3).userData.noInk = true; // boom mic
      break;
    }
    case 'flatcap': {
      add(head, taper(0.27, 0.3, 0.065, 0.3, 0.34, 0.02), accentM, 0, 0.125, 0.0, 0.12);
      add(head, taper(0.24, 0.27, 0.02, 0.07, 0.1), M(mul(A, 0.55)), 0, 0.082, 0.19, 0.28);
      add(head, taper(0.25, 0.2, 0.1, 0.06, 0.04), hairM, 0, -0.03, -0.14);
      break;
    }
    case 'cropped':
      hair('cropped');
      break;
    case 'spiky':
      hair('spiky');
      break;
    case 'ponytail': {
      hair('fringe');
      add(head, box(0.07, 0.05, 0.05), accentM, 0, 0.1, -0.17);
      const t = group(head, 0, 0.1, -0.19);
      add(t, taper(0.075, 0.055, 0.18, 0.06, 0.045), hairM, 0, -0.09, 0);
      const t2 = group(t, 0, -0.18, 0);
      add(t2, taper(0.055, 0.02, 0.17, 0.045, 0.02), hairM, 0, -0.085, 0);
      t.rotation.set(0.5, 0, 0);
      tails.push({ g: t, g2: t2, s: 0 });
      break;
    }
    case 'goggles': {
      hair('spiky');
      add(head, taper(0.262, 0.285, 0.04, 0.29, 0.31), gear, 0, 0.075, -0.003);
      const lens = holo ? holoHot : M(0x060a0c, { glow: A });
      for (const s of [1, -1]) {
        add(head, prism(0.05, 0.055, 0.05, 6), steel, s * 0.062, 0.085, 0.15, Math.PI / 2 - 0.25);
        add(head, prism(0.036, 0.036, 0.012, 6), lens, s * 0.062, 0.092, 0.178, Math.PI / 2 - 0.25).userData.noInk = true;
      }
      break;
    }
    case 'bald':
      break;
    default:
      hair('fringe');
  }
  if (spec.shades && !masked && spec.head !== 'shades' && spec.head !== 'nvg' && spec.head !== 'visor') shades();
  if (spec.mustache && !masked && !holo) add(head, taper(0.07, 0.11, 0.028, 0.02, 0.025), hairM, 0, -0.118, 0.128);
  if (spec.scarf && !holo) add(torso, taper(0.24, 0.33, 0.1, 0.22, 0.29), M(spec.scarf), 0, 0.665, 0.012);

  // ---- outfit dressing: all hard-surface kit
  const belt = (m, pouches = 0) => {
    add(pelvis, taper(0.355, 0.35, 0.055, 0.225, 0.22), m, 0, 0.085, 0);
    add(pelvis, box(0.06, 0.05, 0.02), steel, 0, 0.085, 0.115).userData.noInk = true;
    for (let i = 0; i < pouches; i++) {
      const s = i % 2 ? 1 : -1;
      const k = (i >> 1) + 1;
      add(pelvis, box(0.075, 0.095, 0.06), gear, s * (0.06 + k * 0.085), 0.04, k > 1 ? 0.03 : 0.105, 0, k > 1 ? (s * Math.PI) / 2.4 : 0);
    }
  };
  const coat = (len, m = torsoM) => {
    add(pelvis, taper(0.37, 0.4, len, 0.03, 0.03), m, 0, 0.06 - len / 2, -0.115, -0.05);
    for (const s of [1, -1]) {
      add(pelvis, taper(0.03, 0.03, len, 0.22, 0.26), m, s * 0.185, 0.06 - len / 2, 0, 0, 0, s * 0.05);
      add(pelvis, taper(0.12, 0.14, len, 0.03, 0.03), m, s * 0.13, 0.06 - len / 2, 0.112, 0.04, 0, s * 0.03);
    }
  };
  const collar = (m, h = 0.11) => {
    add(torso, taper(0.3, 0.24, h, 0.05, 0.05), m, 0, 0.66 + h / 2 - 0.03, -0.1, -0.2);
    for (const s of [1, -1]) add(torso, taper(0.05, 0.05, h, 0.2, 0.16), m, s * 0.125, 0.66 + h / 2 - 0.03, -0.01, 0, 0, s * -0.25);
  };
  const kneepads = (m) => legs.forEach((l) => add(l.knee, taper(0.13, 0.115, 0.11, 0.05, 0.04), m, 0, -0.02, 0.075));
  const elbowpads = (m) => arms.forEach((a) => add(a.el, box(0.11, 0.08, 0.05), m, 0, 0, -0.055));
  const shoulderpads = (m) => [1, -1].forEach((s, i) => add(arms[i].sh, taper(0.17, 0.19, 0.055, 0.19, 0.2), m, s * 0.012, 0.052, 0, 0, 0, s * -0.25));
  const vest = (m, plates = true) => {
    add(torso, taper(0.47, 0.37, 0.27, 0.29, 0.235), m, 0, 0.415, 0.004);
    if (plates) {
      add(torso, box(0.2, 0.13, 0.03), gear, 0, 0.44, 0.145);
      for (const s of [1, -1]) add(torso, box(0.085, 0.1, 0.045), gear, s * 0.115, 0.33, 0.125);
    }
  };

  if (o === 'rig') {
    // tactical rig: harness, chest plates, pads, pouches
    const rig = M(mul(P, 0.5));
    vest(rig, false);
    for (const s of [1, -1]) {
      add(torso, box(0.04, 0.42, 0.02), accentM, s * 0.075, 0.45, 0.143, 0.14, 0, s * 0.3);
      add(torso, box(0.04, 0.36, 0.02), gear, s * 0.1, 0.45, -0.135, -0.1, 0, s * -0.25);
    }
    add(torso, box(0.14, 0.09, 0.04), gear, -0.09, 0.36, 0.14);
    add(torso, box(0.17, 0.2, 0.07), gear, 0, 0.42, -0.165);
    collar(rig, 0.07);
    belt(gear, 4);
    kneepads(gear);
    elbowpads(gear);
    shoulderpads(rig);
    legs.forEach((l, i) => add(l.hip, box(0.05, 0.13, 0.11), gear, (i ? -1 : 1) * 0.09, -0.2, 0));
  } else if (o === 'longcoat') {
    coat(0.76);
    collar(torsoM, 0.15);
    belt(accentM, 0);
    for (const s of [1, -1]) {
      add(torso, taper(0.11, 0.03, 0.26, 0.012, 0.012), M(mul(P, 0.6)), s * 0.07, 0.5, 0.142, -0.08, 0, s * 0.12);
      add(arms[s === 1 ? 0 : 1].sh, taper(0.16, 0.17, 0.03, 0.17, 0.18), M(mul(P, 0.7)), 0, 0.05, 0);
    }
    add(torso, taper(0.1, 0.05, 0.12, 0.012, 0.012), accentM, 0, 0.56, 0.14, -0.1).userData.noInk = true; // scarf knot
  } else if (o === 'moto') {
    // cropped jacket over an accent tee
    add(torso, taper(0.378, 0.338, 0.21, 0.218, 0.208), accentM, 0, 0.18, 0);
    add(torso, taper(0.54, 0.41, 0.3, 0.285, 0.235), torsoM, 0, 0.44, 0.002);
    add(torso, box(0.018, 0.3, 0.012), steel, 0.05, 0.44, 0.148, 0, 0, -0.28).userData.noInk = true;
    for (const s of [1, -1]) add(torso, taper(0.1, 0.04, 0.16, 0.012, 0.012), M(mul(P, 0.6)), s * 0.09, 0.53, 0.147, -0.06, 0, s * 0.3).userData.noInk = true;
    collar(torsoM, 0.07);
    shoulderpads(M(mul(P, 0.65)));
    arms.forEach((a) => add(a.el, taper(0.108, 0.098, 0.05, 0.112, 0.102), M(mul(P, 0.65)), 0, -0.215, 0));
    belt(gear, 1);
    legs.forEach((l) => add(l.knee, taper(0.135, 0.14, 0.05, 0.155, 0.175), accentM, 0, -0.31, 0.005));
  } else if (o === 'parka') {
    add(torso, taper(0.57, 0.45, 0.34, 0.31, 0.275), torsoM, 0, 0.43, 0);
    add(pelvis, taper(0.44, 0.47, 0.27, 0.275, 0.295), torsoM, 0, 0.0, 0);
    add(torso, taper(0.36, 0.45, 0.09, 0.3, 0.35), M(0xd8d2c4), 0, 0.668, -0.01); // fur trim
    add(torso, taper(0.24, 0.31, 0.15, 0.1, 0.13), torsoM, 0, 0.62, -0.18, -0.3); // hood, down
    for (const s of [1, -1]) add(pelvis, box(0.12, 0.1, 0.03), M(mul(P, 0.7)), s * 0.12, 0.0, 0.142);
    add(torso, box(0.024, 0.52, 0.012), accentM, 0, 0.36, 0.16).userData.noInk = true;
    arms.forEach((a) => {
      add(a.sh, taper(0.17, 0.15, 0.26, 0.17, 0.15), torsoM, 0, -0.13, 0);
      add(a.el, taper(0.115, 0.105, 0.05, 0.12, 0.11), accentM, 0, -0.215, 0);
    });
  } else if (o === 'suit') {
    add(torso, taper(0.17, 0.05, 0.3, 0.012, 0.012), M(0xe0dacb), 0, 0.46, 0.142, -0.07).userData.noInk = true;
    add(torso, taper(0.045, 0.03, 0.26, 0.014, 0.014), accentM, 0, 0.45, 0.148, -0.07).userData.noInk = true; // tie
    for (const s of [1, -1]) add(torso, taper(0.12, 0.03, 0.28, 0.012, 0.012), M(mul(P, 0.6)), s * 0.09, 0.47, 0.146, -0.07, 0, s * 0.15).userData.noInk = true;
    add(torso, box(0.05, 0.02, 0.012), accentM, 0.13, 0.5, 0.14).userData.noInk = true; // pocket square
    coat(0.24);
    collar(M(0xe0dacb), 0.05);
    belt(ink, 0);
  } else if (o === 'techvest') {
    vest(M(P));
    add(torso, box(0.3, 0.02, 0.012), accentM, 0, 0.52, 0.152).userData.noInk = true;
    add(torso, box(0.03, 0.03, 0.012), M(0x0a0a0a, { glow: A }), 0.13, 0.46, 0.15).userData.noInk = true;
    for (const s of [1, -1]) add(torso, box(0.04, 0.34, 0.02), gear, s * 0.13, 0.46, -0.14);
    add(torso, box(0.2, 0.22, 0.08), M(mul(P, 0.7)), 0, 0.42, -0.17); // slim pack
    collar(M(mul(P, 0.5)), 0.08);
    belt(gear, 4);
    kneepads(M(P));
    arms.forEach((a) => add(a.el, taper(0.108, 0.1, 0.1, 0.112, 0.104), M(P), 0, -0.17, 0)); // bracers
  } else if (o === 'jumpsuit') {
    add(torso, box(0.022, 0.5, 0.012), accentM, 0, 0.38, 0.143).userData.noInk = true; // zip
    add(pelvis, box(0.022, 0.14, 0.012), accentM, 0, 0.02, 0.108).userData.noInk = true;
    for (const s of [1, -1]) {
      add(torso, box(0.09, 0.08, 0.02), M(mul(P, 0.7)), s * 0.12, 0.48, 0.138);
      add(legs[s === 1 ? 0 : 1].hip, box(0.03, 0.14, 0.12), M(mul(P, 0.7)), s * 0.085, -0.22, 0);
    }
    collar(torsoM, 0.07);
    belt(accentM, 2);
    arms.forEach((a) => add(a.el, taper(0.112, 0.108, 0.06, 0.116, 0.112), M(mul(P, 0.7)), 0, -0.02, 0)); // rolled cuffs
    kneepads(M(mul(P, 0.6)));
    add(torso, box(0.08, 0.03, 0.012), M(0xe0dacb), -0.12, 0.54, 0.14).userData.noInk = true; // name tape
  } else if (o === 'poncho') {
    add(torso, taper(0.34, 0.84, 0.5, 0.3, 0.6), M(P), 0, 0.43, 0);
    add(torso, taper(0.845, 0.87, 0.04, 0.605, 0.625), accentM, 0, 0.175, 0);
    add(torso, taper(0.26, 0.36, 0.1, 0.24, 0.32), M(mul(P, 0.7)), 0, 0.67, 0.01);
    add(torso, box(0.03, 0.26, 0.012), accentM, 0, 0.5, 0.21, 0.33).userData.noInk = true;
    belt(gear, 0);
    kneepads(gear);
  } else if (o === 'polo') {
    vest(M(0x15181e));
    collar(torsoM, 0.05);
    belt(gear, 2);
    add(torso, box(0.03, 0.05, 0.03), gear, 0.15, 0.6, 0.06); // radio mic
    add(head, box(0.012, 0.06, 0.012), gear, 0.142, -0.06, 0.02).userData.noInk = true; // earpiece
  } else if (o === 'rentacop') {
    add(torso, taper(0.05, 0.03, 0.3, 0.012, 0.012), ink, 0, 0.44, 0.143).userData.noInk = true; // tie
    add(torso, box(0.05, 0.06, 0.014), M(0xc9a24a), 0.12, 0.5, 0.134).userData.noInk = true;
    collar(torsoM, 0.05);
    shoulderpads(M(mul(P, 0.6)));
    belt(gear, 3);
    add(pelvis, box(0.035, 0.24, 0.035), ink, 0.2, -0.06, 0.02, 0.15); // baton
    add(torso, box(0.045, 0.07, 0.035), gear, -0.14, 0.58, 0.07);
  } else if (o === 'hazmat') {
    add(torso, box(0.2, 0.2, 0.07), gear, 0, 0.42, 0.155);
    add(torso, box(0.04, 0.04, 0.012), M(0x062a14, { glow: 0x33ff88 }), 0.05, 0.46, 0.192).userData.noInk = true;
    add(torso, box(0.04, 0.04, 0.012), M(0x2a0606, { glow: 0xff3a2a }), -0.05, 0.46, 0.192).userData.noInk = true;
    for (const s of [1, -1]) add(torso, prism(0.06, 0.06, 0.32, 6), steel, s * 0.075, 0.42, -0.19);
    add(torso, prism(0.025, 0.025, 0.3, 5), gear, 0.12, 0.6, 0.02, 1.2, 0, 0.3); // hose
    belt(gear, 2);
    legs.forEach((l) => add(l.knee, taper(0.135, 0.13, 0.04, 0.15, 0.145), M(0xb8901c), 0, -0.29, 0));
    arms.forEach((a) => add(a.el, taper(0.11, 0.105, 0.04, 0.115, 0.11), M(0xb8901c), 0, -0.2, 0));
  } else if (o === 'fatigues') {
    vest(M(0x1c2016));
    for (const s of [1, -1]) add(torso, box(0.04, 0.4, 0.02), gear, s * 0.1, 0.46, 0.146, 0.13, 0, s * 0.1);
    add(torso, box(0.06, 0.14, 0.05), gear, -0.17, 0.6, -0.08); // radio + whip aerial
    add(torso, box(0.008, 0.26, 0.008), ink, -0.17, 0.8, -0.08).userData.noInk = true;
    belt(gear, 4);
    kneepads(gear);
    shoulderpads(M(0x1c2016));
  } else if (o === 'tux') {
    add(torso, taper(0.17, 0.05, 0.3, 0.012, 0.012), M(0xd8d2c4), 0, 0.46, 0.142, -0.07).userData.noInk = true; // shirt front
    for (const s of [1, -1]) {
      add(torso, taper(0.045, 0.012, 0.035, 0.014, 0.014), accentM, s * 0.028, 0.615, 0.142, 0, 0, s * (Math.PI / 2)).userData.noInk = true; // bow tie
      add(torso, taper(0.11, 0.03, 0.27, 0.012, 0.012), M(0x1c1c22), s * 0.085, 0.47, 0.146, -0.07, 0, s * 0.14).userData.noInk = true; // satin lapels
    }
    coat(0.3);
    belt(accentM, 0);
    add(torso, box(0.03, 0.05, 0.03), gear, 0.13, 0.33, 0.13); // shoulder-holster-shaped radio
  }

  if (holo) {
    const wire = new THREE.LineBasicMaterial({ color: 0x5cfff0 });
    const meshes = [];
    root.traverse((m) => m.isMesh && meshes.push(m));
    for (const m of meshes) {
      const key = `edges:${m.geometry.uuid}`;
      const eg = geo(key, () => new THREE.EdgesGeometry(m.geometry, 20));
      const l = new THREE.LineSegments(eg, wire);
      l.userData.ink = true;
      m.add(l);
    }
  } else {
    inkAll(root, spec.ink ?? 0.007);
  }

  const rig = { root, body, pelvis, torso, head, armL, armR, legL, legR, tails, phase: 0, j: null, height: 1.88 * build.h, holo };
  rig.j = restPose();
  applyPose(rig, rig.j);
  return rig;
}

/** Draw the character again where it is hidden by walls, as a ghostly silhouette. */
export function addSilhouette(rig, color = 0x5cf0b0) {
  // Inverted depth test: draws only where something nearer hides the body.
  // The depth used for that test is pulled 0.7 m towards the camera so the
  // character's own limbs never count as "something nearer".
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false });
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
  rig.root.traverse((m) => m.isMesh && !m.userData.ink && meshes.push(m));
  for (const m of meshes) {
    const s = new THREE.Mesh(m.geometry, mat);
    s.renderOrder = 50;
    s.userData.ink = true;
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
      T.py = 0.52 + Math.abs(Math.sin(ph)) * 0.025 * amp;
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
    tl.g.rotation.z = tl.s * 0.2 + Math.sin(t * 3.3 + tl.s * 2) * 0.09;
    if (tl.g2) tl.g2.rotation.x = 0.25 + Math.min(0.7, speed * 0.16) + Math.sin(t * 6.3 + tl.s * 3) * (0.1 + amp * 0.2);
  }
}

/** Snap straight to the pose animateCharacter is heading for (no blending). */
export function settleCharacter(rig, p) {
  animateCharacter(rig, p, 10);
}

/** three.js yaw for a core heading angle (direction = cos a, sin a in XZ). */
export const yawOf = (ang) => Math.PI / 2 - ang;

const GUARD_LOOKS = {
  yacht: {
    outfits: ['polo', 'polo', 'suit', 'techvest', 'moto'],
    primary: [0x2a3a40, 0x1f3a3a, 0x3a3f48, 0xd8d2c4, 0x22304a],
    accent: [0xe8a020, 0x14181e, 0xc9a24a, 0xe8e0cc],
    heads: ['cap', 'cap', 'cropped', 'bald', 'beret', 'bucket', 'roundshades', 'flatcap'],
    shades: 0.6,
  },
  office: {
    outfits: ['rentacop', 'rentacop', 'suit', 'longcoat', 'moto'],
    primary: [0x4a5a68, 0x3a4a4a, 0x56607a, 0x6a6458, 0x2a2a32],
    accent: [0x14161e, 0x5cf0b0, 0xc9a24a, 0x7ac8ff],
    heads: ['cap', 'cap', 'cropped', 'bald', 'fedora', 'flatcap', 'headphones', 'hair'],
    shades: 0.25,
  },
  lab: {
    outfits: ['hazmat', 'hazmat', 'jumpsuit', 'parka', 'techvest'],
    primary: [0xa8801a, 0x8a929a, 0x5a7a22, 0x3a6a5a, 0xc8c0ae],
    accent: [0x5cf0b0, 0x23282c, 0xe8e0cc, 0xff9a3a],
    heads: ['gasmask', 'gasmask', 'visor', 'goggles', 'hood', 'visorcap'],
    shades: 0,
  },
  bunker: {
    outfits: ['fatigues', 'fatigues', 'rig', 'poncho', 'parka'],
    primary: [0x5a6238, 0x6e6040, 0x4c5434, 0x3a4a3a, 0x8a4a2a],
    accent: [0xe8a020, 0x16301c, 0xe0562a, 0xd8c090],
    heads: ['balaclava', 'balaclava', 'beret', 'helmet', 'visor', 'bucket', 'goggles', 'beanie'],
    shades: 0.2,
  },
  museum: {
    outfits: ['tux', 'tux', 'longcoat', 'suit'],
    primary: [0x16161c, 0x1f2a26, 0x2a2a32, 0x3a2a22],
    accent: [0x7a0f1c, 0xc9a24a, 0xe8e0cc, 0x2fa87a],
    heads: ['hair', 'fedora', 'bald', 'shades', 'flatcap', 'cropped', 'ponytail', 'roundshades'],
    shades: 0.3,
  },
  vr: {
    outfits: ['fatigues', 'rig', 'longcoat', 'techvest', 'jumpsuit'],
    primary: [0x22e6d2],
    accent: [0x22e6d2],
    heads: ['helmet', 'visor', 'balaclava', 'cap', 'hood', 'goggles'],
    shades: 0,
  },
};

/** Guard look for a theme: a random outfit, palette, headgear, build and extras. */
export function guardSpec(themeId, rng) {
  const look = GUARD_LOOKS[themeId] || GUARD_LOOKS.vr;
  return {
    skin: rng.pick(SKIN_TONES),
    build: rng.pick(['standard', 'standard', 'stocky', 'tall', 'tall', 'slim']),
    hairColor: rng.pick(HAIR_COLORS.slice(0, 6)),
    outfit: rng.pick(look.outfits),
    primary: rng.pick(look.primary),
    accent: rng.pick(look.accent),
    head: rng.pick(look.heads),
    mustache: rng.chance(0.3),
    stubble: rng.chance(0.5),
    shades: rng.chance(look.shades),
    scarf: rng.chance(0.18) ? rng.pick(look.accent) : 0,
    holo: themeId === 'vr',
    rim: 0xffe2b8,
    rimStrength: 0.3,
  };
}

/** Convert saved agent settings into a character spec. */
export function agentSpec(agent) {
  return {
    skin: SKIN_TONES[agent.skin] ?? SKIN_TONES[1],
    build: agent.build,
    outfit: agent.outfit,
    primary: agent.primary,
    accent: agent.accent,
    head: agent.head,
    hairColor: HAIR_COLORS[agent.hair] ?? HAIR_COLORS[0],
    stubble: false,
    rim: 0xc8ffe8,
    rimStrength: 0.3,
    ink: 0.008,
  };
}
