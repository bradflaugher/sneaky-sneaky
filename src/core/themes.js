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

// ------------------------------------------------------------------ venue names
// Every room gets its own gritty address, built from the seed.

const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' IX'];
const HEX = '0123456789ABCDEF';
const VENUES = {
  yacht: (r) =>
    `M/Y ${r.pick(['Offshore Liability', 'Plausible Deniability', 'Tax Haven', 'Liquid Assets', 'Shell Company', 'Golden Parachute', 'Hostile Takeover', 'Sea Section', 'Unrealised Gains', 'Insider Tide', 'Blind Trust', 'Fiduciary Duty', 'Escrow', 'Aft Thought', 'Knot Guilty', 'Non-Disclosure', 'Severance', 'Midnight Dividend', 'Quiet Money', 'The Write-Off', 'Margin Call', 'Black Ledger'])}${r.pick(ROMAN)} · ${r.pick(['Lido Deck', 'Owner\'s Deck', 'Cigar Lounge', 'Lower Hold', 'Helipad Bar', 'Engine Gallery', 'Aft Saloon', 'Wine Cellar', 'Panic Suite', 'Crew Mess', 'Tender Garage', 'Storm Bridge'])}`,
  office: (r) =>
    `${r.pick(['Apex', 'Synergy', 'Meridian', 'Halcyon', 'Obelisk', 'Paragon', 'Vantage', 'Monolith', 'Pinnacle', 'Leverage', 'Quorum', 'Stratum', 'Keystone', 'Dominion', 'Ledger', 'Northgate'])} Tower · Floor ${r.int(12, 99)} (${r.pick(['Rainy Annex', 'Executive Wing', 'Records', 'Compliance', 'Dead Server Room', 'Mergers', 'Night Desk', 'Shredding', 'The Quiet Floor', 'Accounts Unpayable', 'Legal Hold', 'Open Plan Hell'])})`,
  lab: (r) =>
    `Sub-Level ${r.int(2, 31)} · ${r.pick(['Damp', 'Sealed', 'Flickering', 'Quarantined', 'Unlisted', 'Leaking', 'Humming', 'Condemned', 'Overgrown', 'Cold', 'Sticky', 'Forgotten'])} ${r.pick(['Containment', 'Specimen Hall', 'Wet Lab', 'Reactor Annex', 'Cryo Storage', 'Incubation', 'Test Chamber', 'Decon Corridor', 'Sample Vault', 'Observation Deck', 'Disposal Wing', 'Growth Lab'])} ${r.pick(['A', 'B', 'C', 'D', 'E', 'Ω', '7', '12'])}`,
  bunker: (r) =>
    `Outpost ${r.pick(['Sandcastle', 'Vulture', 'Dry Well', 'Scorpion', 'Mirage', 'Rattlesnake', 'Last Canteen', 'Sunstroke', 'Tumbleweed', 'Cinder', 'Jackal', 'Broken Compass', 'Hard Tack', 'Dust Devil', 'Long Shadow', 'Red Mesa'])} · ${r.pick(['West', 'East', 'North', 'South', 'Lower', 'Upper', 'Old', 'Sealed'])} ${r.pick(['Vault', 'Armoury', 'Motor Pool', 'Mess Hall', 'Magazine', 'Barracks', 'Signals Room', 'Fuel Dump', 'Map Room', 'Stockade'])} ${r.int(1, 19)}`,
  museum: (r) =>
    `The ${r.pick(['Nocturne', 'Halloran', 'Velvet', 'Obsidian', 'Marlowe', 'Gilt', 'Ashgrove', 'Sable', 'Lacuna', 'Vesper', 'Black Orchid', 'Hollow Crown', 'Penumbra', 'Auberon', 'Crimson', 'Midnight'])} ${r.pick(['Gallery', 'Collection', 'Museum', 'Archive', 'Institute', 'Trust'])} · ${r.pick(['Wing', 'Hall', 'Vault', 'Salon', 'Rotunda', 'Annex'])} ${r.pick(['A', 'B', 'C', 'D', 'E', 'F', 'IX', 'XII'])} (${r.pick(['After Hours', 'Closed For Restoration', 'Private View', 'Night Inventory', 'Members Only', 'Under Review', 'On Loan', 'Alarm Test'])})`,
  vr: (r) =>
    `VR Simulation 0x${HEX[r.int(0, 15)]}${HEX[r.int(0, 15)]} · ${r.pick(['Ghost', 'Shadow', 'Silent', 'Phantom', 'Zero', 'Hollow', 'Mirror', 'Static', 'Null', 'Cold', 'Echo', 'Glass'])} ${r.pick(['Protocol', 'Variation', 'Sweep', 'Drill', 'Gauntlet', 'Scenario', 'Trial', 'Loop', 'Exercise', 'Checksum'])} ${r.int(1, 99).toString().padStart(2, '0')}`,
};

/** A deterministic venue name for a themed room, e.g. "Apex Tower · Floor 47 (Rainy Annex)". */
export function venueName(themeId, rng) {
  return (VENUES[themeId] || VENUES.vr)(rng);
}
