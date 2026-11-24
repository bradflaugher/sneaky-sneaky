// Procedural heist rooms.
//
// Layout: rectangular chambers separated by 1-cell walls, joined by 2-cell
// doorways (a spanning tree plus the odd extra), dressed with waist-high cover,
// crawl vents, laser doors with wall switches, a loot pedestal and an
// extraction pad. Guards get loop / ping-pong / lookout patrols.
//
// How the chambers are carved is the room's architectural style
// (`room.layoutStyle`, rolled from the seed):
//
//   classic   a BSP split of the whole footprint
//   atrium    a generous central grand hall ringed by perimeter chambers
//   wing      an L-shaped or stepped footprint: one or two outer corners are
//             solid mass (`room.voids`), so the plan is not a plain rectangle
//   corridor  a central spine corridor with flanking chambers, every one
//             opening onto it, and HVAC ducts crossing over the corridor
//
// A style that cannot fit its footprint falls back to classic.
//
// Every room returned has been through both verifiers in solver.js, so it is
// guaranteed beatable as a perfect ghost: no knockouts, no distractions.

import { RNG, hashSeed } from './rng.js';
import { FLOOR, WALL, COVER, cellAt, isFloor, DIRS4 } from './grid.js';
import { buildTimeline, poseAt } from './patrol.js';
import { canSee } from './stealth.js';
import { solveTopology, solveStealth, SOLVER_PAD_RANGE, SOLVER_PAD_ANGLE } from './solver.js';
import { THEMES, THEME_IDS, venueName } from './themes.js';
import { generateLoot } from './loot.js';

const MIN_CHAMBER = 5;
const COVER_SHAPES = [
  [1, 2],
  [2, 1],
  [1, 3],
  [3, 1],
  [2, 2],
  [1, 4],
  [4, 1],
  [2, 3],
  [3, 2],
];

export const MAX_SIZE_TIER = 20;

/** Architectural layout styles, and how often each is rolled. */
export const LAYOUT_STYLES = ['classic', 'atrium', 'wing', 'corridor'];
const LAYOUT_WEIGHTS = { classic: 3, atrium: 2, wing: 2, corridor: 2 };

/** The layout style a seed rolls at a tier. Independent of theme and difficulty. */
export function layoutStyleFor(seed, level = 1) {
  return new RNG(hashSeed(`${seed}|layout|${level}`)).weighted(LAYOUT_STYLES, (s) => LAYOUT_WEIGHTS[s]);
}
const NO_MODS = { vision: 1, speed: 1, density: 1, puzzleShift: 0, sizeShift: 0 };

export function guardCountFor(level, density = 1) {
  const base = level <= 1 ? 1 : level <= 2 ? 2 : level <= 3 ? 3 : Math.min(12, 3 + Math.floor((level - 2) / 2));
  return Math.max(1, Math.min(14, Math.round(base * density)));
}

/**
 * The mission target and the address a (seed, tier, setting) rolls. They come
 * from their own stream, so they depend only on those three, never on layout
 * retries, layout style or difficulty. Cheap: the case catalog calls this at
 * boot without generating a single room.
 */
export function rollFlavour(seed, level, themeId) {
  const flavour = new RNG(hashSeed(`${seed}|loot|${level}|${themeId}`));
  const loot = generateLoot(flavour, themeId);
  return { loot, venue: venueName(themeId, flavour) };
}

/**
 * generateRoom({ seed, level, theme, mods, layout, lootOverride, venueOverride }) -> room
 * `theme` is optional; omitted, one is rolled from the seed.
 * `layout` is optional too: one of LAYOUT_STYLES, else rolled from the seed.
 * `room.layoutStyle` records the style actually built.
 * `mods` (see core/difficulty.js resolveMods) scales guard vision, patrol
 * speed, guard density, how early puzzles appear and how big compounds get.
 * `level` is the size/complexity tier: 1 is a three-chamber starter, 14+ is a
 * sprawling mega-facility. It keeps working past MAX_SIZE_TIER (rooms simply
 * stop growing), so an endless run never runs out of rooms.
 * `lootOverride` / `venueOverride` pin the exact mission target and address
 * (a Case File from core/caseCatalog.js) instead of rolling them.
 */
