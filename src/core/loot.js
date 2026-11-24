// The loot.
//
// Two sources, mixed every room:
// These are mission TARGETS, not just loot. The agent is a pacifist spy, and
// each room rolls an assignment: photograph it, decrypt it, rescue it, swap
// it, verify it... (see MISSION_VERBS). Mechanically it is always "sneak to
// the pedestal, interact, extract".
//
//   SIGNATURE  – the handcrafted classics below, each with its own bespoke prop
//   procedural – an endless supply assembled from word banks:
//                [Owner] [Adjective] [Material] [Object] [(Tag)]
//                e.g. "The Admiral's Mildly Radioactive Brass Toaster (Do Not Shake)"
//
// Every item carries a `propSpec` that src/render/lootProps.js turns into a
// 3D prop: base silhouette, palette, glow, scale/tilt and an optional topper.
// The material word drives the prop's finish, so the name and the object on
// the pedestal always agree.

export const LOOT = [
  { id: 'sourdough', name: "The CEO's Unattended Sourdough Starter", flavor: 'Named Gerald. Fed twice daily. Worth more than the company.', prop: 'jar', themes: ['office'] },
  { id: 'beanie', name: "The Yacht Captain's Mint 1998 Beanie Baby", flavor: 'Tag protector still on. The captain weeps nightly.', prop: 'beanie', themes: ['yacht'] },
  { id: 'breadknife', name: 'Blueprints for a Self-Toasting Bread Knife', flavor: 'Patent pending. Fire marshal also pending.', prop: 'blueprint', themes: ['lab', 'office'] },
  { id: 'stapler', name: "The Lab's Only Working Stapler", flavor: 'Seventeen PhDs. One stapler. You monster.', prop: 'stapler', themes: ['lab', 'office'] },
  { id: 'duck', name: 'A Suspiciously Heavy Rubber Duck', flavor: 'It does not float. Nobody will say why.', prop: 'duck', themes: null },
  { id: 'frog', name: "The General's Lucky Porcelain Frog", flavor: 'Undefeated in four campaigns and one bake sale.', prop: 'frog', themes: ['bunker'] },
  { id: 'croissant', name: 'A Golden Croissant (Still Warm)', flavor: '24 karats. 81 layers. Somehow still warm.', prop: 'croissant', themes: ['museum', 'yacht'] },
  { id: 'usb', name: 'USB Labeled NOT_PASSWORDS.TXT', flavor: 'It is passwords.', prop: 'usb', themes: ['office', 'lab', 'vr'] },
  { id: 'mug', name: "The 'World's Okayest Boss' Mug", flavor: 'A rare moment of corporate honesty.', prop: 'mug', themes: ['office'] },
  { id: 'cactus', name: "The Quartermaster's Emotional Support Cactus", flavor: 'His name is Spike and he is doing his best.', prop: 'cactus', themes: ['bunker'] },
  { id: 'snowglobe', name: 'A Snow Globe of a Slightly Different Snow Globe', flavor: 'It gets weird if you look too long.', prop: 'snowglobe', themes: ['museum'] },
  { id: 'banana', name: 'The Banana From The Famous Banana Painting', flavor: 'The duct tape is sold separately.', prop: 'banana', themes: ['museum'] },
  { id: 'cheese', name: 'The Forbidden Break-Room Cheese Wheel', flavor: 'Aged 12 years. Labeled "DAVE\'S. DO NOT."', prop: 'cheese', themes: ['office', 'lab'] },
  { id: 'trophy', name: "A 'Participant' Trophy, Solid Gold", flavor: 'Awarded for showing up. Extravagantly.', prop: 'trophy', themes: null },
  { id: 'gnome', name: 'Admiral Gnome, Garden Division', flavor: 'Decorated veteran of the Hedge Wars.', prop: 'gnome', themes: ['bunker', 'yacht'] },
  { id: 'teapot', name: 'The Teapot That Was Present At History', flavor: 'It saw everything. It said nothing.', prop: 'teapot', themes: ['museum'] },
  { id: 'cube', name: 'An Unsolvable Cube (Solved)', flavor: 'This should not be possible. Do not think about it.', prop: 'cube', themes: ['vr', 'lab'] },
  { id: 'cartridge', name: 'A Game Cartridge That Works First Try', flavor: 'Nobody has ever blown on it. Priceless.', prop: 'cartridge', themes: ['vr'] },
  { id: 'pineapple', name: "The Captain's Ceremonial Pineapple", flavor: 'Maritime law is surprisingly clear on this.', prop: 'pineapple', themes: ['yacht'] },
  { id: 'flask', name: 'Flask of Extremely Regular Water', flavor: 'Guarded around the clock. Draw your own conclusions.', prop: 'flask', themes: ['lab'] },
  { id: 'toaster', name: 'Prototype Toaster With Opinions', flavor: 'It thinks you can do better.', prop: 'toaster', themes: ['lab', 'vr'] },
  { id: 'helmet', name: "The Colonel's Slightly Too Small Helmet", flavor: 'He insists it fits. It does not fit.', prop: 'helmet', themes: ['bunker'] },
  { id: 'vase', name: 'A Priceless Vase (Already Glued Twice)', flavor: 'Third time is the charm. Walk slowly.', prop: 'vase', themes: ['museum'] },
  { id: 'anchor', name: 'A Tiny Decorative Anchor of Great Sentimental Weight', flavor: 'Emotionally: four tonnes.', prop: 'anchor', themes: ['yacht'] },
  { id: 'donut', name: 'The Last Donut (Maple, Uncontested)', flavor: 'Left on the plate for six hours out of pure politeness.', prop: 'donut', themes: ['office', 'bunker'] },
  { id: 'crown', name: 'A Crown For A Very Small King', flavor: 'The king is a corgi. Long may he reign.', prop: 'crown', themes: ['museum'] },
  { id: 'floppy', name: 'A Floppy Disk Containing One (1) Excellent JPEG', flavor: '1.44 megabytes of pure art.', prop: 'floppy', themes: ['vr', 'office'] },
  { id: 'canteen', name: 'Canteen of Suspiciously Good Soup', flavor: "The mess hall's only secret worth keeping.", prop: 'canteen', themes: ['bunker'] },
  { id: 'chips', name: "The House's Only Honest Poker Chip", flavor: 'Kept under guard so it does not give the others ideas.', prop: 'chips', themes: ['casino'] },
  { id: 'dice', name: 'A Pair of Dice That Only Roll Sevens', flavor: 'Retired undefeated. The floor manager still flinches.', prop: 'dice', themes: ['casino'] },
  { id: 'orchid', name: 'The Second-Place Orchid (Bitter About It)', flavor: 'Lost to a begonia in 2019. Has not opened since.', prop: 'orchid', themes: ['greenhouse'] },
  { id: 'wateringcan', name: 'A Watering Can of Great Diplomatic Importance', flavor: 'Three treaties were signed over it. One fern was saved.', prop: 'wateringcan', themes: ['greenhouse'] },
  { id: 'fondue', name: 'The Bottomless Fondue Pot of Peak 9', flavor: 'Nobody has seen the bottom. Two forks are still missing.', prop: 'fondue', themes: ['alpine'] },
  { id: 'cowbell', name: 'A Cowbell That Has Heard Enough', flavor: 'Rung once in 1974. The avalanche report is sealed.', prop: 'cowbell', themes: ['alpine'] },
  { id: 'token', name: 'The Last Valid Token for Line 0', flavor: 'Good for one ride. The line has no trains.', prop: 'token', themes: ['subway'] },
  { id: 'ticket', name: 'A Monthly Pass That Expired In 1987', flavor: 'The inspectors are still looking for whoever owes the fare.', prop: 'ticket', themes: ['subway'] },
];

