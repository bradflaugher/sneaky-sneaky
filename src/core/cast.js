// The cast. Pure data + functions (no canvas, no three.js) so it can be tested.
//
//  thiefLook()  – the one and only hero: a nondescript all-black thief who
//                 could be anybody. No customisation, no backstory.
//  guardLook()  – a procedurally generated guard: one of five comic-book
//                 archetypes, weighted by setting, with randomised build,
//                 skin, hair, headwear, eyewear, facial hair, scarf, badge,
//                 uniform colours and hand prop.
//
// src/render/sprites.js turns a look into inked 2D comic art.

export const ARCHETYPES = {
  enforcer: {
    name: 'Heavy Enforcer',
    build: { shoulders: 0.275, bulk: 1.28, belly: 0.06, height: 1.07, head: 0.98, slouch: 0.02, jaw: 1.18 },
    hats: ['none', 'none', 'beanie', 'fedora'],
    eyewear: ['shades', 'shades', 'none'],
    props: ['flashlight', 'flashlight', 'baton'],
    coat: [0.5, 0.62, 0],
    vest: 0.5,
    tie: 0,
    mustache: 0.3,
    beard: 0.35,
  },
  watchman: {
    name: 'Night Watchman',
    build: { shoulders: 0.215, bulk: 1.02, belly: 0.2, height: 0.97, head: 1.02, slouch: 0.13, jaw: 1 },
    hats: ['cap', 'cap', 'cap', 'none'],
    eyewear: ['none', 'none', 'glasses'],
    props: ['thermos', 'keys', 'flashlight'],
    coat: [0, 0, 0.3],
    vest: 0,
    tie: 0.6,
    mustache: 0.55,
    beard: 0.1,
  },
  tech: {
    name: 'Tech Specialist',
    build: { shoulders: 0.21, bulk: 0.94, belly: 0, height: 1.0, head: 1.0, slouch: 0.03, jaw: 0.95 },
    hats: ['visor', 'visor', 'visor', 'headset'],
    eyewear: ['none'],
    props: ['scanner', 'scanner', 'tablet'],
    coat: [0, 0, 0.42],
    vest: 0.9,
    tie: 0,
    mustache: 0,
    beard: 0,
  },
  gala: {
    name: 'Gala Security',
    build: { shoulders: 0.235, bulk: 1.0, belly: 0, height: 1.04, head: 0.98, slouch: 0, jaw: 1.03 },
    hats: ['none', 'none', 'none', 'fedora'],
    eyewear: ['shades', 'none', 'none'],
    props: ['earpiece', 'earpiece', 'radio'],
    coat: [0.22, 0.22, 0.28],
    vest: 0,
    tie: 1,
    mustache: 0.2,
    beard: 0.15,
  },
  tactical: {
    name: 'Tactical Officer',
    build: { shoulders: 0.245, bulk: 1.1, belly: 0, height: 1.03, head: 0.98, slouch: -0.03, jaw: 1.08 },
    hats: ['beret', 'beret', 'cap', 'helmet'],
    eyewear: ['none', 'none', 'shades'],
    props: ['radio', 'baton', 'flashlight'],
    coat: [0.66, 0.4, 0.4],
    vest: 0.35,
    tie: 0,
    mustache: 0.35,
    beard: 0.2,
  },
};
export const ARCHETYPE_IDS = Object.keys(ARCHETYPES);

