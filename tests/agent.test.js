import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import { OUTFITS, HEADGEAR, BUILDS, SKIN_TONES, HAIR_COLORS, PALETTES, randomAgent, randomCodename, normalizeAgent, isLegacyDefault, isSoldierCliche } from '../src/core/agent.js';
import { loadSave, storeSave, confirmAgent } from '../src/game/save.js';
import { guardSpec, agentSpec } from '../src/render/character.js';
import { THEME_IDS } from '../src/core/themes.js';

const KEY = 'sneaky-sneaky:v1';
const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => (data[k] = String(v)), data };
};
const OLD_DEFAULTS = [
  { codename: 'Quiet Otter', outfit: 'sneak', primary: 0x2c4a6e, accent: 0xffb347, head: 'bandana', skin: 2, build: 'standard' },
  { codename: 'Quiet Otter', outfit: 'sneak', primary: 0x3d5266, accent: 0xc1121f, head: 'bandana', skin: 1, build: 'standard' },
];

const agents = Array.from({ length: 600 }, (_, i) => randomAgent(new RNG(`agent-${i}`)));

test('the wardrobe is broad: 8+ outfits, 12+ head options, bandana is just one of them', () => {
  assert.ok(Object.keys(OUTFITS).length >= 8);
  assert.ok(Object.keys(HEADGEAR).length >= 12);
  assert.ok(PALETTES.length >= 12);
  for (const key of ['longcoat', 'moto', 'parka', 'suit', 'techvest', 'jumpsuit', 'poncho', 'rig']) assert.ok(OUTFITS[key], key);
  for (const key of ['hood', 'bucket', 'beanie', 'roundshades', 'visorcap', 'headphones', 'flatcap', 'cropped', 'spiky', 'ponytail', 'goggles', 'bandana']) assert.ok(HEADGEAR[key], key);
  assert.notEqual(Object.keys(HEADGEAR)[0], 'bandana', 'bandana is not first in line');
});

test('random agents are valid, varied and deterministic per seed', () => {
  for (const a of agents) {
    assert.ok(OUTFITS[a.outfit] && HEADGEAR[a.head] && BUILDS[a.build]);
    assert.ok(a.skin >= 0 && a.skin < SKIN_TONES.length && a.hair >= 0 && a.hair < HAIR_COLORS.length);
    assert.ok(PALETTES.some((p) => p.primary === a.primary && p.accent === a.accent), 'palette is one of the cohesive pairs');
    assert.match(a.codename, /^[A-Z][A-Za-z-]+ [A-Z][a-z]+$/);
    assert.deepEqual(normalizeAgent(a), a, 'already normal');
  }
  assert.deepEqual(randomAgent(new RNG('agent-7')), agents[7]);
  const count = (f) => new Set(agents.map(f)).size;
  assert.equal(count((a) => a.outfit), Object.keys(OUTFITS).length, 'every outfit is dealt');
  assert.equal(count((a) => a.head), Object.keys(HEADGEAR).length, 'every head option is dealt');
  assert.equal(count((a) => a.build), Object.keys(BUILDS).length);
  assert.equal(count((a) => a.primary), PALETTES.length);
  assert.ok(count((a) => a.codename) > 300);
  assert.ok(count((a) => `${a.outfit}|${a.head}|${a.primary}|${a.build}|${a.skin}`) > 520, 'looks rarely repeat');
});

test('no agent is ever dealt as the bandana-and-tactical-gear soldier cliche', () => {
  for (const a of agents) assert.equal(isSoldierCliche(a), false, JSON.stringify(a));
  const bandanas = agents.filter((a) => a.head === 'bandana').length;
  assert.ok(bandanas > 5 && bandanas < agents.length / 8, `bandana should be an occasional option, got ${bandanas}/600`);
  assert.equal(isSoldierCliche({ outfit: 'rig', head: 'bandana' }), true);
  assert.equal(isSoldierCliche({ outfit: 'longcoat', head: 'bandana' }), false);
  for (const old of OLD_DEFAULTS) assert.equal(isLegacyDefault(old), true);
  assert.equal(isLegacyDefault(agents[0]), false);
});

