import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import { generateLoot } from '../src/core/loot.js';
import { THEME_IDS } from '../src/core/themes.js';
import { PRESETS, PRESET_IDS, gameTypeOf } from '../src/core/difficulty.js';
import { loadSave, storeSave, recordLoot, recordRoom, modeCaseFiles, modeSummaryLine, entryModes, vaultEntries, vaultSummary, caseFileCards, catalogClosed, GAME_MODES, CASE_FILE_MODES, GAME_MODE_IDS, DEFAULT_MODE, MAX_VAULT } from '../src/game/save.js';
import { CASE_CATALOG, CASE_RARITIES, casesByRarity, caseById, caseByLootId, caseRoomSpec, describeCase } from '../src/core/caseCatalog.js';
import { generateRoom, rollFlavour, LAYOUT_STYLES } from '../src/core/generator.js';
import { solveTopology, solveStealth } from '../src/core/solver.js';
import { MISSION_VERBS } from '../src/core/loot.js';
import { resolveMods } from '../src/core/difficulty.js';

const KEY = 'sneaky-sneaky:v1';
const memory = (initial = null) => {
  const data = new Map(initial === null ? [] : [[KEY, typeof initial === 'string' ? initial : JSON.stringify(initial)]]);
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
};
const fresh = () => loadSave(memory());
const lootFor = (theme, i) => generateLoot(new RNG(`cf-${theme}-${i}`), theme);
const EMPTY = { rooms: 0, ghosts: 0, bestStreak: 0, bestRank: null, heists: 0, themesCleared: [] };
/** Clear one room the way Game.clear() does. */
const clearRoom = (save, mode, { theme = 'lab', i = 0, rank = 'B', ghost = false, streak = 1, knockouts = 0 } = {}) => {
  const loot = lootFor(theme, i);
  const isNew = recordLoot(save, loot, rank, { venue: 'Somewhere', sector: streak, theme, mode });
  recordRoom(save, mode, { ghost, streak, knockouts });
  return { loot, isNew };
};

test('five game types: the four difficulties and Endless Run', () => {
  assert.deepEqual(GAME_MODE_IDS, ['tourist', 'operative', 'shadow', 'master', 'infinite']);
  assert.deepEqual(GAME_MODES.map((m) => m.label), ['TOURIST', 'OPERATIVE', 'SHADOW', 'GHOST MASTER', 'ENDLESS RUN']);
  assert.equal(CASE_FILE_MODES, GAME_MODES);
  for (const m of GAME_MODES) {
    assert.deepEqual(Object.keys(m), ['id', 'label', 'blurb']);
    assert.ok(m.blurb.length > 20);
  }
  for (const id of PRESET_IDS) assert.equal(GAME_MODES.find((m) => m.id === id).blurb, PRESETS[id].blurb);
  assert.equal(DEFAULT_MODE, 'operative');
  // every game type the game can report has a mini case file
  for (const id of PRESET_IDS) assert.ok(GAME_MODE_IDS.includes(gameTypeOf('mission', { difficulty: id })));
  assert.ok(GAME_MODE_IDS.includes(gameTypeOf('infinite', {})));
});

test('a fresh save has an empty mini case file for every game type', () => {
  const save = fresh();
  assert.deepEqual(Object.keys(save.byMode), GAME_MODE_IDS);
  for (const id of GAME_MODE_IDS) assert.deepEqual(save.byMode[id], EMPTY);
  save.byMode.tourist.themesCleared.push('lab');
  assert.deepEqual(save.byMode.shadow.themesCleared, [], 'the files do not share state');
  const files = modeCaseFiles(save);
  assert.deepEqual(files.map((f) => f.id), GAME_MODE_IDS);
  for (const f of files.slice(1)) {
    assert.deepEqual([f.rooms, f.ghosts, f.bestStreak, f.bestRank, f.heists, f.themes, f.files, f.summary], [0, 0, 0, null, 0, 0, 0, '']);
    assert.equal(f.themesTotal, 10);
  }
});

