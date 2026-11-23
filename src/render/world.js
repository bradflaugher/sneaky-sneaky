// Turns a generated room into a lit, dressed three.js scene.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WALL, cellAt } from '../core/grid.js';
import { RNG } from '../core/rng.js';
import { ART, VENT_COLORS, WALL_H } from './themeArt.js';
import { floorTexture, wallTexture, miscTexture, skyTexture, glowTexture, poolTexture, shaftTexture, paintedTexture, backdropTexture, oceanTexture, cityBelowTexture } from './textures.js';
import { toon, glowToon, inkAll } from './toon.js';
import { buildLootProp } from './lootProps.js';
import { LOOT_BY_ID } from '../core/loot.js';
import { ductPath } from '../core/ducts.js';

// Everything solid is cel-shaded and flat-faceted (see toon.js).
const std = (color, o = {}) => toon(color, o);
const glowMat = (color, intensity = 2) => glowToon(color, intensity);
const matOf = (o) => toon(o.color ?? 0xffffff, o);
const additive = (color, opacity, map = null) =>
  new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });

/** Greedy-merge all cells matching `pred` into rectangles. */
function rectsOf(room, pred) {
  const used = new Uint8Array(room.w * room.h);
  const out = [];
  for (let y = 0; y < room.h; y++)
    for (let x = 0; x < room.w; x++) {
      if (used[y * room.w + x] || !pred(x, y)) continue;
      let w = 1;
      while (x + w < room.w && !used[y * room.w + x + w] && pred(x + w, y)) w++;
      let h = 1;
      outer: for (; y + h < room.h; h++) for (let k = 0; k < w; k++) if (used[(y + h) * room.w + x + k] || !pred(x + k, y + h)) break outer;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) used[yy * room.w + xx] = 1;
      out.push({ x, y, w, h });
    }
  return out;
}

/** Box with wall-friendly UVs: u tiles every 2 m along the wall, v spans the height. */
function wallBox(x0, y0, z0, x1, y1, z1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const g = new THREE.BoxGeometry(dx, dy, dz);
  const uv = g.attributes.uv;
  for (let i = 0; i < 24; i++) {
    const face = i >> 2;
    const span = face < 2 ? dz : dx;
    uv.setX(i, uv.getX(i) * (span / 2));
    if (face === 2 || face === 3) uv.setY(i, uv.getY(i) * (dz / 2) * 0.05);
  }
  g.translate(x0 + dx / 2, y0 + dy / 2, z0 + dz / 2);
  return g;
}

