import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRoom, LAYOUT_STYLES, layoutStyleFor, patrolIsValid } from '../src/core/generator.js';
import { FLOOR, WALL, cellAt, roomToAscii } from '../src/core/grid.js';
import { solveTopology, solveStealth } from '../src/core/solver.js';
import { buildTimeline } from '../src/core/patrol.js';
import { resolveMods, PRESET_IDS } from '../src/core/difficulty.js';
import { THEME_IDS } from '../src/core/themes.js';
import { ductPath } from '../src/core/ducts.js';
import { floodFromStart } from './helpers.js';

const LEVELS = [1, 2, 3, 5, 8, 11, 15, 20];
const PER_LEVEL = 3;
const rooms = [];
for (const layout of LAYOUT_STYLES) {
  LEVELS.forEach((level, li) => {
    for (let i = 0; i < PER_LEVEL; i++) {
      const n = li * PER_LEVEL + i;
      const mods = resolveMods({ difficulty: PRESET_IDS[n % PRESET_IDS.length] });
      const t0 = performance.now();
      const room = generateRoom({ seed: `layout-${layout}-${n}`, level, layout, theme: THEME_IDS[n % THEME_IDS.length], mods });
      rooms.push({ layout, room, ms: performance.now() - t0 });
    }
  });
}
const of = (layout) => rooms.filter((r) => r.layout === layout).map((r) => r.room);
const label = (r) => `${r.layoutStyle} seed=${r.seed} level=${r.level}\n${roomToAscii(r)}`;
const inRect = (c, x, y) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h;

test('four architectural layout styles', () => {
  assert.deepEqual(LAYOUT_STYLES, ['classic', 'atrium', 'wing', 'corridor']);
  assert.equal(rooms.length, LAYOUT_STYLES.length * LEVELS.length * PER_LEVEL);
});

test('a requested style is the style that gets built, at every size', () => {
  for (const { layout, room } of rooms) assert.equal(room.layoutStyle, layout, label(room));
});

test('the style is rolled deterministically from the seed, and every style comes up', () => {
  const tally = Object.fromEntries(LAYOUT_STYLES.map((s) => [s, 0]));
  for (let i = 0; i < 400; i++) {
    const style = layoutStyleFor(`roll-${i}`, 1 + (i % 12));
    assert.equal(style, layoutStyleFor(`roll-${i}`, 1 + (i % 12)));
    tally[style]++;
  }
  for (const s of LAYOUT_STYLES) assert.ok(tally[s] >= 50, `${s} rolled only ${tally[s]} times in 400`);
  for (let i = 0; i < 12; i++) {
    const a = generateRoom({ seed: `style-${i}`, level: 3 });
    assert.equal(a.layoutStyle, layoutStyleFor(`style-${i}`, 3), 'an unspecified layout is the seed roll');
    const b = generateRoom({ seed: `style-${i}`, level: 3 });
    assert.equal(b.layoutStyle, a.layoutStyle);
    assert.deepEqual(Array.from(b.cells), Array.from(a.cells));
  }
  // the roll belongs to the seed alone: theme and difficulty never change the floor plan style
  assert.equal(generateRoom({ seed: 'style-0', level: 3, theme: 'casino', mods: resolveMods({ difficulty: 'master' }) }).layoutStyle, layoutStyleFor('style-0', 3));
  assert.equal(generateRoom({ seed: 'style-0', level: 3, layout: 'not-a-style' }).layoutStyle, layoutStyleFor('style-0', 3), 'an unknown style falls back to the roll');
});

test('forcing a style is deterministic too, and different styles give different rooms', () => {
  const plans = LAYOUT_STYLES.map((layout) => {
    const a = generateRoom({ seed: 'same-seed', level: 5, layout });
    const b = generateRoom({ seed: 'same-seed', level: 5, layout });
    assert.deepEqual(Array.from(a.cells), Array.from(b.cells));
    assert.deepEqual(a.guards.map((g) => g.pts), b.guards.map((g) => g.pts));
    return roomToAscii(a);
  });
  assert.equal(new Set(plans).size, LAYOUT_STYLES.length);
});