export function generateRoom({ seed, level = 1, theme = null, mods = null, layout = null, lootOverride = null, venueOverride = null }) {
  const m = { ...NO_MODS, ...(mods || {}) };
  const themeRng = new RNG(hashSeed(`${seed}|theme|${level}`));
  const themeId = theme && THEMES[theme] ? theme : themeRng.pick(THEME_IDS);
  const style = LAYOUT_STYLES.includes(layout) ? layout : layoutStyleFor(seed, level);
  for (let attempt = 0; attempt < 60; attempt++) {
    const rng = new RNG(hashSeed(`${seed}|${level}|${attempt}`));
    const room = buildLayout(rng, level, m, style);
    if (!room) continue;
    const topo = solveTopology(room);
    if (!topo.ok) continue;
    room.seed = String(seed);
    room.level = level;
    room.mods = m;
    room.themeId = themeId;
    room.attempt = attempt;
    const coverKinds = THEMES[themeId].covers;
    for (const c of room.covers) if (c.kind !== 'pedestal') c.kind = rng.pick(coverKinds);
    const flavour = lootOverride && venueOverride ? null : rollFlavour(seed, level, themeId);
    room.loot.info = lootOverride || flavour.loot;
    room.loot.item = room.loot.info.id;
    room.venue = venueOverride || flavour.venue;
    if (!placeGuards(room, rng, level, m)) continue;
    return room;
  }
  throw new Error(`Could not generate a room for seed "${seed}" level ${level}`);
}

// ---------------------------------------------------------------- layout

/**
 * Split the largest splittable leaves (never a `fixed` one) until there are
 * `target` of them, and then for as long as one is at least `maxArea` cells.
 */
function splitLeaves(leaves, target, rng, maxArea = Infinity) {
  for (;;) {
    const splittable = leaves.filter((l) => !l.fixed && (l.w >= MIN_CHAMBER * 2 + 1 || l.h >= MIN_CHAMBER * 2 + 1));
    if (!splittable.length) break;
    splittable.sort((a, b) => b.w * b.h - a.w * a.h);
    const leaf = splittable[0];
    if (leaves.length >= target && leaf.w * leaf.h < maxArea) break;
    const canV = leaf.w >= MIN_CHAMBER * 2 + 1;
    const canH = leaf.h >= MIN_CHAMBER * 2 + 1;
    const vertical = canV && canH ? (leaf.w > leaf.h * 1.25 ? true : leaf.h > leaf.w * 1.25 ? false : rng.chance(0.5)) : canV;
    leaves.splice(leaves.indexOf(leaf), 1);
    if (vertical) {
      const p = rng.int(leaf.x + MIN_CHAMBER, leaf.x + leaf.w - MIN_CHAMBER - 1);
      leaves.push({ ...leaf, w: p - leaf.x });
      leaves.push({ ...leaf, x: p + 1, w: leaf.x + leaf.w - p - 1 });
    } else {
      const p = rng.int(leaf.y + MIN_CHAMBER, leaf.y + leaf.h - MIN_CHAMBER - 1);
      leaves.push({ ...leaf, h: p - leaf.y });
      leaves.push({ ...leaf, y: p + 1, h: leaf.y + leaf.h - p - 1 });
    }
  }
  return leaves;
}

