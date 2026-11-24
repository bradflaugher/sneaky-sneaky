import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import { generateLoot, rollMission, MISSION_VERBS, MISSION_CATEGORIES, PROP_SHAPES } from '../src/core/loot.js';
import { generateRoom } from '../src/core/generator.js';
import { ductPath, crawlRoute, pointAlong, gratePoint } from '../src/core/ducts.js';
import { resolveMods, PRESET_IDS } from '../src/core/difficulty.js';
import { THEME_IDS } from '../src/core/themes.js';
import { WALL, cellAt, isFloor } from '../src/core/grid.js';
import { recordLoot, vaultEntries } from '../src/game/save.js';

// ------------------------------------------------------------ missions

test('twelve mission verbs in three pacifist categories', () => {
  assert.deepEqual(Object.keys(MISSION_CATEGORIES), ['intel', 'recovery', 'tinker']);
  const by = (c) => MISSION_VERBS.filter((v) => v.category === c).map((v) => v.verb);
  assert.deepEqual(by('intel'), ['PHOTOGRAPH', 'COPY', 'DECRYPT', 'SCAN']);
  assert.deepEqual(by('recovery'), ['RETRIEVE', 'RESCUE', 'RECOVER', 'RETURN']);
  assert.deepEqual(by('tinker'), ['SWAP', 'RECALIBRATE', 'VERIFY', 'INSPECT']);
  for (const v of MISSION_VERBS) {
    assert.match(v.verb, /^[A-Z]{4,11}$/, 'fits the action button');
    assert.match(v.past, /^[A-Z]+ED$/);
    assert.match(v.sfx, /^[A-Z ]+!$/);
    assert.ok(v.carrying.length > 3);
    assert.ok(!/STEAL|LOOT|ROB|HEIST/.test(v.verb + v.past), 'no thieving verbs');
  }
  assert.equal(MISSION_CATEGORIES.recovery.takes, true, 'recoveries leave with the object');
  assert.equal(MISSION_CATEGORIES.intel.takes, false, 'intel jobs leave it where it was');
  assert.equal(MISSION_CATEGORIES.tinker.takes, false);
});

test('every target rolls a valid mission, deterministically, with every verb in play', () => {
  const verbs = new Map();
  const cats = new Map();
  for (const theme of THEME_IDS)
    for (let i = 0; i < 300; i++) {
      const loot = generateLoot(new RNG(`mission-${theme}-${i}`), theme);
      const m = loot.mission;
      const def = MISSION_VERBS.find((v) => v.verb === m.verb);
      assert.ok(def, `unknown verb ${m.verb}`);
      assert.equal(m.past, def.past);
      assert.equal(m.category, def.category);
      assert.equal(m.takes, MISSION_CATEGORIES[m.category].takes);
      assert.deepEqual(generateLoot(new RNG(`mission-${theme}-${i}`), theme).mission, m);
      verbs.set(m.verb, (verbs.get(m.verb) || 0) + 1);
      cats.set(m.category, (cats.get(m.category) || 0) + 1);
    }
  assert.equal(verbs.size, 12, 'all twelve verbs turn up');
  for (const [c, n] of cats) assert.ok(n > THEME_IDS.length * 300 * 0.2, `${c} is too rare: ${n}`);
});

test('objects lean towards jobs that suit them', () => {
  const share = (shape, category) => {
    let n = 0;
    for (let i = 0; i < 600; i++) if (rollMission(new RNG(`bias-${shape}-${i}`), shape).category === category) n++;
    return n / 600;
  };
  assert.ok(share('floppy', 'intel') > 0.5, 'you decrypt a floppy disk');
  assert.ok(share('frog', 'recovery') > 0.5, 'you rescue a frog');
  assert.ok(share('toaster', 'tinker') > 0.5, 'you recalibrate a toaster');
  for (const shape of PROP_SHAPES) for (const c of ['intel', 'recovery', 'tinker']) assert.ok(share(shape, c) > 0.05, `${shape} can still be a ${c} job`);
});

test('rooms carry their mission, and difficulty never changes it', () => {
  for (let i = 0; i < 18; i++) {
    const a = generateRoom({ seed: `mroom-${i}`, level: 1 + (i % 4), theme: THEME_IDS[i % THEME_IDS.length] });
    const b = generateRoom({ seed: `mroom-${i}`, level: 1 + (i % 4), theme: THEME_IDS[i % THEME_IDS.length], mods: resolveMods({ difficulty: 'master' }) });
    assert.ok(a.loot.info.mission.verb);
    assert.deepEqual(a.loot.info.mission, b.loot.info.mission);
    assert.equal(a.loot.info.name, b.loot.info.name);
  }
});

test('case files record what was done, not just what was taken', () => {
  const save = { vault: {}, stats: { heists: 0 } };
  const loot = generateLoot(new RNG('file-1'), 'lab');
  recordLoot(save, loot, 'S', { venue: 'Sub-Level 9', sector: 3, theme: 'lab' });
  const [entry] = vaultEntries(save);
  assert.equal(entry.verb, loot.mission.past);
  assert.equal(entry.name, loot.name);
});

// ------------------------------------------------------------ ductwork

