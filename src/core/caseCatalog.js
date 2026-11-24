// The Case File catalog: 48 fixed, playable cases, 12 of every rarity.
//
// Each case is a pinned room spec { seed, level, themeId, layoutStyle } plus
// the target and address that seed rolls. Nothing here is hand-written: for
// every slot we walk a stable series of seeds (`case-absurd-01`,
// `case-absurd-01.1`, ...) and keep the first whose own loot roll comes up
// with the wanted rarity and a target no other case has. So the target, its
// serial, tagline, prop and assignment are exactly what generateRoom() would
// roll for that seed anyway.
//
// Building the catalog only rolls names (a few hundred cheap RNG draws at
// import). Rooms are generated when a case is actually played: caseRoomSpec().

import { THEME_IDS } from './themes.js';
import { LAYOUT_STYLES, rollFlavour } from './generator.js';

/** Catalog order: the rarest folders first. */
export const CASE_RARITIES = ['SIGNATURE', 'ABSURD', 'RARE', 'CONTRABAND'];
export const CASES_PER_RARITY = 12;
export const CASE_TIERS = 10;

const MAX_ROLLS = 5000;

function buildCatalog() {
  const catalog = [];
  const taken = new Set(); // one case per target: the vault files by loot id
  CASE_RARITIES.forEach((rarity, r) => {
    for (let k = 0; k < CASES_PER_RARITY; k++) {
      const no = String(k + 1).padStart(2, '0');
      const id = `case-${rarity.toLowerCase()}-${no}`;
      // Offsets differ per rarity so setting, floor plan and size never line up.
      const themeId = THEME_IDS[(k + r * 2) % THEME_IDS.length];
      const layoutStyle = LAYOUT_STYLES[(k + r) % LAYOUT_STYLES.length];
      const level = 1 + ((k * 3 + r * 7) % CASE_TIERS);
      for (let n = 0; ; n++) {
        if (n >= MAX_ROLLS) throw new Error(`No ${rarity} roll found for ${id}`);
        const seed = n ? `${id}.${n}` : id;
        const { loot, venue } = rollFlavour(seed, level, themeId);
        if (loot.rarity !== rarity || taken.has(loot.id)) continue;
        taken.add(loot.id);
        catalog.push(Object.freeze({ id, caseId: `${rarity}-${no}`, seed, level, themeId, layoutStyle, venue, loot: Object.freeze(loot) }));
        break;
      }
    }
  });
  return Object.freeze(catalog);
}

/** Every catalog case: { id, caseId, seed, level, themeId, layoutStyle, venue, loot }. */
export const CASE_CATALOG = buildCatalog();

const BY_ID = new Map(CASE_CATALOG.map((c) => [c.id, c]));
const BY_LOOT = new Map(CASE_CATALOG.map((c) => [c.loot.id, c]));

export const casesByRarity = (rarity) => CASE_CATALOG.filter((c) => c.loot.rarity === rarity);
export const caseById = (id) => BY_ID.get(id) || null;
/** The catalog case whose target is this loot id (how a vault entry finds its case). */
export const caseByLootId = (lootId) => BY_LOOT.get(lootId) || null;

/** generateRoom() arguments for a case: its exact setting, floor plan, seed, tier and target. */
export function caseRoomSpec(entry, mods = null) {
  return { seed: entry.seed, level: entry.level, theme: entry.themeId, layout: entry.layoutStyle, mods, lootOverride: entry.loot, venueOverride: entry.venue };
}

/** "CASE FILE · ABSURD-07 · TIER 05" for the HUD, loading card and clear screen. */
export function describeCase(entry) {
  return `CASE FILE · ${entry.caseId} · TIER ${String(entry.level).padStart(2, '0')}`;
}