// Each style returns { leaves, voids } for a w x h grid, or null when the
// footprint is too small for it. Leaves are floor rectangles that tile the
// footprint with exactly one wall cell between neighbours; `role` tags the
// ones the rest of the generator treats specially.
const LAYOUTS = {
  classic(rng, w, h, target) {
    return { leaves: splitLeaves([{ x: 1, y: 1, w: w - 2, h: h - 2 }], target, rng), voids: [] };
  },

  // A grand hall in the middle. Small footprints get a hall running the full
  // depth between two flanks; big ones get chambers all the way round it.
  atrium(rng, w, h, target) {
    const iw = w - 2;
    const ih = h - 2;
    if (iw < MIN_CHAMBER * 2 + 9) return null;
    const hw = Math.max(7, Math.min(iw - (MIN_CHAMBER + 1) * 2, Math.round(iw * rng.range(0.34, 0.44))));
    const spare = iw - hw - 2 - MIN_CHAMBER * 2;
    const lw = MIN_CHAMBER + Math.floor(spare / 2) + (spare > 1 ? rng.int(-1, 1) : 0);
    const rw = iw - hw - 2 - lw;
    const hx = 1 + lw + 1;
    const ring = ih >= MIN_CHAMBER * 2 + 11;
    if (!ring) {
      const leaves = [
        { x: 1, y: 1, w: lw, h: ih, role: 'flank' },
        { x: hx, y: 1, w: hw, h: ih, role: 'hall', fixed: true },
        { x: hx + hw + 1, y: 1, w: rw, h: ih, role: 'flank' },
      ];
      return { leaves: splitLeaves(leaves, target, rng, hw * ih), voids: [] };
    }
    const hh = Math.max(9, Math.min(ih - (MIN_CHAMBER + 1) * 2, Math.round(ih * rng.range(0.4, 0.5))));
    const spareV = ih - hh - 2 - MIN_CHAMBER * 2;
    const th = MIN_CHAMBER + Math.floor(spareV / 2) + (spareV > 1 ? rng.int(-1, 1) : 0);
    const bh = ih - hh - 2 - th;
    const hy = 1 + th + 1;
    const leaves = [
      { x: 1, y: 1, w: iw, h: th, role: 'flank' },
      { x: 1, y: hy, w: lw, h: hh, role: 'flank' },
      { x: hx, y: hy, w: hw, h: hh, role: 'hall', fixed: true },
      { x: hx + hw + 1, y: hy, w: rw, h: hh, role: 'flank' },
      { x: 1, y: hy + hh + 1, w: iw, h: bh, role: 'flank' },
    ];
    // nothing round the hall is allowed to out-size it
    return { leaves: splitLeaves(leaves, Math.max(target, 5), rng, hw * hh), voids: [] };
  },

  // Two bands, one or both cut short by a block of solid mass in an outer
  // corner: an L, or on wide footprints a stepped S / Z.
  wing(rng, w, h, target) {
    const iw = w - 2;
    const ih = h - 2;
    if (iw < MIN_CHAMBER * 2 + 2 || ih < MIN_CHAMBER * 2 + 1) return null;
    const cutTop = rng.chance(0.5);
    const cutLeft = rng.chance(0.5);
    const cutH = rng.int(MIN_CHAMBER, ih - MIN_CHAMBER - 1); // depth of the shortened band
    const cutW = rng.int(Math.max(MIN_CHAMBER, Math.round(iw * 0.26)), Math.min(iw - MIN_CHAMBER - 1, Math.round(iw * 0.5)));
    const fullH = ih - cutH - 1;
    const yCut = cutTop ? 1 : 1 + fullH + 1;
    const yFull = cutTop ? 1 + cutH + 1 : 1;
    const short = { x: cutLeft ? 1 + cutW : 1, y: yCut, w: iw - cutW, h: cutH, role: 'wing' };
    const full = { x: 1, y: yFull, w: iw, h: fullH, role: 'wing' };
    const voids = [{ x: cutLeft ? 1 : 1 + iw - cutW, y: yCut, w: cutW, h: cutH }];
    // the second step, in the opposite corner of the other band
    if (iw >= 26 && fullH >= MIN_CHAMBER && rng.chance(0.55)) {
      const stepW = rng.int(MIN_CHAMBER, Math.max(MIN_CHAMBER, Math.min(Math.round(iw * 0.3), iw - cutW - 8)));
      if (iw - cutW - stepW >= 8) {
        voids.push({ x: cutLeft ? 1 + iw - stepW : 1, y: yFull, w: stepW, h: fullH });
        full.w = iw - stepW;
        if (!cutLeft) full.x = 1 + stepW;
      }
    }
    return { leaves: splitLeaves([short, full], target, rng), voids };
  },

  // A corridor down the middle with chambers off both sides.
  corridor(rng, w, h, target) {
    const iw = w - 2;
    const ih = h - 2;
    const sh = ih >= 15 ? 3 : 2;
    const rest = ih - sh - 2; // floor rows left for the two flanks
    if (rest < 8 || iw < MIN_CHAMBER * 2 + 1) return null;
    // the spine stays near the middle: it may drift a little, never to an edge
    const nh = rest < MIN_CHAMBER * 2 ? Math.floor(rest / 2) + (rest % 2 ? rng.int(0, 1) : 0) : Math.max(MIN_CHAMBER, Math.min(rest - MIN_CHAMBER, Math.round(rest * rng.range(0.38, 0.62))));
    const leaves = [
      { x: 1, y: 1, w: iw, h: nh, role: 'north' },
      { x: 1, y: 1 + nh + 1, w: iw, h: sh, role: 'spine', fixed: true },
      { x: 1, y: 1 + nh + 1 + sh + 1, w: iw, h: rest - nh, role: 'south' },
    ];
    return { leaves: splitLeaves(leaves, Math.max(target, 4) + 1, rng), voids: [] };
  },
};

