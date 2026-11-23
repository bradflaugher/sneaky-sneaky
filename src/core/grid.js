// The room is a grid of 1x1 metre cells. World X = grid x, world Z = grid y.
// Cell (cx, cy) spans [cx, cx+1] x [cy, cy+1]; its centre is (cx+0.5, cy+0.5).

export const FLOOR = 0;
export const WALL = 1; // full height: blocks movement and all sight
export const COVER = 2; // waist high: blocks movement, hides a crouching agent

export function cellAt(room, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= room.w || cy >= room.h) return WALL;
  return room.cells[cy * room.w + cx];
}

export function isFloor(room, cx, cy) {
  return cellAt(room, cx, cy) === FLOOR;
}

export const DIRS4 = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/**
 * Grid DDA raycast. (dx, dz) must be normalised. Returns the distance at which
 * the ray is stopped, or maxDist if nothing is hit. Walls always stop the ray;
 * waist-high cover stops it only when `coverBlocks` is true (i.e. when looking
 * for something crouched).
 */
export function castRay(room, ox, oz, dx, dz, maxDist, coverBlocks) {
  let cx = Math.floor(ox);
  let cy = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dz > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMaxX = dx > 0 ? (cx + 1 - ox) / dx : dx < 0 ? (cx - ox) / dx : Infinity;
  let tMaxY = dz > 0 ? (cy + 1 - oz) / dz : dz < 0 ? (cy - oz) / dz : Infinity;
  const w = room.w;
  const h = room.h;
  const cells = room.cells;
  for (;;) {
    let t;
    if (tMaxX < tMaxY) {
      t = tMaxX;
      cx += stepX;
      tMaxX += tDeltaX;
    } else {
      t = tMaxY;
      cy += stepY;
      tMaxY += tDeltaY;
    }
    if (t >= maxDist) return maxDist;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return t;
    const c = cells[cy * w + cx];
    if (c === WALL || (coverBlocks && c === COVER)) return t;
  }
}

/** True when nothing blocks the straight line a -> b. */
export function hasLineOfSight(room, ax, az, bx, bz, coverBlocks) {
  const dx = bx - ax;
  const dz = bz - az;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  return castRay(room, ax, az, dx / d, dz / d, d, coverBlocks) >= d - 1e-6;
}

/** 4-connected BFS shortest path between floor cells; returns [{cx, cy}] or null. */
export function findPath(room, sx, sy, tx, ty) {
  const { w, h } = room;
  if (!isFloor(room, sx, sy) || !isFloor(room, tx, ty)) return null;
  const prev = new Int32Array(w * h).fill(-1);
  const start = sy * w + sx;
  const goal = ty * w + tx;
  prev[start] = start;
  const queue = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    if (cur === goal) break;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    for (const [dx, dy] of DIRS4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isFloor(room, nx, ny)) continue;
      const ni = ny * w + nx;
      if (prev[ni] !== -1) continue;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  if (prev[goal] === -1) return null;
  const path = [];
  for (let cur = goal; ; cur = prev[cur]) {
    const cx = cur % w;
    path.push({ cx, cy: (cur - cx) / w });
    if (cur === start) break;
  }
  return path.reverse();
}

/** Nearest floor cell to a world point (spiral search), for sending guards somewhere sensible. */
export function nearestFloorCell(room, x, z) {
  const cx = Math.floor(x);
  const cy = Math.floor(z);
  if (isFloor(room, cx, cy)) return { cx, cy };
  let best = null;
  let bestD = Infinity;
  for (let r = 1; r <= 3 && !best; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (!isFloor(room, cx + dx, cy + dy)) continue;
        const d = Math.hypot(cx + dx + 0.5 - x, cy + dy + 0.5 - z);
        if (d < bestD) {
          bestD = d;
          best = { cx: cx + dx, cy: cy + dy };
        }
      }
    }
  }
  return best;
}

/** ASCII dump, handy in tests and when debugging a seed. */
export function roomToAscii(room) {
  const rows = [];
  for (let y = 0; y < room.h; y++) {
    let row = '';
    for (let x = 0; x < room.w; x++) {
      const c = room.cells[y * room.w + x];
      row += c === WALL ? '#' : c === COVER ? 'o' : '.';
    }
    rows.push(row.split(''));
  }
  const put = (cx, cy, ch) => {
    if (rows[cy] && rows[cy][cx] !== undefined) rows[cy][cx] = ch;
  };
  for (const l of room.lasers) for (const c of l.cells) put(c.cx, c.cy, '|');
  for (const v of room.vents) {
    put(v.a.cx, v.a.cy, 'v');
    put(v.b.cx, v.b.cy, 'v');
  }
  for (const s of room.switches) put(s.cx, s.cy, 's');
  put(room.loot.cx, room.loot.cy, '$');
  put(room.exit.cx, room.exit.cy, 'X');
  put(room.start.cx, room.start.cy, '@');
  for (const g of room.guards) put(Math.floor(g.pts[0].x), Math.floor(g.pts[0].z), 'G');
  return rows.map((r) => r.join('')).join('\n');
}
