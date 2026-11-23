// Agent identity: the customizer's option lists, cohesive palettes, codenames,
// and the random agent generator. Pure data + functions (no three.js) so the
// first-run flow can be unit tested.
//
// There is no hardcoded default agent. A new player is dealt a fresh random
// original, and picks or rerolls on the Select Your Agent screen.

import { RNG } from './rng.js';

export const OUTFITS = {
  longcoat: 'Long Coat',
  moto: 'Cropped Moto Jacket',
  parka: 'Hooded Parka',
  suit: 'Tailored Heist Suit',
  techvest: 'Tech Vest',
  jumpsuit: 'Jumpsuit',
  poncho: 'Stealth Poncho',
  rig: 'Tactical Rig',
};
export const HEADGEAR = {
  hood: 'Hood',
  bucket: 'Bucket Hat',
  beanie: 'Beanie',
  roundshades: 'Round Shades',
  visorcap: 'Visor Cap',
  headphones: 'Headphones',
  flatcap: 'Flat Cap',
  cropped: 'Cropped Hair',
  spiky: 'Spiky Hair',
  ponytail: 'Ponytail',
  goggles: 'Goggles',
  bandana: 'Bandana',
};
export const BUILDS = {
  slim: { name: 'Slim', w: 0.9, h: 1.0 },
  standard: { name: 'Standard', w: 1.0, h: 1.0 },
  stocky: { name: 'Stocky', w: 1.18, h: 0.95 },
  tall: { name: 'Tall', w: 0.97, h: 1.09 },
  compact: { name: 'Compact', w: 1.0, h: 0.88 },
};
export const SKIN_TONES = [0xe9c4a0, 0xd3a077, 0xb98358, 0x93633e, 0x6b4429, 0x452b1b];
export const HAIR_COLORS = [0x15110e, 0x3a2616, 0x6a4a2a, 0xb89a5a, 0x8a8a8a, 0x8a2a1a, 0x2a6a5a, 0xd8d2c4];

// Cohesive two-tone looks: a body colour and an accent that sings against the
// game's green-noir shadows.
export const PALETTES = [
  { name: 'Moss & Marigold', primary: 0x4a5a3a, accent: 0xe8a020 },
  { name: 'Ink & Mint', primary: 0x1c2026, accent: 0x5cf0b0 },
  { name: 'Bone & Ember', primary: 0xc8c0ae, accent: 0xe0562a },
  { name: 'Plum & Brass', primary: 0x4a2a4a, accent: 0xc9a24a },
  { name: 'Rust & Cream', primary: 0x8a4a2a, accent: 0xe8e0cc },
  { name: 'Slate & Coral', primary: 0x4a5560, accent: 0xff7a6a },
  { name: 'Oxblood & Sand', primary: 0x5a1c22, accent: 0xd8c090 },
  { name: 'Teal & Tangerine', primary: 0x1f5a5a, accent: 0xff9a3a },
  { name: 'Charcoal & Violet', primary: 0x2a2a32, accent: 0x9a7aff },
  { name: 'Olive & Sky', primary: 0x5a5a32, accent: 0x7ac8ff },
  { name: 'Mustard & Ink', primary: 0xb8922a, accent: 0x1c2026 },
  { name: 'Fog & Rose', primary: 0x8a929a, accent: 0xe05a8a },
  { name: 'Pine & Bone', primary: 0x1f4a3a, accent: 0xe8e0cc },
  { name: 'Cocoa & Lime', primary: 0x3a2a22, accent: 0xb8e03a },
  { name: 'Navy & Gold', primary: 0x22304a, accent: 0xe8b83a },
  { name: 'Clay & Jade', primary: 0xa8623a, accent: 0x2fa87a },
];
export const PRIMARY_COLORS = [...new Set(PALETTES.map((p) => p.primary))];
export const ACCENT_COLORS = [...new Set(PALETTES.map((p) => p.accent))];

