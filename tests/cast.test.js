import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import { ARCHETYPES, ARCHETYPE_IDS, THEME_CAST, SKIN_TONES, HAIR_COLORS, thiefLook, guardLook } from '../src/core/cast.js';
import { jointPose, solveSkeleton, frameKey, WALK_FRAMES, VIEW_COUNT } from '../src/render/sprites.js';
import { loadSave } from '../src/game/save.js';
import { THEME_IDS } from '../src/core/themes.js';

const lum = (hex) => (0.299 * ((hex >> 16) & 255) + 0.587 * ((hex >> 8) & 255) + 0.114 * (hex & 255)) / 255;

test('the thief is one fixed, anonymous, all-black figure', () => {
  const t = thiefLook();
  assert.deepEqual(thiefLook(), t, 'no randomness, no customisation');
  assert.equal(t.role, 'thief');
  assert.ok(lum(t.suit) < 0.12, 'matte black suit');
  assert.ok(lum(t.highlight) > lum(t.suit) + 0.25, 'slate rim highlight reads against the suit');
  for (const key of ['skin', 'hair', 'hairStyle', 'hat', 'archetype', 'codename', 'mustache']) assert.equal(t[key], undefined, `the thief has no ${key}`);
});

test('there is no character customisation left in the save', () => {
  const save = loadSave({ getItem: () => null });
  assert.equal(save.agent, undefined);
  assert.equal(save.agentConfirmed, undefined);
  const legacy = loadSave({ getItem: () => JSON.stringify({ agent: { outfit: 'parka' }, agentConfirmed: true, settings: { style: 'noir' } }) });
  assert.equal(legacy.agent, undefined, 'old agent data is simply ignored');
  assert.equal(legacy.settings.style, 'print', 'old visual style ids migrate to Comic Print');
  assert.equal(loadSave({ getItem: () => JSON.stringify({ settings: { style: 'clean' } }) }).settings.style, 'ink');
});

test('five distinct guard archetypes', () => {
  assert.deepEqual(ARCHETYPE_IDS, ['enforcer', 'watchman', 'tech', 'gala', 'tactical']);
  const names = ARCHETYPE_IDS.map((id) => ARCHETYPES[id].name);
  assert.deepEqual(names, ['Heavy Enforcer', 'Night Watchman', 'Tech Specialist', 'Gala Security', 'Tactical Officer']);
  assert.ok(ARCHETYPES.enforcer.build.shoulders > ARCHETYPES.watchman.build.shoulders, 'the enforcer is the broad one');
  assert.ok(ARCHETYPES.enforcer.build.bulk > ARCHETYPES.tech.build.bulk);
  assert.ok(ARCHETYPES.watchman.build.belly > 0.1 && ARCHETYPES.watchman.build.slouch > 0.05, 'the watchman is rumpled');
  assert.ok(ARCHETYPES.tech.hats.every((h) => h === 'visor' || h === 'headset'));
  assert.equal(ARCHETYPES.gala.tie, 1, 'gala security always wears a tie');
  assert.ok(ARCHETYPES.tactical.hats.includes('beret'));
});

test('every setting has its own cast, and guards are deterministic per seed', () => {
  for (const theme of THEME_IDS) {
    const cast = THEME_CAST[theme];
    assert.ok(cast && cast.uniforms.length >= 2, theme);
    assert.ok(Object.values(cast.weights).filter((w) => w > 0).length >= 3, `${theme} has at least three archetypes on the payroll`);
    assert.deepEqual(guardLook(theme, new RNG('same')), guardLook(theme, new RNG('same')));
  }
  assert.ok(THEME_CAST.lab.weights.tech > THEME_CAST.lab.weights.watchman, 'labs are mostly specialists');
  assert.ok(THEME_CAST.museum.weights.gala > THEME_CAST.museum.weights.enforcer, 'museums are mostly gala security');
  assert.ok(THEME_CAST.bunker.weights.tactical > THEME_CAST.bunker.weights.watchman);
});