export const LOOT_BY_ID = Object.fromEntries(LOOT.map((l) => [l.id, l]));

export const SIGNATURE_CHANCE = 0.15;
export const RARITIES = ['CONTRABAND', 'RARE', 'ABSURD', 'SIGNATURE'];

// ------------------------------------------------------------------ word banks

const OWNERS_ANY = [
  "The Intern's",
  "The Janitor's",
  "The Night Manager's",
  "Somebody's Uncle's",
  "The Previous Tenant's",
  "A Rival Thief's",
  "The Mayor's",
  "Head Office's",
  'An Unclaimed',
  'A Heavily Insured',
  'A Wrongly Delivered',
  'An Allegedly Priceless',
  'A Legally Ambiguous',
  'A Twice-Stolen',
];
const OWNERS = {
  yacht: ["The Admiral's", "The Captain's", "The First Mate's", "The Oligarch's", "The Sommelier's", "The Harbourmaster's", "A Stowaway's", "The Yacht Broker's"],
  office: ["The CFO's", "The CEO's", "Legal's", "The Board's", "HR's", "The Regional Manager's", "The Consultant's", "Floor 47's", "The Auditor's"],
  lab: ["Sub-Level 9's", "Dr. Vex's", "The Lead Researcher's", "Test Subject 12's", "The Ethics Committee's", "The Night Shift's", "Containment Team B's", "The Grant Committee's"],
  bunker: ["The General's", "The Colonel's", "The Quartermaster's", "The Garrison's", "Sergeant Pickles'", "The Mess Hall's", "The Motor Pool's", "Command's"],
  museum: ["The Curator's", "The Duchess's", "The Benefactor's", "The Restorer's", "The Late Baron's", "The East Wing's", "A Forger's", "The Trustees'"],
  casino: ["The Pit Boss's", "The House's", "The High Roller's", "The Croupier's", "The Card Counter's", "The Whale's", "Table Nine's", "The Cashier Cage's"],
  greenhouse: ["The Head Botanist's", "The Orchid Society's", "The Night Gardener's", "The Fern Committee's", "A Carnivorous Plant's", "The Seed Bank's", "The Topiarist's", "Greenhouse Four's"],
  alpine: ["The Lodge Owner's", "The Ski Instructor's", "The Countess's", "Ski Patrol's", "The Fondue Chef's", "The Lift Operator's", "A Snowed-In Guest's", "The Yodelling Champion's"],
  subway: ["The Station Master's", "The Transit Authority's", "Lost Property's", "The Night Conductor's", "The Archivist's", "Platform Zero's", "A Fare Dodger's", "The Signalman's"],
  vr: ["The Simulation's", "Admin's", "Player Two's", "The Dev Team's", "Build 0.9.3's", "The Tutorial's", "A Speedrunner's", "The QA Department's"],
};

