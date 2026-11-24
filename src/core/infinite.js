// Endless Run (mode id `infinite`): an endless, seeded run of rooms with nothing held constant.
//
// Every room rolls a fresh setting, a fresh architectural layout style, a
// fresh size and (through its own room seed) a fresh assignment. Everything
// here is a pure function of (run seed, room number), so a shared
// `?mode=infinite&seed=...` link replays the same run room for room, and room
// 4000 costs no more to work out than room 4.

import { RNG } from './rng.js';
import { THEME_IDS } from './themes.js';
import { LAYOUT_STYLES } from './generator.js';
import { resolveMods } from './difficulty.js';

/** Endless Run is its own game type: fair Operative guards, whatever Mission Setup says. */
export const INFINITE_MODS = Object.freeze(resolveMods({ difficulty: 'operative' }));

/** Where the size ladder tops out; past this, rooms just keep varying. */
export const INFINITE_TIER_CAP = 12;

/**
 * The n-th draw (0-based) from an endless series of shuffled bags of `items`.
 * Each bag holds every item once, so nothing goes missing for long, and a bag
 * never opens with the item that closed the one before: no back-to-back repeats.
 */
export function bagDraw(seed, label, items, n) {
  const size = items.length;
  const bag = (b) => {
    const order = new RNG(`${seed}|${label}|bag${b}`).shuffle(items.slice());
    // Only slots 0 and 1 ever swap, so the last slot of the previous bag is
    // its plain shuffled order and this never recurses further back.
    if (b > 0 && size > 2) {
      const prev = new RNG(`${seed}|${label}|bag${b - 1}`).shuffle(items.slice());
      if (order[0] === prev[size - 1]) [order[0], order[1]] = [order[1], order[0]];
    }
    return order;
  };
  const i = Math.max(0, Math.floor(n));
  return bag(Math.floor(i / size))[i % size];
}

/** Generator tier for the n-th room: a quick climb, then big rooms of every size. */
export function infiniteTier(seed, roomNo) {
  const n = Math.max(1, Math.floor(roomNo));
  const rng = new RNG(`${seed}|inf-tier|${n}`);
  const base = 2 + Math.floor((n - 1) / 2);
  if (base < INFINITE_TIER_CAP) return Math.max(1, base + rng.int(-1, 1));
  return INFINITE_TIER_CAP + rng.int(-4, 4);
}

/**
 * Everything needed to generate the n-th room (1-based) of an infinite run:
 * `{ roomNo, seed, theme, layout, level, mods }`, ready for generateRoom().
 * There is no last room.
 */
export function infiniteRoom(seed, roomNo) {
  const n = Math.max(1, Math.floor(roomNo));
  return {
    roomNo: n,
    seed: `${seed}#inf${n}`,
    theme: bagDraw(seed, 'theme', THEME_IDS, n - 1),
    layout: bagDraw(seed, 'layout', LAYOUT_STYLES, n - 1),
    level: infiniteTier(seed, n),
    mods: INFINITE_MODS,
  };
}

/** "ENDLESS RUN · SEED 7QK2 · ROOM 07 · STREAK 3" for the HUD, banner and clear screen. */
export function describeInfinite(roomNo, seed, streak = 0) {
  const parts = ['ENDLESS RUN', `SEED ${seed}`, `ROOM ${String(roomNo).padStart(2, '0')}`];
  if (streak > 0) parts.push(`STREAK ${streak}`);
  return parts.join(' · ');
}