const rooms = [];
for (const theme of THEME_IDS) for (let i = 0; i < 12; i++) rooms.push(generateRoom({ seed: `duct-${theme}-${i}`, level: 1 + (i % 12), theme }));

test('Room 1 always has ductwork, on every difficulty and in every setting', () => {
  let n = 0;
  for (const difficulty of PRESET_IDS)
    for (const theme of THEME_IDS)
      for (let i = 0; i < 10; i++) {
        const r = generateRoom({ seed: `first-${difficulty}-${theme}-${i}`, level: 1, theme, mods: resolveMods({ difficulty }) });
        assert.ok(r.vents.length >= 1, `no vent in a first room (${difficulty}/${theme}/${i})`);
        assert.ok(ductPath(r, r.vents[0]).length >= 1, 'the duct spans at least the wall it passes through');
        n++;
      }
  assert.equal(n, PRESET_IDS.length * THEME_IDS.length * 10);
});

test('every vent has a duct: axis-aligned, grate to grate, Manhattan length', () => {
  let ducts = 0;
  let elbows = 0;
  for (const r of rooms)
    for (const v of r.vents) {
      ducts++;
      const d = ductPath(r, v);
      const a = gratePoint(v.a);
      const b = gratePoint(v.b);
      assert.deepEqual(d.points[0], a);
      assert.deepEqual(d.points[d.points.length - 1], b);
      assert.ok(d.points.length === 2 || d.points.length === 3);
      if (d.points.length === 3) elbows++;
      let len = 0;
      for (let i = 1; i < d.points.length; i++) {
        const p = d.points[i - 1];
        const q = d.points[i];
        assert.ok(Math.abs(p.x - q.x) < 1e-9 || Math.abs(p.z - q.z) < 1e-9, 'every run is axis-aligned');
        len += Math.hypot(p.x - q.x, p.z - q.z);
      }
      assert.ok(Math.abs(len - d.length) < 1e-9 && Math.abs(d.length - (Math.abs(a.x - b.x) + Math.abs(a.z - b.z))) < 1e-9);
      for (const p of d.points) assert.ok(p.x >= 0 && p.z >= 0 && p.x <= r.w && p.z <= r.h, 'ducts stay over the building');
      // grates really are on wall faces
      for (const e of [v.a, v.b]) assert.equal(cellAt(r, e.cx + e.dx, e.cy + e.dy), WALL);
      assert.deepEqual(ductPath(r, v), d, 'routing is deterministic');
    }
  assert.ok(ducts >= rooms.length && elbows > ducts * 0.5, `${ducts} ducts, ${elbows} with an elbow`);
});

test('the crawl follows the duct from floor to floor, both ways', () => {
  for (const r of rooms)
    for (const v of r.vents) {
      const fwd = crawlRoute(r, v, false);
      const back = crawlRoute(r, v, true);
      assert.deepEqual(back, [...fwd].reverse());
      assert.deepEqual(fwd[0], { x: v.a.cx + 0.5, z: v.a.cy + 0.5 });
      assert.deepEqual(fwd[fwd.length - 1], { x: v.b.cx + 0.5, z: v.b.cy + 0.5 });
      assert.ok(isFloor(r, v.a.cx, v.a.cy) && isFloor(r, v.b.cx, v.b.cy));
      assert.deepEqual(fwd.slice(1, -1), ductPath(r, v).points, 'the middle of the crawl IS the duct');
      assert.deepEqual(pointAlong(fwd, 0), fwd[0]);
      assert.deepEqual(pointAlong(fwd, 1), fwd[fwd.length - 1]);
      // moving along it never jumps, and never leaves the route
      let prev = pointAlong(fwd, 0);
      let total = 0;
      for (let i = 1; i < fwd.length; i++) total += Math.hypot(fwd[i].x - fwd[i - 1].x, fwd[i].z - fwd[i - 1].z);
      for (let k = 0.01; k <= 1.0001; k += 0.01) {
        const p = pointAlong(fwd, k);
        assert.ok(Math.hypot(p.x - prev.x, p.z - prev.z) <= total * 0.0101 + 1e-9, 'smooth');
        const onRoute = fwd.some((q, i) => i > 0 && Math.abs(Math.hypot(p.x - q.x, p.z - q.z) + Math.hypot(p.x - fwd[i - 1].x, p.z - fwd[i - 1].z) - Math.hypot(q.x - fwd[i - 1].x, q.z - fwd[i - 1].z)) < 1e-6);
        assert.ok(onRoute, 'on the route');
        prev = p;
      }
    }
});

test('ducts prefer to ride along wall tops', () => {
  const room = { w: 8, h: 6, cells: new Uint8Array(48).fill(0) };
  for (let x = 0; x < 8; x++) room.cells[0 * 8 + x] = WALL; // a wall along the top edge
  const vent = { a: { cx: 1, cy: 1, dx: 0, dy: -1 }, b: { cx: 6, cy: 4, dx: 1, dy: 0 } };
  room.cells[4 * 8 + 7] = WALL;
  const d = ductPath(room, vent);
  assert.deepEqual(d.points[1], { x: 7, z: 1 }, 'runs along the top wall first, then turns');
});
