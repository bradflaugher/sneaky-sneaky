import test from 'node:test';
import assert from 'node:assert/strict';
import { infiniteRoom, infiniteTier, bagDraw, describeInfinite, INFINITE_MODS, INFINITE_TIER_CAP } from '../src/core/infinite.js';
import { generateRoom, LAYOUT_STYLES, MAX_SIZE_TIER } from '../src/core/generator.js';
import { solveTopology, solveStealth } from '../src/core/solver.js';
import { buildTimeline } from '../src/core/patrol.js';
import { FLOOR, roomToAscii } from '../src/core/grid.js';
import { THEME_IDS } from '../src/core/themes.js';
import { DEFAULT_SETUP, PRESET_IDS, RUN_MODES, resolveMods, modeFromParams, modeToParams, gameTypeOf, setupFromParams, setupToParams, describeRun } from '../src/core/difficulty.js';
import { floodFromStart } from './helpers.js';

const SEEDS = ['velvet-otter-123', 'quiet-moth-777', 'A', '', '∞ seed with spaces'];

// ------------------------------------------------------------ URL params

test('two run modes; ?mode=infinite selects Endless Run and anything else is the mission flow', () => {
  assert.deepEqual(RUN_MODES, ['mission', 'infinite']);
  const from = (q) => modeFromParams(new URLSearchParams(q));
  assert.equal(from(''), 'mission');
  assert.equal(from('mode=infinite'), 'infinite');
  assert.equal(from('mode=INFINITE'), 'infinite');
  assert.equal(from('mode=endless'), 'infinite', 'a friendly alias');
  assert.equal(from('mode=mission'), 'mission');
  assert.equal(from('mode=banana'), 'mission');
  assert.equal(from('mode='), 'mission');
  assert.equal(from('seed=abc&diff=shadow'), 'mission');
  assert.equal(modeFromParams(new URLSearchParams(''), 'infinite'), 'infinite', 'falls back to the given base when the param is absent');
  assert.equal(modeFromParams(new URLSearchParams('mode=mission'), 'infinite'), 'mission', 'an explicit param beats the base');
});

test('the mode survives a round trip through a shareable ?mode=infinite&seed=... link', () => {
  assert.equal(modeToParams('mission').toString(), '', 'the default mode leaves the URL clean');
  assert.equal(modeToParams('infinite').toString(), 'mode=infinite');
  for (const mode of RUN_MODES) assert.equal(modeFromParams(modeToParams(mode)), mode);
  const p = new URLSearchParams('seed=velvet-otter-123&diff=shadow');
  modeToParams('infinite', p);
  assert.equal(p.toString(), 'seed=velvet-otter-123&diff=shadow&mode=infinite', 'seed and setup params are preserved');
  assert.equal(p.get('seed'), 'velvet-otter-123');
  assert.equal(setupFromParams(p).difficulty, 'shadow', 'mode and setup params coexist');
  setupToParams(DEFAULT_SETUP, p);
  assert.equal(p.toString(), 'seed=velvet-otter-123&mode=infinite', 'rewriting the setup never drops the mode or the seed');
  modeToParams('mission', p);
  assert.equal(p.toString(), 'seed=velvet-otter-123', 'going back to missions removes it');
  const shared = new URLSearchParams('mode=infinite&seed=quiet-moth-777');
  assert.equal(modeFromParams(shared), 'infinite');
  assert.deepEqual(infiniteRoom(shared.get('seed'), 3), infiniteRoom('quiet-moth-777', 3), 'the link replays the same run');
});

test('game types: Endless Run is its own, a mission run is filed under its difficulty', () => {
  assert.equal(gameTypeOf('infinite', { difficulty: 'master' }), 'infinite');
  for (const difficulty of PRESET_IDS) assert.equal(gameTypeOf('mission', { difficulty }), difficulty);
  assert.equal(gameTypeOf('mission', {}), 'operative');
  assert.equal(gameTypeOf('mission', { difficulty: 'nightmare' }), 'operative');
  assert.equal(gameTypeOf(undefined, { difficulty: 'shadow' }), 'shadow');
});

// ------------------------------------------------------------ the run itself

