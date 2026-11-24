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
  casino: {
    id: 'casino',
    name: 'Midnight Casino',
    place: 'The Velvet Table',
    guard: 'Pit Boss Security',
    covers: ['bar', 'lounge', 'plinth'],
  },
  greenhouse: {
    id: 'greenhouse',
    name: 'Botanical Conservatory',
    place: 'The Glass Pavilion, after dusk',
    guard: 'Night Botanist',
    covers: ['planter', 'bench', 'vitrine'],
  },
  alpine: {
    id: 'alpine',
    name: 'Alpine Chalet',
    place: 'Peak 9 Private Lodge',
    guard: 'Ski Patrol Sentry',
    covers: ['lounge', 'bar', 'crate'],
  },
  subway: {
    id: 'subway',
    name: 'Underground Archive',
    place: 'Line 0 Vault Station',
    guard: 'Transit Inspector',
    covers: ['bench', 'crate', 'console'],
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
  casino: (r) =>
    `The ${r.pick(['Velvet Table', 'Gilded Ace', 'Lucky Mirage', 'Crimson Roulette', 'Loaded Die', 'Royal Bluff', 'Midnight Jackpot', 'Silent Partner', 'Brass Canary', 'Last Marker', 'House Edge', 'Double Down', 'Snake Eyes', 'Emerald Baize', 'Cold Deck', 'Sure Thing'])}${r.pick(ROMAN)} · ${r.pick(['High-Roller Salon', 'Baccarat Room', 'Count Room', 'Chip Vault', 'Mezzanine Bar', 'Private Pit', 'Roulette Hall', 'Cashier Cage', 'Eye In The Sky', 'Whale Suite', 'Slot Gallery', 'Back Office'])} ${r.int(1, 21)} (${r.pick(['Tables Closed', 'Invitation Only', 'House Rules', 'After Last Call', 'Comped', 'Under Audit', 'No Limit', 'Cameras Looping'])})`,
  greenhouse: (r) =>
    `The ${r.pick(['Glass Pavilion', 'Fernwright', 'Verdigris', 'Nightbloom', 'Larkspur', 'Hollyhock', 'Thornfield', 'Moonflower', 'Wisteria', 'Aldergate', 'Briar Rose', 'Foxglove', 'Quillwort', 'Sundew', 'Ivy Royal', 'Mossgrave'])} ${r.pick(['Conservatory', 'Gardens', 'Arboretum', 'Orangery', 'Glasshouse', 'Herbarium'])} · ${r.pick(['Orchid House', 'Palm Court', 'Fern Gallery', 'Carnivorous Wing', 'Seed Vault', 'Potting Hall', 'Lily Pond', 'Mist Room', 'Cactus Terrace', 'Hybrid Nursery', 'Bonsai Annex', 'Night Garden'])} ${r.pick(['A', 'B', 'C', 'D', 'E', 'IV', 'VII', 'XI'])} (${r.pick(['After Dusk', 'Misters Running', 'Pollination Night', 'Members Only', 'Do Not Feed', 'Grow Lamps On', 'Under Glass', 'Watering Day'])})`,
  alpine: (r) =>
    `${r.pick(['Peak 9', 'Schattenhorn', 'Whiteout', 'Black Diamond', 'Gletscher', 'Hochnebel', 'Powder Keg', 'Edelweiss', 'Thin Air', 'Cornice', 'Last Lift', 'Silberspitz', 'Avalanche', 'Frostbite', 'Yodel', 'Cold Shoulder'])} ${r.pick(['Private Lodge', 'Chalet', 'Summit Club', 'Ski Haus', 'Hütte', 'Mountain Retreat'])} · ${r.pick(['Great Room', 'Fondue Hall', 'Boot Room', 'Trophy Den', 'Hearth Lounge', 'Wine Cave', 'Gondola Dock', 'Sauna Wing', 'Wax Room', 'Fur Closet', 'Map Loft', 'Cellar Bar'])} ${r.int(1, 12)} (${r.pick(['Snowed In', 'Off-Piste', 'Après Hours', 'Lifts Closed', 'Storm Warning', 'Guests Asleep', 'Fire Still Lit', 'No Tracks'])})`,
  subway: (r) =>
    `Line ${r.pick(['0', '0', '13', 'Ø', 'Q', 'Z', '99', '7½'])} · ${r.pick(['Vault', 'Ghost', 'Dead Letter', 'Lost Property', 'Terminus', 'Cinder Street', 'Blackfriar', 'Old Mint', 'Undercroft', 'Sealed', 'Midnight', 'Archive', 'Low Road', 'Ratcatcher', 'Third Rail', 'Nowhere'])} ${r.pick(['Station', 'Junction', 'Depot', 'Interchange', 'Platform', 'Sidings'])} · ${r.pick(['Ticket Hall', 'Signal Room', 'Stacks', 'Mezzanine', 'Microfilm Vault', 'Dispatch', 'Relay Room', 'Turnstile Bank', 'Card Catalogue', 'Pump Room', 'Lost & Found', 'Sorting Floor'])} ${r.int(1, 24)}${r.pick(['A', 'B', 'C', 'N', 'S'])} (${r.pick(['Not In Service', 'Mind The Gap', 'Last Train Gone', 'Signal Failure', 'Staff Only', 'Power Rail Live', 'Out Of Zone', 'Delays Expected'])})`,
};

/** A deterministic venue name for a themed room, e.g. "Apex Tower · Floor 47 (Rainy Annex)". */
export function venueName(themeId, rng) {
  return (VENUES[themeId] || VENUES.vr)(rng);
}
