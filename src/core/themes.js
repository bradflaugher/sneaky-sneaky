// Theme metadata that game logic and UI need. The look of each theme (palette,
// textures, props, lighting) lives in src/render/themeArt.js.

export const THEMES = {
  yacht: {
    id: 'yacht',
    name: 'Superyacht',
    place: 'aboard the M/Y Plausible Deniability',
    guard: 'Deck Security',
    covers: ['lounge', 'crate', 'bar'],
  },
  office: {
    id: 'office',
    name: 'Corporate Mega-Office',
    place: 'Floor 88, Synergy Tower',
    guard: 'Rent-a-Cop',
    covers: ['desk', 'cubicle', 'planter'],
  },
  lab: {
    id: 'lab',
    name: 'Secret Science Lab',
    place: 'Sublevel 4, Definitely Not A Lab',
    guard: 'Hazmat Sentry',
    covers: ['console', 'bench', 'crate'],
  },
  bunker: {
    id: 'bunker',
    name: 'Desert Bunker',
    place: 'Outpost Sandcastle',
    guard: 'Garrison Trooper',
    covers: ['crate', 'sandbag', 'bench'],
  },
  museum: {
    id: 'museum',
    name: 'Midnight Museum',
    place: 'The East Wing, after hours',
    guard: 'Night Curator',
    covers: ['vitrine', 'bench', 'plinth'],
  },
  vr: {
    id: 'vr',
    name: 'VR Training',
    place: 'Simulation 0x5E',
    guard: 'Holo-Sentry',
    covers: ['monolith'],
  },
};

export const THEME_IDS = Object.keys(THEMES);
