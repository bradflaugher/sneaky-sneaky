// localStorage persistence: case files (completed missions), stats, settings.
// (There is no character customisation: the thief is always the thief.)

import { DEFAULT_SETUP, PRESETS, normalizeSetup } from '../core/difficulty.js';
import { LOOT, LOOT_BY_ID } from '../core/loot.js';
import { THEME_IDS } from '../core/themes.js';
import { CASE_CATALOG, caseByLootId } from '../core/caseCatalog.js';

const KEY = 'sneaky-sneaky:v1';

/**
 * Every game type keeps its own mini case file: the four difficulty presets
 * of the mission ladder, plus the Endless Run (id `infinite`, `?mode=infinite`).
 */
export const GAME_MODES = [
  ...Object.values(PRESETS).map((p) => ({ id: p.id, label: p.name.toUpperCase(), blurb: p.blurb })),
  { id: 'infinite', label: 'ENDLESS RUN', blurb: 'Endless random-seeded rooms: a new setting, floor plan and assignment every time.' },
];
export const CASE_FILE_MODES = GAME_MODES;
export const GAME_MODE_IDS = GAME_MODES.map((m) => m.id);
/** Rooms cleared before modes were tracked, or with no mode given, count as Operative. */
export const DEFAULT_MODE = 'operative';

const ORDER = { S: 3, A: 2, B: 1 };
const freshMode = () => ({ rooms: 0, ghosts: 0, bestStreak: 0, bestRank: null, heists: 0, themesCleared: [] });
const freshByMode = () => Object.fromEntries(GAME_MODE_IDS.map((id) => [id, freshMode()]));
const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const modeOf = (id) => (GAME_MODE_IDS.includes(id) ? id : DEFAULT_MODE);

/** Coerce whatever was stored for one game type into a clean mini case file. */
function cleanMode(raw) {
  const m = freshMode();
  if (!raw || typeof raw !== 'object') return m;
  for (const k of ['rooms', 'ghosts', 'bestStreak', 'heists']) m[k] = count(raw[k]);
  if (ORDER[raw.bestRank]) m.bestRank = raw.bestRank;
  if (Array.isArray(raw.themesCleared)) m.themesCleared = [...new Set(raw.themesCleared.filter((t) => THEME_IDS.includes(t)))];
  return m;
}

const fresh = () => ({
  vault: {}, // lootId -> { name, rarity, serial, tagline, venue, sector, theme, mode, modes, count, best, at }
  stats: { rooms: 0, ghosts: 0, bestStreak: 0, knockouts: 0, heists: 0 },
  byMode: freshByMode(), // game type -> { rooms, ghosts, bestStreak, bestRank, heists, themesCleared }
  settings: { mute: false, cam: 'chase', setup: { ...DEFAULT_SETUP } },
});

/** Load the save. `storage` is injectable for tests; anything with getItem works. */
export function loadSave(storage = globalThis.localStorage) {
  const base = fresh();
  try {
    const raw = JSON.parse((storage && storage.getItem(KEY)) || 'null');
    if (raw && typeof raw === 'object') {
      Object.assign(base.vault, raw.vault);
      Object.assign(base.stats, raw.stats);
      Object.assign(base.settings, raw.settings);
      // older saves stored only { count, best } for the handcrafted items
      for (const [id, e] of Object.entries(base.vault)) {
        if (!e || typeof e !== 'object') delete base.vault[id];
        else if (!e.name) {
          const sig = LOOT_BY_ID[id];
          if (!sig) delete base.vault[id];
          else Object.assign(e, { name: sig.name, tagline: sig.flavor, rarity: 'SIGNATURE', serial: 'FILE #000-A', venue: '', sector: 0, theme: '', at: 0 });
        }
      }
      // saves from before per-mode tracking simply start every mini case file empty
      for (const id of GAME_MODE_IDS) base.byMode[id] = cleanMode(raw.byMode?.[id]);
      if (!base.stats.heists) base.stats.heists = Object.values(base.vault).reduce((n, e) => n + (e.count || 0), 0);
      base.settings.setup = normalizeSetup({ theme: raw.settings?.theme, ...(raw.settings?.setup || {}) });
      delete base.settings.theme;
      // visual style ids from earlier versions
      const style = base.settings.style;
      if (style === 'ps1' || style === 'noir') base.settings.style = 'print';
      if (style === 'crisp' || style === 'clean') base.settings.style = 'ink';
    }
  } catch {
    // corrupted or unavailable storage: start fresh
  }
  return base;
}

export function storeSave(save, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(save));
  } catch {
    // storage full or blocked: the game still works, it just forgets
  }
}

export const MAX_VAULT = 500;

/**
 * File a recovered artifact in the vault. Returns true when it is a new unique
 * trophy. `ctx` is { venue, sector, theme, mode }; `mode` is the game type
 * (see GAME_MODES) and defaults to Operative. The entry keeps the `mode` it was
 * first closed in and the set of `modes` it has ever been closed in, and the
 * game type's mini case file gains the heist, the rank and the setting.
 * The vault keeps the newest MAX_VAULT unique items; signature pieces are
 * never evicted.
 */
