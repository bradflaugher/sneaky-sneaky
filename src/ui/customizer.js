// Agent customizer controls. The live 3D preview is rendered by the game on
// the main canvas; this module only owns the form.

import { OUTFITS, HEADGEAR, BUILDS, SKIN_TONES, HAIR_COLORS, PRIMARY_COLORS, ACCENT_COLORS, randomAgent, randomCodename } from '../core/agent.js';

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
      // a whole new original, codename included
      Object.assign(this.agent, randomAgent());
      this.name.value = this.agent.codename;
      this.onClick();
      this.render();
      this.onChange(this.agent, true);
    });
  }

  /** firstRun switches the copy to the Select Your Agent / Confirm & Deploy flow. */
  open(agent, firstRun = false) {
    this.agent = agent;
    this.name.value = agent.codename;
    document.getElementById('custom-title').textContent = firstRun ? 'SELECT YOUR AGENT' : 'AGENT DOSSIER';
    document.getElementById('custom-intro').textContent = firstRun ? 'We dealt you a random original. Keep them, reroll, or tailor every detail.' : 'Reroll for a new original, or tailor every detail.';
    document.getElementById('btn-custom-done').textContent = firstRun ? 'CONFIRM & DEPLOY' : 'CONFIRM';
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
        const value = key === 'skin' || key === 'hair' ? i : c;
        const b = document.createElement('button');
        b.className = `swatch${a[key] === value ? ' sel' : ''}`;
        b.style.background = hex(c);
        b.setAttribute('aria-label', `${key} colour ${i + 1}`);
        b.addEventListener('click', () => set(key, value));
        row.append(b);
      });
    };
    field('OUTFIT', chips('outfit', Object.entries(OUTFITS)));
    field('MAIN COLOUR', swatches('primary', PRIMARY_COLORS));
    field('ACCENT COLOUR', swatches('accent', ACCENT_COLORS));
    field('HEAD', chips('head', Object.entries(HEADGEAR)));
    field('HAIR', swatches('hair', HAIR_COLORS));
    field('SKIN TONE', swatches('skin', SKIN_TONES));
    field('BUILD', chips('build', Object.entries(BUILDS).map(([k, v]) => [k, v.name])));
  }
}
