// Difficulty presets, endless-ramp maths and mission-setup settings.
// Pure data + functions: shared by the generator, the game, the UI and tests.

export const PRESETS = {
  tourist: {
    id: 'tourist',
    name: 'Tourist',
    tag: 'Relaxed',
    blurb: 'Sleepy guards, short cones, slow patrols. Enjoy the scenery.',
    detect: 0.65, // detection meter fill rate
    vision: 0.88, // cone range (and, more gently, width)
    speed: 0.88, // patrol walking + sweeping speed
    density: 0.8, // guard count
    puzzleShift: -1, // lasers / extra vents arrive this many tiers earlier (+) or later (-)
    sizeShift: 0, // compound size tiers added on top of the ramp
  },
  operative: {
    id: 'operative',
    name: 'Operative',
    tag: 'Classic',
    blurb: 'The intended experience. Fair cones, fair guards.',
    detect: 1,
    vision: 1,
    speed: 1,
    density: 1,
    puzzleShift: 0,
    sizeShift: 0,
  },
  shadow: {
    id: 'shadow',
    name: 'Shadow',
    tag: 'Hard',
    blurb: 'Sharper eyes, longer cones, brisk patrols, lasers early.',
    detect: 1.35,
    vision: 1.12,
    speed: 1.14,
    density: 1.15,
    puzzleShift: 2,
    sizeShift: 0,
  },
  master: {
    id: 'master',
    name: 'Ghost Master',
    tag: 'Extreme',
    blurb: 'Razor detection, sweeping cones, crowded sprawling compounds.',
    detect: 1.7,
    vision: 1.22,
    speed: 1.25,
    density: 1.4,
    puzzleShift: 4,
    sizeShift: 2,
  },
};
export const PRESET_IDS = Object.keys(PRESETS);

/** How many generator tiers each cleared room adds. */
export const RAMPS = {
  steady: { id: 'steady', name: 'Steady', rate: 0, blurb: 'Stays at your starting size forever.' },
  gradual: { id: 'gradual', name: 'Gradual', rate: 0.5, blurb: 'A slow, deep climb: one step every two rooms.' },
  classic: { id: 'classic', name: 'Classic', rate: 1, blurb: 'One step up every room.' },
  turbo: { id: 'turbo', name: 'Turbo', rate: 2, blurb: 'Two steps a room. Mega-facilities arrive fast.' },
};
export const RAMP_IDS = Object.keys(RAMPS);

/** Where a run starts on the size ladder. */
export const STARTS = {
  compact: { id: 'compact', name: 'Compact', tier: 1 },
  standard: { id: 'standard', name: 'Standard', tier: 4 },
  large: { id: 'large', name: 'Large Compound', tier: 8 },
  mega: { id: 'mega', name: 'Mega-Facility', tier: 14 },
};
export const START_IDS = Object.keys(STARTS);

export const MAX_TIER = 20; // rooms stop growing here; the run itself never ends
export const ALERT_RANGE = [0.5, 2];
export const VISION_RANGE = [0.8, 1.3];

export const DEFAULT_SETUP = { difficulty: 'operative', ramp: 'classic', start: 'compact', alert: 1, vision: 1, theme: 'random' };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Coerce anything (saved data, URL params) into a valid setup object. */
export function normalizeSetup(raw = {}) {
  const num = (v, [lo, hi], dflt) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? Math.round(clamp(n, lo, hi) * 100) / 100 : dflt;
  };
  return {
    difficulty: PRESETS[raw.difficulty] ? raw.difficulty : DEFAULT_SETUP.difficulty,
    ramp: RAMPS[raw.ramp] ? raw.ramp : DEFAULT_SETUP.ramp,
    start: STARTS[raw.start] ? raw.start : DEFAULT_SETUP.start,
    alert: num(raw.alert, ALERT_RANGE, 1),
    vision: num(raw.vision, VISION_RANGE, 1),
    theme: typeof raw.theme === 'string' && raw.theme ? raw.theme : 'random',
  };
}