function buildLayout(rng, level, m, style = 'classic') {
  // lv drives physical size and chamber count; plv drives puzzle density.
  const lv = Math.max(1, Math.min(level + m.sizeShift, MAX_SIZE_TIER));
  const plv = Math.max(1, level + m.puzzleShift);
  const w = Math.min(48, Math.round(19 + Math.min(lv, 6) * 2 + Math.max(0, lv - 6) * 1.4) + rng.int(0, 2));
  const h = Math.min(30, Math.round(14 + Math.min(lv, 6) + Math.max(0, lv - 6) * 0.75) + rng.int(0, 1));
  const cells = new Uint8Array(w * h).fill(WALL);
  const room = {
    w,
    h,
    cells,
    layoutStyle: style,
    voids: [],
    chambers: [],
    doors: [],
    covers: [],
    vents: [],
    lasers: [],
    switches: [],
    guards: [],
  };

  // --- chambers, carved in the room's architectural style
  const target = lv <= 1 ? 3 : lv <= 2 ? rng.int(3, 4) : lv <= 4 ? rng.int(4, 5) : Math.min(15, rng.int(5, 7) + Math.floor((lv - 5) * 0.6));
  let plan = LAYOUTS[style](rng, w, h, target);
  if (!plan) {
    room.layoutStyle = 'classic';
    plan = LAYOUTS.classic(rng, w, h, target);
  }
  const leaves = plan.leaves;
  room.voids = plan.voids;
  if (leaves.length < 2) return null;
  leaves.sort((a, b) => a.x - b.x || a.y - b.y);
  room.chambers = leaves;
  for (const l of leaves) {
    for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) cells[y * w + x] = FLOOR;
  }

  // --- doorways
  const edges = [];
  for (let i = 0; i < leaves.length; i++) {
    for (let j = 0; j < leaves.length; j++) {
      if (i === j) continue;
      const A = leaves[i];
      const B = leaves[j];
      if (A.x + A.w === B.x - 1) {
        const y0 = Math.max(A.y, B.y);
        const y1 = Math.min(A.y + A.h, B.y + B.h) - 1;
        if (y1 - y0 + 1 >= 2) edges.push({ a: i, b: j, vertical: true, at: A.x + A.w, lo: y0, hi: y1 });
      }
      if (A.y + A.h === B.y - 1) {
        const x0 = Math.max(A.x, B.x);
        const x1 = Math.min(A.x + A.w, B.x + B.w) - 1;
        if (x1 - x0 + 1 >= 2) edges.push({ a: i, b: j, vertical: false, at: A.y + A.h, lo: x0, hi: x1 });
      }
    }
  }
  rng.shuffle(edges);
  const uf = leaves.map((_, i) => i);
  const find = (i) => (uf[i] === i ? i : (uf[i] = find(uf[i])));
  let extras = 0;
  for (const e of edges) {
    const ra = find(e.a);
    const rb = find(e.b);
    const tree = ra !== rb;
    // Every chamber beside the spine opens onto it; a grand hall gets most of its doors.
    const hub = [leaves[e.a].role, leaves[e.b].role];
    const open = !tree && (hub.includes('spine') || (hub.includes('hall') && rng.chance(0.6)));
    if (!tree && !open && !(extras < 2 + Math.floor(lv / 5) && rng.chance(0.22))) continue;
    if (tree) uf[ra] = rb;
    else if (!open) extras++;
    const p = rng.int(e.lo, e.hi - 1);
    const dc = e.vertical
      ? [
          { cx: e.at, cy: p },
          { cx: e.at, cy: p + 1 },
        ]
      : [
          { cx: p, cy: e.at },
          { cx: p + 1, cy: e.at },
        ];
    for (const c of dc) cells[c.cy * w + c.cx] = FLOOR;
    room.doors.push({ a: e.a, b: e.b, vertical: e.vertical, cells: dc, tree });
  }
  if (leaves.some((_, i) => find(i) !== find(0))) return null;

  // --- reserved cells keep doorways, spawn points and gadgets clear of cover
  const reserved = new Uint8Array(w * h);
  const reserve = (cx, cy, r = 0) => {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && y >= 0 && x < w && y < h) reserved[y * w + x] = 1;
  };
  for (const d of room.doors) for (const c of d.cells) reserve(c.cx, c.cy, 1);

  const chamberDist = (from, blocked = []) => {
    const dist = leaves.map(() => -1);
    dist[from] = 0;
    const q = [from];
    for (let qi = 0; qi < q.length; qi++) {
      room.doors.forEach((d, di) => {
        if (blocked.includes(di)) return;
        const other = d.a === q[qi] ? d.b : d.b === q[qi] ? d.a : -1;
        if (other < 0 || dist[other] !== -1) return;
        dist[other] = dist[q[qi]] + 1;
        q.push(other);
      });
    }
    return dist;
  };

  const degree = leaves.map((_, i) => room.doors.filter((d) => d.a === i || d.b === i).length);
  const deadEnds = leaves.map((_, i) => i).filter((i) => degree[i] === 1);
  const startCh = deadEnds.length ? rng.pick(deadEnds) : rng.int(0, leaves.length - 1);
  const fromStart = chamberDist(startCh);
  const far = Math.max(...fromStart);
  const lootCh = rng.pick(leaves.map((_, i) => i).filter((i) => fromStart[i] === far));
  let exitCh = startCh;
  if (lv > 2 && rng.chance(0.5)) {
    const options = leaves.map((_, i) => i).filter((i) => i !== lootCh);
    exitCh = rng.pick(options);
  }
  room.startChamber = startCh;
  room.lootChamber = lootCh;
  room.exitChamber = exitCh;

  const ringCells = (ci) => {
    const c = leaves[ci];
    const out = [];
    for (let y = c.y; y < c.y + c.h; y++)
      for (let x = c.x; x < c.x + c.w; x++)
        if (x === c.x || y === c.y || x === c.x + c.w - 1 || y === c.y + c.h - 1) out.push({ cx: x, cy: y });
    return out;
  };
  const doorDist = (ci, cx, cy) => {
    let best = Infinity;
    for (const d of room.doors) {
      if (d.a !== ci && d.b !== ci) continue;
      for (const c of d.cells) best = Math.min(best, Math.abs(c.cx - cx) + Math.abs(c.cy - cy));
    }
    return best;
  };

  // --- start: the corner of the start chamber furthest from its doors
  {
    const c = leaves[startCh];
    const corners = [
      { cx: c.x, cy: c.y },
      { cx: c.x + c.w - 1, cy: c.y },
      { cx: c.x, cy: c.y + c.h - 1 },
      { cx: c.x + c.w - 1, cy: c.y + c.h - 1 },
    ];
    corners.sort((a, b) => doorDist(startCh, b.cx, b.cy) - doorDist(startCh, a.cx, a.cy));
    const s = corners[0];
    room.start = {
      cx: s.cx,
      cy: s.cy,
      x: s.cx + 0.5,
      z: s.cy + 0.5,
      ang: Math.atan2(c.y + c.h / 2 - s.cy - 0.5, c.x + c.w / 2 - s.cx - 0.5),
    };
    reserve(s.cx, s.cy, 1);
  }

  // --- extraction pad
  {
    const options = ringCells(exitCh).filter(
      (c) => !reserved[c.cy * w + c.cx] && Math.abs(c.cx - room.start.cx) + Math.abs(c.cy - room.start.cy) >= 4,
    );
    if (!options.length) return null;
    const e = rng.pick(options);
    room.exit = { cx: e.cx, cy: e.cy, x: e.cx + 0.5, z: e.cy + 0.5 };
    reserve(e.cx, e.cy, 1);
  }

  // --- loot pedestal: deep inside the loot chamber
  {
    const c = leaves[lootCh];
    const options = [];
    for (let y = c.y + 1; y < c.y + c.h - 1; y++)
      for (let x = c.x + 1; x < c.x + c.w - 1; x++) {
        if (reserved[y * w + x]) continue;
        options.push({ cx: x, cy: y, score: doorDist(lootCh, x, y) + rng.range(0, 2.5) });
      }
    if (!options.length) return null;
    options.sort((a, b) => b.score - a.score);
    const p = options[0];
    cells[p.cy * w + p.cx] = COVER;
    room.loot = { cx: p.cx, cy: p.cy, x: p.cx + 0.5, z: p.cy + 0.5, item: null };
    room.covers.push({ x: p.cx, y: p.cy, w: 1, h: 1, kind: 'pedestal' });
  }

  // --- waist-high cover: always at least one cell from walls and each other,
  // so every chamber keeps a walkable ring and stays connected.
  leaves.forEach((c) => {
    const innerArea = (c.w - 2) * (c.h - 2);
    // A grand hall is a lot of open floor: it gets more to hide behind.
    const want = Math.max(1, Math.min(c.role === 'hall' ? 11 : 6, Math.round((innerArea / 10) * rng.range(0.6, 1.1))));
    let placed = 0;
    for (let tries = 0; tries < 40 && placed < want; tries++) {
      const [cw, ch] = rng.pick(COVER_SHAPES);
      if (cw > c.w - 2 || ch > c.h - 2) continue;
      const x = rng.int(c.x + 1, c.x + c.w - 1 - cw);
      const y = rng.int(c.y + 1, c.y + c.h - 1 - ch);
      let ok = true;
      for (let yy = y - 1; yy <= y + ch && ok; yy++)
        for (let xx = x - 1; xx <= x + cw && ok; xx++) {
          if (cellAt(room, xx, yy) === COVER) ok = false;
          const inside = xx >= x && xx < x + cw && yy >= y && yy < y + ch;
          if (inside && reserved[yy * w + xx]) ok = false;
        }
      if (!ok) continue;
      for (let yy = y; yy < y + ch; yy++) for (let xx = x; xx < x + cw; xx++) cells[yy * w + xx] = COVER;
      room.covers.push({ x, y, w: cw, h: ch, kind: 'crate' });
      placed++;
    }
  });

  // --- wall-side gadget spots (vent grates, switch terminals)
  const wallSpot = (ci) => {
    const options = [];
    for (const c of ringCells(ci)) {
      if (reserved[c.cy * w + c.cx]) continue;
      const walls = DIRS4.filter(([dx, dy]) => cellAt(room, c.cx + dx, c.cy + dy) === WALL);
      if (walls.length !== 1) continue; // skip corners: grates read better on a flat wall
      options.push({ cx: c.cx, cy: c.cy, dx: walls[0][0], dy: walls[0][1] });
    }
    if (!options.length) return null;
    const s = rng.pick(options);
    reserve(s.cx, s.cy, 1);
    return s;
  };
  const addVent = (ca, cb) => {
    const a = wallSpot(ca);
    const b = a && wallSpot(cb);
    if (!a || !b) return false;
    const len = Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
    room.vents.push({ a: { ...a, chamber: ca }, b: { ...b, chamber: cb }, len, time: 1.0 + len * 0.07 });
    return true;
  };

  // --- lasers across doorways on the way to the loot, with switches placed
  // somewhere reachable *before* the beam.
  const pathDoors = (from, to) => {
    const prev = leaves.map(() => null);
    const seen = leaves.map(() => false);
    seen[from] = true;
    const q = [from];
    for (let qi = 0; qi < q.length; qi++) {
      room.doors.forEach((d, di) => {
        const other = d.a === q[qi] ? d.b : d.b === q[qi] ? d.a : -1;
        if (other < 0 || seen[other]) return;
        seen[other] = true;
        prev[other] = { ch: q[qi], door: di };
        q.push(other);
      });
    }
    const out = [];
    for (let c = to; prev[c]; c = prev[c].ch) out.push(prev[c].door);
    return out.reverse();
  };
  const laserDoors = [];
  const maxLasers = plv >= 12 ? 3 : plv >= 5 ? 2 : plv >= 2 ? 1 : 0;
  if (maxLasers && rng.chance(plv === 2 ? 0.45 : 0.8)) {
    const path = pathDoors(startCh, lootCh);
    if (path.length) laserDoors.push(path[path.length - 1 - (path.length > 1 && rng.chance(0.35) ? 1 : 0)]);
    for (let k = 1; k < maxLasers && laserDoors.length; k++) {
      if (!rng.chance(plv >= 12 ? 0.75 : 0.5)) continue;
      const others = room.doors.map((_, i) => i).filter((i) => !laserDoors.includes(i));
      if (others.length) laserDoors.push(rng.pick(others));
    }
  }
  laserDoors.forEach((di, li) => {
    const d = room.doors[di];
    // Switch i must be reachable without crossing laser i or any later laser.
    const reach = chamberDist(startCh, laserDoors.slice(li));
    const options = leaves.map((_, i) => i).filter((i) => reach[i] >= 0);
    const ch = rng.weighted(options, (i) => (i === startCh ? 1 : 2 + reach[i]));
    const s = wallSpot(ch);
    if (!s) return;
    const c0 = d.cells[0];
    const c1 = d.cells[1];
    const laser = {
      cells: d.cells.map((c) => ({ ...c })),
      vertical: d.vertical,
      door: di,
      // beam endpoints, door-frame to door-frame
      x0: d.vertical ? c0.cx + 0.5 : c0.cx,
      z0: d.vertical ? c0.cy : c0.cy + 0.5,
      x1: d.vertical ? c1.cx + 0.5 : c1.cx + 1,
      z1: d.vertical ? c1.cy + 1 : c1.cy + 0.5,
    };
    room.lasers.push(laser);
    room.switches.push({ ...s, chamber: ch, laser: room.lasers.length - 1 });
    // Sometimes there's also a way to crawl around the beam entirely.
    if (rng.chance(0.45)) {
      const behind = leaves.map((_, i) => i).filter((i) => reach[i] < 0);
      if (behind.length) addVent(rng.pick(options), rng.pick(behind));
    }
  });

  // --- corridor rooms: HVAC ducts that cross over the spine, flank to flank
  if (room.layoutStyle === 'corridor') {
    const side = (role) => rng.shuffle(leaves.map((_, i) => i).filter((i) => leaves[i].role === role));
    const north = side('north');
    const south = side('south');
    const want = 1 + (lv >= 6 && rng.chance(0.5) ? 1 : 0);
    let made = 0;
    for (let k = 0; k < Math.min(north.length, south.length) && made < want; k++) if (addVent(north[k], south[k])) made++;
  }

  // --- crawl vents between chambers, favouring long skips
  {
    const pairs = [];
    for (let i = 0; i < leaves.length; i++) {
      const dist = chamberDist(i);
      for (let j = i + 1; j < leaves.length; j++) pairs.push({ i, j, wgt: dist[j] >= 2 ? 4 : 1 });
    }
    const want = (plv <= 1 ? 1 : rng.int(1, 2)) + Math.min(3, Math.floor(plv / 5));
    for (let k = 0; k < want && pairs.length; k++) {
      const p = rng.weighted(pairs, (q) => q.wgt);
      pairs.splice(pairs.indexOf(p), 1);
      addVent(p.i, p.j);
    }
  }

  // Every room, including the very first, has at least one vent and duct:
  // try every chamber pair before giving up on this layout.
  for (let i = 0; i < leaves.length && !room.vents.length; i++) for (let j = i + 1; j < leaves.length && !room.vents.length; j++) addVent(i, j);
  if (!room.vents.length) return null;

  return room;
}