test('recordLoot tags the entry with its game type and updates that mini case file', () => {
  const save = fresh();
  const { loot, isNew } = clearRoom(save, 'shadow', { theme: 'casino', rank: 'A' });
  assert.equal(isNew, true);
  const e = save.vault[loot.id];
  assert.equal(e.mode, 'shadow');
  assert.deepEqual(e.modes, ['shadow']);
  assert.equal(e.theme, 'casino');
  assert.deepEqual(save.byMode.shadow, { rooms: 1, ghosts: 0, bestStreak: 1, bestRank: 'A', heists: 1, themesCleared: ['casino'] });
  for (const id of GAME_MODE_IDS) if (id !== 'shadow') assert.deepEqual(save.byMode[id], EMPTY, `${id} is untouched`);
  assert.equal(save.stats.heists, 1);
  assert.equal(save.stats.rooms, 1);
});

test('no mode, or an unknown one, is filed under Operative', () => {
  const save = fresh();
  const a = lootFor('lab', 1);
  recordLoot(save, a, 'B'); // the pre-mode call signature still works
  assert.equal(save.vault[a.id].mode, 'operative');
  const b = lootFor('lab', 2);
  recordLoot(save, b, 'B', { theme: 'lab', mode: 'speedrun' });
  assert.equal(save.vault[b.id].mode, 'operative');
  recordRoom(save, 'speedrun', { streak: 2 });
  recordRoom(save, undefined, {});
  assert.equal(save.byMode.operative.heists, 2);
  assert.equal(save.byMode.operative.rooms, 2);
  assert.deepEqual(Object.keys(save.byMode), GAME_MODE_IDS, 'no stray game types appear');
});

test('each game type keeps its own rooms, ghost runs, best streak, best rank and themes', () => {
  const save = fresh();
  clearRoom(save, 'tourist', { theme: 'yacht', i: 1, rank: 'B', streak: 1 });
  clearRoom(save, 'tourist', { theme: 'office', i: 2, rank: 'A', ghost: true, streak: 2 });
  clearRoom(save, 'tourist', { theme: 'yacht', i: 3, rank: 'B', streak: 1 });
  clearRoom(save, 'master', { theme: 'vr', i: 4, rank: 'S', ghost: true, streak: 1, knockouts: 2 });
  for (let n = 1; n <= 12; n++) clearRoom(save, 'infinite', { theme: THEME_IDS[n % 10], i: 10 + n, rank: n === 5 ? 'S' : 'A', ghost: n % 3 === 0, streak: n });
  assert.deepEqual(save.byMode.tourist, { rooms: 3, ghosts: 1, bestStreak: 2, bestRank: 'A', heists: 3, themesCleared: ['yacht', 'office'] });
  assert.deepEqual(save.byMode.master, { rooms: 1, ghosts: 1, bestStreak: 1, bestRank: 'S', heists: 1, themesCleared: ['vr'] });
  const inf = save.byMode.infinite;
  assert.deepEqual([inf.rooms, inf.ghosts, inf.bestStreak, inf.bestRank, inf.heists], [12, 4, 12, 'S', 12]);
  assert.deepEqual([...inf.themesCleared].sort(), [...THEME_IDS].sort(), 'all ten settings cleared in Endless Run');
  assert.deepEqual(save.byMode.operative, EMPTY);
  assert.deepEqual(save.byMode.shadow, EMPTY);
  // the overall stats are still the sum of every game type
  const sum = (k) => GAME_MODE_IDS.reduce((n, id) => n + save.byMode[id][k], 0);
  assert.equal(save.stats.rooms, sum('rooms'));
  assert.equal(save.stats.ghosts, sum('ghosts'));
  assert.equal(save.stats.heists, sum('heists'));
  assert.equal(save.stats.bestStreak, 12);
  assert.equal(save.stats.knockouts, 2);
});

test('best rank only ever improves, and a streak has no cap', () => {
  const save = fresh();
  const ranks = ['B', 'A', 'B', 'S', 'A', 'B'];
  const best = ['B', 'A', 'A', 'S', 'S', 'S'];
  ranks.forEach((rank, i) => {
    clearRoom(save, 'operative', { i, rank });
    assert.equal(save.byMode.operative.bestRank, best[i]);
  });
  recordRoom(save, 'infinite', { streak: 1_000_000 });
  recordRoom(save, 'infinite', { streak: 3 });
  assert.equal(save.byMode.infinite.bestStreak, 1_000_000);
});