test('an infinite run is a pure function of (seed, room number)', () => {
  for (const seed of SEEDS)
    for (const n of [1, 2, 9, 10, 11, 250, 99999]) {
      const plan = infiniteRoom(seed, n);
      assert.deepEqual(infiniteRoom(seed, n), plan);
      assert.equal(plan.roomNo, n);
      assert.equal(plan.seed, `${seed}#inf${n}`);
      assert.ok(THEME_IDS.includes(plan.theme));
      assert.ok(LAYOUT_STYLES.includes(plan.layout));
      assert.ok(Number.isInteger(plan.level) && plan.level >= 1);
      assert.equal(plan.mods, INFINITE_MODS);
    }
  const sig = (seed) => Array.from({ length: 12 }, (_, i) => infiniteRoom(seed, i + 1)).map((p) => `${p.theme}/${p.layout}/${p.level}`).join(' ');
  assert.notEqual(sig('velvet-otter-123'), sig('velvet-otter-124'), 'a new seed is a different run');
  assert.deepEqual(infiniteRoom('x', 0), infiniteRoom('x', 1), 'room numbers start at 1');
  assert.deepEqual(infiniteRoom('x', 3.9), infiniteRoom('x', 3));
});

test('Endless Run uses fair Operative guards, whatever Mission Setup says', () => {
  assert.deepEqual({ ...INFINITE_MODS }, resolveMods({ difficulty: 'operative' }));
  assert.ok(Object.isFrozen(INFINITE_MODS));
});

test('every room rolls a fresh setting: no back-to-back repeats, all 10 themes in every 10 rooms', () => {
  for (const seed of SEEDS) {
    const themes = Array.from({ length: 400 }, (_, i) => infiniteRoom(seed, i + 1).theme);
    for (let i = 1; i < themes.length; i++) assert.notEqual(themes[i], themes[i - 1], `seed "${seed}": rooms ${i} and ${i + 1} are both ${themes[i]}`);
    for (let b = 0; b < themes.length; b += THEME_IDS.length) assert.deepEqual(themes.slice(b, b + THEME_IDS.length).sort(), [...THEME_IDS].sort());
    assert.notDeepEqual(themes.slice(0, 10), themes.slice(10, 20), 'each lap is reshuffled');
  }
  // across many seeds the opening room is not always the same setting
  assert.equal(new Set(Array.from({ length: 200 }, (_, i) => infiniteRoom(`open-${i}`, 1).theme)).size, THEME_IDS.length);
});

test('every room rolls a fresh floor plan: no back-to-back repeats, all 4 styles in every 4 rooms', () => {
  for (const seed of SEEDS) {
    const styles = Array.from({ length: 400 }, (_, i) => infiniteRoom(seed, i + 1).layout);
    for (let i = 1; i < styles.length; i++) assert.notEqual(styles[i], styles[i - 1], `seed "${seed}": rooms ${i} and ${i + 1} are both ${styles[i]}`);
    for (let b = 0; b < styles.length; b += 4) assert.deepEqual(styles.slice(b, b + 4).sort(), [...LAYOUT_STYLES].sort());
  }
  // setting and floor plan are rolled independently: every pairing turns up
  const pairs = new Set(Array.from({ length: 400 }, (_, i) => infiniteRoom('pairs', i + 1)).map((p) => `${p.theme}|${p.layout}`));
  assert.equal(pairs.size, THEME_IDS.length * LAYOUT_STYLES.length);
});

test('bagDraw: shuffled bags with no repeat across the seam, for any item count', () => {
  for (const items of [['a', 'b', 'c'], ['a', 'b', 'c', 'd'], THEME_IDS]) {
    for (let s = 0; s < 40; s++) {
      const seq = Array.from({ length: items.length * 12 }, (_, i) => bagDraw(`bag-${s}`, 'x', items, i));
      for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1]);
      for (let b = 0; b < seq.length; b += items.length) assert.equal(new Set(seq.slice(b, b + items.length)).size, items.length);
    }
  }
  assert.equal(bagDraw('s', 'one', ['only'], 7), 'only', 'a single item just repeats');
  assert.notDeepEqual(
    Array.from({ length: 10 }, (_, i) => bagDraw('s', 'theme', THEME_IDS, i)),
    Array.from({ length: 10 }, (_, i) => bagDraw('s', 'other', THEME_IDS, i)),
    'different labels are different streams',
  );
});