// `glow` tints the prop with an emissive colour.
const ADJECTIVES = [
  { t: 'Suspiciously Warm', glow: 0xff7a1a },
  { t: 'Counterfeit' },
  { t: 'Haunted', glow: 0x5cf0ff },
  { t: 'Mildly Radioactive', glow: 0x6aff3a },
  { t: 'Tax-Deductible' },
  { t: 'Artisanal' },
  { t: 'Bootleg' },
  { t: 'Tactical' },
  { t: 'Cursed', glow: 0xc1121f },
  { t: 'Emotional-Support' },
  { t: 'Slightly Damp' },
  { t: 'Over-Engineered' },
  { t: 'Forbidden', glow: 0xb040ff },
  { t: 'Ceremonial' },
  { t: 'Decommissioned' },
  { t: 'Unlicensed' },
  { t: 'Classified' },
  { t: 'Heirloom' },
  { t: 'Prototype' },
  { t: 'Limited-Edition' },
  { t: 'Ergonomic' },
  { t: 'Load-Bearing' },
  { t: 'Sentimental' },
  { t: 'Weaponless' },
  { t: 'Recalled' },
  { t: 'Suspiciously Heavy' },
  { t: 'Legally Distinct' },
  { t: 'Monogrammed' },
  { t: 'Vintage' },
  { t: 'Experimental', glow: 0x3affa0 },
  { t: 'Uninsurable' },
  { t: 'Passive-Aggressive' },
  { t: 'Award-Winning' },
  { t: 'Disputed' },
  { t: 'Humming', glow: 0xffd24a },
  { t: 'Second-Hand' },
  { t: 'Overdue' },
  { t: 'Bulletproof' },
  { t: 'Free-Range' },
  { t: 'Diplomatic' },
  { t: 'Waterlogged' },
  { t: 'Misfiled' },
  { t: 'Commemorative' },
  { t: 'Unreasonably Loud' },
  { t: 'Self-Aware', glow: 0x19f0e0 },
  { t: 'Off-Brand' },
  { t: 'Inflatable' },
  { t: 'Notarised' },
  { t: 'Gently Used' },
  { t: 'Ominous', glow: 0x8a1420 },
];