// ---------------------------------------------------------------- guards

function rollGuard(room, rng, chamberIdx, m) {
  const c = room.chambers[chamberIdx];
  const centre = (cx, cy) => ({ x: cx + 0.5, z: cy + 0.5 });
  const roll = rng.next();
  const vis = { range: rng.range(6.2, 7.4) * m.vision, half: rng.range(0.47, 0.56) * (1 + (m.vision - 1) * 0.5) };
  const base = { vis, chamber: chamberIdx, look: rng.int(0, 1e9) };

  if (roll < 0.45) {
    // Loop: around a piece of cover, or around the chamber's outer ring.
    const covers = room.covers.filter(
      (k) => k.x >= c.x && k.x < c.x + c.w && k.y >= c.y && k.y < c.y + c.h,
    );
    let r;
    if (covers.length && rng.chance(0.65)) {
      const k = rng.pick(covers);
      r = { x0: k.x - 1, y0: k.y - 1, x1: k.x + k.w, y1: k.y + k.h };
    } else {
      r = { x0: c.x, y0: c.y, x1: c.x + c.w - 1, y1: c.y + c.h - 1 };
    }
    let pts = [centre(r.x0, r.y0), centre(r.x1, r.y0), centre(r.x1, r.y1), centre(r.x0, r.y1)];
    if (rng.chance(0.5)) pts.reverse();
    const rot = rng.int(0, 3);
    pts = pts.slice(rot).concat(pts.slice(0, rot));
    return { ...base, kind: 'loop', pts, speed: rng.range(1.25, 1.7) * m.speed, wait: rng.chance(0.4) ? rng.range(0.6, 1.4) : 0 };
  }

  if (roll < 0.8) {
    // Ping-pong: a straight beat, often marching through a doorway.
    const doors = room.doors.filter((d) => d.a === chamberIdx || d.b === chamberIdx);
    let cx;
    let cy;
    let horizontal;
    if (doors.length && rng.chance(0.55)) {
      const d = rng.pick(doors);
      const dc = rng.pick(d.cells);
      cx = dc.cx;
      cy = dc.cy;
      horizontal = d.vertical; // a door in a vertical wall is walked through horizontally
    } else {
      cx = rng.int(c.x, c.x + c.w - 1);
      cy = rng.int(c.y, c.y + c.h - 1);
      horizontal = c.w >= c.h ? rng.chance(0.7) : rng.chance(0.3);
    }
    if (!isFloor(room, cx, cy)) return null;
    const [dx, dy] = horizontal ? [1, 0] : [0, 1];
    let a = 0;
    let b = 0;
    while (a > -7 && isFloor(room, cx + dx * (a - 1), cy + dy * (a - 1))) a--;
    while (b < 7 && isFloor(room, cx + dx * (b + 1), cy + dy * (b + 1))) b++;
    if (b - a < 4) return null;
    // trim randomly so beats differ
    if (b - a > 6 && rng.chance(0.5)) a += rng.int(1, 2);
    if (b - a > 6 && rng.chance(0.5)) b -= rng.int(1, 2);
    const pts = [centre(cx + dx * a, cy + dy * a), centre(cx + dx * b, cy + dy * b)];
    if (rng.chance(0.5)) pts.reverse();
    return { ...base, kind: 'pingpong', pts, speed: rng.range(1.3, 1.8) * m.speed, wait: rng.range(0.7, 1.8) };
  }

  // Lookout: stands still and swivels.
  const cx = rng.int(c.x, c.x + c.w - 1);
  const cy = rng.int(c.y, c.y + c.h - 1);
  if (!isFloor(room, cx, cy)) return null;
  const toCentre = Math.atan2(c.y + c.h / 2 - cy - 0.5, c.x + c.w / 2 - cx - 0.5);
  let angles;
  if (rng.chance(0.35)) {
    const s = rng.chance(0.5) ? 1 : -1;
    const a0 = (Math.PI / 2) * rng.int(0, 3);
    angles = [a0, a0 + (s * Math.PI) / 2, a0 + s * Math.PI, a0 + (s * 3 * Math.PI) / 2];
  } else {
    const spread = rng.range(0.7, 1.25);
    angles = [toCentre - spread, toCentre + spread];
  }
  return {
    ...base,
    vis: { range: vis.range + 0.6, half: vis.half },
    kind: 'lookout',
    pts: [centre(cx, cy)],
    angles,
    dwell: rng.range(1.6, 2.8),
    sweepSpeed: rng.range(0.9, 1.3) * m.speed,
    speed: 1.5,
  };
}

