// Guard patrols are pure functions of time. An undisturbed guard's pose at
// second `t` comes straight from a precomputed cyclic timeline, which is what
// lets the solver prove a room is beatable before you ever see it.
//
// Angles are radians in the XZ plane: direction = (cos a, sin a).

export const TURN_SPEED = 2.6; // rad/s when pivoting at a waypoint

const TAU = Math.PI * 2;

/** Shortest signed rotation taking angle a to angle b, in (-PI, PI]. */
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/**
 * def: { kind: 'loop' | 'pingpong' | 'lookout', pts: [{x, z}], speed, wait,
 *        angles: [rad], dwell, sweepSpeed }
 * Returns { segs, period }.
 */
export function buildTimeline(def) {
  const segs = [];
  if (def.kind === 'lookout') {
    const p = def.pts[0];
    const n = def.angles.length;
    const sweep = def.sweepSpeed || 1.1;
    for (let i = 0; i < n; i++) {
      const a0 = def.angles[i];
      const a1 = def.angles[(i + 1) % n];
      segs.push({ type: 'wait', x: p.x, z: p.z, a0, dur: def.dwell || 2 });
      const d = angDiff(a0, a1);
      if (Math.abs(d) > 1e-4) segs.push({ type: 'turn', x: p.x, z: p.z, a0, da: d, dur: Math.abs(d) / sweep });
    }
  } else {
    // Expand to a cyclic list of nodes; ping-pong walks out and back.
    let nodes = def.pts.map((p) => ({ x: p.x, z: p.z, wait: 0 }));
    if (def.kind === 'pingpong') {
      const back = def.pts.slice(1, -1).reverse().map((p) => ({ x: p.x, z: p.z, wait: 0 }));
      nodes[0].wait = def.wait || 0;
      nodes[nodes.length - 1].wait = def.wait || 0;
      nodes = nodes.concat(back);
    } else if (def.wait) {
      nodes[0].wait = def.wait;
    }
    const n = nodes.length;
    const heading = (i) => {
      const a = nodes[i];
      const b = nodes[(i + 1) % n];
      return Math.atan2(b.z - a.z, b.x - a.x);
    };
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      const b = nodes[(i + 1) % n];
      const h = heading(i);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      segs.push({ type: 'move', x: a.x, z: a.z, x1: b.x, z1: b.z, a0: h, dur: len / def.speed });
      if (b.wait > 0) segs.push({ type: 'wait', x: b.x, z: b.z, a0: h, dur: b.wait });
      const d = angDiff(h, heading((i + 1) % n));
      if (Math.abs(d) > 1e-4) segs.push({ type: 'turn', x: b.x, z: b.z, a0: h, da: d, dur: Math.abs(d) / TURN_SPEED });
    }
  }
  let t = 0;
  for (const s of segs) {
    s.t0 = t;
    t += s.dur;
  }
  return { segs, period: t };
}

/** Pose {x, z, ang, moving} of a timeline at time t (seconds). Writes into `out`. */
export function poseAt(tl, t, out = {}) {
  let u = t % tl.period;
  if (u < 0) u += tl.period;
  const segs = tl.segs;
  let lo = 0;
  let hi = segs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segs[mid].t0 <= u) lo = mid;
    else hi = mid - 1;
  }
  const s = segs[lo];
  const k = s.dur > 0 ? Math.min(1, (u - s.t0) / s.dur) : 0;
  if (s.type === 'move') {
    out.x = s.x + (s.x1 - s.x) * k;
    out.z = s.z + (s.z1 - s.z) * k;
    out.ang = s.a0;
    out.moving = true;
  } else if (s.type === 'turn') {
    out.x = s.x;
    out.z = s.z;
    out.ang = s.a0 + s.da * k;
    out.moving = false;
  } else {
    out.x = s.x;
    out.z = s.z;
    out.ang = s.a0;
    out.moving = false;
  }
  return out;
}