// The finish word. `primary`/`accent` recolour the prop so name and object agree.
const MATERIALS = [
  { t: 'Brass', primary: 0xb8862a, accent: 0x5a3c10 },
  { t: 'Obsidian', primary: 0x16141c, accent: 0x6a4aff },
  { t: 'Chrome', primary: 0xc8d0d8, accent: 0x4a5560 },
  { t: 'Velvet', primary: 0x7a0f1c, accent: 0xc9a24a },
  { t: 'Jade', primary: 0x2f9a6a, accent: 0xd8f0e0 },
  { t: 'Porcelain', primary: 0xe8e2d4, accent: 0x2a5fc8 },
  { t: 'Bakelite', primary: 0x5a2a14, accent: 0xe0c890 },
  { t: '24K', primary: 0xe0b040, accent: 0xfff0b0, glow: 0x4a3200 },
  { t: 'Neon', primary: 0xff2a8a, accent: 0x19f0e0, glow: 0xff2a8a },
  { t: 'Rusted', primary: 0x8a4a1c, accent: 0x3a2a20 },
  { t: 'Marble', primary: 0xd0ccc4, accent: 0x6a6a72 },
  { t: 'Walnut', primary: 0x4a2c16, accent: 0xb8862a },
  { t: 'Pewter', primary: 0x7a7f86, accent: 0x2a2c30 },
  { t: 'Ivory', primary: 0xe6dcc0, accent: 0x7a0f1c },
  { t: 'Copper', primary: 0xc0622a, accent: 0x2f9a6a },
  { t: 'Glow-in-the-Dark', primary: 0x9affb0, accent: 0x1a4a2a, glow: 0x6aff8a },
  { t: 'Camouflage', primary: 0x5a6238, accent: 0x2a2f1c },
  { t: 'Carbon-Fibre', primary: 0x1c1e22, accent: 0xc1121f },
];