test('sizes climb quickly, then vary for ever: no cap on the room number', () => {
  for (const seed of SEEDS) {
    const tier = (n) => infiniteTier(seed, n);
    assert.ok(tier(1) >= 1 && tier(1) <= 3, 'the first room is a small one');
    const avg = (from, to) => {
      let sum = 0;
      for (let n = from; n <= to; n++) sum += tier(n);
      return sum / (to - from + 1);
    };
    assert.ok(avg(1, 4) < avg(9, 12) && avg(9, 12) < avg(25, 60), 'early rooms ramp up');
    const late = Array.from({ length: 300 }, (_, i) => tier(1000 + i));
    assert.ok(Math.min(...late) >= INFINITE_TIER_CAP - 4 && Math.max(...late) <= INFINITE_TIER_CAP + 4);
    assert.ok(new Set(late).size >= 7, 'late rooms keep changing size');
    assert.ok(Math.max(...late) <= MAX_SIZE_TIER);
    for (const n of [1e4, 1e6, 123456789, Number.MAX_SAFE_INTEGER]) {
      const plan = infiniteRoom(seed, n);
      assert.equal(plan.roomNo, n);
      assert.ok(plan.level >= 1 && plan.level <= INFINITE_TIER_CAP + 4 && THEME_IDS.includes(plan.theme) && LAYOUT_STYLES.includes(plan.layout));
    }
  }
});

// A real run: the first 20 rooms of one seed, then a few from deep in two others.
const played = [];
for (let n = 1; n <= 20; n++) played.push(infiniteRoom('velvet-otter-123', n));
for (const n of [57, 300, 4096]) played.push(infiniteRoom('quiet-moth-777', n));
for (const n of [1, 2, 1000001]) played.push(infiniteRoom('∞ seed with spaces', n));
const built = played.map((plan) => ({ plan, room: generateRoom(plan) }));
const label = (r) => `seed=${r.seed} level=${r.level} ${r.layoutStyle}\n${roomToAscii(r)}`;

test(`${built.length} infinite rooms generate exactly as planned, deterministically`, () => {
  for (const { plan, room } of built) {
    assert.equal(room.themeId, plan.theme);
    assert.equal(room.layoutStyle, plan.layout);
    assert.equal(room.level, plan.level);
    assert.equal(room.seed, plan.seed);
    assert.ok(room.loot.info.mission.verb && room.venue);
  }
  for (const { plan, room } of built.slice(0, 6)) {
    const again = generateRoom(infiniteRoom('velvet-otter-123', plan.roomNo));
    assert.deepEqual(Array.from(again.cells), Array.from(room.cells));
    assert.deepEqual(again.loot, room.loot);
    assert.deepEqual(again.guards.map((g) => g.pts), room.guards.map((g) => g.pts));
  }
});

test('every infinite room is connected, solvable and has a verified perfect-ghost route', () => {
  for (const { room: r } of built) {
    const seen = floodFromStart(r);
    for (let i = 0; i < r.cells.length; i++) if (r.cells[i] === FLOOR) assert.ok(seen[i], `unreachable floor\n${label(r)}`);
    assert.ok(solveTopology(r).ok, label(r));
    const res = solveStealth(r, r.guards.map((g) => ({ timeline: buildTimeline(g), vis: g.vis })));
    assert.ok(res.ok, `no ghost route\n${label(r)}`);
    assert.equal(res.steps, r.ghostSteps);
  }
});

test('a run is genuinely varied: settings, floor plans, assignments and targets all change', () => {
  const run = built.slice(0, 20).map((b) => b.room);
  assert.equal(new Set(run.map((r) => r.themeId)).size, THEME_IDS.length);
  assert.equal(new Set(run.map((r) => r.layoutStyle)).size, LAYOUT_STYLES.length);
  assert.ok(new Set(run.map((r) => r.loot.info.mission.verb)).size >= 6, 'a fresh assignment every room');
  assert.equal(new Set(run.map((r) => r.loot.info.name)).size, run.length, 'never the same target twice');
  assert.equal(new Set(run.map((r) => r.venue)).size, run.length);
  assert.ok(new Set(run.map((r) => `${r.w}x${r.h}`)).size >= 8);
});

// ------------------------------------------------------------ labels

test('the HUD line names the active mode, seed, room and endless streak', () => {
  assert.equal(describeInfinite(1, 'velvet-otter-123'), 'ENDLESS RUN · SEED velvet-otter-123 · ROOM 01');
  assert.equal(describeInfinite(7, 'velvet-otter-123', 6), 'ENDLESS RUN · SEED velvet-otter-123 · ROOM 07 · STREAK 6');
  assert.equal(describeInfinite(1234, 'x', 1233), 'ENDLESS RUN · SEED x · ROOM 1234 · STREAK 1233', 'no cap on room or streak');
  assert.match(describeInfinite(3, 'CaseSensitive'), /SEED CaseSensitive/, 'the seed is shown exactly as it must be shared');
  // and the mission flow still names its difficulty
  assert.match(describeRun(7, { difficulty: 'operative' }), /OPERATIVE/);
  assert.ok(!/INFINITE/.test(describeRun(7, DEFAULT_SETUP)));
});