test('generated guards are valid and genuinely varied in every setting', () => {
  const seenArch = new Set();
  for (const theme of THEME_IDS) {
    const looks = Array.from({ length: 120 }, (_, i) => guardLook(theme, new RNG(`g-${theme}-${i}`)));
    const count = (f) => new Set(looks.map(f)).size;
    for (const l of looks) {
      assert.equal(l.role, 'guard');
      assert.ok(ARCHETYPES[l.archetype]);
      assert.ok(THEME_CAST[theme].weights[l.archetype] > 0, `${l.archetype} does not work at the ${theme}`);
      assert.ok(SKIN_TONES.includes(l.skin) && HAIR_COLORS.includes(l.hair));
      assert.ok(l.build.shoulders > 0.17 && l.build.shoulders < 0.32 && l.build.height > 0.9 && l.build.height < 1.14);
      assert.ok(Number.isInteger(l.top) && Number.isInteger(l.bottom) && Number.isInteger(l.accent));
      assert.equal(l.holo, theme === 'vr');
      seenArch.add(l.archetype);
    }
    assert.ok(count((l) => l.archetype) >= 3, `${theme}: archetypes`);
    assert.ok(count((l) => l.skin) >= 5, `${theme}: skin tones`);
    assert.ok(count((l) => l.hat) >= 3, `${theme}: headwear`);
    assert.ok(count((l) => l.prop) >= 3, `${theme}: props`);
    assert.ok(count((l) => `${l.archetype}|${l.skin}|${l.hair}|${l.hairStyle}|${l.hat}|${l.eyewear}|${l.top}|${l.mustache}|${l.prop}`) >= 100, `${theme}: looks repeat too often`);
  }
  assert.equal(seenArch.size, 5, 'all five archetypes turn up across the ten settings');
});

test('poses: walk cycle, crouch, sleeper hold, startled, asleep', () => {
  const build = thiefLook().build;
  const headY = (p) => solveSkeleton(p, build).head[1];
  const stand = jointPose('normal', false);
  const crouch = jointPose('normal', true);
  assert.ok(headY(crouch) < headY(stand) - 0.35, 'crouching is a real, low prowl');
  assert.ok(headY(crouch) < 1.25, 'low enough to hide behind waist-high cover art');
  // the walk cycle alternates the legs and returns to where it started
  const legs = Array.from({ length: WALK_FRAMES }, (_, i) => jointPose('normal', false, i).lLx);
  assert.ok(Math.max(...legs) > 0.5 && Math.min(...legs) < -0.5);
  for (let i = 0; i < WALK_FRAMES; i++) {
    const p = jointPose('normal', false, i);
    assert.ok(Math.abs(p.lLx + p.lRx) < 1e-9, 'legs swing in opposition');
  }
  assert.ok(WALK_FRAMES >= 4 && VIEW_COUNT === 5);
  assert.equal(jointPose('sleep', false).sleep, true);
  assert.equal(jointPose('alert', false).mood, 'alert');
  assert.equal(jointPose('suspicious', false).mood, 'wary');
  assert.ok(jointPose('choking', false).aLx < -1, 'arms reach forward for the sleeper hold');
  assert.notDeepEqual(jointPose('held', false, -1, 0), jointPose('held', false, -1, 1), 'the held guard flails');
  assert.notEqual(jointPose('look', false, -1, 0).headYaw, jointPose('look', false, -1, 1).headYaw);
  // every joint stays above the floor and the skeleton is finite
  for (const mode of ['normal', 'choking', 'held', 'alert', 'look', 'suspicious'])
    for (const c of [false, true])
      for (let w = -1; w < WALK_FRAMES; w++) {
        const sk = solveSkeleton(jointPose(mode, c, w), build);
        for (const part of [sk.head, sk.neck, sk.armL.hand, sk.armR.hand, sk.legL.A, sk.legR.A, sk.legL.toe]) {
          assert.ok(part.every(Number.isFinite));
          assert.ok(part[1] >= 0, `${mode} crouch=${c} frame ${w} dips below the floor`);
        }
      }
});

test('frame cache keys are unique per view and pose', () => {
  const keys = new Set();
  for (let v = 0; v < VIEW_COUNT; v++)
    for (const mode of ['normal', 'alert', 'sleep'])
      for (const crouch of [false, true]) for (let w = -1; w < WALK_FRAMES; w++) keys.add(frameKey({ mode, crouch, walk: w, alt: 0 }, v));
  assert.equal(keys.size, VIEW_COUNT * 3 * 2 * (WALK_FRAMES + 1));
});