// Object nouns, each mapped to a base 3D silhouette and its natural colours.
const NOUNS = [
  { t: 'Rubber Duck', shape: 'duck', primary: 0xffd12e, accent: 0xff7a1a },
  { t: 'Decoy Duck', shape: 'duck', primary: 0x5a6238, accent: 0xb8862a },
  { t: 'Sourdough Jar', shape: 'jar', primary: 0xe9d9b0, accent: 0xc1121f },
  { t: 'Pickle Jar', shape: 'jar', primary: 0x6a8a2a, accent: 0xc9a24a },
  { t: 'Stapler', shape: 'stapler', primary: 0xc1121f, accent: 0x1a1c20 },
  { t: 'Hole Punch', shape: 'stapler', primary: 0x2a5fc8, accent: 0x1a1c20 },
  { t: 'Toaster', shape: 'toaster', primary: 0xb8c0c8, accent: 0xd9a05a },
  { t: 'Croissant', shape: 'croissant', primary: 0xd9a05a, accent: 0x8a5a2a },
  { t: 'Bust', shape: 'bust', primary: 0xd0ccc4, accent: 0x6a6a72 },
  { t: 'Bust of Somebody', shape: 'bust', primary: 0x7a7f86, accent: 0x2a2c30 },
  { t: 'Briefcase', shape: 'case', primary: 0x3a2416, accent: 0xb8862a },
  { t: 'Lunchbox', shape: 'case', primary: 0xc1121f, accent: 0xe8e2d4 },
  { t: 'Toolbox', shape: 'case', primary: 0x2a5fc8, accent: 0x7a7f86 },
  { t: 'VHS Tape', shape: 'tape', primary: 0x1a1c20, accent: 0xe8e2d4 },
  { t: 'Cassette', shape: 'tape', primary: 0xe0b040, accent: 0x1a1c20 },
  { t: 'Espresso Machine', shape: 'espresso', primary: 0xb8c0c8, accent: 0xc1121f },
  { t: 'Porcelain Frog', shape: 'frog', primary: 0x58b86a, accent: 0xc9a24a },
  { t: 'Toad Figurine', shape: 'frog', primary: 0x8a6a2a, accent: 0xe8e2d4 },
  { t: 'Trophy', shape: 'trophy', primary: 0xe0b040, accent: 0x1a1c20 },
  { t: 'Participation Cup', shape: 'trophy', primary: 0xb8c0c8, accent: 0x2a5fc8 },
  { t: 'Snowglobe', shape: 'globe', primary: 0xbfe8ff, accent: 0x4a2c16 },
  { t: 'Crystal Ball', shape: 'globe', primary: 0xb090ff, accent: 0x16141c },
  { t: 'Floppy Disk', shape: 'floppy', primary: 0x2a3f8a, accent: 0xe8e2d4 },
  { t: 'Teapot', shape: 'teapot', primary: 0xe8e2d4, accent: 0x2a5fc8 },
  { t: 'Gravy Boat', shape: 'teapot', primary: 0xd0ccc4, accent: 0xc9a24a },
  { t: 'Cactus', shape: 'cactus', primary: 0x3f8a4a, accent: 0xc0622a },
  { t: 'Bonsai', shape: 'cactus', primary: 0x2a6a3a, accent: 0x3a2416 },
  { t: 'Gnome', shape: 'gnome', primary: 0x2a5fc8, accent: 0xc1121f },
  { t: 'Urn', shape: 'urn', primary: 0x2a5fc8, accent: 0xc9a24a },
  { t: 'Vase', shape: 'urn', primary: 0xe8e2d4, accent: 0x7a0f1c },
  { t: 'Typewriter', shape: 'typewriter', primary: 0x1a1c20, accent: 0xe8e2d4 },
  { t: 'Cash Register', shape: 'typewriter', primary: 0xb8862a, accent: 0x1a1c20 },
  { t: 'Lava Lamp', shape: 'lava', primary: 0xff5a2a, accent: 0x7a7f86, glow: 0xff5a2a },
  { t: 'Crown', shape: 'crown', primary: 0xe0b040, accent: 0xc1121f },
  { t: 'Tiara', shape: 'crown', primary: 0xc8d0d8, accent: 0x19f0e0 },
  { t: 'Cube', shape: 'cube', primary: 0x19f0e0, accent: 0x16141c },
  { t: 'Paperweight', shape: 'cube', primary: 0x7a7f86, accent: 0xc9a24a },
  { t: 'Mug', shape: 'mug', primary: 0xe8e2d4, accent: 0xc1121f },
  { t: 'Thermos', shape: 'bottle', primary: 0x2f6a4a, accent: 0xb8c0c8 },
  { t: 'Bottle of Something', shape: 'bottle', primary: 0x3a6a2a, accent: 0xe8e2d4 },
  { t: 'Radio', shape: 'radio', primary: 0x4a2c16, accent: 0xe0c890 },
  { t: 'Walkie-Talkie', shape: 'radio', primary: 0x1a1c20, accent: 0xc1121f },
  { t: 'Rotary Phone', shape: 'phone', primary: 0xc1121f, accent: 0x1a1c20 },
  { t: 'Alarm Clock', shape: 'clock', primary: 0xc1121f, accent: 0xe8e2d4 },
  { t: 'Cuckoo Clock', shape: 'clock', primary: 0x4a2c16, accent: 0xe0b040 },
  { t: 'Desk Lamp', shape: 'lamp', primary: 0x2f6a4a, accent: 0xb8862a, glow: 0xffd88a },
  { t: 'Bowling Pin', shape: 'pin', primary: 0xe8e2d4, accent: 0xc1121f },
  { t: 'Chess Rook', shape: 'rook', primary: 0x16141c, accent: 0xe8e2d4 },
  { t: 'Traffic Cone', shape: 'cone', primary: 0xff7a1a, accent: 0xe8e2d4 },
  { t: 'Fire Hydrant', shape: 'hydrant', primary: 0xc1121f, accent: 0xb8862a },
  { t: 'Birdhouse', shape: 'house', primary: 0x8a5a2a, accent: 0xc1121f },
  { t: 'Model Lighthouse', shape: 'lighthouse', primary: 0xe8e2d4, accent: 0xc1121f, glow: 0xffd88a },
  { t: 'Wheel of Cheese', shape: 'wheel', primary: 0xf2b632, accent: 0xc1121f },
  { t: 'Fruitcake', shape: 'wheel', primary: 0x5a2a14, accent: 0x3f8a4a },
];

