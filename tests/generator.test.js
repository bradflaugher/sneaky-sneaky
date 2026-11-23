import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRoom, patrolIsValid, guardCountFor } from '../src/core/generator.js';
import { FLOOR, WALL, COVER, cellAt, isFloor, roomToAscii } from '../src/core/grid.js';
import { solveTopology, solveStealth, STEP_DT } from '../src/core/solver.js';
import { poseAt, buildTimeline } from '../src/core/patrol.js';
import { canSee, isBumping } from '../src/core/stealth.js';
import { THEME_IDS } from '../src/core/themes.js';
import { floodFromStart, roomFromAscii } from './helpers.js';

const SEEDS_PER_THEME = 22; // 6 themes x 22 = 132 rooms
const rooms = [];
for (const theme of THEME_IDS) {
  for (let i = 0; i < SEEDS_PER_THEME; i++) {
    const level = 1 + (i % 9);
    rooms.push(generateRoom({ seed: `test-${theme}-${i}`, level, theme }));
  }
}
const label = (r) => `seed=${r.seed} level=${r.level}\n${roomToAscii(r)}`;

test(`generated ${rooms.length} rooms across all 6 themes`, () => {
  assert.ok(rooms.length >= 100);
  assert.deepEqual([...new Set(rooms.map((r) => r.themeId))].sort(), [...THEME_IDS].sort());
});

test('generation is deterministic for a seed', () => {
  for (const r of rooms.slice(0, 24)) {
    const again = generateRoom({ seed: r.seed, level: r.level, theme: r.themeId });
    assert.deepEqual(Array.from(again.cells), Array.from(r.cells));
    assert.deepEqual(again.start, r.start);
    assert.deepEqual(again.loot, r.loot);
    assert.equal(again.venue, r.venue);
    assert.deepEqual(again.vents, r.vents);
    assert.deepEqual(again.guards.map((g) => g.pts), r.guards.map((g) => g.pts));
  }
  const other = generateRoom({ seed: 'something-else', level: 3 });
  assert.notDeepEqual(Array.from(other.cells), Array.from(rooms[2].cells));
});

test('an unspecified theme is rolled from the seed, deterministically', () => {
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const a = generateRoom({ seed: `roll-${i}`, level: 1 });
    assert.equal(a.themeId, generateRoom({ seed: `roll-${i}`, level: 1 }).themeId);
    seen.add(a.themeId);
  }
  assert.equal(seen.size, 6, 'all six themes show up');
});

test('every room: sane geometry, border walls, spawn/loot/exit placement', () => {
  for (const r of rooms) {
    for (let x = 0; x < r.w; x++) {
      assert.equal(cellAt(r, x, 0), WALL);
      assert.equal(cellAt(r, x, r.h - 1), WALL);
    }
    for (let y = 0; y < r.h; y++) {
      assert.equal(cellAt(r, 0, y), WALL);
      assert.equal(cellAt(r, r.w - 1, y), WALL);
    }
    assert.ok(isFloor(r, r.start.cx, r.start.cy), label(r));
    assert.ok(isFloor(r, r.exit.cx, r.exit.cy), label(r));
    assert.equal(cellAt(r, r.loot.cx, r.loot.cy), COVER, 'loot sits on a pedestal');
    assert.ok(r.loot.info && r.loot.info.name && r.loot.item === r.loot.info.id, 'room has a heist target');
    assert.ok(r.venue && r.venue.length > 8, 'room has a venue name');
    assert.ok(r.chambers.length >= 2);
    assert.ok(r.start.cx !== r.exit.cx || r.start.cy !== r.exit.cy);
    assert.ok(r.par > 0);
  }
});

test('every room: all floor is connected (cover never seals anything off)', () => {
  for (const r of rooms) {
    const seen = floodFromStart(r);
    for (let i = 0; i < r.cells.length; i++) {
      if (r.cells[i] === FLOOR) assert.ok(seen[i], `unreachable floor cell\n${label(r)}`);
    }
  }
});

test('every room: topologically solvable (loot -> exit with vents/switches)', () => {
  for (const r of rooms) assert.ok(solveTopology(r).ok, label(r));
});