// Who works where, and in what colours. [uniform, trousers, accent] triples.
export const THEME_CAST = {
  yacht: {
    weights: { gala: 4, watchman: 2, enforcer: 3, tactical: 1, tech: 0 },
    uniforms: [
      [0xf2ede0, 0x1c2a4a, 0xd9a520],
      [0x1c2a4a, 0xe8e2d2, 0xd9a520],
      [0x7a1f2a, 0x16181f, 0xf2ede0],
      [0x2f4a44, 0xe8e2d2, 0xc98a2a],
    ],
  },
  office: {
    weights: { watchman: 5, gala: 3, enforcer: 2, tech: 1, tactical: 0 },
    uniforms: [
      [0x5f86c8, 0x1b2238, 0xf0b93a],
      [0x2a3350, 0x1b2238, 0x5fd8e8],
      [0x8a8f9a, 0x22262e, 0xe8643c],
      [0xdcd6c6, 0x2a3350, 0x3a6fd8],
    ],
  },
  lab: {
    weights: { tech: 6, watchman: 2, tactical: 2, enforcer: 0, gala: 0 },
    uniforms: [
      [0xe6eef0, 0x35505a, 0x4fe8c0],
      [0xf0c23a, 0x2a3238, 0x2a3238],
      [0x3a5a66, 0x1f2c33, 0xff7a4a],
      [0xc8d4d8, 0x3a5a66, 0x4fc8f0],
    ],
  },
  bunker: {
    weights: { tactical: 5, enforcer: 3, watchman: 2, tech: 0, gala: 0 },
    uniforms: [
      [0x6f7a48, 0x4a5234, 0xc9432e],
      [0xa8875a, 0x5c4a34, 0x2f4a6a],
      [0x4a5a66, 0x2c363e, 0xe0a030],
      [0x8a4a30, 0x3a2a22, 0xe8d8a8],
    ],
  },
  museum: {
    weights: { gala: 5, watchman: 3, enforcer: 2, tactical: 0, tech: 0 },
    uniforms: [
      [0x1c1c24, 0x16161c, 0xc0283a],
      [0x4a2242, 0x1c1c24, 0xe0b040],
      [0x6a1a26, 0x1c1c24, 0xf0e6d2],
      [0x23423a, 0x16161c, 0xe0b040],
    ],
  },
  vr: {
    weights: { tech: 5, tactical: 3, enforcer: 2, watchman: 0, gala: 0 },
    uniforms: [
      [0x0c1630, 0x0a1026, 0x3ae8ff],
      [0x0c1630, 0x0a1026, 0xff3ac8],
    ],
  },
};

export const SKIN_TONES = [0xf3cfb0, 0xe2b089, 0xc98f62, 0xa56f45, 0x7c5030, 0x55351f];
export const HAIR_COLORS = [0x1a1512, 0x3d2817, 0x6e4a26, 0xc29a52, 0x8f8f8f, 0x9a3a1c, 0xe6e0d0];
export const HAIR_STYLES = ['short', 'slick', 'buzz', 'bald', 'curly', 'bob', 'bun'];

/** The hero: matte black from mask to boots, slate-blue comic highlights, no identity. */
export function thiefLook() {
  return {
    role: 'thief',
    build: { shoulders: 0.225, bulk: 1.0, belly: 0, height: 1.0, head: 0.98, slouch: 0.02, jaw: 0.96 },
    suit: 0x171920,
    suitShade: 0x0a0b10,
    highlight: 0x6f86bf,
    ink: 0x3a4a78, // the outline itself is the rim light, so black reads on black
    eyes: 0xf2f5fb,
  };
}

/** A procedurally generated guard for a setting. Deterministic for a given rng. */
export function guardLook(themeId, rng) {
  const cast = THEME_CAST[themeId] || THEME_CAST.vr;
  const archId = rng.weighted(ARCHETYPE_IDS, (id) => cast.weights[id] || 0);
  const a = ARCHETYPES[archId];
  const [top, bottom, accent] = rng.pick(cast.uniforms);
  const jitter = (v, amt) => v * (1 + rng.range(-amt, amt));
  const hairStyle = rng.pick(HAIR_STYLES);
  return {
    role: 'guard',
    archetype: archId,
    name: a.name,
    holo: themeId === 'vr',
    build: {
      shoulders: jitter(a.build.shoulders, 0.06),
      bulk: jitter(a.build.bulk, 0.07),
      belly: Math.max(0, a.build.belly + rng.range(-0.04, 0.06)),
      height: jitter(a.build.height, 0.035),
      head: a.build.head,
      slouch: a.build.slouch,
      jaw: jitter(a.build.jaw, 0.05),
    },
    skin: rng.pick(SKIN_TONES),
    hair: rng.pick(HAIR_COLORS),
    hairStyle,
    hat: rng.pick(a.hats),
    eyewear: rng.pick(a.eyewear),
    mustache: rng.chance(a.mustache),
    beard: rng.chance(a.beard),
    scarf: rng.chance(0.16),
    badge: rng.chance(archId === 'watchman' || archId === 'tactical' ? 0.85 : 0.3),
    prop: rng.pick(a.props),
    coat: rng.pick(a.coat),
    vest: rng.chance(a.vest),
    tie: rng.chance(a.tie),
    epaulettes: archId === 'tactical' || (archId === 'watchman' && rng.chance(0.5)),
    top,
    bottom,
    accent,
  };
}