/** Every patrol leg must be a straight run of floor cells, clear of gadgets and the spawn. */
export function patrolIsValid(room, g) {
  const blocked = new Set();
  const key = (cx, cy) => cy * room.w + cx;
  blocked.add(key(room.exit.cx, room.exit.cy));
  for (const l of room.lasers) for (const c of l.cells) blocked.add(key(c.cx, c.cy));
  for (const s of room.switches) blocked.add(key(s.cx, s.cy));
  const n = g.kind === 'loop' ? g.pts.length : g.pts.length - 1;
  const check = (x, z) => {
    const cx = Math.floor(x);
    const cy = Math.floor(z);
    return isFloor(room, cx, cy) && !blocked.has(key(cx, cy));
  };
  for (const p of g.pts) {
    if (!check(p.x, p.z)) return false;
    if (Math.hypot(p.x - room.start.x, p.z - room.start.z) < 4.5) return false;
  }
  for (let i = 0; i < n; i++) {
    const a = g.pts[i];
    const b = g.pts[(i + 1) % g.pts.length];
    if (a.x !== b.x && a.z !== b.z) return false; // axis-aligned legs only
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    for (let s = 0; s <= len; s += 0.5) {
      if (!check(a.x + ((b.x - a.x) * s) / len, a.z + ((b.z - a.z) * s) / len)) return false;
    }
  }
  return true;
}

