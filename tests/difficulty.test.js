import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, PRESET_IDS, RAMPS, RAMP_IDS, STARTS, START_IDS, DEFAULT_SETUP, MAX_TIER, normalizeSetup, tierFor, sizeClass, resolveMods, describeRun, describeSetup, setupFromParams, setupToParams, isCustom } from '../src/core/difficulty.js';
import { generateRoom, guardCountFor, patrolIsValid, MAX_SIZE_TIER } from '../src/core/generator.js';
import { solveTopology, solveStealth, STEP_DT } from '../src/core/solver.js';
import { buildTimeline, poseAt } from '../src/core/patrol.js';
import { canSee, isBumping } from '../src/core/stealth.js';
import { FLOOR, roomToAscii } from '../src/core/grid.js';
import { THEME_IDS } from '../src/core/themes.js';
import { floodFromStart } from './helpers.js';

const label = (r) => `seed=${r.seed} level=${r.level} mods=${JSON.stringify(r.mods)}\n${roomToAscii(r)}`;

// ------------------------------------------------------------ presets

test('four presets with the advertised multipliers', () => {
  assert.deepEqual(PRESET_IDS, ['tourist', 'operative', 'shadow', 'master']);
  assert.equal(PRESETS.tourist.detect, 0.65);
  assert.equal(PRESETS.tourist.vision, 0.88);
  assert.ok(PRESETS.tourist.speed < 1, 'calmer patrols');
  assert.deepEqual([PRESETS.operative.detect, PRESETS.operative.vision, PRESETS.operative.speed, PRESETS.operative.density], [1, 1, 1, 1]);
  assert.equal(PRESETS.shadow.detect, 1.35);
  assert.equal(PRESETS.shadow.vision, 1.12);
  assert.ok(PRESETS.shadow.speed > 1 && PRESETS.shadow.puzzleShift > 0, 'brisker patrols, earlier puzzles');
  assert.equal(PRESETS.master.detect, 1.7);
  assert.equal(PRESETS.master.vision, 1.22);
  assert.ok(PRESETS.master.density > PRESETS.shadow.density && PRESETS.master.sizeShift > 0, 'dense guards, huge compounds');
  for (const p of Object.values(PRESETS)) assert.ok(p.name && p.tag && p.blurb);
});

test('presets are strictly ordered from easiest to hardest', () => {
  for (const key of ['detect', 'vision', 'speed', 'density', 'puzzleShift']) {
    for (let i = 1; i < PRESET_IDS.length; i++) {
      assert.ok(PRESETS[PRESET_IDS[i]][key] > PRESETS[PRESET_IDS[i - 1]][key], `${key}: ${PRESET_IDS[i]} > ${PRESET_IDS[i - 1]}`);
    }
  }
});

test('resolveMods: operative is the identity, sliders stack on the preset and are clamped', () => {
  assert.deepEqual(resolveMods(DEFAULT_SETUP), { detect: 1, vision: 1, speed: 1, density: 1, puzzleShift: 0, sizeShift: 0 });
  assert.equal(resolveMods({ difficulty: 'shadow' }).detect, 1.35);
  assert.equal(resolveMods({ difficulty: 'shadow', alert: 2 }).detect, 2.7);
  assert.equal(resolveMods({ difficulty: 'tourist', alert: 0.5 }).detect, 0.325);
  assert.equal(resolveMods({ difficulty: 'operative', vision: 1.2 }).vision, 1.2);
  assert.ok(resolveMods({ difficulty: 'master', vision: 99 }).vision <= 1.45, 'vision stays inside what the solver is tuned for');
  assert.equal(normalizeSetup({ alert: 99 }).alert, 2);
  assert.equal(normalizeSetup({ alert: -3 }).alert, 0.5);
  assert.equal(normalizeSetup({ vision: 'banana' }).vision, 1);
  assert.equal(isCustom({ alert: 1.25 }), true);
  assert.equal(isCustom({}), false);
});

test('normalizeSetup rejects junk and falls back to the defaults', () => {
  assert.deepEqual(normalizeSetup(), DEFAULT_SETUP);
  assert.deepEqual(normalizeSetup({ difficulty: 'nightmare', ramp: 'ludicrous', start: 'planet', theme: '' }), DEFAULT_SETUP);
  assert.equal(normalizeSetup({ difficulty: 'master' }).difficulty, 'master');
});