test('every room: a perfect-ghost route exists (re-verified independently)', () => {
  for (const r of rooms) {
    const guards = r.guards.map((g) => ({ timeline: buildTimeline(g), vis: g.vis }));
    const res = solveStealth(r, guards);
    assert.ok(res.ok, `no ghost route\n${label(r)}`);
    assert.equal(res.steps, r.ghostSteps);
  }
});

test('ghost routes survive continuous replay against real guard vision', () => {
  let replayed = 0;
  for (const r of rooms) {
    if (!r.guards.length) continue;
    const res = solveStealth(r, r.guards, { wantPath: true });
    assert.ok(res.ok && res.path.length > 1);
    replayed++;
    const pose = {};
    for (let i = 0; i < res.path.length - 1; i++) {
      const a = res.path[i];
      const b = res.path[i + 1];
      if (b.vent) continue; // inside the ducts: invisible
      assert.ok(Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy) <= 1, 'route moves one cell at a time');
      assert.equal(b.step, a.step + 1);
      for (let s = 0; s <= 8; s++) {
        const k = s / 8;
        const t = (a.step + k) * STEP_DT;
        const px = a.cx + 0.5 + (b.cx - a.cx) * k;
        const pz = a.cy + 0.5 + (b.cy - a.cy) * k;
        for (const g of r.guards) {
          poseAt(g.timeline, t, pose);
          assert.ok(!canSee(r, pose, px, pz, true, g.vis), `seen at t=${t.toFixed(2)} (${px},${pz})\n${label(r)}`);
          assert.ok(!isBumping(r, pose, px, pz), `bumped a guard at t=${t.toFixed(2)}\n${label(r)}`);
        }
      }
    }
    const end = res.path[res.path.length - 1];
    assert.deepEqual([end.cx, end.cy], [r.exit.cx, r.exit.cy]);
    assert.ok(end.flags & 1, 'arrives carrying the loot');
  }
  assert.ok(replayed >= 100, `replayed ${replayed}`);
});

test('vents: grates sit on real walls, link different chambers, and connect floor to floor', () => {
  let count = 0;
  for (const r of rooms) {
    assert.ok(r.vents.length >= 1, 'every room has at least one vent');
    for (const v of r.vents) {
      count++;
      for (const e of [v.a, v.b]) {
        assert.ok(isFloor(r, e.cx, e.cy), label(r));
        assert.equal(cellAt(r, e.cx + e.dx, e.cy + e.dy), WALL, 'grate is mounted on a wall');
        assert.equal(Math.abs(e.dx) + Math.abs(e.dy), 1);
        const c = r.chambers[e.chamber];
        assert.ok(e.cx >= c.x && e.cx < c.x + c.w && e.cy >= c.y && e.cy < c.y + c.h);
      }
      assert.notEqual(v.a.chamber, v.b.chamber);
      assert.ok(v.time > 0.5 && v.time < 6);
    }
    const spots = [...r.vents.flatMap((v) => [v.a, v.b]), ...r.switches].map((e) => `${e.cx},${e.cy}`);
    assert.equal(new Set(spots).size, spots.length, 'no two gadgets share a cell');
  }
  assert.ok(count >= rooms.length);
});

test('a vent is the only way through when the doorway is walled off', () => {
  const room = roomFromAscii(['#########', '#...#...#', '#...#...#', '#...#...#', '#########']);
  Object.assign(room, {
    start: { cx: 1, cy: 1, x: 1.5, z: 1.5 },
    exit: { cx: 1, cy: 3, x: 1.5, z: 3.5 },
    loot: { cx: 6, cy: 2, x: 6.5, z: 2.5 },
  });
  room.cells[2 * room.w + 6] = COVER;
  assert.equal(solveTopology(room).ok, false);
  room.vents.push({ a: { cx: 3, cy: 2, dx: 1, dy: 0 }, b: { cx: 5, cy: 2, dx: -1, dy: 0 }, len: 2, time: 1.2 });
  assert.equal(solveTopology(room).ok, true);
  assert.equal(solveStealth(room, []).ok, true);
});

