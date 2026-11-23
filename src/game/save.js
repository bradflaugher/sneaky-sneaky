// localStorage persistence: agent look, loot vault, stats, settings.

import { DEFAULT_AGENT } from '../render/character.js';
import { DEFAULT_SETUP, normalizeSetup } from '../core/difficulty.js';

const KEY = 'sneaky-sneaky:v1';

const fresh = () => ({
  agent: { ...DEFAULT_AGENT },
  vault: {}, // lootId -> { count, best: 'S' | 'A' | 'B' }
  stats: { rooms: 0, ghosts: 0, bestStreak: 0, knockouts: 0 },
  settings: { mute: false, cam: 'chase', setup: { ...DEFAULT_SETUP } },
});

export function loadSave() {
  const base = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      Object.assign(base.agent, raw.agent);
      Object.assign(base.vault, raw.vault);
      Object.assign(base.stats, raw.stats);
      Object.assign(base.settings, raw.settings);
      base.settings.setup = normalizeSetup({ theme: raw.settings?.theme, ...(raw.settings?.setup || {}) });
      delete base.settings.theme;
    }
  } catch {
    // corrupted or unavailable storage: start fresh
  }
  return base;
}

export function storeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // storage full or blocked: the game still works, it just forgets
  }
}

const ORDER = { S: 3, A: 2, B: 1 };
export function recordLoot(save, lootId, rank) {
  const e = save.vault[lootId] || { count: 0, best: 'B' };
  e.count++;
  if ((ORDER[rank] || 0) > (ORDER[e.best] || 0) || e.count === 1) e.best = rank;
  save.vault[lootId] = e;
}