const TAGS = [
  'Still Warm',
  'Do Not Shake',
  'Mint Condition',
  'Allegedly',
  'Expired 1997',
  'No Questions Asked',
  'Missing One Screw',
  'Batteries Not Included',
  'Signed By Someone',
  'As Seen On TV',
  'Evidence',
  'Slightly Haunted',
  'Final Sale',
  'Do Not Lick',
  'Property Of Dave',
  'Insured Twice',
  'Handle With Regret',
  'Recalled',
  'One Of Three',
  'Sticky',
  'Lightly Singed',
  'Factory Second',
  'Pending Lawsuit',
  'Not A Bomb',
  'Smells Fine',
  'Fragile-ish',
  'Under Warranty',
  'It Hums',
  'Display Only',
  'Do Not Wind',
  'Refrigerate After Stealing',
  'Ask About Gerald',
];

const TAGLINES = [
  'Insured for more than the building.',
  'Nobody remembers buying it. Everyone would miss it.',
  "Appraised at 'please stop asking'.",
  'It has its own security clearance.',
  'Three people have cried about this.',
  'The paperwork alone weighs four kilos.',
  'Technically a business expense.',
  'Guarded around the clock. Draw your own conclusions.',
  'It was on a shelf. Now it is a matter of principle.',
  'Last seen in an expense report.',
  'The lawyers call it "the incident".',
  'Not valuable. Just deeply, deeply missed.',
  'There is a plaque. The plaque is also wrong.',
  'Worth a fortune to exactly one person.',
  'It should not be here. Neither should you.',
  'Catalogued under "miscellaneous regrets".',
  'A previous thief returned it. With a note.',
  'Do not ask what it is for.',
  'It came with the building.',
  'Somebody is going to have a very bad Monday.',
  'The warranty is the most valuable part.',
  'Has survived two audits and a flood.',
  'Legend says it is exactly what it looks like.',
  'It will look great on your mantel of crimes.',
];
const NOUN_TAGLINES = [
  (n) => `The ${n} knows what it did.`,
  (n) => `One (1) ${n}. Irreplaceable, apparently.`,
  (n) => `They built the vault around the ${n}.`,
  (n) => `It is just a ${n}. That is what makes it suspicious.`,
  (n) => `Every heist needs a ${n}. Nobody knows why.`,
  (n) => `The ${n} has been through enough. Take it home.`,
  (n) => `Rumoured to be the only honest ${n} left.`,
  (n) => `A ${n} with a paper trail.`,
];

