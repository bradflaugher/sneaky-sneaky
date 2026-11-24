import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import { THEMES, THEME_IDS, venueName } from '../src/core/themes.js';
import { THEME_CAST, guardLook } from '../src/core/cast.js';
import { LOOT, LOOT_WORDS, generateLoot } from '../src/core/loot.js';
import { generateRoom } from '../src/core/generator.js';
import { ART, VENT_COLORS } from '../src/render/themeArt.js';
import { FLOOR_KEYS, WALL_KEYS, BACKDROP_KEYS } from '../src/render/textures.js';
import { PROP_KEYS } from '../src/render/lootProps.js';

const ORIGINAL = ['yacht', 'office', 'lab', 'bunker', 'museum', 'vr'];
const NEW = ['casino', 'greenhouse', 'alpine', 'subway'];
// The cover props src/render/world.js knows how to build.
const COVER_KINDS = ['desk', 'cubicle', 'planter', 'lounge', 'bar', 'crate', 'sandbag', 'console', 'bench', 'vitrine', 'plinth', 'monolith'];
const ENVS = ['ocean', 'skyline', 'desert', 'vrgrid', 'garden', 'alpine', 'void'];
const isColour = (c) => Number.isInteger(c) && c >= 0 && c <= 0xffffff;
const hue = (hex) => {
  const [r, g, b] = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (!d) return -1;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

test('ten themes: the original six, then the four new settings', () => {
  assert.deepEqual(THEME_IDS, [...ORIGINAL, ...NEW]);
  for (const id of THEME_IDS) {
    const t = THEMES[id];
    assert.equal(t.id, id);
    for (const key of ['name', 'place', 'guard']) assert.ok(typeof t[key] === 'string' && t[key].length > 3, `${id}.${key}`);
    assert.ok(t.covers.length >= 1);
    for (const kind of t.covers) assert.ok(COVER_KINDS.includes(kind), `${id}: world.js cannot build a "${kind}"`);
  }
  assert.equal(new Set(THEME_IDS.map((id) => THEMES[id].name)).size, 10, 'every theme has its own name');
});

test('the four new themes are exactly as briefed', () => {
  assert.deepEqual(THEMES.casino, { id: 'casino', name: 'Midnight Casino', place: 'The Velvet Table', guard: 'Pit Boss Security', covers: ['bar', 'lounge', 'plinth'] });
  assert.deepEqual(THEMES.greenhouse, { id: 'greenhouse', name: 'Botanical Conservatory', place: 'The Glass Pavilion, after dusk', guard: 'Night Botanist', covers: ['planter', 'bench', 'vitrine'] });
  assert.deepEqual(THEMES.alpine, { id: 'alpine', name: 'Alpine Chalet', place: 'Peak 9 Private Lodge', guard: 'Ski Patrol Sentry', covers: ['lounge', 'bar', 'crate'] });
  assert.deepEqual(THEMES.subway, { id: 'subway', name: 'Underground Archive', place: 'Line 0 Vault Station', guard: 'Transit Inspector', covers: ['bench', 'crate', 'console'] });
  assert.deepEqual([ART.casino.floor, ART.casino.wall], ['baize', 'casinowall']);
  assert.deepEqual([ART.greenhouse.floor, ART.greenhouse.wall, ART.greenhouse.outer], ['flagstone', 'glasshouse', 'glass']);
  assert.deepEqual([ART.alpine.floor, ART.alpine.wall], ['herringbone', 'timber']);
  assert.deepEqual([ART.subway.floor, ART.subway.wall], ['metro', 'subwaytile']);
  assert.equal(ART.casino.env, 'skyline', 'the casino looks out over the skyline');
  assert.ok(ART.greenhouse.rain, 'rain on the conservatory glass');
  assert.ok(ART.alpine.snow, 'snow at the chalet');
});

test('every theme has complete art: palette, light rig, and painters for its surfaces', () => {
  assert.deepEqual(Object.keys(ART).sort(), [...THEME_IDS].sort());
  for (const id of THEME_IDS) {
    const a = ART[id];
    assert.ok(FLOOR_KEYS.includes(a.floor), `${id}: no floor texture "${a.floor}"`);
    assert.ok(WALL_KEYS.includes(a.wall), `${id}: no wall texture "${a.wall}"`);
    assert.ok(['solid', 'glass', 'rail'].includes(a.outer), `${id}.outer`);
    assert.ok(ENVS.includes(a.env), `${id}.env`);
    if (a.hall) {
      assert.equal(a.env, 'void', 'only interiors sit inside a hall');
      assert.ok(BACKDROP_KEYS.includes(a.hall[0]), `${id}: no backdrop "${a.hall[0]}"`);
      assert.ok(isColour(a.hall[1]));
    }
    for (const key of ['cap', 'glow', 'accent', 'motes']) assert.ok(isColour(a[key]), `${id}.${key}`);
    assert.ok(a.sky.length >= 3 && a.sky.every(([stop, css]) => stop >= 0 && stop <= 1 && /^#[0-9a-f]{6}$/.test(css)), `${id}.sky`);
    assert.deepEqual(a.sky.map((s) => s[0]), [...a.sky.map((s) => s[0])].sort((x, y) => x - y), `${id}.sky stops ascend`);
    assert.ok(isColour(a.fog[0]) && a.fog[1] > 0 && a.fog[1] < 0.05, `${id}.fog`);
    assert.ok(isColour(a.hemi[0]) && isColour(a.hemi[1]) && a.hemi[2] > 0, `${id}.hemi`);
    assert.ok(isColour(a.sun[0]) && a.sun[1] > 0 && a.sun[2].length === 3 && a.sun[2][1] > 0, `${id}.sun shines down`);
    assert.ok(isColour(a.rim[0]) && a.rim[1] > 0, `${id}.rim`);
    assert.ok(isColour(a.lamp[0]) && a.lamp[1] > 0, `${id}.lamp`);
    assert.ok(a.grade.length === 2 && a.grade.every(isColour), `${id}.grade`);
    assert.ok(a.exposure > 0.9 && a.exposure < 1.5 && a.bloom > 0.2 && a.bloom < 0.6, `${id}: exposure/bloom`);
  }
  for (const key of ['harbor', 'city', 'mesas', 'vr', 'garden', 'peaks', 'tunnel']) assert.ok(BACKDROP_KEYS.includes(key), `backdrop ${key}`);
  assert.equal(new Set(THEME_IDS.map((id) => ART[id].floor)).size, 10, 'no two themes share a floor');
  assert.equal(new Set(THEME_IDS.map((id) => ART[id].wall)).size, 10, 'no two themes share a wall');
  assert.ok(VENT_COLORS.length >= 4 && VENT_COLORS.every(isColour), 'duct colours are per-duct, not per-theme');
});

test('the new colour stories: warm practical lamps against cool or jewel-toned shadow', () => {
  const warm = (hex) => {
    const h = hue(hex);
    return h >= 10 && h <= 55;
  };
  for (const id of NEW) assert.ok(warm(ART[id].lamp[0]), `${id}: amber lamps`);
  const between = (hex, lo, hi) => hue(hex) >= lo && hue(hex) <= hi;
  assert.ok(between(ART.casino.grade[0], 250, 320), 'casino: ruby-indigo shadow grade');
  assert.ok(between(ART.greenhouse.fog[0], 150, 185), 'greenhouse: emerald-teal fog');
  assert.ok(between(ART.alpine.sun[0], 200, 240), 'alpine: icy moonlight');
  assert.ok(between(ART.subway.rim[0], 175, 195), 'subway: cyan transit-sign rim light');
});

test('every theme names its venues, deterministically and with plenty of variety', () => {
  for (const id of THEME_IDS) {
    const names = new Set();
    for (let i = 0; i < 80; i++) {
      const name = venueName(id, new RNG(`venue-${id}-${i}`));
      assert.equal(name, venueName(id, new RNG(`venue-${id}-${i}`)));
      assert.ok(name.length > 8 && name.length < 80 && !/undefined|null|NaN/.test(name), `${name} must fit the HUD`);
      names.add(name);
    }
    assert.ok(names.size >= 70, `${id}: only ${names.size} distinct venues in 80`);
  }
  assert.match(venueName('casino', new RNG('v')), /Salon|Room|Vault|Bar|Pit|Hall|Cage|Sky|Suite|Gallery|Office/);
  assert.match(venueName('greenhouse', new RNG('v')), /Conservatory|Gardens|Arboretum|Orangery|Glasshouse|Herbarium/);
  assert.match(venueName('alpine', new RNG('v')), /Lodge|Chalet|Club|Haus|Hütte|Retreat/);
  assert.match(venueName('subway', new RNG('v')), /^Line /);
});

test('every theme has a cast, local owners and signature loot of its own', () => {
  for (const id of THEME_IDS) {
    const cast = THEME_CAST[id];
    assert.ok(cast, `${id}: no cast`);
    assert.ok(cast.uniforms.length >= 2 && cast.uniforms.every((u) => u.length === 3 && u.every(isColour)), `${id}: uniforms`);
    assert.ok(Object.values(cast.weights).filter((w) => w > 0).length >= 3, `${id}: archetypes`);
    const look = guardLook(id, new RNG(`cast-${id}`));
    assert.ok(cast.uniforms.some(([top, bottom, accent]) => look.top === top && look.bottom === bottom && look.accent === accent), `${id}: guard wears a house uniform`);
    const owners = LOOT_WORDS.OWNERS[id];
    assert.ok(owners && owners.length >= 6 && new Set(owners).size === owners.length, `${id}: local owners`);
    const sig = LOOT.filter((l) => l.themes && l.themes.includes(id));
    assert.ok(sig.length >= 1, `${id}: no signature loot`);
    for (const l of sig) assert.ok(PROP_KEYS.includes(l.prop), `${id}: no bespoke prop "${l.prop}"`);
  }
  for (const id of NEW) {
    assert.equal(THEME_CAST[id].uniforms.length, 4);
    const own = LOOT.filter((l) => l.themes && l.themes.length === 1 && l.themes[0] === id);
    assert.ok(own.length >= 1 && own.length <= 2, `${id}: one or two signature pieces of its own`);
    // local owners never leak into another setting
    for (const other of THEME_IDS) if (other !== id) for (const o of LOOT_WORDS.OWNERS[id]) assert.ok(!LOOT_WORDS.OWNERS[other].includes(o), `${o} is in both ${id} and ${other}`);
  }
  assert.ok(THEME_CAST.casino.weights.gala > THEME_CAST.casino.weights.enforcer, 'casinos are mostly tuxedos');
  assert.ok(THEME_CAST.alpine.weights.tactical >= THEME_CAST.alpine.weights.watchman, 'ski patrol is uniformed');
});

test('signature pieces of the new themes actually drop there', () => {
  for (const id of NEW) {
    const mine = new Set(LOOT.filter((l) => l.themes && l.themes.includes(id)).map((l) => l.id));
    const seen = new Set();
    for (let i = 0; i < 600; i++) {
      const loot = generateLoot(new RNG(`sig-${id}-${i}`), id);
      if (loot.signature && mine.has(loot.id)) seen.add(loot.id);
    }
    assert.equal(seen.size, mine.size, `${id}: saw ${[...seen]} of ${[...mine]}`);
  }
});

test('rooms generate in each new theme with its own cover props, venue and local flavour', () => {
  for (const id of NEW) {
    const kinds = new Set();
    for (let i = 0; i < 6; i++) {
      const r = generateRoom({ seed: `new-theme-${id}-${i}`, level: 2 + i, theme: id });
      assert.equal(r.themeId, id);
      assert.ok(r.venue.length > 8);
      for (const c of r.covers) {
        if (c.kind === 'pedestal') continue;
        assert.ok(THEMES[id].covers.includes(c.kind), `${id}: unexpected cover ${c.kind}`);
        kinds.add(c.kind);
      }
    }
    assert.deepEqual([...kinds].sort(), [...THEMES[id].covers].sort(), `${id}: every cover kind turns up`);
  }
});
