// localStorage persistence: loot vault, stats, settings.
// (There is no character customisation: the thief is always the thief.)

import { DEFAULT_SETUP, normalizeSetup } from '../core/difficulty.js';
import { LOOT, LOOT_BY_ID } from '../core/loot.js';

const KEY = 'sneaky-sneaky:v1';

const fresh = () => ({
  vault: {}, // lootId -> { name, rarity, serial, tagline, venue, sector, theme, count, best, at }
  stats: { rooms: 0, ghosts: 0, bestStreak: 0, knockouts: 0, heists: 0 },
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

const ORDER = { S: 3, A: 2, B: 1 };
export const MAX_VAULT = 500;

/**
 * File a recovered artifact in the vault. Returns true when it is a new unique
 * trophy. `ctx` is { venue, sector, theme }.
 * The vault keeps the newest MAX_VAULT unique items; signature pieces are
 * never evicted.
 */
export function recordLoot(save, loot, rank, ctx = {}) {
  const st = save.stats;
  st.heists = (st.heists || 0) + 1;
  let e = save.vault[loot.id];
  const isNew = !e;
  if (!e) {
    e = { name: loot.name, rarity: loot.rarity, serial: loot.serial, tagline: loot.tagline, venue: ctx.venue || '', sector: ctx.sector || 0, theme: ctx.theme || '', count: 0, best: rank };
    save.vault[loot.id] = e;
  }
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