const TOPPERS = ['none', 'none', 'none', 'ribbon', 'tag', 'bow', 'evidence'];

// ------------------------------------------------------------------ missions
// What the agent is actually there to do. `takes` is whether the object
// leaves with you; intel and tinker jobs leave it on its pedestal.

export const MISSION_CATEGORIES = {
  intel: { name: 'Intel / Recon', takes: false },
  recovery: { name: 'Recovery / Rescue', takes: true },
  tinker: { name: 'Pacifist Tinker / Swap', takes: false },
};
export const MISSION_VERBS = [
  { verb: 'PHOTOGRAPH', past: 'PHOTOGRAPHED', category: 'intel', sfx: 'CLICK!', carrying: 'Photos in hand' },
  { verb: 'COPY', past: 'COPIED', category: 'intel', sfx: 'ZIP!', carrying: 'Copy made' },
  { verb: 'DECRYPT', past: 'DECRYPTED', category: 'intel', sfx: 'BEEP!', carrying: 'Decrypted' },
  { verb: 'SCAN', past: 'SCANNED', category: 'intel', sfx: 'BLIP!', carrying: 'Scan complete' },
  { verb: 'RETRIEVE', past: 'RETRIEVED', category: 'recovery', sfx: 'YOINK!', carrying: 'Carrying' },
  { verb: 'RESCUE', past: 'RESCUED', category: 'recovery', sfx: 'GOTCHA!', carrying: 'Escorting' },
  { verb: 'RECOVER', past: 'RECOVERED', category: 'recovery', sfx: 'YOINK!', carrying: 'Carrying' },
  { verb: 'RETURN', past: 'RETURNED', category: 'recovery', sfx: 'GOT IT!', carrying: 'Returning' },
  { verb: 'SWAP', past: 'SWAPPED', category: 'tinker', sfx: 'SWITCH!', carrying: 'Swapped for a decoy' },
  { verb: 'RECALIBRATE', past: 'RECALIBRATED', category: 'tinker', sfx: 'TWEAK!', carrying: 'Recalibrated' },
  { verb: 'VERIFY', past: 'VERIFIED', category: 'tinker', sfx: 'CHECK!', carrying: 'Verified' },
  { verb: 'INSPECT', past: 'INSPECTED', category: 'tinker', sfx: 'HMM!', carrying: 'Inspected' },
];
// Some objects suit some jobs: you decrypt a floppy, you rescue a frog.
const SHAPE_BIAS = {
  intel: ['floppy', 'tape', 'typewriter', 'radio', 'phone', 'case', 'cube', 'globe', 'bust', 'ticket', 'token'],
  recovery: ['duck', 'frog', 'gnome', 'cactus', 'trophy', 'crown', 'urn', 'teapot', 'jar', 'croissant', 'wheel', 'pin', 'house', 'orchid', 'cowbell', 'chips'],
  tinker: ['toaster', 'espresso', 'clock', 'lamp', 'lava', 'stapler', 'bottle', 'mug', 'hydrant', 'cone', 'lighthouse', 'rook', 'dice', 'wateringcan', 'fondue'],
};

/** Roll the assignment for a target. Deterministic for a given rng. */
export function rollMission(rng, shape) {
  const cats = Object.keys(MISSION_CATEGORIES);
  const category = rng.weighted(cats, (c) => (SHAPE_BIAS[c].includes(shape) ? 4 : 1));
  const m = rng.pick(MISSION_VERBS.filter((v) => v.category === category));
  return { ...m, takes: MISSION_CATEGORIES[category].takes };
}

/** Every base silhouette lootProps.js must know how to build. */
export const PROP_SHAPES = [...new Set(NOUNS.map((n) => n.shape))];