/** The spawn point must be a permanent safe spot, even standing up. */
function seesStart(room, g) {
  const pose = {};
  for (let t = 0; t < g.timeline.period; t += 0.12) {
    poseAt(g.timeline, t, pose);
    for (const [ox, oz] of [
      [0, 0],
      [0.35, 0],
      [-0.35, 0],
      [0, 0.35],
      [0, -0.35],
    ]) {
      if (canSee(room, pose, room.start.x + ox, room.start.z + oz, false, g.vis, SOLVER_PAD_RANGE, SOLVER_PAD_ANGLE))
        return true;
    }
  }
  return false;
}

function placeGuards(room, rng, level, m) {
  const want = Math.min(guardCountFor(level, m.density), room.chambers.length + 2);
  // Big compounds cost more per verification, so they get fewer re-rolls
  // before a guard is stood down.
  const rerolls = room.w * room.h > 800 ? 3 : 7;
  for (let count = want; count >= 0; count--) {
    for (let tries = 0; tries < (count === 0 ? 1 : rerolls); tries++) {
      const guards = [];
      const load = room.chambers.map(() => 0);
      for (let i = 0; i < count; i++) {
        for (let roll = 0; roll < 30; roll++) {
          const options = room.chambers.map((_, ci) => ci);
          const ci =
            i === 0 && roll < 10
              ? room.lootChamber
              : rng.weighted(options, (c) => (c === room.startChamber ? 0.3 : 1) / (1 + load[c] * 2));
          const g = rollGuard(room, rng, ci, m);
          if (!g || !patrolIsValid(room, g)) continue;
          g.timeline = buildTimeline(g);
          if (seesStart(room, g)) continue;
          // no two guards on the same beat
          if (guards.some((o) => o.kind === g.kind && Math.hypot(o.pts[0].x - g.pts[0].x, o.pts[0].z - g.pts[0].z) < 2.5))
            continue;
          load[ci]++;
          guards.push(g);
          break;
        }
      }
      if (guards.length < count) continue;
      const res = solveStealth(room, guards);
      if (!res.ok) continue;
      guards.forEach((g, i) => (g.id = i));
      room.guards = guards;
      room.par = Math.round(res.time);
      room.ghostSteps = res.steps;
      return true;
    }
  }
  return false;
}