test('every style: chambers tile the floor, walls on the border, all floor connected', () => {
  for (const { room: r } of rooms) {
    for (let x = 0; x < r.w; x++) assert.ok(cellAt(r, x, 0) === WALL && cellAt(r, x, r.h - 1) === WALL);
    for (let y = 0; y < r.h; y++) assert.ok(cellAt(r, 0, y) === WALL && cellAt(r, r.w - 1, y) === WALL);
    assert.ok(r.chambers.length >= 2);
    // chambers never overlap or touch: there is always a wall between two of them
    r.chambers.forEach((a, i) => {
      for (const b of r.chambers.slice(i + 1)) {
        const apart = a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y;
        assert.ok(apart, `chambers touch\n${label(r)}`);
      }
    });
    const doorCells = new Set(r.doors.flatMap((d) => d.cells.map((c) => c.cy * r.w + c.cx)));
    const seen = floodFromStart(r);
    for (let i = 0; i < r.cells.length; i++) {
      const x = i % r.w;
      const y = Math.floor(i / r.w);
      const inChamber = r.chambers.some((c) => inRect(c, x, y));
      if (r.cells[i] === FLOOR) {
        assert.ok(seen[i], `unreachable floor\n${label(r)}`);
        assert.ok(inChamber || doorCells.has(i), `floor outside any chamber or doorway\n${label(r)}`);
      } else if (r.cells[i] === WALL) assert.ok(!inChamber, `wall inside a chamber\n${label(r)}`);
    }
  }
});

test('every style: 100% verified by solveTopology and solveStealth', () => {
  for (const { room: r } of rooms) {
    assert.ok(solveTopology(r).ok, label(r));
    const res = solveStealth(r, r.guards.map((g) => ({ timeline: buildTimeline(g), vis: g.vis })));
    assert.ok(res.ok, `no perfect-ghost route\n${label(r)}`);
    assert.equal(res.steps, r.ghostSteps);
    assert.ok(r.par > 0);
    for (const g of r.guards) assert.ok(patrolIsValid(r, g), label(r));
    assert.ok(r.vents.length >= 1);
    for (const v of r.vents) assert.notEqual(v.a.chamber, v.b.chamber);
  }
});

test('every style stays well guarded and generates fast', () => {
  for (const layout of LAYOUT_STYLES) {
    const mine = rooms.filter((r) => r.layout === layout);
    const guards = mine.reduce((n, r) => n + r.room.guards.length, 0);
    assert.ok(guards >= mine.length * 2.5, `${layout}: only ${guards} guards in ${mine.length} rooms`);
    const avg = mine.reduce((n, r) => n + r.ms, 0) / mine.length;
    assert.ok(avg < 1500, `${layout}: average ${Math.round(avg)} ms per room`);
    assert.ok(Math.max(...mine.map((r) => r.ms)) < 6000, `${layout}: slowest room`);
    const big = mine.filter((r) => r.room.level >= 10);
    const small = mine.filter((r) => r.room.level <= 2);
    const mean = (rs, f) => rs.reduce((n, r) => n + f(r.room), 0) / rs.length;
    assert.ok(mean(big, (r) => r.chambers.length) > mean(small, (r) => r.chambers.length), `${layout}: bigger tiers have more chambers`);
  }
});

test('classic: a plain BSP, no hall, no spine, no carved corners', () => {
  for (const r of of('classic')) {
    assert.deepEqual(r.voids, []);
    assert.ok(r.chambers.every((c) => !c.role));
  }
});

test('atrium: one generous grand hall in the middle, chambers either side of it', () => {
  let ringed = 0;
  for (const r of of('atrium')) {
    const halls = r.chambers.filter((c) => c.role === 'hall');
    assert.equal(halls.length, 1, label(r));
    const hall = halls[0];
    assert.ok(hall.w >= 7 && hall.h >= 9, `hall is ${hall.w}x${hall.h}\n${label(r)}`);
    const biggest = Math.max(...r.chambers.map((c) => c.w * c.h));
    assert.equal(hall.w * hall.h, biggest, `the hall is the largest chamber\n${label(r)}`);
    // central: it holds the middle of the plan and never touches the side walls
    assert.ok(inRect(hall, Math.floor(r.w / 2), Math.floor(r.h / 2)), label(r));
    assert.ok(hall.x >= 7 && hall.x + hall.w <= r.w - 7, label(r));
    assert.ok(r.chambers.some((c) => c.x + c.w < hall.x) && r.chambers.some((c) => c.x > hall.x + hall.w), 'flanks on both sides');
    const ring = hall.y > 1 && hall.y + hall.h < r.h - 1;
    if (ring) {
      ringed++;
      assert.ok(r.chambers.some((c) => c.y + c.h < hall.y) && r.chambers.some((c) => c.y > hall.y + hall.h), 'chambers above and below');
    }
    // the hall is a hub: at least two ways in
    const hi = r.chambers.indexOf(hall);
    assert.ok(r.doors.filter((d) => d.a === hi || d.b === hi).length >= 2, label(r));
  }
  assert.ok(ringed >= 5, `big footprints ring the hall on all four sides (${ringed})`);
  assert.ok(ringed < of('atrium').length, 'small footprints run the hall wall to wall instead');
});