const ADJ = ['Quiet', 'Velvet', 'Sneaky', 'Damp', 'Polite', 'Beige', 'Tactical', 'Suspicious', 'Midnight', 'Squeaky', 'Humble', 'Greased', 'Invisible', 'Lukewarm', 'Discreet', 'Unbothered', 'Slippery', 'Whispering', 'Casual', 'Budget', 'Nocturnal', 'Gentle', 'Feral', 'Laminated', 'Patient', 'Borrowed', 'Deniable', 'Soft', 'Uninvited', 'Off-Duty'];
const NOUN = ['Otter', 'Baguette', 'Raccoon', 'Sock', 'Possum', 'Noodle', 'Mongoose', 'Crouton', 'Ferret', 'Pigeon', 'Gecko', 'Biscuit', 'Lemur', 'Turnip', 'Weasel', 'Pancake', 'Moth', 'Dumpling', 'Badger', 'Cabbage', 'Heron', 'Pretzel', 'Marten', 'Radish', 'Magpie', 'Waffle', 'Stoat', 'Pickle', 'Newt', 'Teacup'];

const freshRng = () => new RNG(Math.floor(Math.random() * 0xffffffff));

export function randomCodename(rng = freshRng()) {
  return `${rng.pick(ADJ)} ${rng.pick(NOUN)}`;
}

/**
 * The one combination we never deal: a bandana over tactical gear reads as a
 * certain famous sneaking soldier, and this agent is supposed to be yours.
 */
export function isSoldierCliche(agent) {
  return agent.head === 'bandana' && (agent.outfit === 'rig' || agent.outfit === 'jumpsuit' || agent.outfit === 'techvest');
}

/** A fresh, original agent: random outfit, palette, headgear, skin, hair, build and codename. */
export function randomAgent(rng = freshRng(), keep = {}) {
  const palette = rng.pick(PALETTES);
  const agent = {
    codename: randomCodename(rng),
    outfit: rng.pick(Object.keys(OUTFITS)),
    primary: palette.primary,
    accent: palette.accent,
    head: rng.pick(Object.keys(HEADGEAR)),
    skin: rng.int(0, SKIN_TONES.length - 1),
    hair: rng.int(0, HAIR_COLORS.length - 1),
    build: rng.pick(Object.keys(BUILDS)),
    ...keep,
  };
  while (isSoldierCliche(agent)) agent.head = rng.pick(Object.keys(HEADGEAR));
  return agent;
}

// Options from earlier versions map onto their nearest current equivalent.
const LEGACY_OUTFIT = { sneak: 'rig', burglar: 'jumpsuit', tourist: 'techvest', labcoat: 'longcoat', recon: 'poncho', trench: 'longcoat' };
const LEGACY_HEAD = { nvg: 'goggles', hair: 'cropped', shades: 'roundshades', beret: 'flatcap' };

/** The old hardcoded default (sneaking suit + bandana) that nobody actually chose. */
export function isLegacyDefault(raw) {
  return !!raw && raw.outfit === 'sneak' && raw.head === 'bandana' && (raw.codename === undefined || raw.codename === 'Quiet Otter');
}

/** Coerce saved data into a valid agent, filling any gaps from `fallback`. */
export function normalizeAgent(raw, fallback = randomAgent()) {
  const a = { ...fallback, ...(raw && typeof raw === 'object' ? raw : {}) };
  a.outfit = LEGACY_OUTFIT[a.outfit] || a.outfit;
  a.head = LEGACY_HEAD[a.head] || a.head;
  if (!OUTFITS[a.outfit]) a.outfit = fallback.outfit;
  if (!HEADGEAR[a.head]) a.head = fallback.head;
  if (!BUILDS[a.build]) a.build = fallback.build;
  const colour = (c, d) => (Number.isInteger(c) && c >= 0 && c <= 0xffffff ? c : d);
  a.primary = colour(a.primary, fallback.primary);
  a.accent = colour(a.accent, fallback.accent);
  const index = (v, n, d) => (Number.isInteger(v) && v >= 0 && v < n ? v : d);
  a.skin = index(a.skin, SKIN_TONES.length, fallback.skin);
  a.hair = index(a.hair, HAIR_COLORS.length, fallback.hair);
  a.codename = typeof a.codename === 'string' && a.codename.trim() ? a.codename.trim().slice(0, 22) : fallback.codename;
  return a;
}
