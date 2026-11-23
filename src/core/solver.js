// Deterministic room verifiers.
//
//  solveTopology – can the agent physically get loot -> exit, using doors,
//                  vents and laser switches? (BFS over cell x flags.)
//  solveStealth  – is there a route that is never inside any guard's vision,
//                  with no knockouts and no distractions? This is a BFS over a
//                  time-expanded graph: guards follow their exact patrol
//                  timelines, the agent crouch-walks one cell per step, may
//                  wait, crawl vents and flip switches. Vision is padded so
//                  the discrete proof holds up for continuous movement.
//
// A room that passes solveStealth is always beatable as a perfect ghost.

import { FLOOR, DIRS4, hasLineOfSight } from './grid.js';
import { poseAt, angDiff } from './patrol.js';

export const STEP_DT = 0.4; // seconds per solver step (one cell at crouch speed)
export const SOLVER_PAD_RANGE = 0.75;
export const SOLVER_PAD_ANGLE = 0.14;
const NEAR_RADIUS = 1.6; // never route this close to an awake guard

function buildStatics(room) {
  const { w, h } = room;
  const n = w * h;
  const laserOf = new Int8Array(n).fill(-1);
  room.lasers.forEach((l, i) => l.cells.forEach((c) => (laserOf[c.cy * w + c.cx] = i)));
  const switchOf = new Int8Array(n).fill(-1);
  for (const s of room.switches) switchOf[s.cy * w + s.cx] = s.laser;
  const lootAdj = new Uint8Array(n);
  for (const [dx, dy] of DIRS4) {
    const x = room.loot.cx + dx;
    const y = room.loot.cy + dy;
    if (x >= 0 && y >= 0 && x < w && y < h) lootAdj[y * w + x] = 1;
  }
  const ventsAt = new Map();
  for (const v of room.vents) {
    const a = v.a.cy * w + v.a.cx;
    const b = v.b.cy * w + v.b.cx;
    const steps = Math.ceil(v.time / STEP_DT) + 1;
    if (!ventsAt.has(a)) ventsAt.set(a, []);
    if (!ventsAt.has(b)) ventsAt.set(b, []);
    ventsAt.get(a).push({ to: b, steps });
    ventsAt.get(b).push({ to: a, steps });
  }
  const nf = 2 << room.lasers.length; // loot bit + one bit per laser
  return { w, h, n, laserOf, switchOf, lootAdj, ventsAt, nf };
}

// Flags: bit 0 = carrying loot, bit (1 + i) = laser i switched off.
function settleFlags(st, cell, f) {
  if (st.lootAdj[cell]) f |= 1;
  const sw = st.switchOf[cell];
  if (sw >= 0) f |= 2 << sw;
  return f;
}

export function solveTopology(room) {
  const st = buildStatics(room);
  const { w, n, nf } = st;
  const start = room.start.cy * w + room.start.cx;
  const exit = room.exit.cy * w + room.exit.cx;
  const dist = new Int32Array(n * nf).fill(-1);
  const s0 = start * nf + settleFlags(st, start, 0);
  dist[s0] = 0;
  const queue = [s0];
  for (let qi = 0; qi < queue.length; qi++) {
    const s = queue[qi];
    const f = s % nf;
    const cell = (s - f) / nf;
    if (cell === exit && f & 1) return { ok: true, steps: dist[s] };
    const cx = cell % w;
    const cy = (cell - cx) / w;
    const push = (c2, cost) => {
      const s2 = c2 * nf + settleFlags(st, c2, f);
      if (dist[s2] !== -1) return;
      dist[s2] = dist[s] + cost;
      queue.push(s2);
    };
    for (const [dx, dy] of DIRS4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= st.h) continue;
      const c2 = ny * w + nx;
      if (room.cells[c2] !== FLOOR) continue;
      const l = st.laserOf[c2];
      if (l >= 0 && !(f & (2 << l))) continue;
      push(c2, 1);
    }
    const vents = st.ventsAt.get(cell);
    if (vents) for (const v of vents) push(v.to, 1);
  }
  return { ok: false, steps: -1 };
}

// Sample points inside a cell; a cell is unsafe if any of them is visible.
const SAMPLE_OFFSETS = [
  [0, 0],
  [0.42, 0],
  [-0.42, 0],
  [0, 0.42],
  [0, -0.42],
  [0.3, 0.3],
  [-0.3, 0.3],
  [0.3, -0.3],
  [-0.3, -0.3],
];

/** Mark every floor cell an awake guard could see (crouched target) at time t. */
export function markVisible(room, guards, t, out) {
  const { w, h, cells } = room;
  const pose = {};
  for (const g of guards) {
    poseAt(g.timeline, t, pose);
    const range = g.vis.range + SOLVER_PAD_RANGE;
    const half = g.vis.half + SOLVER_PAD_ANGLE;
    const reach = range + 0.6;
    const fx = Math.cos(pose.ang);
    const fz = Math.sin(pose.ang);
    const x0 = Math.max(0, Math.floor(pose.x - reach));
    const x1 = Math.min(w - 1, Math.floor(pose.x + reach));
    const y0 = Math.max(0, Math.floor(pose.z - reach));
    const y1 = Math.min(h - 1, Math.floor(pose.z + reach));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const i = cy * w + cx;
        if (out[i] || cells[i] !== FLOOR) continue;
        const ccx = cx + 0.5;
        const ccz = cy + 0.5;
        const cd = Math.hypot(ccx - pose.x, ccz - pose.z);
        if (cd > reach) continue;
        if (cd < NEAR_RADIUS) {
          out[i] = 1;
          continue;
        }
        // Cheap reject: the whole cell lies outside the padded cone.
        const off = Math.acos(Math.max(-1, Math.min(1, ((ccx - pose.x) * fx + (ccz - pose.z) * fz) / cd)));
        if (off > half + Math.asin(Math.min(1, 0.6 / cd))) continue;
        for (const [ox, oz] of SAMPLE_OFFSETS) {
          const px = ccx + ox;
          const pz = ccz + oz;
          const dx = px - pose.x;
          const dz = pz - pose.z;
          const d = Math.hypot(dx, dz);
          if (d > range) continue;
          if (Math.abs(angDiff(pose.ang, Math.atan2(dz, dx))) > half) continue;
          if (hasLineOfSight(room, pose.x, pose.z, px, pz, true)) {
            out[i] = 1;
            break;
          }
        }
      }
    }
  }
  return out;
}