test('first run: no save means a fresh random agent and an unconfirmed flag', () => {
  const looks = new Set();
  for (let i = 0; i < 25; i++) {
    const save = loadSave(fakeStorage());
    assert.equal(save.agentConfirmed, false);
    assert.ok(OUTFITS[save.agent.outfit] && HEADGEAR[save.agent.head]);
    assert.equal(isSoldierCliche(save.agent), false);
    assert.notEqual(save.agent.outfit, 'sneak');
    looks.add(`${save.agent.outfit}|${save.agent.head}|${save.agent.primary}|${save.agent.codename}`);
  }
  assert.ok(looks.size >= 20, 'new players do not all get the same agent');
});

test('first run: the old hardcoded default is replaced, never inherited', () => {
  for (const old of OLD_DEFAULTS) {
    const save = loadSave(fakeStorage({ [KEY]: JSON.stringify({ agent: old, vault: {}, stats: {}, settings: {} }) }));
    assert.equal(save.agentConfirmed, false);
    assert.ok(OUTFITS[save.agent.outfit], 'a current outfit');
    assert.equal(isSoldierCliche(save.agent), false);
  }
});

test('confirmation flow: confirm, store, reload keeps the agent and skips the select screen', () => {
  const storage = fakeStorage();
  const first = loadSave(storage);
  assert.equal(first.agentConfirmed, false);
  first.agent = randomAgent(new RNG('chosen'), { codename: 'Polite Heron' });
  confirmAgent(first);
  storeSave(first, storage);
  const second = loadSave(storage);
  assert.equal(second.agentConfirmed, true);
  assert.deepEqual(second.agent, first.agent);
  // an unconfirmed but customised agent is kept, and still asks once
  const third = fakeStorage({ [KEY]: JSON.stringify({ agent: { ...first.agent, codename: 'Damp Newt' } }) });
  const loaded = loadSave(third);
  assert.equal(loaded.agentConfirmed, false);
  assert.equal(loaded.agent.codename, 'Damp Newt');
});

test('older saves migrate: legacy outfit and headgear keys map to current ones', () => {
  const legacy = { codename: 'Velvet Moth', outfit: 'trench', primary: 0x5a1a22, accent: 0xffb000, head: 'beret', skin: 4, build: 'tall' };
  const save = loadSave(fakeStorage({ [KEY]: JSON.stringify({ agent: legacy, agentConfirmed: true, settings: { style: 'ps1' } }) }));
  assert.equal(save.agentConfirmed, true);
  assert.equal(save.agent.outfit, 'longcoat');
  assert.equal(save.agent.head, 'flatcap');
  assert.equal(save.agent.codename, 'Velvet Moth');
  assert.equal(save.agent.primary, 0x5a1a22);
  assert.ok(Number.isInteger(save.agent.hair), 'new fields are filled in');
  assert.equal(save.settings.style, 'noir', 'old visual style ids migrate');
  const junk = normalizeAgent({ outfit: 'spacesuit', head: 42, build: null, primary: 'red', skin: 99, codename: '   ' }, agents[3]);
  assert.deepEqual(junk, agents[3], 'junk falls back field by field');
  assert.doesNotThrow(() => loadSave(fakeStorage({ [KEY]: '{not json' })));
});

test('codenames and agent specs', () => {
  const names = new Set(Array.from({ length: 300 }, (_, i) => randomCodename(new RNG(i))));
  assert.ok(names.size > 200);
  const spec = agentSpec(agents[0]);
  assert.equal(spec.outfit, agents[0].outfit);
  assert.equal(spec.skin, SKIN_TONES[agents[0].skin]);
  assert.equal(spec.hairColor, HAIR_COLORS[agents[0].hair]);
});

test('guards are generated with real variety in every theme', () => {
  for (const theme of THEME_IDS) {
    const specs = Array.from({ length: 80 }, (_, i) => guardSpec(theme, new RNG(`guard-${theme}-${i}`)));
    const count = (f) => new Set(specs.map(f)).size;
    assert.ok(count((s) => s.outfit) >= 3, `${theme}: outfits`);
    assert.ok(count((s) => s.head) >= 5, `${theme}: headgear`);
    assert.ok(count((s) => s.build) >= 3, `${theme}: builds`);
    assert.ok(count((s) => `${s.outfit}|${s.head}|${s.primary}|${s.accent}|${s.build}`) >= 40, `${theme}: only ${count((s) => `${s.outfit}|${s.head}|${s.primary}|${s.accent}|${s.build}`)} distinct looks in 80`);
    assert.deepEqual(guardSpec(theme, new RNG('same')), guardSpec(theme, new RNG('same')));
    assert.equal(specs.every((s) => s.holo === (theme === 'vr')), true);
  }
});
