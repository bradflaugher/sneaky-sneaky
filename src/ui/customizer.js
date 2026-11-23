// Agent customizer controls. The live 3D preview is rendered by the game on
// the main canvas; this module only owns the form.

import { OUTFITS, HEADGEAR, BUILDS, SKIN_TONES } from '../render/character.js';

export const PRIMARY_COLORS = [0x3d5266, 0x1a1a20, 0x3a2a4a, 0x5a1a22, 0x2a4a3a, 0x6e6046, 0xb8b2a6, 0x8a4a1c, 0x1f6a7a, 0x4a4f56];
export const ACCENT_COLORS = [0xc1121f, 0xffb000, 0x19f0e0, 0xefe6d2, 0x1a1a20, 0x6a8a2a, 0x7a5cff, 0xd94f8a, 0x2a6fd0, 0x5a6a78];

const ADJ = ['Quiet', 'Velvet', 'Sneaky', 'Damp', 'Polite', 'Beige', 'Tactical', 'Suspicious', 'Midnight', 'Squeaky', 'Humble', 'Greased', 'Invisible', 'Lukewarm', 'Discreet', 'Unbothered', 'Slippery', 'Whispering', 'Casual', 'Budget'];
const NOUN = ['Otter', 'Baguette', 'Raccoon', 'Sock', 'Possum', 'Noodle', 'Mongoose', 'Crouton', 'Ferret', 'Pigeon', 'Gecko', 'Biscuit', 'Lemur', 'Turnip', 'Weasel', 'Pancake', 'Moth', 'Dumpling', 'Badger', 'Cabbage'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function randomCodename() {
  return `${pick(ADJ)} ${pick(NOUN)}`;
}

export function randomAgent(agent) {
  return {
    ...agent,
    outfit: pick(Object.keys(OUTFITS)),
    head: pick(Object.keys(HEADGEAR)),
    build: pick(Object.keys(BUILDS)),
    skin: Math.floor(Math.random() * SKIN_TONES.length),
    primary: pick(PRIMARY_COLORS),
    accent: pick(ACCENT_COLORS),
  };
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

export class Customizer {
  /** onChange(agent, rebuild) – rebuild is false for codename-only edits. */
  constructor(onChange, onClick) {
    this.onChange = onChange;
    this.onClick = onClick || (() => {});
    this.fields = document.getElementById('custom-fields');
    this.name = document.getElementById('codename');
    this.agent = null;
    this.name.addEventListener('input', () => {
      this.agent.codename = this.name.value.trim().slice(0, 22) || 'Agent';
      this.onChange(this.agent, false);
    });
    document.getElementById('btn-dice').addEventListener('click', () => {
      this.agent.codename = randomCodename();
      this.name.value = this.agent.codename;
      this.onClick();
      this.onChange(this.agent, false);
    });
    document.getElementById('btn-random-look').addEventListener('click', () => {
      Object.assign(this.agent, randomAgent(this.agent));
      this.onClick();
      this.render();
      this.onChange(this.agent, true);
    });
  }

  open(agent) {
    this.agent = agent;
    this.name.value = agent.codename;
    this.render();
  }

  render() {
    const a = this.agent;
    this.fields.textContent = '';
    const field = (label, build) => {
      const f = document.createElement('div');
      f.className = 'field';
      const l = document.createElement('span');
      l.className = 'lbl';
      l.textContent = label;
      const row = document.createElement('div');
      row.className = 'chips';
      f.append(l, row);
      build(row);
      this.fields.append(f);
    };
    const set = (key, value) => {
      a[key] = value;
      this.onClick();
      this.render();
      this.onChange(a, true);
    };
    const chips = (key, options) => (row) => {
      for (const [value, label] of options) {
        const b = document.createElement('button');
        b.className = `chip${a[key] === value ? ' sel' : ''}`;
        b.textContent = label;
        b.addEventListener('click', () => set(key, value));
        row.append(b);
      }
    };
    const swatches = (key, colors) => (row) => {
      colors.forEach((c, i) => {
        const value = key === 'skin' ? i : c;
        const b = document.createElement('button');
        b.className = `swatch${a[key] === value ? ' sel' : ''}`;
        b.style.background = hex(c);
        b.setAttribute('aria-label', `${key} colour ${i + 1}`);
        b.addEventListener('click', () => set(key, value));
        row.append(b);
      });
    };
    field('OUTFIT', chips('outfit', Object.entries(OUTFITS)));
    field('SUIT COLOUR', swatches('primary', PRIMARY_COLORS));
    field('ACCENT COLOUR', swatches('accent', ACCENT_COLORS));
    field('HEADGEAR', chips('head', Object.entries(HEADGEAR)));
    field('SKIN TONE', swatches('skin', SKIN_TONES));
    field('BUILD', chips('build', Object.entries(BUILDS).map(([k, v]) => [k, v.name])));
  }
}