test('an artifact closed in several game types remembers all of them, and where it was first closed', () => {
  const save = fresh();
  const loot = lootFor('museum', 7);
  assert.equal(recordLoot(save, loot, 'B', { theme: 'museum', mode: 'operative' }), true);
  assert.equal(recordLoot(save, loot, 'S', { theme: 'museum', mode: 'infinite' }), false);
  assert.equal(recordLoot(save, loot, 'A', { theme: 'museum', mode: 'infinite' }), false);
  const e = save.vault[loot.id];
  assert.equal(e.mode, 'operative', 'the first game type is preserved');
  assert.deepEqual(e.modes, ['operative', 'infinite'], 'no duplicates');
  assert.equal(e.count, 3);
  assert.equal(e.best, 'S');
  assert.deepEqual(entryModes(e), ['operative', 'infinite']);
  assert.equal(save.byMode.operative.bestRank, 'B', 'a rank earned in one game type does not leak into another');
  assert.equal(save.byMode.infinite.bestRank, 'S');
});

test('filtering the case files by game type', () => {
  const save = fresh();
  const made = { tourist: 3, operative: 0, shadow: 5, master: 1, infinite: 8 };
  let i = 0;
  for (const [mode, n] of Object.entries(made)) for (let k = 0; k < n; k++) clearRoom(save, mode, { theme: THEME_IDS[i % 10], i: i++ });
  const shared = lootFor('lab', 500);
  recordLoot(save, shared, 'B', { theme: 'lab', mode: 'tourist' });
  recordLoot(save, shared, 'B', { theme: 'lab', mode: 'master' });
  const all = vaultEntries(save);
  assert.equal(all.length, 18);
  const inMode = (mode) => all.filter((e) => entryModes(e).includes(mode));
  assert.deepEqual(GAME_MODE_IDS.map((m) => inMode(m).length), [4, 0, 5, 2, 8]);
  assert.ok(inMode('tourist').some((e) => e.id === shared.id) && inMode('master').some((e) => e.id === shared.id), 'a shared artifact shows under both');
  assert.deepEqual(modeCaseFiles(save).map((f) => f.files), [4, 0, 5, 2, 8], 'modeCaseFiles counts the same entries');
  // the game-type filter composes with the rarity filter
  for (const mode of GAME_MODE_IDS)
    for (const rarity of ['SIGNATURE', 'ABSURD', 'RARE', 'CONTRABAND']) {
      const both = all.filter((e) => entryModes(e).includes(mode) && e.rarity === rarity);
      assert.deepEqual(both, inMode(mode).filter((e) => e.rarity === rarity));
      assert.ok(both.length <= vaultSummary(save).by[rarity]);
    }
  assert.equal(GAME_MODE_IDS.reduce((n, m) => n + inMode(m).length, 0), all.length + 1, 'only the shared artifact is counted twice');
});

test('modeCaseFiles: the dossier summary for every game type', () => {
  const save = fresh();
  clearRoom(save, 'operative', { theme: 'alpine', i: 1, rank: 'S', ghost: true, streak: 1 });
  clearRoom(save, 'operative', { theme: 'subway', i: 2, rank: 'A', streak: 2 });
  clearRoom(save, 'operative', { theme: 'alpine', i: 3, rank: 'B', streak: 3 });
  clearRoom(save, 'infinite', { theme: 'greenhouse', i: 4, rank: 'B', streak: 1 });
  const files = modeCaseFiles(save);
  assert.equal(files.length, 5);
  const by = Object.fromEntries(files.map((f) => [f.id, f]));
  assert.deepEqual(by.operative, {
    id: 'operative',
    label: 'OPERATIVE',
    blurb: PRESETS.operative.blurb,
    rooms: 3,
    ghosts: 1,
    bestStreak: 3,
    bestRank: 'S',
    heists: 3,
    themesCleared: ['alpine', 'subway'],
    themes: 2,
    themesTotal: 10,
    files: 3,
    summary: '3 cleared · Best S',
  });
  assert.equal(by.infinite.label, 'ENDLESS RUN');
  assert.equal(by.infinite.summary, '1 cleared · Best B');
  assert.equal(`${by.infinite.themes}/${by.infinite.themesTotal}`, '1/10');
  assert.equal(by.tourist.summary, '', 'nothing to show until a game type has been played');
  assert.equal(by.master.bestRank, null);
  // the summary is a copy: drawing the UI can never corrupt the save
  by.operative.themesCleared.push('vr');
  by.operative.rooms = 99;
  assert.deepEqual(save.byMode.operative.themesCleared, ['alpine', 'subway']);
  assert.equal(save.byMode.operative.rooms, 3);
});

