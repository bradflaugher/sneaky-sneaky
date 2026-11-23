// Ductwork routing. Every vent pair is joined by a visible overhead duct, and
// the thief crawls along exactly that path. Pure geometry, shared by the
// renderer (to build the duct), the game (to move the crawl) and the tests.

import { WALL, cellAt } from './grid.js';

/** Where a vent's grate sits on its wall face. */
export const gratePoint = (e) => ({ x: e.cx + 0.5 + e.dx * 0.5, z: e.cy + 0.5 + e.dy * 0.5 });

function wallCover(room, p, q) {
  const len = Math.hypot(q.x - p.x, q.z - p.z);
  let n = 0;
  for (let s = 0; s <= len; s += 0.5) {
    const k = len ? s / len : 0;
    if (cellAt(room, Math.floor(p.x + (q.x - p.x) * k), Math.floor(p.z + (q.z - p.z) * k)) === WALL) n++;
  }
  return n;
}

/**
 * The overhead duct for a vent: an axis-aligned L (or a straight run) from
 * grate A to grate B. Of the two possible elbows it takes the one that rides
 * along more wall-top, so ducts hug the architecture instead of crossing rooms.
 * Returns { points: [{x, z}, ...], length }.
 */
export function ductPath(room, vent) {
  const a = gratePoint(vent.a);
  const b = gratePoint(vent.b);
  const straight = Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.z - b.z) < 1e-6;
  let points;
  if (straight) points = [a, b];
  else {
    const c1 = { x: b.x, z: a.z }; // along X first
    const c2 = { x: a.x, z: b.z }; // along Z first
    const s1 = wallCover(room, a, c1) + wallCover(room, c1, b);
    const s2 = wallCover(room, a, c2) + wallCover(room, c2, b);
    points = [a, s2 > s1 ? c2 : c1, b];
  }
  return { points, length: Math.abs(a.x - b.x) + Math.abs(a.z - b.z) };
}

/**
 * The full crawl: floor cell -> grate -> along the duct -> grate -> floor cell.
 * `reverse` crawls from B to A.
 */
export function crawlRoute(room, vent, reverse = false) {
  const centre = (e) => ({ x: e.cx + 0.5, z: e.cy + 0.5 });
  const pts = [centre(vent.a), ...ductPath(room, vent).points, centre(vent.b)];
  return reverse ? pts.reverse() : pts;
}

/** Point at fraction k (0..1) of the way along a polyline, by arc length. */
export function pointAlong(points, k) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  let want = Math.max(0, Math.min(1, k)) * total;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    if (want <= seg || i === points.length - 1) {
      const u = seg ? Math.min(1, want / seg) : 0;
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * u, z: points[i - 1].z + (points[i].z - points[i - 1].z) * u };
    }
    want -= seg;
  }
  return { ...points[points.length - 1] };
}