export function buildWorld(room, { lowPower = false } = {}) {
  const art = ART[room.themeId];
  const rng = new RNG(`${room.seed}:${room.level}:dress`);
  const group = new THREE.Group();
  const disposables = [];
  const animated = [];
  const { w, h } = room;
  const glowTex = glowTexture();
  const poolTex = poolTexture();
  const shaftTex = shaftTexture();

  const mesh = (geo, mat, parent = group, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    disposables.push(geo);
    return m;
  };
  const merged = (geos, mat, shadow = true) => {
    if (!geos.length) return null;
    const g = mergeGeometries(geos);
    geos.forEach((x) => x.dispose());
    return mesh(g, mat, group, shadow);
  };
  const decal = (color, size, x, z, opacity = 0.5, y = 0.02, tex = glowTex) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), additive(color, opacity, tex));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 2;
    group.add(m);
    return m;
  };
  const shaft = (color, x, z, radius, height, opacity = 0.22) => {
    const g = new THREE.CylinderGeometry(radius * 0.35, radius, height, 20, 1, true);
    const m = new THREE.Mesh(g, additive(color, opacity, shaftTex));
    m.position.set(x, height / 2, z);
    m.renderOrder = 3;
    group.add(m);
    return m;
  };

  // ------------------------------------------------------------ sky + environment
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(room.themeId, art.sky, art.stars), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.position.set(w / 2, 0, h / 2);
  sky.renderOrder = -10;
  group.add(sky);

  const ground = (mat, y, size = 500) => {
    const m = mesh(new THREE.PlaneGeometry(size, size), mat, group, false);
    m.rotation.x = -Math.PI / 2;
    m.position.set(w / 2, y, h / 2);
    return m;
  };
  /** An illustrated panorama wrapped round the horizon. */
  const backdrop = (kind, radius, height, baseY, repeat = 2, opacity = 1) => {
    const tex = backdropTexture(kind).clone();
    tex.repeat.set(repeat, 1);
    tex.needsUpdate = true;
    disposables.push(tex);
    const geo = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, side: THREE.BackSide, fog: false, depthWrite: false }));
    m.position.set(w / 2, baseY + height / 2, h / 2);
    m.renderOrder = -5;
    group.add(m);
    disposables.push(geo);
    return m;
  };
  /** A soft moon with a halo, hung in the sky. */
  const moon = (x, y, z, size, color = 0xdfe8ff) => {
    for (const [k, o] of [
      [1, 0.95],
      [3.2, 0.3],
    ]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: o, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.position.set(w / 2 + x, y, h / 2 + z);
      sp.scale.setScalar(size * k);
      sp.renderOrder = -6;
      group.add(sp);
    }
  };
  const reach = Math.max(w, h);

  if (art.env === 'ocean') {
    // a moonlit sea with inked wave crests, drifting slowly past the hull
    const seaTex = oceanTexture().clone();
    seaTex.repeat.set(70, 70);
    seaTex.needsUpdate = true;
    disposables.push(seaTex);
    const sea = ground(new THREE.MeshBasicMaterial({ map: seaTex, color: 0xb8c8e8 }), -2.4);
    sea.receiveShadow = false;
    animated.push((t) => seaTex.offset.set(t * 0.012, t * 0.007));
    const hullM = std(0xe8e0cc);
    mesh(new THREE.BoxGeometry(w + 3, 2.6, h + 3), hullM).position.set(w / 2, -1.32, h / 2);
    const bow = mesh(new THREE.CylinderGeometry((h + 3) / 2 / Math.cos(Math.PI / 4) / 1.4142, (h + 3) / 2.4, 2.6, 4, 1), hullM);
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(1.5, 1, 1);
    bow.position.set(w + 1.5, -1.32, h / 2);
    mesh(new THREE.BoxGeometry(w + 3.1, 0.25, h + 3.1), std(0x7a4020)).position.set(w / 2, -1.4, h / 2);
    // the moon and its long shimmering path on the water
    moon(-64, 30, -40, 10);
    for (let i = 0; i < 30; i++) {
      const k = i / 30;
      const s = decal(0xdfe8ff, rng.range(5, 12), w / 2 - 14 - k * 96 + rng.range(-3, 3), h / 2 - 9 - k * 61 + rng.range(-4, 4), 0.3, -2.37);
      s.scale.y = 0.14;
      s.rotation.z = 0.55;
      animated.push((t) => (s.material.opacity = 0.1 + 0.2 * Math.max(0, Math.sin(t * 1.6 + i * 1.7))));
    }
    backdrop('harbor', reach * 0.5 + 36, 22, -5, 2);
  } else if (art.env === 'skyline') {
    // midnight city on every side, a hazy moon above it
    backdrop('city', 190, 120, -52, 2, 0.75);
    backdrop('city', reach * 0.5 + 70, 70, -44, 3);
    moon(50, 40, -80, 14, 0xe8e0ff);
    // the streets far below: blocks, lit windows, rivers of amber traffic
    const below = cityBelowTexture().clone();
    below.repeat.set(9, 9);
    below.needsUpdate = true;
    disposables.push(below);
    ground(new THREE.MeshBasicMaterial({ map: below, color: 0x5a5f8c, fog: false }), -70, 900).receiveShadow = false;
    mesh(new THREE.BoxGeometry(w + 0.6, 60, h + 0.6), std(0x05060c), group, false).position.set(w / 2, -30.06, h / 2);
  } else if (art.env === 'desert') {
    // dusk sand running out to the canyon walls
    ground(std(0x54384e), -0.04);
    for (let i = 0; i < 16; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(reach * 0.75 + 6, reach * 0.5 + 30);
      const dune = mesh(new THREE.SphereGeometry(1, 24, 12), std(0x6e4658), group, false);
      dune.scale.set(rng.range(6, 16), rng.range(1.2, 4), rng.range(5, 12));
      dune.position.set(w / 2 + Math.cos(a) * d, -0.3, h / 2 + Math.sin(a) * d);
      dune.rotation.y = rng.range(0, 3);
    }
    // canyon mesas all round, catching the last of the sun
    backdrop('mesas', reach * 0.5 + 34, 26, -3, 2);
    moon(60, 36, 50, 6, 0xfff0d0);
  } else if (art.env === 'vrgrid') {
    const tex = floorTexture('vrgrid').clone();
    tex.repeat.set(125, 125);
    tex.needsUpdate = true;
    ground(new THREE.MeshBasicMaterial({ map: tex, color: 0x4a6a9a }), -0.03);
    backdrop('vr', reach * 0.5 + 36, 24, -0.5, 3);
    // floating holo-markers drifting over the grid
    const cols = [0x3ae8ff, 0xff3ac8];
    for (let i = 0; i < 22; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(reach * 0.7 + 5, 64);
      const bx = new THREE.BoxGeometry(rng.range(2, 5), rng.range(4, 22), rng.range(2, 5));
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(bx), new THREE.LineBasicMaterial({ color: cols[i % 5 === 0 ? 1 : 0], transparent: true, opacity: 0.6 }));
      bx.dispose();
      const y0 = rng.range(2, 9);
      e.position.set(w / 2 + Math.cos(a) * d, y0, h / 2 + Math.sin(a) * d);
      group.add(e);
      disposables.push(e.geometry);
      animated.push((t) => {
        e.position.y = y0 + Math.sin(t * 0.4 + i) * 0.6;
        e.rotation.y = t * 0.05 * (i % 2 ? 1 : -1);
      });
    }
  } else {
    // an interior: the room sits inside a much bigger hall
    const lab = room.themeId === 'lab';
    // the same flooring runs on into the dark beyond the walls
    const outer = floorTexture(art.floor).clone();
    outer.repeat.set(125, 125);
    outer.needsUpdate = true;
    disposables.push(outer);
    ground(new THREE.MeshStandardMaterial({ map: outer, color: lab ? 0x6f8a90 : 0x7a6a8a, roughness: 0.6 }), -0.05);
    const hall = backdrop(lab ? 'sublevel' : 'hall', reach * 0.62 + 20, 30, -7, lab ? 3 : 4, lab ? 0.9 : 0.8);
    hall.material.fog = true;
    if (lab) {
      // glowing conduit pipes rising out of the dark, and mist along the floor
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.3;
        const d = reach * 0.62 + rng.range(5, 12);
        const col = i % 3 === 0 ? 0x4fc8f0 : 0x4fe8c0;
        const pipe = mesh(new THREE.CylinderGeometry(0.22, 0.22, 16, 12), glowMat(col, 1.4), group, false);
        pipe.position.set(w / 2 + Math.cos(a) * d, 6, h / 2 + Math.sin(a) * d * 0.8);
        const collar = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 12), std(0x1c3038), group, false);
        collar.position.set(pipe.position.x, 0.25, pipe.position.z);
        decal(col, 7, pipe.position.x, pipe.position.z, 0.22);
      }
      for (let i = 0; i < 14; i++) {
        const a = rng.range(0, Math.PI * 2);
        const d = reach * 0.5 + rng.range(2, 14);
        const mist = decal(0x9fe8e0, rng.range(10, 18), w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d * 0.8, 0.07, 0.3);
        const x0 = mist.position.x;
        animated.push((t) => {
          mist.position.x = x0 + Math.sin(t * 0.12 + i) * 2.5;
          mist.material.opacity = 0.05 + 0.03 * Math.sin(t * 0.3 + i * 2);
        });
      }
    }
  }

  // ------------------------------------------------------------ floor
  {
    const tex = floorTexture(art.floor).clone();
    tex.repeat.set(w / 4, h / 4); // one texture covers 4 m: broad, calm panels
    tex.needsUpdate = true;
    // VR is unlit phosphor on black, exactly as drawn
    // Elsewhere the floor is the one PBR surface: a soft sheen lets lamp pools
    // bloom across the dark instead of stepping in toon bands.
    const glossy = art.floor === 'marble' || art.floor === 'tile' || art.floor === 'teak';
    const mat = room.themeId === 'vr' ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshStandardMaterial({ map: tex, roughness: glossy ? 0.42 : 0.72, metalness: glossy ? 0.12 : 0 });
    const f = mesh(new THREE.PlaneGeometry(w, h), mat, group, false);
    f.rotation.x = -Math.PI / 2;
    f.position.set(w / 2, 0, h / 2);
    disposables.push(tex);
  }

  // ------------------------------------------------------------ walls
  const isBorder = (x, y) => x === 0 || y === 0 || x === w - 1 || y === h - 1;
  const wallMat = std(0xffffff, { map: wallTexture(art.wall), roughness: 0.85 });
  if (room.themeId === 'vr') {
    wallMat.emissiveMap = wallMat.map;
    wallMat.emissive = new THREE.Color(0xffffff);
    wallMat.emissiveIntensity = 0.9;
    wallMat.color.setHex(0x0a1416);
  }
  const capMat = art.capGlow ? matOf({ color: 0x021008, emissive: art.cap, emissiveIntensity: 0.05 }) : std(art.cap, { roughness: 0.55, metalness: art.capMetal || 0.1 });
  const wallGeos = [];
  const capGeos = [];
  const solidOuter = art.outer === 'solid';
  for (const r of rectsOf(room, (x, y) => room.cells[y * w + x] === WALL && !isBorder(x, y))) {
    wallGeos.push(wallBox(r.x, 0, r.y, r.x + r.w, WALL_H, r.y + r.h));
    capGeos.push(new THREE.BoxGeometry(r.w + 0.08, 0.09, r.h + 0.08).translate(r.x + r.w / 2, WALL_H + 0.045, r.y + r.h / 2));
  }
  merged(wallGeos, wallMat);
  merged(capGeos, capMat, false);
  // skirting trim where wall meets floor
  const skirtGeos = rectsOf(room, (x, y) => room.cells[y * w + x] === WALL && !isBorder(x, y)).map((r) => new THREE.BoxGeometry(r.w + 0.07, 0.13, r.h + 0.07).translate(r.x + r.w / 2, 0.065, r.y + r.h / 2));
  merged(skirtGeos, capMat, false);

  // The four outer walls are separate groups so whichever ones stand between
  // the camera and the room can sink out of the way (dollhouse cutaway).
  const railMat = std(0xb8862a);
  const frameMat = std(0x0c0d12);
  const glassMat = std(0x4ac8b0, { transparent: true, opacity: 0.07, depthWrite: false });
  const sides = [
    { r: { x: 0, y: 0, w, h: 1 }, hidden: (c) => c.z < 0.5 },
    { r: { x: 0, y: h - 1, w, h: 1 }, hidden: (c) => c.z > h - 0.5 },
    { r: { x: 0, y: 1, w: 1, h: h - 2 }, hidden: (c) => c.x < 0.5 },
    { r: { x: w - 1, y: 1, w: 1, h: h - 2 }, hidden: (c) => c.x > w - 0.5 },
  ];
  for (const side of sides) {
    const r = side.r;
    const g = new THREE.Group();
    group.add(g);
    side.group = g;
    side.sink = 0;
    const add = (geo, mat, shadow = true) => {
      const m = mesh(geo, mat, g, shadow);
      return m;
    };
    const long = r.w >= r.h;
    const len = long ? r.w : r.h;
    if (art.outer === 'rail') {
      side.low = true;
      add(wallBox(r.x, 0, r.y, r.x + r.w, 0.82, r.y + r.h), wallMat);
      add(new THREE.BoxGeometry(r.w + 0.06, 0.07, r.h + 0.06).translate(r.x + r.w / 2, 0.855, r.y + r.h / 2), capMat, false);
      const rails = [new THREE.BoxGeometry(long ? r.w : 0.07, 0.06, long ? 0.07 : r.h).translate(r.x + r.w / 2, 1.22, r.y + r.h / 2)];
      for (let k = 0.5; k < len; k += 2) rails.push(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 12).translate(long ? r.x + k : r.x + 0.5, 1.04, long ? r.y + 0.5 : r.y + k));
      add(mergeGeometries(rails), railMat);
      rails.forEach((x) => x.dispose());
    } else if (art.outer === 'glass') {
      add(wallBox(r.x, 0, r.y, r.x + r.w, 0.45, r.y + r.h), wallMat);
      const gl = add(new THREE.BoxGeometry(long ? r.w : 0.08, WALL_H - 0.45, long ? 0.08 : r.h).translate(r.x + r.w / 2, (WALL_H + 0.45) / 2, r.y + r.h / 2), glassMat, false);
      gl.receiveShadow = false;
      gl.renderOrder = 9;
      const frames = [new THREE.BoxGeometry(r.w, 0.14, r.h).translate(r.x + r.w / 2, WALL_H + 0.07, r.y + r.h / 2)];
      for (let k = 0; k <= len; k += 2) frames.push(new THREE.BoxGeometry(0.12, WALL_H - 0.45, 0.12).translate(long ? r.x + Math.min(k, len) : r.x + 0.5, (WALL_H + 0.45) / 2, long ? r.y + 0.5 : r.y + Math.min(k, len)));
      add(mergeGeometries(frames), frameMat);
      frames.forEach((x) => x.dispose());
    } else {
      add(wallBox(r.x, 0, r.y, r.x + r.w, WALL_H, r.y + r.h), wallMat);
      add(new THREE.BoxGeometry(r.w + 0.08, 0.09, r.h + 0.08).translate(r.x + r.w / 2, WALL_H + 0.045, r.y + r.h / 2), capMat, false);
    }
  }
  /** Parent for anything mounted on the wall cell (wx, wy): its outer-wall group, or the room. */
  const wallParent = (wx, wy) => {
    if (!isBorder(wx, wy)) return group;
    if (wy === 0) return sides[0].group;
    if (wy === h - 1) return sides[1].group;
    return wx === 0 ? sides[2].group : sides[3].group;
  };

  // ------------------------------------------------------------ cover props
  const M = {
    walnut: std(0xffffff, { map: miscTexture('wood') }),
    darkwood: std(0x9a8a7a, { map: miscTexture('wood') }),
    crate: std(0xffffff, { map: miscTexture('crate') }),
    ammo: std(0xffffff, { map: miscTexture('ammo') }),
    fabric: std(0x5f78b8, { map: miscTexture('fabric') }),
    white: std(0xcfc6b0),
    leather: std(0xd6ccb4),
    brass: std(0xe0b040),
    metal: std(0xffffff, { map: miscTexture('metal') }),
    darkmetal: std(0x262a3a),
    labwhite: std(0xb4c8cc),
    sandbag: std(0xc9a070, { map: miscTexture('fabric') }),
    marble: std(0xcac2b0),
    darkmarble: std(0x2c1a38),
    velvet: std(0x9a1426),
    glass: std(0x9fc8ff, { transparent: true, opacity: 0.16 }),
    leaf: std(0x2f9a5c),
    screen: glowMat(art.glow, 1.6),
    warm: glowMat(0xffb040, 2),
    accent: std(art.accent),
    holo: new THREE.MeshBasicMaterial({ color: 0x010b0d, transparent: true, opacity: 0.9 }),
    gold: std(0xf0c040),
  };
  // Soft, modern forms: every box is bevelled, every round thing is truly round.
  const unitBox = new RoundedBoxGeometry(1, 1, 1, 3, 0.03);
  const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 28);
  const unitSph = new THREE.SphereGeometry(0.5, 24, 16);
  const unitIco = new THREE.IcosahedronGeometry(0.5, 2);
  disposables.push(unitBox, unitCyl, unitSph, unitIco);
  const part = (parent, geo, mat, sx, sy, sz, x, y, z, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const lineMat = new THREE.LineBasicMaterial({ color: art.glow });
  const edgeGeo = new THREE.EdgesGeometry(unitBox);
  disposables.push(edgeGeo);

  function buildCover(c) {
    const g = new THREE.Group();
    g.position.set(c.x + c.w / 2, 0, c.y + c.h / 2);
    const cw = c.w;
    const ch = c.h;
    const long = cw >= ch; // long axis is X
    const L = Math.max(cw, ch);
    const b = (mat, sx, sy, sz, x, y, z, sh) => part(g, unitBox, mat, sx, sy, sz, x, y, z, sh);
    const along = (i, n) => ((i + 0.5) / n - 0.5) * L; // spread items along the long axis
    const at = (a, cross = 0) => (long ? [a, cross] : [cross, a]);
    switch (c.kind) {
      case 'pedestal': {
        const base = room.themeId === 'vr' ? M.holo : room.themeId === 'museum' ? M.marble : M.darkmetal;
        b(base, 0.74, 0.12, 0.74, 0, 0.06, 0);
        part(g, unitCyl, base, 0.5, 0.7, 0.5, 0, 0.47, 0);
        b(base, 0.66, 0.1, 0.66, 0, 0.87, 0);
        b(M.velvet, 0.5, 0.06, 0.5, 0, 0.95, 0);
        part(g, unitCyl, M.gold, 0.56, 0.02, 0.56, 0, 0.82, 0, false);
        break;
      }
      case 'desk': {
        b(M.darkwood, cw - 0.3, 0.74, ch - 0.3, 0, 0.37, 0);
        b(M.walnut, cw - 0.08, 0.07, ch - 0.08, 0, 0.78, 0);
        for (let i = 0; i < L; i++) {
          const [x, z] = at(along(i, L), 0);
          const mon = new THREE.Group();
          mon.position.set(x, 0, z);
          mon.rotation.y = (long ? 0 : Math.PI / 2) + rng.range(-0.25, 0.25) + (rng.chance(0.5) ? Math.PI : 0);
          g.add(mon);
          part(mon, unitBox, M.darkmetal, 0.52, 0.32, 0.03, 0, 1.03, 0);
          part(mon, unitBox, M.screen, 0.47, 0.27, 0.01, 0, 1.03, 0.02, false);
          part(mon, unitBox, M.darkmetal, 0.05, 0.1, 0.05, 0, 0.85, -0.02);
          part(mon, unitBox, M.darkmetal, 0.3, 0.015, 0.1, 0, 0.823, 0.2, false);
        }
        break;
      }
      case 'cubicle': {
        b(M.fabric, cw - 0.1, 1.02, ch - 0.1, 0, 0.51, 0);
        b(M.darkmetal, cw - 0.06, 0.04, ch - 0.06, 0, 1.04, 0);
        b(M.darkmetal, cw - 0.06, 0.08, ch - 0.06, 0, 0.04, 0);
        const notes = [0xffe66b, 0xff9ac1, 0x8be0ff, 0xb6ff8a];
        for (let i = 0; i < L * 2; i++) {
          const side = rng.chance(0.5) ? 1 : -1;
          const a = rng.range(-L / 2 + 0.2, L / 2 - 0.2);
          const cross = side * ((long ? ch : cw) / 2 - 0.045);
          const [x, z] = at(a, cross);
          const n = b(std(rng.pick(notes), { roughness: 1 }), long ? 0.13 : 0.01, 0.13, long ? 0.01 : 0.13, x, rng.range(0.55, 0.9), z, false);
          n.rotation[long ? 'z' : 'x'] = rng.range(-0.15, 0.15);
        }
        break;
      }
      case 'planter': {
        b(room.themeId === 'yacht' ? M.white : M.darkwood, cw - 0.12, 0.5, ch - 0.12, 0, 0.25, 0);
        b(std(0x3a2a1c, { roughness: 1 }), cw - 0.2, 0.04, ch - 0.2, 0, 0.5, 0, false);
        for (let i = 0; i < L * 2; i++) {
          const [x, z] = at(along(i, L * 2), rng.range(-0.1, 0.1));
          const s = rng.range(0.42, 0.62);
          const bush = part(g, unitIco, M.leaf, s, s * rng.range(0.8, 1.1), s, x, 0.5 + s * 0.42, z);
          bush.rotation.set(rng.range(0, 3), rng.range(0, 3), 0);
        }
        break;
      }
      case 'lounge': {
        b(M.walnut, cw - 0.1, 0.14, ch - 0.1, 0, 0.07, 0);
        b(M.leather, cw - 0.14, 0.3, ch - 0.14, 0, 0.29, 0);
        const cross = (long ? ch : cw) / 2 - 0.17;
        if (Math.min(cw, ch) === 1) {
          const [x, z] = at(0, -cross);
          b(M.leather, long ? cw - 0.14 : 0.24, 0.56, long ? 0.24 : ch - 0.14, x, 0.7, z);
        } else {
          b(M.leather, long ? cw - 0.5 : 0.3, 0.52, long ? 0.3 : ch - 0.5, 0, 0.7, 0);
        }
        for (const e of [-1, 1]) {
          const [x, z] = at(e * (L / 2 - 0.16), 0);
          b(M.leather, long ? 0.2 : cw - 0.14, 0.3, long ? ch - 0.14 : 0.2, x, 0.58, z);
        }
        for (let i = 0; i < L; i++) {
          const [x, z] = at(along(i, L) + rng.range(-0.1, 0.1), cross * 0.2);
          const p = b(M.accent, 0.34, 0.1, 0.34, x, 0.49, z);
          p.rotation.y = rng.range(0, 1.5);
        }
        break;
      }
      case 'bar': {
        b(M.walnut, cw - 0.12, 0.96, ch - 0.12, 0, 0.48, 0);
        b(M.brass, cw - 0.04, 0.05, ch - 0.04, 0, 0.985, 0);
        const cols = [0x3fb24f, 0xd9432f, 0xffd12e, 0x7fd4ff, 0xf4f1ea];
        for (let i = 0; i < L * 2; i++) {
          const [x, z] = at(along(i, L * 2) + rng.range(-0.1, 0.1), rng.range(-0.2, 0.2));
          const col = rng.pick(cols);
          const m = std(col, { transparent: true, opacity: 0.8, roughness: 0.08 });
          part(g, unitCyl, m, 0.09, 0.2, 0.09, x, 1.11, z);
          part(g, unitCyl, m, 0.035, 0.1, 0.035, x, 1.26, z, false);
        }
        break;
      }
      case 'crate': {
        const mat = room.themeId === 'bunker' ? (rng.chance(0.6) ? M.ammo : M.crate) : M.crate;
        for (let yy = 0; yy < ch; yy++)
          for (let xx = 0; xx < cw; xx++) {
            const s = rng.range(0.84, 0.94);
            const k = b(rng.chance(0.2) && room.themeId === 'lab' ? M.metal : mat, s, rng.range(0.9, 1.02), s, xx - cw / 2 + 0.5, 0, yy - ch / 2 + 0.5);
            k.position.y = k.scale.y / 2;
            k.rotation.y = rng.range(-0.09, 0.09);
          }
        break;
      }
      case 'sandbag': {
        for (let layer = 0; layer < 4; layer++) {
          const n = L * 2 - (layer % 2);
          for (let i = 0; i < n; i++) {
            for (const cr of Math.min(cw, ch) > 1 ? [-0.5, 0, 0.5] : [-0.14, 0.14]) {
              const [x, z] = at(((i + 0.5) / n - 0.5) * (L - 0.1), cr * (Math.min(cw, ch) > 1 ? 1.2 : 1));
              const s = part(g, unitSph, M.sandbag, long ? 0.56 : 0.36, 0.3, long ? 0.36 : 0.56, x, 0.13 + layer * 0.235, z);
              s.rotation.y = rng.range(-0.15, 0.15);
            }
          }
        }
        break;
      }
      case 'console': {
        b(M.labwhite, cw - 0.12, 0.72, ch - 0.12, 0, 0.36, 0);
        b(M.darkmetal, cw - 0.08, 0.08, ch - 0.08, 0, 0.04, 0);
        for (let i = 0; i < L; i++) {
          const [x, z] = at(along(i, L), 0);
          const tilt = new THREE.Group();
          tilt.position.set(x, 0.76, z);
          tilt.rotation.y = long ? 0 : Math.PI / 2;
          g.add(tilt);
          const p = part(tilt, unitBox, M.darkmetal, 0.86, 0.06, 0.7, 0, 0.1, 0);
          p.rotation.x = 0.35;
          const s = part(tilt, unitBox, M.screen, 0.6, 0.02, 0.36, 0, 0.14, -0.04, false);
          s.rotation.x = 0.35;
          for (let k = 0; k < 4; k++) {
            const bt = part(tilt, unitSph, glowMat(rng.pick([0xff4a3a, 0x33ff88, 0xffd12e, 0x4fd8ff]), 2.2), 0.06, 0.04, 0.06, -0.27 + k * 0.18, 0.03, 0.27, false);
            bt.rotation.x = 0.35;
          }
        }
        break;
      }
      case 'bench': {
        if (room.themeId === 'museum') {
          b(M.darkmarble, cw - 0.2, 0.42, ch - 0.2, 0, 0.21, 0);
          b(M.velvet, cw - 0.1, 0.14, ch - 0.1, 0, 0.49, 0);
          b(M.gold, cw - 0.08, 0.03, ch - 0.08, 0, 0.415, 0, false);
        } else {
          b(room.themeId === 'lab' ? M.labwhite : M.darkwood, cw - 0.14, 0.82, ch - 0.14, 0, 0.41, 0);
          b(room.themeId === 'lab' ? M.metal : M.walnut, cw - 0.06, 0.06, ch - 0.06, 0, 0.85, 0);
          for (let i = 0; i < L * 2; i++) {
            const [x, z] = at(along(i, L * 2) + rng.range(-0.1, 0.1), rng.range(-0.2, 0.2));
            if (room.themeId === 'lab') {
              const col = rng.pick([0x48ffd0, 0xff6fd8, 0xffd12e, 0x4fd8ff]);
              part(g, unitCyl, matOf({ color: col, emissive: col, emissiveIntensity: 1.1, transparent: true, opacity: 0.8, roughness: 0.1 }), 0.11, rng.range(0.12, 0.26), 0.11, x, 0.97, z, false);
            } else {
              part(g, unitBox, rng.chance(0.5) ? M.ammo : M.darkmetal, 0.3, 0.18, 0.22, x, 0.97, z).rotation.y = rng.range(0, 3);
            }
          }
        }
        break;
      }
      case 'vitrine': {
        b(M.darkmarble, cw - 0.1, 0.5, ch - 0.1, 0, 0.25, 0);
        b(M.gold, cw - 0.06, 0.03, ch - 0.06, 0, 0.515, 0, false);
        const gl = b(M.glass, cw - 0.16, 0.55, ch - 0.16, 0, 0.8, 0, false);
        gl.renderOrder = 4;
        for (let i = 0; i < L; i++) {
          const [x, z] = at(along(i, L), 0);
          const kind = rng.int(0, 2);
          const m = rng.pick([M.gold, M.marble, std(0x4fd8ff, { roughness: 0.1, metalness: 0.4 })]);
          if (kind === 0) part(g, unitSph, m, 0.26, 0.34, 0.26, x, 0.72, z);
          else if (kind === 1) part(g, unitIco, m, 0.3, 0.3, 0.3, x, 0.72, z);
          else part(g, unitCyl, m, 0.16, 0.36, 0.16, x, 0.72, z);
        }
        break;
      }
      case 'plinth': {
        for (let yy = 0; yy < ch; yy++)
          for (let xx = 0; xx < cw; xx++) {
            const x = xx - cw / 2 + 0.5;
            const z = yy - ch / 2 + 0.5;
            b(M.marble, 0.8, 0.1, 0.8, x, 0.05, z);
            b(M.marble, 0.64, 0.8, 0.64, x, 0.5, z);
            b(M.marble, 0.76, 0.08, 0.76, x, 0.94, z);
            // a very serious marble bust
            part(g, unitSph, M.marble, 0.5, 0.26, 0.3, x, 1.06, z);
            part(g, unitCyl, M.marble, 0.14, 0.14, 0.14, x, 1.2, z);
            part(g, unitSph, M.marble, 0.28, 0.33, 0.3, x, 1.4, z);
          }
        break;
      }
      default: {
        // VR monolith
        const m = b(M.holo, cw - 0.1, 1.02, ch - 0.1, 0, 0.51, 0);
        const e = new THREE.LineSegments(edgeGeo, lineMat);
        m.add(e);
        b(glowMat(art.glow, 0.35), cw - 0.5, 0.02, ch - 0.5, 0, 1.035, 0, false);
      }
    }
    group.add(g);
  }
  for (const c of room.covers) buildCover(c);

  // ------------------------------------------------------------ wall decor
  const gadgetCells = new Set();
  for (const v of room.vents) for (const e of [v.a, v.b]) gadgetCells.add(`${e.cx},${e.cy}`);
  for (const s of room.switches) gadgetCells.add(`${s.cx},${s.cy}`);
  const paintings = (i) =>
    paintedTexture(`${room.themeId}:${i}`, (g, s, r) => {
      const hue = r.int(0, 360);
      const gr = g.createLinearGradient(0, 0, s, s);
      gr.addColorStop(0, `hsl(${hue},50%,30%)`);
      gr.addColorStop(1, `hsl(${(hue + 70) % 360},60%,10%)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
      for (let k = 0; k < 7; k++) {
        g.fillStyle = r.chance(0.25) ? '#050505' : `hsl(${(hue + r.int(100, 260)) % 360},65%,${r.int(30, 60)}%)`;
        g.beginPath();
        if (r.chance(0.5)) g.arc(r.range(0, s), r.range(0, s), r.range(3, 14), 0, 7);
        else g.rect(Math.round(r.range(0, s)), Math.round(r.range(0, s)), Math.round(r.range(5, 24)), Math.round(r.range(2, 20)));
        g.fill();
      }
    });
  const lampSpots = [];
  for (const c of room.chambers) {
    lampSpots.push({ x: c.x + c.w / 2, z: c.y + c.h / 2 });
    for (let y = c.y; y < c.y + c.h; y++)
      for (let x = c.x; x < c.x + c.w; x++) {
        const edge = x === c.x || y === c.y || x === c.x + c.w - 1 || y === c.y + c.h - 1;
        if (!edge || gadgetCells.has(`${x},${y}`) || !rng.chance(0.15)) continue;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const wx = x + dx;
          const wy = y + dy;
          if (cellAt(room, wx, wy) !== WALL) continue;
          if (!solidOuter && isBorder(wx, wy)) continue;
          const d = new THREE.Group();
          d.position.set(x + 0.5 + dx * 0.5, 0, y + 0.5 + dy * 0.5);
          d.rotation.y = Math.atan2(-dx, -dy); // local +Z points into the room
          wallParent(wx, wy).add(d);
          const p = (geo, mat, sx, sy, sz, px, py, pz, sh = false) => part(d, geo, mat, sx, sy, sz, px, py, pz, sh);
          const t = room.themeId;
          const roll = rng.next();
          if (t === 'museum' && roll > 0.72) {
            // a hanging tapestry: deep colour, gold bands, a tasselled hem
            const col = rng.pick([0x9a1426, 0x4a2a7a, 0x1f5a4a]);
            p(unitBox, M.gold, 0.74, 0.06, 0.06, 0, 2.02, 0.05);
            p(unitBox, std(col), 0.66, 1.45, 0.03, 0, 1.28, 0.045);
            p(unitBox, M.gold, 0.66, 0.05, 0.035, 0, 1.75, 0.05);
            p(unitBox, M.gold, 0.66, 0.05, 0.035, 0, 0.72, 0.05);
            p(unitSph, M.gold, 0.2, 0.2, 0.04, 0, 1.25, 0.065);
          } else if (t === 'museum' || (t === 'office' && roll < 0.5)) {
            const pw = rng.range(0.5, 0.85);
            const phh = rng.range(0.5, 0.85);
            p(unitBox, t === 'museum' ? M.gold : M.darkmetal, pw + 0.12, phh + 0.12, 0.05, 0, 1.55, 0.03);
            p(unitBox, std(0xffffff, { map: paintings(rng.int(0, 7)), roughness: 0.6 }), pw, phh, 0.02, 0, 1.55, 0.055);
            if (t === 'museum') p(unitBox, M.warm, 0.3, 0.03, 0.06, 0, 1.55 + phh / 2 + 0.16, 0.08);
          } else if (t === 'office') {
            p(unitBox, M.darkmetal, 0.7, 1.9, 0.2, 0, 0.95, 0.1, true);
            for (let k = 0; k < 6; k++) p(unitBox, glowMat(rng.pick([0x33ff88, 0x7fd4ff, 0xffb347]), 2), 0.5, 0.02, 0.01, 0, 0.35 + k * 0.28, 0.205);
          } else if (t === 'lab') {
            if (roll < 0.6) {
              p(unitCyl, M.darkmetal, 0.62, 0.16, 0.44, 0, 0.08, 0.02, true);
              p(unitCyl, M.darkmetal, 0.62, 0.14, 0.44, 0, 2.05, 0.02, true);
              const col = rng.pick([0x48ffd0, 0x7dff5a, 0xff6fd8]);
              const liquid = p(unitCyl, matOf({ color: col, emissive: col, emissiveIntensity: 0.9, transparent: true, opacity: 0.55, roughness: 0.05 }), 0.54, 1.84, 0.38, 0, 1.07, 0.02);
              const blob = p(unitSph, glowMat(col, 2.4), 0.2, 0.36, 0.16, 0, 1.0, 0.02);
              const ph = rng.range(0, 6);
              animated.push((tt) => {
                blob.position.y = 1.05 + Math.sin(tt * 0.9 + ph) * 0.22;
                liquid.material.emissiveIntensity = 0.8 + Math.sin(tt * 2 + ph) * 0.2;
              });
            } else {
              p(unitBox, M.darkmetal, 0.8, 0.5, 0.05, 0, 1.6, 0.03);
              p(unitBox, M.screen, 0.72, 0.42, 0.02, 0, 1.6, 0.055);
            }
          } else if (t === 'bunker') {
            if (roll < 0.4) {
              p(unitBox, M.darkwood, 0.9, 0.6, 0.04, 0, 1.55, 0.03);
              p(unitBox, std(0xe6d6a8, { map: paintings(rng.int(0, 3)), roughness: 1 }), 0.8, 0.5, 0.02, 0, 1.55, 0.05);
            } else if (roll < 0.75) {
              p(unitBox, M.darkmetal, 0.12, 0.2, 0.12, 0, 1.9, 0.1);
              p(unitSph, M.warm, 0.14, 0.18, 0.14, 0, 1.76, 0.1);
            } else {
              const pipe = p(unitCyl, M.metal, 0.09, 1, 0.09, 0, 2.1, 0.08, true);
              pipe.rotation.z = Math.PI / 2;
              p(unitCyl, M.accent, 0.13, 0.06, 0.13, 0.2, 2.1, 0.08).rotation.z = Math.PI / 2;
            }
          } else if (t === 'yacht') {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.045, 12, 32), roll < 0.5 ? M.brass : std(0xe8452f, { roughness: 0.5 }));
            ring.position.set(0, 1.5, 0.04);
            d.add(ring);
            disposables.push(ring.geometry);
            if (roll < 0.5) p(unitCyl, glowMat(0x7fd4ff, 0.9), 0.5, 0.02, 0.5, 0, 1.5, 0.03).rotation.x = Math.PI / 2;
          } else {
            const pl = p(unitBox, additive(art.glow, 0.25), 0.7, 0.9, 0.01, 0, 1.4, 0.12);
            const e = new THREE.LineSegments(edgeGeo, lineMat);
            pl.add(e);
            const ph = rng.range(0, 6);
            animated.push((tt) => (pl.position.y = 1.4 + Math.sin(tt * 1.2 + ph) * 0.06));
          }
          break;
        }
      }
  }

  // ------------------------------------------------------------ lights
  const hemi = new THREE.HemisphereLight(art.hemi[0], art.hemi[1], art.hemi[2]);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(art.sun[0], art.sun[1]);
  const sd = new THREE.Vector3(...art.sun[2]).normalize();
  sun.position.set(w / 2 + sd.x * 40, sd.y * 40, h / 2 + sd.z * 40);
  sun.target.position.set(w / 2, 0, h / 2);
  sun.castShadow = true;
  const sh = sun.shadow;
  sh.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  const ext = Math.hypot(w, h) / 2 + 2;
  Object.assign(sh.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 5, far: 90 });
  sh.bias = -0.0006;
  sh.normalBias = 0.03;
  sh.radius = 3;
  group.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(art.rim[0], art.rim[1]);
  rim.position.set(w / 2 - sd.x * 30, 14, h / 2 - sd.z * 30);
  rim.target.position.set(w / 2, 0, h / 2);
  group.add(rim, rim.target);
  // One hard practical per chamber: a stepped pool of light in the dark.
  lampSpots.forEach((s, i) => {
    if (i < (lowPower ? 4 : 9)) {
      const l = new THREE.PointLight(art.lamp[0], art.lamp[1], 9.5, 1.5);
      l.position.set(s.x, 3.0, s.z);
      group.add(l);
    }
    // a soft pool on the floor and a faint volumetric shaft above it
    const pool = decal(art.lamp[0], 7, s.x, s.z, 0.2);
    const lean = room.themeId === 'bunker' ? 0.3 : room.themeId === 'yacht' ? 0.12 : 0;
    const sf = shaft(art.lamp[0], s.x + lean * 3, s.z, 2.3, 7, 0.06);
    sf.rotation.z = lean;
    const ph = rng.range(0, 6);
    const dying = room.themeId === 'lab' && i % 4 === 1;
    animated.push((t) => {
      // shafts drift and breathe, never strobe
      const k = 0.8 + 0.2 * Math.sin(t * 0.45 + ph);
      sf.material.opacity = 0.06 * k;
      sf.rotation.z = lean + Math.sin(t * 0.21 + ph) * 0.025;
      pool.material.opacity = (dying && Math.sin(t * 23 + i) > 0.9 ? 0.06 : 0.2) * (0.9 + 0.1 * k);
    });
  });

  // Storm rain: short hard streaks.
  if (art.rain && !lowPower) {
    const n = 260;
    const pos = new Float32Array(n * 6);
    const seeds = [];
    for (let i = 0; i < n; i++) seeds.push([rng.range(-4, w + 4), rng.range(0, 9), rng.range(-4, h + 4), rng.range(9, 14)]);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x8fa8d8, transparent: true, opacity: 0.35 }));
    rain.frustumCulled = false;
    group.add(rain);
    disposables.push(rg);
    animated.push((t) => {
      for (let i = 0; i < n; i++) {
        const [x, y0, z, v] = seeds[i];
        const y = 9 - ((y0 + t * v) % 9);
        pos.set([x + y * 0.12, y, z, x + (y + 0.45) * 0.12, y + 0.45, z], i * 6);
      }
      rg.attributes.position.needsUpdate = true;
    });
  }

  // ------------------------------------------------------------ loot
  const loot = new THREE.Group();
  loot.position.set(room.loot.x, 1.0, room.loot.z);
  const prop = buildLootProp(room.loot.info || lootPropOf(room));
  inkAll(prop, 0.005);
  prop.scale.setScalar(1.25);
  loot.add(prop);
  group.add(loot);
  const lootBeam = shaft(0xffd27a, room.loot.x, room.loot.z, 0.34, 5.5, 0.07);
  lootBeam.position.y = 1.55 + 2.75; // starts above the prop so the prize itself stays readable
  const lootGlow = decal(0xffd27a, 3.0, room.loot.x, room.loot.z, 0.3, 0.023, poolTex);
  const lootLight = new THREE.PointLight(0xfff0d8, 3.2, 6, 1.6);
  lootLight.position.set(room.loot.x, 2.2, room.loot.z);
  group.add(lootLight);
  animated.push((t) => {
    prop.rotation.y = t * 0.9;
    prop.position.y = 0.08 + Math.sin(t * 2) * 0.04;
    lootBeam.material.opacity = 0.06 + Math.sin(t * 3) * 0.025;
  });

  // museum: velvet rope stanchions round the prize
  if (room.themeId === 'museum') {
    const posts = [
      [-0.46, -0.46],
      [0.46, -0.46],
      [0.46, 0.46],
      [-0.46, 0.46],
    ];
    posts.forEach(([px, pz], i) => {
      part(group, unitCyl, M.gold, 0.05, 0.82, 0.05, room.loot.x + px, 0.41, room.loot.z + pz);
      part(group, unitSph, M.gold, 0.1, 0.1, 0.1, room.loot.x + px, 0.86, room.loot.z + pz, false);
      const [qx, qz] = posts[(i + 1) % 4];
      const horiz = px !== qx;
      part(group, unitBox, M.velvet, horiz ? 0.92 : 0.035, 0.035, horiz ? 0.035 : 0.92, room.loot.x + (px + qx) / 2, 0.72, room.loot.z + (pz + qz) / 2, false);
    });
  }

  // moonlight through tall windows, thrown across the floor as window panes
  if (room.themeId === 'museum' || room.themeId === 'office') {
    const panes = paintedTexture('skylight', (g, sz) => {
      g.clearRect(0, 0, sz, sz);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 2; xx++) g.fillRect(xx * (sz / 2) + 5, yy * (sz / 3) + 5, sz / 2 - 10, sz / 3 - 10);
    }, 128);
    for (const c of room.chambers) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.2), additive(room.themeId === 'museum' ? 0xb8c0ff : 0x9fd8ff, 0.07, panes));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = 0.5;
      m.scale.x = 1.5; // sheared like a low moon
      m.position.set(c.x + c.w * rng.range(0.3, 0.7), 0.024, c.y + c.h * rng.range(0.3, 0.7));
      m.renderOrder = 2;
      group.add(m);
      const ph = rng.range(0, 6);
      animated.push((t) => (m.material.opacity = 0.065 + 0.02 * Math.sin(t * 0.5 + ph)));
    }
  }

  // ------------------------------------------------------------ extraction pad
  const pad = new THREE.Group();
  pad.position.set(room.exit.x, 0, room.exit.z);
  group.add(pad);
  const padRingM = new THREE.MeshBasicMaterial({ color: 0x5a6a78 });
  const padRing = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 32), padRingM);
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.y = 0.025;
  const padDiscM = matOf({ color: 0x20262e, roughness: 0.5, metalness: 0.5 });
  const padDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.03, 32), padDiscM);
  padDisc.position.y = 0.012;
  padDisc.receiveShadow = true;
  const padArrows = [];
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Mesh(new THREE.RingGeometry(0.1 + i * 0.07, 0.13 + i * 0.07, 24), new THREE.MeshBasicMaterial({ color: 0x5a6a78, transparent: true }));
    a.rotation.x = -Math.PI / 2;
    a.position.y = 0.03;
    pad.add(a);
    padArrows.push(a);
  }
  pad.add(padRing, padDisc);
  const padBeam = shaft(0x5aff9a, room.exit.x, room.exit.z, 0.46, 4.5, 0.3);
  const padGlow = decal(0x5aff9a, 3.2, room.exit.x, room.exit.z, 0.5);
  padBeam.visible = padGlow.visible = false;
  let exitActive = false;
  animated.push((t) => {
    if (!exitActive) return;
    padBeam.material.opacity = 0.24 + Math.sin(t * 4) * 0.08;
    padArrows.forEach((a, i) => (a.material.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * 5 - i * 1.1))));
  });

  // ------------------------------------------------------------ vents
  const ductM = std(0xffffff, { map: miscTexture('metal') });
  const DUCT_Y = WALL_H + 0.36;
  const DUCT_W = 0.36;
  const DUCT_H = 0.26;
  const ducts = [];
  room.vents.forEach((v, vi) => {
    const col = VENT_COLORS[vi % VENT_COLORS.length];
    const gm = glowMat(col, 1.8);
    const stripM = glowMat(col, 0.7);
    [v.a, v.b].forEach((e) => {
      const g = new THREE.Group();
      g.position.set(e.cx + 0.5 + e.dx * 0.5, 0, e.cy + 0.5 + e.dy * 0.5);
      g.rotation.y = Math.atan2(-e.dx, -e.dy);
      wallParent(e.cx + e.dx, e.cy + e.dy).add(g);
      part(g, unitBox, M.darkmetal, 0.86, 0.62, 0.07, 0, 0.36, 0.02);
      part(g, unitBox, std(0x050608), 0.72, 0.48, 0.02, 0, 0.36, 0.06, false);
      for (let k = 0; k < 4; k++) part(g, unitBox, M.metal, 0.72, 0.03, 0.03, 0, 0.19 + k * 0.115, 0.075, false);
      part(g, unitBox, gm, 0.9, 0.035, 0.04, 0, 0.69, 0.05, false);
      part(g, unitBox, gm, 0.035, 0.66, 0.04, 0.45, 0.36, 0.05, false);
      part(g, unitBox, gm, 0.035, 0.66, 0.04, -0.45, 0.36, 0.05, false);
      const low = !solidOuter && isBorder(e.cx + e.dx, e.cy + e.dy);
      if (!low) {
        // a stub of ducting climbing the wall above the grate
        // the riser: ducting climbing the wall from the grate up to the overhead run
        part(g, unitBox, ductM, 0.36, WALL_H + 0.36 - 0.72, 0.14, 0, 0.72 + (WALL_H + 0.36 - 0.72) / 2, 0.02);
        part(g, unitBox, stripM, 0.05, WALL_H + 0.36 - 0.72, 0.02, 0, 0.72 + (WALL_H + 0.36 - 0.72) / 2, 0.095, false);
      }
      const pool = decal(col, 1.9, e.cx + 0.5, e.cy + 0.5, 0.5);
      animated.push((t) => (pool.material.opacity = 0.4 + Math.sin(t * 2.5 + vi) * 0.12));
    });

    // The duct itself: brushed steel, ribbed, flanged at every joint, with the
    // vent's colour running along the top. It follows ductPath(), the same
    // route the crawl takes. Each run fades out whenever it would come between
    // the camera and the agent, so it never hides the action.
    const steel = std(0xc8d0d8, { map: miscTexture('metal'), transparent: true });
    const flange = std(0x8a929c, { transparent: true });
    const stripe = glowMat(col, 1.1);
    stripe.transparent = true;
    const mats = [steel, flange, stripe];
    const pts = ductPath(room, v).points;
    const runs = [];
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      if (len < 0.05) continue;
      const alongX = Math.abs(p1.x - p0.x) > Math.abs(p1.z - p0.z);
      const cx = (p0.x + p1.x) / 2;
      const cz = (p0.z + p1.z) / 2;
      const box = (mat, l, hgt, wid, along, y) => part(group, unitBox, mat, alongX ? l : wid, hgt, alongX ? wid : l, alongX ? cx + along : cx, y, alongX ? cz : cz + along, false);
      box(steel, len + DUCT_W, DUCT_H, DUCT_W, 0, DUCT_Y);
      box(stripe, len + DUCT_W, 0.02, 0.07, 0, DUCT_Y + DUCT_H / 2 + 0.008);
      for (let d = -len / 2 + 0.35; d < len / 2 - 0.2; d += 0.7) box(flange, 0.05, DUCT_H + 0.035, DUCT_W + 0.035, d, DUCT_Y); // ribs
      runs.push({ x0: Math.min(p0.x, p1.x) - DUCT_W, x1: Math.max(p0.x, p1.x) + DUCT_W, z0: Math.min(p0.z, p1.z) - DUCT_W, z1: Math.max(p0.z, p1.z) + DUCT_W });
    }
    // riveted flange collars at both ends and at the elbow
    for (const q of pts) {
      part(group, unitBox, flange, DUCT_W + 0.14, DUCT_H + 0.12, DUCT_W + 0.14, q.x, DUCT_Y, q.z, false);
      for (const [rx, rz] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ])
        part(group, unitSph, steel, 0.045, 0.045, 0.045, q.x + rx * (DUCT_W / 2 + 0.035), DUCT_Y + DUCT_H / 2 + 0.06, q.z + rz * (DUCT_W / 2 + 0.035), false);
    }
    ducts.push({ mats, runs, fade: 1 });
  });

  // the glowing pulse that shows the agent crawling through a duct
  const pulse = new THREE.Group();
  pulse.visible = false;
  {
    const core = new THREE.Mesh(unitSph, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    core.scale.setScalar(0.22);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(1.7);
    pulse.add(core, halo);
    pulse.renderOrder = 30;
    group.add(pulse);
  }

  // ------------------------------------------------------------ arched doorways
  {
    const archGeo = new THREE.TorusGeometry(1, 0.085, 10, 28, Math.PI);
    disposables.push(archGeo);
    const archMat = std(art.cap);
    for (const d of room.doors) {
      const a = d.cells[0];
      const b = d.cells[1];
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.position.set((a.cx + b.cx) / 2 + 0.5, WALL_H - 1.0, (a.cy + b.cy) / 2 + 0.5);
      arch.rotation.y = d.vertical ? Math.PI / 2 : 0;
      arch.castShadow = true;
      group.add(arch);
    }
  }

  // ------------------------------------------------------------ lasers + switches
  const beamM = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.35, 0.3), toneMapped: false });
  const laserGroups = room.lasers.map((l) => {
    const g = new THREE.Group();
    group.add(g);
    const len = Math.hypot(l.x1 - l.x0, l.z1 - l.z0);
    const cx = (l.x0 + l.x1) / 2;
    const cz = (l.z0 + l.z1) / 2;
    for (const yb of [0.22, 0.55, 0.88, 1.21, 1.54]) {
      const bm = part(g, unitCyl, beamM, 0.035, len, 0.035, cx, yb, cz, false);
      bm.rotation[l.vertical ? 'x' : 'z'] = Math.PI / 2;
    }
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.6), additive(0xff3a2a, 0.12));
    sheet.position.set(cx, 0.9, cz);
    sheet.rotation.y = l.vertical ? Math.PI / 2 : 0;
    g.add(sheet);
    const gl = decal(0xff3a2a, 2.6, cx, cz, 0.4);
    g.add(gl);
    for (const [px, pz] of [
      [l.x0, l.z0],
      [l.x1, l.z1],
    ]) {
      const post = part(group, unitBox, M.darkmetal, 0.14, 1.75, 0.14, px, 0.875, pz);
      post.position.x += l.vertical ? 0 : px === l.x0 ? 0.07 : -0.07;
      post.position.z += l.vertical ? (pz === l.z0 ? 0.07 : -0.07) : 0;
    }
    animated.push((t) => (sheet.material.opacity = 0.09 + Math.sin(t * 9) * 0.03));
    return g;
  });
  const switchMeshes = room.switches.map((s) => {
    const g = new THREE.Group();
    g.position.set(s.cx + 0.5 + s.dx * 0.5, 0, s.cy + 0.5 + s.dy * 0.5);
    g.rotation.y = Math.atan2(-s.dx, -s.dy);
    wallParent(s.cx + s.dx, s.cy + s.dy).add(g);
    part(g, unitBox, M.darkmetal, 0.5, 0.66, 0.1, 0, 1.2, 0.05);
    const screenM = glowMat(0xff3a2a, 2.4);
    part(g, unitBox, screenM, 0.38, 0.26, 0.02, 0, 1.32, 0.105, false);
    const lever = part(g, unitBox, M.metal, 0.07, 0.2, 0.07, 0, 1.05, 0.13);
    part(g, unitBox, M.darkmetal, 0.08, 1.0, 0.04, 0, 0.5, 0.02);
    const pool = decal(0xff3a2a, 1.8, s.cx + 0.5, s.cy + 0.5, 0.45);
    return { screenM, lever, pool };
  });

  // ------------------------------------------------------------ dust motes
  const moteCount = lowPower ? 120 : 280;
  const motePos = new Float32Array(moteCount * 3);
  const moteSeed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = rng.range(0, w);
    motePos[i * 3 + 1] = rng.range(0.2, 3.6);
    motePos[i * 3 + 2] = rng.range(0, h);
    moteSeed[i] = rng.range(0, 100);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({ color: art.motes, size: 0.07, map: glowTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }),
  );
  group.add(motes);
  disposables.push(moteGeo);

  return {
    group,
    art,
    /** focus: the agent's position {x, z}; ducts between it and the camera fade away. */
    update(t, dt, camPos, focus = null) {
      for (const f of animated) f(t, dt);
      for (const d of ducts) {
        let blocking = false;
        if (camPos && focus && camPos.y > DUCT_Y + 0.5) {
          // where the sight line from the agent to the camera crosses duct height
          for (const yy of [0.2, 1.0, 1.8]) {
            const k = (DUCT_Y - yy) / (camPos.y - yy);
            const sx = focus.x + (camPos.x - focus.x) * k;
            const sz = focus.z + (camPos.z - focus.z) * k;
            for (const r of d.runs) if (sx > r.x0 - 0.35 && sx < r.x1 + 0.35 && sz > r.z0 - 0.35 && sz < r.z1 + 0.35) blocking = true;
          }
        }
        d.fade += ((blocking ? 0.14 : 1) - d.fade) * (1 - Math.exp(-12 * dt));
        for (const m of d.mats) m.opacity = d.fade;
      }
      for (const side of sides) {
        if (side.low) continue;
        const want = camPos && side.hidden(camPos) ? -(WALL_H - 0.4) : 0;
        side.sink += (want - side.sink) * (1 - Math.exp(-10 * dt));
        side.group.position.y = side.sink;
      }
      for (let i = 0; i < moteCount; i++) {
        const s = moteSeed[i];
        motePos[i * 3] += Math.sin(t * 0.3 + s) * 0.0025;
        motePos[i * 3 + 2] += Math.cos(t * 0.23 + s * 1.7) * 0.0025;
        let y = motePos[i * 3 + 1] + dt * (0.03 + (s % 7) * 0.006);
        if (y > 3.8) y = 0.2;
        motePos[i * 3 + 1] = y;
      }
      moteGeo.attributes.position.needsUpdate = true;
    },
    /** `keep`: the mission left the object in place (photographed, scanned, swapped...). */
    setLootTaken(taken, keep = false) {
      loot.visible = !taken || keep;
      lootBeam.visible = lootGlow.visible = lootLight.visible = !taken;
    },
    /** Show the crawl pulse inside the ductwork at (x, z), or hide it with null. */
    setVentPulse(pos, color = 0xffffff) {
      pulse.visible = !!pos;
      if (!pos) return;
      pulse.position.set(pos.x, DUCT_Y, pos.z);
      pulse.children[0].material.color.setHex(color);
      pulse.children[1].material.color.setHex(color);
    },
    setExitActive(on) {
      exitActive = on;
      padBeam.visible = padGlow.visible = on;
      const c = on ? 0x5aff9a : 0x5a6a78;
      padRingM.color.setHex(c);
      padArrows.forEach((a) => {
        a.material.color.setHex(c);
        a.material.opacity = 1;
      });
      padDiscM.emissive.setHex(on ? 0x0f5a30 : 0);
    },
    setLaser(i, on) {
      if (!laserGroups[i]) return;
      laserGroups[i].visible = on;
      const s = switchMeshes[room.switches.findIndex((sw) => sw.laser === i)];
      if (!s) return;
      const c = on ? 0xff3a2a : 0x33ff88;
      s.screenM.emissive.setHex(c);
      s.pool.material.color.setHex(c);
      s.lever.position.y = on ? 1.05 : 0.95;
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry && !disposables.includes(o.geometry)) o.geometry.dispose();
        if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      });
      disposables.forEach((d) => d.dispose());
    },
  };
}

function lootPropOf(room) {
  return (LOOT_BY_ID[room.loot.item] || {}).prop || 'duck';
}
