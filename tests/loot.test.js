import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import { LOOT, generateLoot, lootCombinations, PROP_SHAPES, RARITIES, LOOT_WORDS, SIGNATURE_CHANCE } from '../src/core/loot.js';
import { THEME_IDS, venueName } from '../src/core/themes.js';
import { generateRoom } from '../src/core/generator.js';
import { buildLootProp, SHAPE_KEYS, PROP_KEYS } from '../src/render/lootProps.js';
import { recordLoot, vaultEntries, vaultSummary, MAX_VAULT } from '../src/game/save.js';

const SEEDS = 500;
const TOPPERS = ['none', 'ribbon', 'tag', 'bow', 'evidence', 'halo'];
const drops = [];
for (const theme of THEME_IDS) for (let i = 0; i < SEEDS; i++) drops.push({ theme, loot: generateLoot(new RNG(`loot-${theme}-${i}`), theme) });
const procedural = drops.filter((d) => !d.loot.signature);
const signature = drops.filter((d) => d.loot.signature);

test(`generated ${drops.length} heist targets: ${SEEDS} seeds x 6 themes`, () => {
  assert.equal(drops.length, 3000);
  assert.deepEqual([...new Set(drops.map((d) => d.theme))].sort(), [...THEME_IDS].sort());
});

test('loot generation is deterministic for a seed and differs between seeds', () => {
  for (const theme of THEME_IDS) {
    for (let i = 0; i < 40; i++) assert.deepEqual(generateLoot(new RNG(`loot-${theme}-${i}`), theme), drops.find((d) => d.theme === theme && d === drops[THEME_IDS.indexOf(theme) * SEEDS + i]).loot);
  }
  assert.notDeepEqual(generateLoot(new RNG('a'), 'lab'), generateLoot(new RNG('b'), 'lab'));
});

test('high combinatorial uniqueness: procedural names almost never repeat', () => {
  const names = new Set(procedural.map((d) => d.loot.name));
  assert.ok(names.size >= procedural.length * 0.985, `${names.size} unique of ${procedural.length}`);
  const ids = new Set(procedural.map((d) => d.loot.id));
  assert.equal(ids.size, names.size, 'ids are 1:1 with names');
  for (const theme of THEME_IDS) {
    const mine = procedural.filter((d) => d.theme === theme);
    assert.ok(new Set(mine.map((d) => d.loot.name)).size >= mine.length * 0.985, `${theme} repeats too much`);
  }
  assert.ok(new Set(drops.map((d) => d.loot.name)).size >= 2500, 'over 2500 distinct targets in 3000 rooms');
});

test('the name space is enormous', () => {
  for (const theme of THEME_IDS) assert.ok(lootCombinations(theme) > 10_000_000, `${theme}: ${lootCombinations(theme)}`);
  assert.ok(LOOT_WORDS.ADJECTIVES.length >= 40 && LOOT_WORDS.NOUNS.length >= 40 && LOOT_WORDS.TAGS.length >= 25 && LOOT_WORDS.MATERIALS.length >= 10);
  for (const bank of [LOOT_WORDS.ADJECTIVES, LOOT_WORDS.MATERIALS, LOOT_WORDS.NOUNS]) assert.equal(new Set(bank.map((w) => w.t)).size, bank.length, 'no duplicate words');
  assert.equal(new Set(LOOT_WORDS.TAGS).size, LOOT_WORDS.TAGS.length);
});

test('signature classics stay in the mix at roughly 15%', () => {
  const share = signature.length / drops.length;
  assert.ok(Math.abs(share - SIGNATURE_CHANCE) < 0.04, `signature share ${share}`);
  for (const d of signature) {
    const item = LOOT.find((l) => l.id === d.loot.id);
    assert.ok(item, 'signature id is a handcrafted item');
    assert.equal(d.loot.name, item.name);
    assert.equal(d.loot.rarity, 'SIGNATURE');
    assert.equal(d.loot.propSpec.shape, 'signature');
    assert.ok(PROP_KEYS.includes(d.loot.propSpec.builder), 'bespoke prop exists');
  }
  assert.ok(new Set(signature.map((d) => d.loot.id)).size >= LOOT.length - 3, 'nearly every classic turns up');
});