test('modeSummaryLine', () => {
  assert.equal(modeSummaryLine(null), '');
  assert.equal(modeSummaryLine({ rooms: 0, bestRank: null }), '');
  assert.equal(modeSummaryLine({ rooms: 3, bestRank: 'S' }), '3 cleared · Best S');
  assert.equal(modeSummaryLine({ rooms: 1, bestRank: 'B' }), '1 cleared · Best B');
  assert.equal(modeSummaryLine({ rooms: 41, bestRank: null }), '41 cleared');
});

test('mini case files survive a save and reload', () => {
  const storage = memory();
  const save = loadSave(storage);
  clearRoom(save, 'shadow', { theme: 'casino', i: 1, rank: 'A', ghost: true, streak: 4 });
  clearRoom(save, 'infinite', { theme: 'subway', i: 2, rank: 'S', streak: 9 });
  storeSave(save, storage);
  assert.ok(storage.data.has(KEY), 'still the v1 key');
  const again = loadSave(storage);
  assert.deepEqual(again.byMode, save.byMode);
  assert.deepEqual(again.vault, save.vault);
  assert.deepEqual(modeCaseFiles(again), modeCaseFiles(save));
  assert.deepEqual(vaultEntries(again).map((e) => e.mode).sort(), ['infinite', 'shadow']);
});

test('backwards compatible: a v1 save from before game types loads untouched, with empty mini case files', () => {
  const old = {
    vault: {
      duck: { count: 2, best: 'A' }, // the oldest format: handcrafted item, { count, best } only
      'p-abc123': { name: "The Intern's Haunted Brass Toaster", rarity: 'RARE', serial: 'FILE #123-A', tagline: 'It hums.', verb: 'RECOVERED', venue: 'Apex Tower', sector: 3, theme: 'office', count: 1, best: 'S', at: 3 },
    },
    stats: { rooms: 40, ghosts: 12, bestStreak: 9, knockouts: 5, heists: 41 },
    settings: { mute: true, cam: 'tactical', setup: { difficulty: 'shadow', ramp: 'turbo', start: 'large', alert: 1.2, vision: 1, theme: 'lab' } },
  };
  const save = loadSave(memory(old));
  assert.deepEqual(save.stats, old.stats, 'overall stats are kept exactly');
  assert.deepEqual(save.settings.setup, old.settings.setup);
  assert.equal(save.settings.mute, true);
  assert.equal(Object.keys(save.vault).length, 2);
  assert.equal(save.vault['p-abc123'].name, "The Intern's Haunted Brass Toaster");
  assert.equal(save.vault.duck.rarity, 'SIGNATURE');
  for (const id of GAME_MODE_IDS) assert.deepEqual(save.byMode[id], EMPTY);
  // old entries were never tagged: they show under ALL MODES only, and nothing is invented for them
  for (const e of vaultEntries(save)) assert.deepEqual(entryModes(e), []);
  assert.deepEqual(modeCaseFiles(save).map((f) => f.files), [0, 0, 0, 0, 0]);
  assert.equal(vaultSummary(save).unique, 2);
  // closing an old entry again tags it from then on
  recordLoot(save, { id: 'p-abc123', name: 'x', rarity: 'RARE' }, 'B', { theme: 'office', mode: 'infinite' });
  assert.equal(save.vault['p-abc123'].mode, 'infinite');
  assert.deepEqual(save.vault['p-abc123'].modes, ['infinite']);
  assert.equal(save.vault['p-abc123'].name, "The Intern's Haunted Brass Toaster");
  assert.equal(save.vault['p-abc123'].best, 'S');
});

