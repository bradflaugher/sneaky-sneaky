import { FLOOR, WALL, COVER } from '../src/core/grid.js';

/** Build a tiny room from ASCII art: '#' wall, 'o' cover, '.' floor. */
export function roomFromAscii(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const cells = new Uint8Array(w * h);
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) cells[y * w + x] = row[x] === '#' ? WALL : row[x] === 'o' ? COVER : FLOOR;
  });
  return { w, h, cells, lasers: [], vents: [], switches: [], guards: [] };
}

export function floodFromStart(room) {
  const seen = new Uint8Array(room.w * room.h);
  const q = [room.start.cy * room.w + room.start.cx];
  seen[q[0]] = 1;
  for (let qi = 0; qi < q.length; qi++) {
    const cx = q[qi] % room.w;
    const cy = Math.floor(q[qi] / room.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= room.w || ny >= room.h) continue;
      const i = ny * room.w + nx;
      if (seen[i] || room.cells[i] !== FLOOR) continue;
      seen[i] = 1;
      q.push(i);
    }
  }
  return seen;
}