// ------------------------------------------------------------ ramps

test('ramp pace: Steady never moves; Gradual < Classic < Turbo', () => {
  assert.deepEqual(RAMP_IDS, ['steady', 'gradual', 'classic', 'turbo']);
  assert.deepEqual(RAMP_IDS.map((id) => RAMPS[id].rate), [0, 0.5, 1, 2]);
  const tiers = (ramp, start = 'compact') => [1, 2, 3, 4, 5, 10, 20].map((n) => tierFor(n, { ramp, start }));
  assert.deepEqual(tiers('steady'), [1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(tiers('gradual'), [1, 1, 2, 2, 3, 5, 10]);
  assert.deepEqual(tiers('classic'), [1, 2, 3, 4, 5, 10, 20]);
  assert.deepEqual(tiers('turbo'), [1, 3, 5, 7, 9, 19, 39]);
  assert.deepEqual(tiers('steady', 'mega'), [14, 14, 14, 14, 14, 14, 14]);
  assert.deepEqual(tiers('classic', 'large'), [8, 9, 10, 11, 12, 17, 27]);
  for (const ramp of RAMP_IDS) {
    for (let n = 1; n < 200; n++) assert.ok(tierFor(n + 1, { ramp }) >= tierFor(n, { ramp }), 'tiers never go down');
    assert.equal(tierFor(1, { ramp }), 1, 'room 1 is always the starting tier');
    assert.equal(tierFor(0, { ramp }), 1, 'guard against room 0');
  }
  for (let n = 2; n < 60; n++) {
    assert.ok(tierFor(n, { ramp: 'turbo' }) > tierFor(n, { ramp: 'classic' }));
    assert.ok(tierFor(n, { ramp: 'classic' }) > tierFor(n, { ramp: 'steady' }));
    assert.ok(tierFor(n, { ramp: 'classic' }) >= tierFor(n, { ramp: 'gradual' }));
  }
});

test('starting sizes and size classes line up', () => {
  assert.deepEqual(START_IDS.map((id) => STARTS[id].tier), [1, 4, 8, 14]);
  for (const id of START_IDS) {
    assert.equal(tierFor(1, { start: id }), STARTS[id].tier);
    assert.equal(sizeClass(STARTS[id].tier).id, id);
  }
  assert.equal(sizeClass(3).id, 'compact');
  assert.equal(sizeClass(7).id, 'standard');
  assert.equal(sizeClass(13).id, 'large');
  assert.equal(sizeClass(500).id, 'mega');
  assert.equal(MAX_TIER, MAX_SIZE_TIER, 'UI and generator agree where rooms stop growing');
});

test('run labels read like the HUD expects', () => {
  assert.equal(describeRun(7, { start: 'standard', ramp: 'classic' }), 'SECTOR 07 · LARGE COMPOUND · OPERATIVE · CLASSIC RAMP');
  assert.equal(describeRun(1, DEFAULT_SETUP), 'SECTOR 01 · COMPACT · OPERATIVE · CLASSIC RAMP');
  assert.equal(describeRun(12, { difficulty: 'tourist', ramp: 'steady', start: 'mega' }), 'SECTOR 12 · MEGA-FACILITY · TOURIST · STEADY RAMP');
  assert.equal(describeRun(3, { difficulty: 'shadow', ramp: 'turbo', alert: 1.5 }), 'SECTOR 03 · STANDARD · SHADOW+ · TURBO RAMP');
  assert.equal(describeRun(120, { ramp: 'turbo' }), 'SECTOR 120 · MEGA-FACILITY · OPERATIVE · TURBO RAMP');
  assert.equal(describeSetup({ difficulty: 'master', ramp: 'gradual', start: 'large' }), 'GHOST MASTER · GRADUAL · LARGE COMPOUND');
});

test('setups survive a round trip through shareable URL params', () => {
  assert.equal(setupToParams(DEFAULT_SETUP).toString(), '', 'defaults leave the URL clean');
  for (const difficulty of PRESET_IDS)
    for (const ramp of RAMP_IDS)
      for (const start of START_IDS) {
        const setup = normalizeSetup({ difficulty, ramp, start, alert: 1.35, vision: 0.9, theme: 'lab' });
        assert.deepEqual(setupFromParams(setupToParams(setup)), setup);
      }
  const p = new URLSearchParams('seed=keep-me&diff=shadow&ramp=turbo&start=large&alert=1.2');
  const s = setupFromParams(p, { ...DEFAULT_SETUP, vision: 1.1, theme: 'vr' });
  assert.deepEqual(s, { difficulty: 'shadow', ramp: 'turbo', start: 'large', alert: 1.2, vision: 1.1, theme: 'vr' });
  assert.equal(setupToParams(DEFAULT_SETUP, p).toString(), 'seed=keep-me', 'unrelated params are preserved, stale ones removed');
});

// ------------------------------------------------------------ generation at scale

const verify = (r) => {
  assert.ok(solveTopology(r).ok, `topology\n${label(r)}`);
  const guards = r.guards.map((g) => ({ timeline: buildTimeline(g), vis: g.vis }));
  const res = solveStealth(r, guards, { wantPath: true });
  assert.ok(res.ok, `no ghost route\n${label(r)}`);
  assert.equal(res.steps, r.ghostSteps);
  return res;
};

test('every preset generates verified rooms across the early tiers and all themes', () => {
  let n = 0;
  for (const difficulty of PRESET_IDS) {
    const mods = resolveMods({ difficulty });
    THEME_IDS.forEach((theme, ti) => {
      for (const level of [1, 3, 6]) {
        const r = generateRoom({ seed: `preset-${difficulty}-${theme}-${level}`, level: level + (ti % 2), theme, mods });
        verify(r);
        n++;
        for (const g of r.guards) assert.ok(patrolIsValid(r, g), label(r));
      }
    });
  }
  assert.equal(n, PRESET_IDS.length * THEME_IDS.length * 3);
});

test('presets really change the guards: vision, patrol speed and head-count', () => {
  const sample = (difficulty) => {
    const mods = resolveMods({ difficulty });
    let range = 0;
    let speed = 0;
    let guards = 0;
    let moving = 0;
    let rooms = 0;
    for (let i = 0; i < 10; i++) {
      const r = generateRoom({ seed: `cmp-${i}`, level: 7, theme: THEME_IDS[i % THEME_IDS.length], mods });
      rooms++;
      guards += r.guards.length;
      for (const g of r.guards) {
        range += g.vis.range;
        if (g.kind !== 'lookout') {
          speed += g.speed;
          moving++;
        }
      }
    }
    return { range: range / guards, speed: speed / moving, guards: guards / rooms };
  };
  const stats = PRESET_IDS.map(sample);
  for (let i = 1; i < stats.length; i++) {
    assert.ok(stats[i].range > stats[i - 1].range, `vision range grows: ${JSON.stringify(stats)}`);
    assert.ok(stats[i].speed > stats[i - 1].speed, `patrol speed grows: ${JSON.stringify(stats)}`);
    assert.ok(stats[i].guards >= stats[i - 1].guards, `guard count grows: ${JSON.stringify(stats)}`);
  }
  assert.ok(stats[3].guards > stats[0].guards);
  assert.ok(Math.abs(stats[0].range / stats[1].range - 0.88) < 0.04, 'tourist cones ~0.88x');
  assert.ok(Math.abs(stats[3].range / stats[1].range - 1.22) < 0.05, 'ghost master cones ~1.22x');
});

test('harder presets bring lasers in earlier', () => {
  const lasers = (difficulty, level) => {
    let n = 0;
    for (let i = 0; i < 12; i++) n += generateRoom({ seed: `early-${i}`, level, mods: resolveMods({ difficulty }) }).lasers.length;
    return n;
  };
  assert.equal(lasers('operative', 1), 0, 'classic: no lasers in the first room');
  assert.equal(lasers('tourist', 2), 0, 'tourist: none in room 2 either');
  assert.ok(lasers('shadow', 1) > 0, 'shadow: lasers from the start');
  assert.ok(lasers('master', 1) > 0);
});

// Large Compound (tier 8-13) and Mega-Facility (tier 14+) rooms, every theme.
const BIG_TIERS = [8, 11, 14, 17, 20];
const big = [];
for (const theme of THEME_IDS) {
  BIG_TIERS.forEach((level, i) => {
    const difficulty = PRESET_IDS[(THEME_IDS.indexOf(theme) + i) % PRESET_IDS.length];
    const t0 = performance.now();
    const room = generateRoom({ seed: `big-${theme}-${level}`, level, theme, mods: resolveMods({ difficulty }) });
    big.push({ room, ms: performance.now() - t0, difficulty });
  });
}

test(`large compounds and mega-facilities: ${big.length} rooms across all ${THEME_IDS.length} themes generate fast`, () => {
  assert.equal(big.length, THEME_IDS.length * BIG_TIERS.length);
  assert.deepEqual([...new Set(big.map((b) => b.room.themeId))].sort(), [...THEME_IDS].sort());
  const total = big.reduce((s, b) => s + b.ms, 0);
  const worst = Math.max(...big.map((b) => b.ms));
  assert.ok(total / big.length < 1500, `average ${Math.round(total / big.length)} ms per room is too slow`);
  assert.ok(worst < 6000, `slowest room took ${Math.round(worst)} ms`);
});

test('large compounds and mega-facilities: all floor connected, topology and ghost route verified', () => {
  for (const { room: r } of big) {
    const seen = floodFromStart(r);
    for (let i = 0; i < r.cells.length; i++) if (r.cells[i] === FLOOR) assert.ok(seen[i], `unreachable floor\n${label(r)}`);
    verify(r);
    for (const g of r.guards) assert.ok(patrolIsValid(r, g), label(r));
  }
});

test('mega-facility ghost routes survive continuous replay against real guard vision', () => {
  for (const { room: r } of big.filter((b) => b.room.level >= 14)) {
    const res = verify(r);
    const pose = {};
    for (let i = 0; i < res.path.length - 1; i++) {
      const a = res.path[i];
      const b = res.path[i + 1];
      if (b.vent) continue;
      for (let s = 0; s <= 6; s++) {
        const k = s / 6;
        const t = (a.step + k) * STEP_DT;
        const px = a.cx + 0.5 + (b.cx - a.cx) * k;
        const pz = a.cy + 0.5 + (b.cy - a.cy) * k;
        for (const g of r.guards) {
          poseAt(g.timeline, t, pose);
          assert.ok(!canSee(r, pose, px, pz, true, g.vis) && !isBumping(r, pose, px, pz), `seen at t=${t.toFixed(2)}\n${label(r)}`);
        }
      }
    }
  }
});

test('rooms genuinely sprawl as tiers climb: bigger grids, more chambers, vents, lasers, guards', () => {
  const avg = (pred, f) => {
    const rs = big.filter((b) => pred(b.room)).map((b) => f(b.room));
    return rs.reduce((s, v) => s + v, 0) / rs.length;
  };
  const large = (r) => r.level >= 8 && r.level < 14;
  const mega = (r) => r.level >= 14;
  const starter = Array.from({ length: 12 }, (_, i) => generateRoom({ seed: `small-${i}`, level: 1, theme: THEME_IDS[i % THEME_IDS.length] }));
  const savg = (f) => starter.reduce((s, r) => s + f(r), 0) / starter.length;
  for (const f of [(r) => r.w * r.h, (r) => r.chambers.length, (r) => r.guards.length, (r) => r.vents.length]) {
    assert.ok(avg(large, f) > savg(f) * 1.5, 'large compounds dwarf starter rooms');
    assert.ok(avg(mega, f) > avg(large, f), 'mega-facilities are bigger again');
  }
  assert.ok(avg(mega, (r) => r.w * r.h) > 1000, 'mega-facilities are over 1000 m²');
  assert.ok(avg(mega, (r) => r.chambers.length) >= 10, 'ten or more chambers');
  assert.ok(avg(mega, (r) => r.vents.length) >= 3, 'multiple vent routes');
  assert.ok(avg(mega, (r) => r.lasers.length) >= 1.5, 'multiple laser puzzles');
  assert.ok(avg(mega, (r) => r.guards.length) >= 8, 'heavily guarded');
  for (const { room: r } of big) assert.ok(r.w <= 48 && r.h <= 30, 'rooms stay within the size budget');
});

test('the ramp never runs out: tiers far beyond the cap still generate and verify', () => {
  for (const level of [25, 60, 400]) {
    const r = generateRoom({ seed: `beyond-${level}`, level, mods: resolveMods({ difficulty: 'master' }) });
    verify(r);
    assert.ok(r.w <= 48 && r.h <= 30);
    assert.ok(r.guards.length <= guardCountFor(level, 1.4));
  }
});