test('damaged or hand-edited byMode data is repaired on load', () => {
  const save = loadSave(
    memory({
      byMode: {
        tourist: { rooms: '7', ghosts: -3, bestStreak: 2.9, bestRank: 'Z', heists: null, themesCleared: ['lab', 'lab', 'atlantis', 42, 'casino'] },
        operative: 'nonsense',
        shadow: { rooms: 4, bestRank: 'A', themesCleared: 'lab' },
        speedrun: { rooms: 99 },
      },
    }),
  );
  assert.deepEqual(Object.keys(save.byMode), GAME_MODE_IDS, 'unknown game types are dropped, missing ones created');
  assert.deepEqual(save.byMode.tourist, { rooms: 0, ghosts: 0, bestStreak: 2, bestRank: null, heists: 0, themesCleared: ['lab', 'casino'] });
  assert.deepEqual(save.byMode.operative, EMPTY);
  assert.deepEqual(save.byMode.shadow, { ...EMPTY, rooms: 4, bestRank: 'A' });
  assert.deepEqual(save.byMode.infinite, EMPTY);
  for (const bad of ['{"byMode":null}', '{"byMode":[]}', '{"byMode":7}', 'not json', '[]']) {
    const s = loadSave(memory(bad));
    for (const id of GAME_MODE_IDS) assert.deepEqual(s.byMode[id], EMPTY, bad);
  }
  // and the recorders cope with a save object that has no byMode at all
  const bare = { vault: {}, stats: {} };
  clearRoom(bare, 'infinite', { theme: 'alpine', rank: 'A', ghost: true, streak: 2 });
  assert.deepEqual(bare.byMode.infinite, { rooms: 1, ghosts: 1, bestStreak: 2, bestRank: 'A', heists: 1, themesCleared: ['alpine'] });
  assert.deepEqual(modeCaseFiles({}).map((f) => f.rooms), [0, 0, 0, 0, 0]);
});

test('vault eviction keeps the mini case files intact', () => {
  const save = fresh();
  for (let i = 0; i < MAX_VAULT + 40; i++) recordLoot(save, { id: `p-evict-${i}`, name: `Thing ${i}`, rarity: 'CONTRABAND', serial: 'FILE #100-A', tagline: 't' }, 'B', { theme: THEME_IDS[i % 10], mode: i % 2 ? 'infinite' : 'master' });
  assert.equal(Object.keys(save.vault).length, MAX_VAULT);
  assert.equal(save.byMode.infinite.heists + save.byMode.master.heists, MAX_VAULT + 40, 'stats count every heist, not just what is still on file');
  assert.equal(save.byMode.infinite.themesCleared.length, 5);
  const files = modeCaseFiles(save);
  assert.equal(files.reduce((n, f) => n + f.files, 0), MAX_VAULT);
});

// ---------------------------------------------------------------- the playable catalog