export function recordLoot(save, loot, rank, ctx = {}) {
  const st = save.stats;
  st.heists = (st.heists || 0) + 1;
  const mode = modeOf(ctx.mode || DEFAULT_MODE);
  const file = modeFile(save, mode);
  file.heists++;
  if ((ORDER[rank] || 0) > (ORDER[file.bestRank] || 0)) file.bestRank = rank;
  if (THEME_IDS.includes(ctx.theme) && !file.themesCleared.includes(ctx.theme)) file.themesCleared.push(ctx.theme);
  let e = save.vault[loot.id];
  const isNew = !e;
  if (!e) {
    e = { name: loot.name, rarity: loot.rarity, serial: loot.serial, tagline: loot.tagline, verb: loot.mission ? loot.mission.past : 'RECOVERED', venue: ctx.venue || '', sector: ctx.sector || 0, theme: ctx.theme || '', mode, modes: [mode], count: 0, best: rank };
    save.vault[loot.id] = e;
  }
  if (!e.mode) e.mode = mode; // an entry from before modes were tracked
  if (!Array.isArray(e.modes)) e.modes = [e.mode];
  if (!e.modes.includes(mode)) e.modes.push(mode);
  e.count++;
  e.at = st.heists;
  if ((ORDER[rank] || 0) > (ORDER[e.best] || 0)) e.best = rank;
  const ids = Object.keys(save.vault);
  if (ids.length > MAX_VAULT) {
    const evict = ids.filter((id) => save.vault[id].rarity !== 'SIGNATURE').sort((x, y) => (save.vault[x].at || 0) - (save.vault[y].at || 0));
    for (let i = 0; i < ids.length - MAX_VAULT && i < evict.length; i++) delete save.vault[evict[i]];
  }
  return isNew;
}

/** The mini case file for one game type, created on demand (old or hand-edited saves). */
function modeFile(save, mode) {
  if (!save.byMode || typeof save.byMode !== 'object') save.byMode = freshByMode();
  if (!save.byMode[mode]) save.byMode[mode] = freshMode();
  return save.byMode[mode];
}

/**
 * Count a cleared room: overall stats and the game type's mini case file.
 * `run` is { ghost, streak, knockouts }; `streak` is the run's current streak
 * including this room.
 */
export function recordRoom(save, mode, { ghost = false, streak = 0, knockouts = 0 } = {}) {
  const st = save.stats;
  const file = modeFile(save, modeOf(mode));
  st.rooms = (st.rooms || 0) + 1;
  file.rooms++;
  if (ghost) {
    st.ghosts = (st.ghosts || 0) + 1;
    file.ghosts++;
  }
  st.knockouts = (st.knockouts || 0) + knockouts;
  st.bestStreak = Math.max(st.bestStreak || 0, streak);
  file.bestStreak = Math.max(file.bestStreak, streak);
  return file;
}

/** The game types a vault entry has been closed in (empty for entries older than mode tracking). */
export const entryModes = (e) => (Array.isArray(e.modes) && e.modes.length ? e.modes : e.mode ? [e.mode] : []);

/** "3 cleared · Best S", or '' for a game type that has not been played yet. */
export function modeSummaryLine(file) {
  if (!file || !file.rooms) return '';
  return `${file.rooms} cleared${file.bestRank ? ` · Best ${file.bestRank}` : ''}`;
}

/**
 * The mini case-file dossier for every game type, in GAME_MODES order:
 * { id, label, blurb, rooms, ghosts, bestStreak, bestRank, heists,
 *   themesCleared, themes, themesTotal, files, summary }.
 * `files` is how many unique vault entries were closed in that game type.
 */
export function modeCaseFiles(save) {
  const entries = Object.values(save.vault || {});
  return GAME_MODES.map((m) => {
    const file = cleanMode(save.byMode?.[m.id]);
    return {
      ...m,
      ...file,
      themes: file.themesCleared.length,
      themesTotal: THEME_IDS.length,
      files: entries.filter((e) => entryModes(e).includes(m.id)).length,
      summary: modeSummaryLine(file),
    };
  });
}

/**
 * The cards the Case Files grid shows, in order. Each is
 * `{ id, rarity, entry, file }`: `entry` is the playable catalog case (or null
 * for a procedural target met out in the field) and `file` is its vault entry
 * (or null while the case is still open).
 *   - all modes (`mode` null): the whole playable catalog, then every other
 *     closed case, newest first. No rarity is ever empty.
 *   - one game type: the cases closed in that game type, newest first.
 */
export function caseFileCards(save, mode = null) {
  const vault = save.vault || {};
  const closed = vaultEntries(save).map((file) => ({ id: file.id, rarity: file.rarity, entry: caseByLootId(file.id), file }));
  if (mode) return closed.filter((c) => entryModes(c.file).includes(mode));
  const catalog = CASE_CATALOG.map((entry) => ({ id: entry.loot.id, rarity: entry.loot.rarity, entry, file: vault[entry.loot.id] ? { id: entry.loot.id, ...vault[entry.loot.id] } : null }));
  return catalog.concat(closed.filter((c) => !c.entry));
}

/** How many catalog cases this save has closed. */
export const catalogClosed = (save) => CASE_CATALOG.filter((c) => save.vault?.[c.loot.id]).length;

/** Vault entries, newest first, with their ids. */
export function vaultEntries(save) {
  return Object.entries(save.vault)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (b.at || 0) - (a.at || 0));
}

export function vaultSummary(save) {
  const entries = Object.values(save.vault);
  const by = { CONTRABAND: 0, RARE: 0, ABSURD: 0, SIGNATURE: 0 };
  for (const e of entries) by[e.rarity] = (by[e.rarity] || 0) + 1;
  return { unique: entries.length, heists: save.stats.heists || 0, signatureTotal: LOOT.length, by };
}