test('lasers block until their switch is flipped', () => {
  const room = roomFromAscii(['#########', '#...#...#', '#.......#', '#...#...#', '#########']);
  Object.assign(room, {
    start: { cx: 1, cy: 1, x: 1.5, z: 1.5 },
    exit: { cx: 1, cy: 3, x: 1.5, z: 3.5 },
    loot: { cx: 6, cy: 2, x: 6.5, z: 2.5 },
  });
  room.cells[2 * room.w + 6] = COVER;
  room.lasers.push({ cells: [{ cx: 4, cy: 2 }] });
  assert.equal(solveTopology(room).ok, false, 'no switch: beam is impassable');
  room.switches.push({ cx: 7, cy: 3, dx: 1, dy: 0, laser: 0 });
  assert.equal(solveTopology(room).ok, false, 'switch behind the beam is useless');
  room.switches[0] = { cx: 3, cy: 3, dx: 1, dy: 0, laser: 0 };
  assert.equal(solveTopology(room).ok, true);
  assert.equal(solveStealth(room, []).ok, true);
});

test('a lookout staring down a corridor forever makes it unsolvable; looking away opens a window', () => {
  const room = roomFromAscii(['############', '#..........#', '############']);
  Object.assign(room, {
    start: { cx: 1, cy: 1, x: 1.5, z: 1.5 },
    exit: { cx: 1, cy: 1, x: 1.5, z: 1.5 },
    loot: { cx: 6, cy: 0, x: 6.5, z: 0.5 },
  });
  const stare = { kind: 'lookout', pts: [{ x: 10.5, z: 1.5 }], angles: [Math.PI, Math.PI + 0.01], dwell: 2, vis: { range: 6, half: 0.5 } };
  stare.timeline = buildTimeline(stare);
  assert.equal(solveStealth(room, [stare]).ok, false);
  const away = { kind: 'lookout', pts: [{ x: 10.5, z: 1.5 }], angles: [0, 0.01], dwell: 2, vis: { range: 6, half: 0.5 } };
  away.timeline = buildTimeline(away);
  assert.equal(solveStealth(room, [away]).ok, true);
});

test('lasers and switches are paired and switches are wall-mounted', () => {
  let lasers = 0;
  for (const r of rooms) {
    assert.equal(r.lasers.length, r.switches.length);
    r.switches.forEach((s) => {
      assert.ok(isFloor(r, s.cx, s.cy));
      assert.equal(cellAt(r, s.cx + s.dx, s.cy + s.dy), WALL);
      assert.ok(r.lasers[s.laser]);
    });
    for (const l of r.lasers) {
      lasers++;
      assert.equal(l.cells.length, 2);
      for (const c of l.cells) assert.ok(isFloor(r, c.cx, c.cy));
    }
    if (r.level === 1) assert.equal(r.lasers.length, 0, 'no lasers in the first room');
  }
  assert.ok(lasers >= 20, `expected plenty of laser rooms, got ${lasers}`);
});

test('guards: valid patrols that stay on open floor and never watch the spawn', () => {
  const kinds = new Set();
  let total = 0;
  for (const r of rooms) {
    assert.ok(r.guards.length <= guardCountFor(r.level));
    for (const g of r.guards) {
      total++;
      kinds.add(g.kind);
      assert.ok(patrolIsValid(r, g), label(r));
      assert.ok(g.timeline.period > 1);
      assert.ok(g.vis.range > 5 && g.vis.half > 0.3 && g.vis.half < 0.7);
      const pose = {};
      for (let t = 0; t < g.timeline.period; t += 0.1) {
        poseAt(g.timeline, t, pose);
        assert.ok(isFloor(r, Math.floor(pose.x), Math.floor(pose.z)), `guard left the floor\n${label(r)}`);
        assert.ok(!canSee(r, pose, r.start.x, r.start.z, false, g.vis), `guard can see the spawn\n${label(r)}`);
      }
    }
  }
  assert.deepEqual([...kinds].sort(), ['lookout', 'loop', 'pingpong']);
  assert.ok(total >= rooms.length * 1.5, `rooms should be well guarded, got ${total} guards`);
});

test('difficulty ramps: later rooms are bigger and busier', () => {
  const avg = (lv, f) => {
    const rs = rooms.filter((r) => r.level === lv);
    return rs.reduce((s, r) => s + f(r), 0) / rs.length;
  };
  assert.ok(avg(7, (r) => r.w * r.h) > avg(1, (r) => r.w * r.h));
  assert.ok(avg(7, (r) => r.guards.length) > avg(1, (r) => r.guards.length));
  assert.ok(avg(7, (r) => r.chambers.length) > avg(1, (r) => r.chambers.length));
});