/**
 * Generator tier for the n-th room of a run (1-based).
 * Steady never moves; the others climb forever (the generator caps physical
 * size at MAX_TIER, so late rooms stay huge rather than growing unbounded).
 */
export function tierFor(roomNo, setup) {
  const s = normalizeSetup(setup);
  return STARTS[s.start].tier + Math.floor((Math.max(1, roomNo) - 1) * RAMPS[s.ramp].rate);
}

/** Size class of a generator tier. */
export function sizeClass(tier) {
  if (tier >= STARTS.mega.tier) return STARTS.mega;
  if (tier >= STARTS.large.tier) return STARTS.large;
  if (tier >= STARTS.standard.tier) return STARTS.standard;
  return STARTS.compact;
}

/**
 * Final multipliers handed to the generator (`vision`, `speed`, `density`,
 * `puzzleShift`, `sizeShift`) and to the game loop (`detect`).
 * The custom sliders stack on top of the preset.
 */
export function resolveMods(setup) {
  const s = normalizeSetup(setup);
  const p = PRESETS[s.difficulty];
  return {
    detect: Math.round(p.detect * s.alert * 1000) / 1000,
    vision: Math.round(clamp(p.vision * s.vision, 0.7, 1.45) * 1000) / 1000,
    speed: p.speed,
    density: p.density,
    puzzleShift: p.puzzleShift,
    sizeShift: p.sizeShift,
  };
}

export const isCustom = (setup) => {
  const s = normalizeSetup(setup);
  return s.alert !== 1 || s.vision !== 1;
};

/** "SECTOR 07 · LARGE COMPOUND · OPERATIVE · CLASSIC RAMP" */
export function describeRun(roomNo, setup) {
  const s = normalizeSetup(setup);
  const tier = tierFor(roomNo, s) + PRESETS[s.difficulty].sizeShift;
  const parts = [
    `SECTOR ${String(roomNo).padStart(2, '0')}`,
    sizeClass(tier).name.toUpperCase(),
    PRESETS[s.difficulty].name.toUpperCase() + (isCustom(s) ? '+' : ''),
    `${RAMPS[s.ramp].name.toUpperCase()} RAMP`,
  ];
  return parts.join(' · ');
}

/** Short form for buttons: "OPERATIVE · CLASSIC · COMPACT". */
export function describeSetup(setup) {
  const s = normalizeSetup(setup);
  return `${PRESETS[s.difficulty].name}${isCustom(s) ? '+' : ''} · ${RAMPS[s.ramp].name} · ${STARTS[s.start].name}`.toUpperCase();
}

// ---- shareable URLs: ?diff=shadow&ramp=turbo&start=large&alert=1.2&vision=1.1&theme=lab

/** Read a setup from URL params, falling back to `base` for anything absent. */
export function setupFromParams(params, base = DEFAULT_SETUP) {
  const get = (k, alt) => (params.has(k) ? params.get(k) : alt);
  return normalizeSetup({
    difficulty: get('diff', base.difficulty),
    ramp: get('ramp', base.ramp),
    start: get('start', base.start),
    alert: get('alert', base.alert),
    vision: get('vision', base.vision),
    theme: get('theme', base.theme),
  });
}

/** Write a setup into URL params (defaults are omitted to keep links short). */
export function setupToParams(setup, params = new URLSearchParams()) {
  const s = normalizeSetup(setup);
  const put = (k, v, dflt) => {
    if (v === dflt) params.delete(k);
    else params.set(k, String(v));
  };
  put('diff', s.difficulty, DEFAULT_SETUP.difficulty);
  put('ramp', s.ramp, DEFAULT_SETUP.ramp);
  put('start', s.start, DEFAULT_SETUP.start);
  put('alert', s.alert, 1);
  put('vision', s.vision, 1);
  put('theme', s.theme, 'random');
  return params;
}