test('wing: an L-shaped or stepped footprint with solid mass in an outer corner', () => {
  let stepped = 0;
  for (const r of of('wing')) {
    assert.ok(r.voids.length >= 1 && r.voids.length <= 2, label(r));
    if (r.voids.length === 2) stepped++;
    for (const v of r.voids) {
      assert.ok(v.w >= 5 && v.h >= 5, `void is ${v.w}x${v.h}`);
      for (let y = v.y; y < v.y + v.h; y++) for (let x = v.x; x < v.x + v.w; x++) assert.equal(cellAt(r, x, y), WALL, `void is not solid\n${label(r)}`);
      // it sits in an outer corner of the footprint
      const corner = (v.x === 1 || v.x + v.w === r.w - 1) && (v.y === 1 || v.y + v.h === r.h - 1);
      assert.ok(corner, `void is not in a corner\n${label(r)}`);
      assert.ok(!r.chambers.some((c) => c.x < v.x + v.w && v.x < c.x + c.w && c.y < v.y + v.h && v.y < c.y + c.h), 'no chamber inside the void');
    }
    // not a plain rectangle: the floor's bounding box has an empty corner
    const corners = [
      [1, 1],
      [r.w - 2, 1],
      [1, r.h - 2],
      [r.w - 2, r.h - 2],
    ];
    assert.ok(corners.some(([x, y]) => cellAt(r, x, y) === WALL), label(r));
    assert.ok(corners.some(([x, y]) => cellAt(r, x, y) !== WALL), label(r));
    const floorArea = r.chambers.reduce((n, c) => n + c.w * c.h, 0);
    assert.ok(floorArea < (r.w - 2) * (r.h - 2) * 0.9, 'a real bite out of the plan');
    // ducts stay inside the building, whatever its outline
    for (const v of r.vents) for (const p of ductPath(r, v).points) assert.ok(p.x >= 0 && p.x <= r.w && p.z >= 0 && p.z <= r.h);
  }
  assert.ok(stepped >= 3, `wide footprints get a second step (${stepped})`);
  assert.ok(stepped < of('wing').length, 'small ones stay a simple L');
});

test('corridor: a central spine with chambers off both sides, each opening onto it, and ducts across it', () => {
  for (const r of of('corridor')) {
    const spines = r.chambers.filter((c) => c.role === 'spine');
    assert.equal(spines.length, 1, label(r));
    const spine = spines[0];
    const si = r.chambers.indexOf(spine);
    assert.ok(spine.h >= 2 && spine.h <= 3, 'a corridor, not a room');
    assert.deepEqual([spine.x, spine.w], [1, r.w - 2], 'it runs wall to wall');
    const mid = spine.y + spine.h / 2;
    assert.ok(mid > r.h * 0.3 && mid < r.h * 0.7, `spine is central (y=${mid} of ${r.h})\n${label(r)}`);
    const north = r.chambers.filter((c) => c.role === 'north');
    const south = r.chambers.filter((c) => c.role === 'south');
    assert.ok(north.length >= 1 && south.length >= 1);
    assert.equal(north.length + south.length + 1, r.chambers.length);
    for (const c of north) assert.ok(c.y + c.h <= spine.y - 1);
    for (const c of south) assert.ok(c.y >= spine.y + spine.h + 1);
    // every chamber that borders the spine has its own doorway onto it
    r.chambers.forEach((c, i) => {
      if (i === si) return;
      const touches = c.y + c.h === spine.y - 1 || c.y === spine.y + spine.h + 1;
      const door = r.doors.some((d) => (d.a === i && d.b === si) || (d.a === si && d.b === i));
      assert.equal(door, touches, `chamber ${i}\n${label(r)}`);
    });
    // cross-corridor HVAC: at least one duct links a north chamber to a south one
    const role = (i) => r.chambers[i].role;
    const crossing = r.vents.filter((v) => new Set([role(v.a.chamber), role(v.b.chamber)]).size === 2 && ![role(v.a.chamber), role(v.b.chamber)].includes('spine'));
    assert.ok(crossing.length >= 1, `no duct crosses the corridor\n${label(r)}`);
    for (const v of crossing) {
      const zs = [v.a.cy, v.b.cy];
      assert.ok(Math.min(...zs) < spine.y && Math.max(...zs) >= spine.y + spine.h, 'its grates are on opposite sides of the spine');
    }
  }
});