test('every drop is well formed: name, tagline, serial, rarity', () => {
  const rar = { CONTRABAND: 0, RARE: 0, ABSURD: 0, SIGNATURE: 0 };
  for (const { loot } of drops) {
    assert.ok(loot.name.length > 8 && loot.name.length < 110, loot.name);
    assert.ok(!/\s{2,}|undefined|null|\[object/.test(loot.name), loot.name);
    assert.ok(loot.tagline.length > 8 && !/undefined/.test(loot.tagline), loot.tagline);
    assert.match(loot.serial, /^FILE #\d{3}-[A-Z]$/);
    assert.ok(RARITIES.includes(loot.rarity));
    assert.ok(typeof loot.id === 'string' && loot.id.length > 1);
    rar[loot.rarity]++;
  }
  for (const r of RARITIES) assert.ok(rar[r] > 60, `rarity ${r} barely appears: ${JSON.stringify(rar)}`);
  assert.ok(rar.CONTRABAND > rar.RARE && rar.RARE > rar.ABSURD, `rarity should be a pyramid: ${JSON.stringify(rar)}`);
});

test('procedural names follow [Owner] [Adjective] [Material] [Object] [(Tag)]', () => {
  const adj = new Set(LOOT_WORDS.ADJECTIVES.map((a) => a.t));
  const nouns = new Set(LOOT_WORDS.NOUNS.map((n) => n.t));
  const seenParts = { owner: 0, material: 0, tag: 0 };
  for (const { loot, theme } of procedural) {
    const p = loot.parts;
    assert.ok(adj.has(p.adjective) && nouns.has(p.noun));
    const expected = [p.owner || (/^[AEIOU]/.test(p.adjective) ? 'An' : 'A'), p.adjective, p.material, p.noun].filter(Boolean).join(' ') + (p.tag ? ` (${p.tag})` : '');
    assert.equal(loot.name, expected);
    if (p.owner) {
      seenParts.owner++;
      assert.ok(LOOT_WORDS.OWNERS_ANY.includes(p.owner) || LOOT_WORDS.OWNERS[theme].includes(p.owner), `${p.owner} does not belong in ${theme}`);
    }
    if (p.material) seenParts.material++;
    if (p.tag) seenParts.tag++;
    assert.match(loot.id, /^p-[0-9a-z]+$/);
  }
  assert.ok(seenParts.owner > procedural.length * 0.7);
  assert.ok(seenParts.material > procedural.length * 0.3 && seenParts.material < procedural.length * 0.6, 'material is optional');
  assert.ok(seenParts.tag > procedural.length * 0.3 && seenParts.tag < procedural.length * 0.55, 'tag is optional');
});

test('loot is theme-flavoured: local owners show up far more in their own theme', () => {
  for (const theme of THEME_IDS) {
    const locals = new Set(LOOT_WORDS.OWNERS[theme]);
    const here = procedural.filter((d) => d.theme === theme && locals.has(d.loot.parts.owner)).length;
    const elsewhere = procedural.filter((d) => d.theme !== theme && locals.has(d.loot.parts.owner)).length;
    assert.ok(here > 100, `${theme} owners appear ${here} times`);
    assert.equal(elsewhere, 0);
  }
});

test('every propSpec is valid and renderable', () => {
  assert.deepEqual([...PROP_SHAPES].sort(), [...SHAPE_KEYS].sort(), 'every noun silhouette has a builder and vice versa');
  assert.ok(PROP_SHAPES.length >= 30);
  const isColour = (c) => Number.isInteger(c) && c >= 0 && c <= 0xffffff;
  const shapes = new Set();
  const toppers = new Set();
  for (const { loot } of procedural) {
    const s = loot.propSpec;
    assert.ok(PROP_SHAPES.includes(s.shape), s.shape);
    assert.ok(isColour(s.primary) && isColour(s.accent) && isColour(s.glow));
    assert.ok(s.scale >= 0.9 && s.scale <= 1.18);
    assert.ok(Math.abs(s.tilt) <= 0.16);
    assert.ok(TOPPERS.includes(s.topper), s.topper);
    if (loot.rarity === 'ABSURD') assert.equal(s.topper, 'halo', 'absurd drops wear a halo');
    else assert.notEqual(s.topper, 'halo');
    shapes.add(s.shape);
    toppers.add(s.topper);
    const noun = LOOT_WORDS.NOUNS.find((n) => n.t === loot.parts.noun);
    assert.equal(s.shape, noun.shape, 'silhouette matches the noun');
    const mat = LOOT_WORDS.MATERIALS.find((m) => m.t === loot.parts.material);
    assert.equal(s.primary, mat ? mat.primary : noun.primary, 'the material word drives the finish');
  }
  assert.equal(shapes.size, PROP_SHAPES.length, 'every silhouette turns up');
  assert.equal(toppers.size, TOPPERS.length, 'every topper turns up');
});

test('composite 3D props build for every silhouette, topper and signature item', () => {
  const count = (g) => {
    let meshes = 0;
    g.traverse((o) => o.isMesh && meshes++);
    return meshes;
  };
  for (const shape of PROP_SHAPES)
    for (const topper of TOPPERS) {
      const g = buildLootProp({ propSpec: { shape, primary: 0xb8862a, accent: 0x16141c, glow: topper === 'bow' ? 0x6aff3a : 0, scale: 1.1, tilt: 0.1, topper } });
      assert.ok(count(g) >= 3, `${shape}/${topper} is too thin`);
    }
  for (const l of LOOT) assert.ok(count(buildLootProp(l.prop)) >= 2, l.prop);
  for (const { loot } of drops.slice(0, 300)) assert.ok(count(buildLootProp(loot)) >= 2, loot.name);
  // props are faceted and cel-shaded, never smooth PBR
  buildLootProp(procedural[0].loot).traverse((o) => {
    if (o.isMesh) assert.equal(o.material.type, 'MeshToonMaterial');
  });
});

// ------------------------------------------------------------ venues

const VENUE_FORMAT = {
  yacht: /^M\/Y [A-Z][A-Za-z' -]+( [IVX]+)? · [A-Z]/,
  office: /^[A-Z][a-z]+ Tower · Floor \d{2} \(.+\)$/,
  lab: /^Sub-Level \d{1,2} · [A-Z][a-z]+ .+ \S+$/,
  bunker: /^Outpost [A-Z][A-Za-z ]+ · [A-Z][a-z]+ [A-Z][A-Za-z ]+ \d{1,2}$/,
  museum: /^The [A-Z][A-Za-z ]+ (Gallery|Collection|Museum|Archive|Institute|Trust) · (Wing|Hall|Vault|Salon|Rotunda|Annex) \S+ \(.+\)$/,
  vr: /^VR Simulation 0x[0-9A-F]{2} · [A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/,
};

test('venue names: deterministic, well formed and in the thousands per theme', () => {
  for (const theme of THEME_IDS) {
    const names = new Set();
    for (let i = 0; i < SEEDS; i++) {
      const v = venueName(theme, new RNG(`venue-${theme}-${i}`));
      assert.equal(v, venueName(theme, new RNG(`venue-${theme}-${i}`)));
      assert.match(v, VENUE_FORMAT[theme], v);
      assert.ok(v.length < 80, v);
      names.add(v);
    }
    assert.ok(names.size >= 380, `${theme}: only ${names.size} distinct venues in ${SEEDS} seeds`);
  }
});

test('rooms carry their target and venue, deterministically and independent of difficulty', () => {
  const seen = new Set();
  for (let i = 0; i < 36; i++) {
    const theme = THEME_IDS[i % 6];
    const a = generateRoom({ seed: `flav-${i}`, level: 1 + (i % 5), theme });
    const b = generateRoom({ seed: `flav-${i}`, level: 1 + (i % 5), theme, mods: { vision: 1.22, speed: 1.25, density: 1.4, puzzleShift: 4, sizeShift: 2 } });
    assert.deepEqual(a.loot.info, b.loot.info, 'difficulty changes the guards, never the prize');
    assert.equal(a.venue, b.venue);
    assert.equal(a.loot.item, a.loot.info.id);
    assert.match(a.venue, VENUE_FORMAT[theme]);
    seen.add(a.loot.info.name);
  }
  assert.ok(seen.size >= 30);
});

// ------------------------------------------------------------ vault

const freshSave = () => ({ vault: {}, stats: { rooms: 0, ghosts: 0, bestStreak: 0, knockouts: 0, heists: 0 } });

test('vault: files unique artifacts with venue, sector, rarity and serial', () => {
  const save = freshSave();
  const loot = procedural[0].loot;
  assert.equal(recordLoot(save, loot, 'A', { venue: 'Apex Tower · Floor 47 (Rainy Annex)', sector: 7, theme: 'office' }), true);
  assert.equal(recordLoot(save, loot, 'S', { venue: 'elsewhere', sector: 9, theme: 'office' }), false, 'a repeat is not a new trophy');
  assert.equal(recordLoot(save, procedural[1].loot, 'B', { venue: 'x', sector: 1, theme: 'lab' }), true);
  const [newest, older] = vaultEntries(save);
  assert.equal(newest.name, procedural[1].loot.name, 'newest first');
  assert.deepEqual(
    { name: older.name, rarity: older.rarity, serial: older.serial, venue: older.venue, sector: older.sector, count: older.count, best: older.best },
    { name: loot.name, rarity: loot.rarity, serial: loot.serial, venue: 'Apex Tower · Floor 47 (Rainy Annex)', sector: 7, count: 2, best: 'S' },
  );
  const sum = vaultSummary(save);
  assert.equal(sum.unique, 2);
  assert.equal(sum.heists, 3);
  assert.equal(sum.signatureTotal, LOOT.length);
});

test('vault: a huge collection stays bounded and never loses signature pieces', () => {
  const save = freshSave();
  for (const d of signature.slice(0, 40)) recordLoot(save, d.loot, 'A', { venue: 'v', sector: 1, theme: d.theme });
  const sigCount = Object.keys(save.vault).length;
  for (const d of procedural) recordLoot(save, d.loot, 'B', { venue: 'v', sector: 2, theme: d.theme });
  const sum = vaultSummary(save);
  assert.equal(sum.unique, MAX_VAULT, 'capped');
  assert.equal(sum.by.SIGNATURE, sigCount, 'signature pieces survive eviction');
  assert.equal(sum.heists, 40 + procedural.length);
  const entries = vaultEntries(save);
  assert.equal(entries[0].name, procedural[procedural.length - 1].loot.name, 'the newest haul is kept');
  assert.ok(JSON.stringify(save.vault).length < 250_000, 'fits comfortably in localStorage');
});
