// The loot. Every item has a distinct procedural 3D prop (see
// src/render/lootProps.js, keyed by `prop`). `themes` biases where it shows up.

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
];

export const LOOT_BY_ID = Object.fromEntries(LOOT.map((l) => [l.id, l]));

/** Pick a loot item for a theme, preferring ones that belong there. */
export function pickLoot(rng, themeId) {
  return rng.weighted(LOOT, (l) => (l.themes === null ? 2 : l.themes.includes(themeId) ? 5 : 0.35));
}