/**
 * Time-expanded ghost-route search.
 * guards: [{ timeline, vis: {range, half} }]
 * Returns { ok, steps, time, path? } where path is
 *   [{ step, cx, cy, flags, vent }] (vent=true: arrived by crawling a vent).
 */
export function solveStealth(room, guards, { maxSteps = 0, wantPath = false } = {}) {
  // Default horizon grows with the room: 2 minutes for a starter room, about
  // 5 for a mega-facility with switch errands.
  if (!maxSteps) maxSteps = 300 + Math.floor((room.w * room.h) / 3);
  const st = buildStatics(room);
  const { w, h, n, nf } = st;
  const S = n * nf;
  const start = room.start.cy * w + room.start.cx;
  const exit = room.exit.cy * w + room.exit.cx;
  const cells = room.cells;

  // unsafe(k) = visible at any of the quarter-step samples around step k.
  const visCache = new Map();
  const visAt = (m) => {
    let v = visCache.get(m);
    if (!v) {
      v = markVisible(room, guards, Math.max(0, (m * STEP_DT) / 4), new Uint8Array(n));
      visCache.set(m, v);
      visCache.delete(m - 16);
    }
    return v;
  };
  const unsafeCache = new Map();
  const unsafeAt = (k) => {
    let u = unsafeCache.get(k);
    if (!u) {
      u = new Uint8Array(n);
      for (let m = 4 * k - 2; m <= 4 * k + 2; m++) {
        const v = visAt(m);
        for (let i = 0; i < n; i++) u[i] |= v[i];
      }
      unsafeCache.set(k, u);
      unsafeCache.delete(k - 3);
    }
    return u;
  };

  const parent = wantPath ? new Int32Array(maxSteps * S).fill(-1) : null;
  let cur = new Uint8Array(S);
  let next = new Uint8Array(S);
  let curList = [];
  let nextList = [];
  const pending = new Map(); // step -> [state, parentCode]

  const s0 = start * nf + settleFlags(st, start, 0);
  if (unsafeAt(0)[start]) return { ok: false, steps: -1, time: -1 };
  cur[s0] = 1;
  curList.push(s0);

  const finish = (k, s) => {
    const res = { ok: true, steps: k, time: k * STEP_DT };
    if (wantPath) {
      const path = [];
      let step = k;
      let state = s;
      for (;;) {
        const f = state % nf;
        const cell = (state - f) / nf;
        const code = step > 0 ? parent[step * S + state] : -1;
        const pStep = code >= 0 ? Math.floor(code / S) : -1;
        path.push({ step, cx: cell % w, cy: Math.floor(cell / w), flags: f, vent: code >= 0 && step - pStep > 1 });
        if (code < 0) break;
        step = pStep;
        state = code % S;
      }
      res.path = path.reverse();
    }
    return res;
  };

  for (let k = 0; k < maxSteps - 1; k++) {
    const uNow = unsafeAt(k);
    const uNext = unsafeAt(k + 1);
    // Vent arrivals scheduled for this step.
    const arrivals = pending.get(k);
    if (arrivals) {
      pending.delete(k);
      for (let i = 0; i < arrivals.length; i += 2) {
        const s = arrivals[i];
        const cell = (s - (s % nf)) / nf;
        if (cur[s] || uNow[cell]) continue;
        cur[s] = 1;
        curList.push(s);
        if (parent) parent[k * S + s] = arrivals[i + 1];
      }
    }
    if (curList.length === 0 && pending.size === 0) break;
    for (let li = 0; li < curList.length; li++) {
      const s = curList[li];
      const f = s % nf;
      const cell = (s - f) / nf;
      if (cell === exit && f & 1) return finish(k, s);
      const code = k * S + s;
      const add = (c2) => {
        const s2 = c2 * nf + settleFlags(st, c2, f);
        if (next[s2]) return;
        next[s2] = 1;
        nextList.push(s2);
        if (parent) parent[(k + 1) * S + s2] = code;
      };
      if (!uNext[cell]) add(cell);
      const cx = cell % w;
      const cy = (cell - cx) / w;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DIRS4[d][0];
        const ny = cy + DIRS4[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const c2 = ny * w + nx;
        if (cells[c2] !== FLOOR || uNow[c2] || uNext[c2]) continue;
        const l = st.laserOf[c2];
        if (l >= 0 && !(f & (2 << l))) continue;
        add(c2);
      }
      const vents = st.ventsAt.get(cell);
      if (vents) {
        for (const v of vents) {
          const at = k + v.steps;
          if (at >= maxSteps) continue;
          const s2 = v.to * nf + settleFlags(st, v.to, f);
          if (!pending.has(at)) pending.set(at, []);
          pending.get(at).push(s2, code);
        }
      }
    }
    for (let li = 0; li < curList.length; li++) cur[curList[li]] = 0;
    [cur, next] = [next, cur];
    [curList, nextList] = [nextList, curList];
    nextList.length = 0;
  }
  return { ok: false, steps: -1, time: -1 };
}