export const LOOT_WORDS = { OWNERS_ANY, OWNERS, ADJECTIVES, MATERIALS, NOUNS, TAGS };

/** Rough size of the procedural name space for one theme (for bragging and tests). */
export function lootCombinations(themeId) {
  const owners = OWNERS_ANY.length + (OWNERS[themeId] || []).length + 1;
  return owners * ADJECTIVES.length * (MATERIALS.length + 1) * NOUNS.length * (TAGS.length + 1);
}

function slugHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

const serialOf = (rng) => `FILE #${rng.int(100, 999)}-${'ABCDEFGHJKLMNPQRSTUVWXYZ'[rng.int(0, 23)]}`;

/**
 * Deterministically generate the heist target for a room.
 * Returns { id, name, tagline, serial, rarity, signature, parts, propSpec }.
 */
export function generateLoot(rng, themeId) {
  // ---- signature drop: one of the handcrafted classics, bespoke prop
  if (rng.chance(SIGNATURE_CHANCE)) {
    const item = rng.weighted(LOOT, (l) => (l.themes === null ? 2 : l.themes.includes(themeId) ? 5 : 0.35));
    const serial = serialOf(rng);
    return {
      mission: rollMission(rng, item.prop),
      id: item.id,
      name: item.name,
      tagline: item.flavor,
      serial,
      rarity: 'SIGNATURE',
      signature: true,
      parts: null,
      propSpec: { shape: 'signature', builder: item.prop, primary: 0xe0b040, accent: 0xc1121f, glow: 0, scale: 1, tilt: 0, topper: 'none' },
    };
  }

  // ---- procedural: [Owner] [Adjective] [Material] [Object] [(Tag)]
  const ownerPool = OWNERS_ANY.concat(OWNERS[themeId] || [], OWNERS[themeId] || []); // locals twice as likely
  const owner = rng.chance(0.88) ? rng.pick(ownerPool) : null;
  const adj = rng.pick(ADJECTIVES);
  const material = rng.chance(0.45) ? rng.pick(MATERIALS) : null;
  const noun = rng.pick(NOUNS);
  const tag = rng.chance(0.42) ? rng.pick(TAGS) : null;

  const words = [];
  if (owner) words.push(owner);
  else words.push(/^[AEIOU]/.test(adj.t) ? 'An' : 'A');
  words.push(adj.t);
  if (material) words.push(material.t);
  words.push(noun.t);
  const name = words.join(' ') + (tag ? ` (${tag})` : '');

  // rarity: the more ornate the name, the rarer the drop
  const ornate = (material ? 1 : 0) + (tag ? 1 : 0) + (adj.glow ? 1 : 0);
  const roll = rng.next() + ornate * 0.14;
  const rarity = roll > 1.05 ? 'ABSURD' : roll > 0.62 ? 'RARE' : 'CONTRABAND';

  const glow = (material && material.glow) || adj.glow || noun.glow || 0;
  const propSpec = {
    shape: noun.shape,
    primary: material ? material.primary : noun.primary,
    accent: material ? material.accent : noun.accent,
    glow,
    scale: Math.round(rng.range(0.9, 1.18) * 100) / 100,
    tilt: Math.round(rng.range(-0.16, 0.16) * 100) / 100,
    topper: rarity === 'ABSURD' ? 'halo' : rng.pick(TOPPERS),
  };

  const short = noun.t.toLowerCase();
  const tagline = rng.chance(0.4) ? rng.pick(NOUN_TAGLINES)(short) : rng.pick(TAGLINES);
  const serial = serialOf(rng);
  return {
    mission: rollMission(rng, noun.shape),
    id: `p-${slugHash(name)}`,
    name,
    tagline,
    serial,
    rarity,
    signature: false,
    parts: { owner, adjective: adj.t, material: material ? material.t : null, noun: noun.t, tag },
    propSpec,
  };
}