test('catalog: 48 playable cases, 12 for every rarity, all unique', () => {
  assert.deepEqual([...CASE_RARITIES].sort(), ['ABSURD', 'CONTRABAND', 'RARE', 'SIGNATURE']);
  assert.ok(CASE_CATALOG.length >= 48);
  for (const rarity of CASE_RARITIES) {
    const cases = casesByRarity(rarity);
    assert.ok(cases.length >= 12, `${rarity} has ${cases.length} cases`);
    for (const c of cases) assert.equal(c.loot.rarity, rarity);
  }
  assert.equal(CASE_RARITIES.reduce((n, r) => n + casesByRarity(r).length, 0), CASE_CATALOG.length, 'every case is one of the four rarities');
  for (const key of ['id', 'caseId', 'seed']) assert.equal(new Set(CASE_CATALOG.map((c) => c[key])).size, CASE_CATALOG.length, `unique ${key}`);
  assert.equal(new Set(CASE_CATALOG.map((c) => c.loot.id)).size, CASE_CATALOG.length, 'one case per target, so the vault can match by loot id');
  assert.equal(new Set(CASE_CATALOG.map((c) => c.loot.name)).size, CASE_CATALOG.length);
  for (const c of CASE_CATALOG) {
    assert.deepEqual(Object.keys(c), ['id', 'caseId', 'seed', 'level', 'themeId', 'layoutStyle', 'venue', 'loot']);
    assert.match(c.id, /^case-(signature|absurd|rare|contraband)-\d\d$/);
    assert.ok(c.seed.startsWith(c.id), 'the seed is the stable case id, plus the roll that hit the rarity');
    assert.equal(caseById(c.id), c);
    assert.equal(caseByLootId(c.loot.id), c);
    assert.ok(c.venue.length > 3 && c.loot.name && c.loot.tagline && c.loot.propSpec);
    assert.match(c.loot.serial, /^FILE #\d{3}-[A-Z]$/);
    assert.ok(MISSION_VERBS.some((v) => v.verb === c.loot.mission.verb));
    assert.equal(c.loot.signature, c.loot.rarity === 'SIGNATURE');
  }
  assert.equal(caseById('case-absurd-99'), null);
  assert.equal(caseByLootId('nope'), null);
});

test('catalog: spread evenly over all 10 themes, all 4 layout styles and tiers 1 to 10', () => {
  const tally = (f) => CASE_CATALOG.reduce((m, c) => m.set(f(c), (m.get(f(c)) || 0) + 1), new Map());
  const themes = tally((c) => c.themeId);
  assert.deepEqual([...themes.keys()].sort(), [...THEME_IDS].sort());
  assert.ok(Math.max(...themes.values()) - Math.min(...themes.values()) <= 1, 'themes are balanced');
  const layouts = tally((c) => c.layoutStyle);
  assert.deepEqual([...layouts.keys()].sort(), [...LAYOUT_STYLES].sort());
  assert.equal(new Set(layouts.values()).size, 1, 'layout styles are perfectly balanced');
  const tiers = tally((c) => c.level);
  assert.deepEqual([...tiers.keys()].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const rarity of CASE_RARITIES) {
    const cases = casesByRarity(rarity);
    assert.equal(new Set(cases.map((c) => c.themeId)).size, 10, `${rarity} visits every theme`);
    assert.equal(new Set(cases.map((c) => c.layoutStyle)).size, 4, `${rarity} uses every layout style`);
    assert.ok(new Set(cases.map((c) => c.level)).size >= 8, `${rarity} varies its tiers`);
  }
});

test('catalog: every target is the authentic roll of its seed, and it is deterministic', () => {
  for (const c of CASE_CATALOG) {
    const { loot, venue } = rollFlavour(c.seed, c.level, c.themeId);
    assert.deepEqual(loot, c.loot, c.id);
    assert.equal(venue, c.venue, c.id);
  }
  assert.equal(describeCase(caseById('case-rare-03')), `CASE FILE · RARE-03 · TIER ${String(caseById('case-rare-03').level).padStart(2, '0')}`);
});

test('catalog: sample cases of every rarity generate verified rooms with their exact target', () => {
  for (const rarity of CASE_RARITIES) {
    const cases = casesByRarity(rarity);
    for (const c of [cases[0], cases[5], cases[11]]) {
      const room = generateRoom(caseRoomSpec(c, resolveMods({ difficulty: 'operative' })));
      assert.equal(room.themeId, c.themeId, c.id);
      assert.equal(room.layoutStyle, c.layoutStyle, c.id);
      assert.equal(room.level, c.level, c.id);
      assert.equal(room.seed, c.seed, c.id);
      assert.equal(room.venue, c.venue, c.id);
      assert.equal(room.loot.info, c.loot, 'the exact catalog target');
      assert.equal(room.loot.item, c.loot.id);
      assert.ok(solveTopology(room).ok, `${c.id} is reachable`);
      assert.ok(solveStealth(room, room.guards).ok, `${c.id} has a ghost route`);
      // without the override the seed rolls the very same target and address
      const plain = generateRoom({ seed: c.seed, level: c.level, theme: c.themeId, layout: c.layoutStyle, mods: resolveMods({ difficulty: 'operative' }) });
      assert.deepEqual(plain.loot.info, c.loot);
      assert.equal(plain.venue, c.venue);
    }
  }
});

test('catalog: every case generates on every difficulty', () => {
  for (const difficulty of PRESET_IDS) {
    const mods = resolveMods({ difficulty });
    for (const c of CASE_CATALOG) assert.equal(generateRoom(caseRoomSpec(c, mods)).loot.info.id, c.loot.id, `${c.id} on ${difficulty}`);
  }
});

test('generateRoom: lootOverride and venueOverride pin the target without touching the floor plan', () => {
  const c = caseById('case-absurd-01');
  const base = { seed: 'override-check', level: 3, theme: 'museum', layout: 'atrium' };
  const plain = generateRoom(base);
  const pinned = generateRoom({ ...base, lootOverride: c.loot, venueOverride: 'The Override Wing' });
  assert.equal(pinned.loot.info, c.loot);
  assert.equal(pinned.loot.item, c.loot.id);
  assert.equal(pinned.venue, 'The Override Wing');
  assert.notEqual(plain.loot.info.id, c.loot.id);
  assert.deepEqual(pinned.cells, plain.cells);
  assert.deepEqual(pinned.guards, plain.guards);
  // one override alone still works: the other is rolled as usual
  assert.equal(generateRoom({ ...base, lootOverride: c.loot }).venue, plain.venue);
});

test('case files grid: a fresh save already has 12 playable cases under every rarity', () => {
  const save = fresh();
  const cards = caseFileCards(save);
  assert.equal(cards.length, CASE_CATALOG.length);
  for (const rarity of CASE_RARITIES) assert.equal(cards.filter((c) => c.rarity === rarity).length, 12, rarity);
  for (const c of cards) {
    assert.ok(c.entry, 'playable');
    assert.equal(c.file, null, 'still open');
  }
  assert.equal(catalogClosed(save), 0);
  for (const id of GAME_MODE_IDS) assert.deepEqual(caseFileCards(save, id), [], 'a mode folder only lists what was closed in it');
});

test('case files grid: clearing a catalog case closes its card, by loot id', () => {
  const save = fresh();
  const c = caseById('case-signature-04');
  assert.equal(recordLoot(save, c.loot, 'A', { venue: c.venue, sector: c.level, theme: c.themeId, mode: 'shadow' }), true);
  recordRoom(save, 'shadow', { streak: 1 });
  const card = caseFileCards(save).find((x) => x.entry === c);
  assert.equal(card.file.best, 'A');
  assert.equal(card.id, c.loot.id);
  assert.equal(catalogClosed(save), 1);
  recordLoot(save, c.loot, 'S', { venue: c.venue, sector: c.level, theme: c.themeId, mode: 'shadow' });
  assert.equal(caseFileCards(save).find((x) => x.entry === c).file.best, 'S', 'a replay improves the stamp');
  assert.equal(caseFileCards(save).length, CASE_CATALOG.length, 'a closed catalog case is not listed twice');
  // it survives a save round trip
  const disk = memory();
  storeSave(save, disk);
  assert.equal(caseFileCards(loadSave(disk)).find((x) => x.entry === c).file.best, 'S');
  // the mode folder shows it, still playable
  const inShadow = caseFileCards(save, 'shadow');
  assert.equal(inShadow.length, 1);
  assert.equal(inShadow[0].entry, c);
  assert.deepEqual(caseFileCards(save, 'tourist'), []);
});

test('case files grid: procedural cases closed in the field are listed after the catalog', () => {
  const save = fresh();
  const extras = [];
  for (let i = 0; extras.length < 5; i++) {
    const loot = lootFor('casino', 500 + i);
    if (caseByLootId(loot.id) || save.vault[loot.id]) continue;
    recordLoot(save, loot, 'B', { theme: 'casino', mode: 'infinite' });
    extras.push(loot);
  }
  const cards = caseFileCards(save);
  assert.equal(cards.length, CASE_CATALOG.length + 5);
  assert.ok(cards.slice(0, CASE_CATALOG.length).every((c) => c.entry));
  const tail = cards.slice(CASE_CATALOG.length);
  assert.ok(tail.every((c) => !c.entry && c.file));
  assert.deepEqual(tail.map((c) => c.id), extras.map((l) => l.id).reverse(), 'newest first');
  for (const rarity of CASE_RARITIES) assert.ok(cards.filter((c) => c.rarity === rarity).length >= 12);
  assert.equal(caseFileCards(save, 'infinite').length, 5);
  assert.equal(catalogClosed(save), 0);
});
