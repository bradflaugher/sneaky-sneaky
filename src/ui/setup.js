// Mission Setup panel: difficulty preset, endless ramp pace, starting size,
// setting lock and the fine-tuning sliders.

import { PRESETS, RAMPS, STARTS, ALERT_RANGE, VISION_RANGE, normalizeSetup, tierFor, sizeClass, resolveMods } from '../core/difficulty.js';
import { THEMES } from '../core/themes.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export class SetupPanel {
  constructor(onChange, onClick) {
    this.onChange = onChange;
    this.onClick = onClick || (() => {});
    this.root = document.getElementById('setup-fields');
    this.note = document.getElementById('setup-note');
    this.setup = normalizeSetup();
  }

  open(setup, midRun) {
    this.setup = normalizeSetup(setup);
    this.note.textContent = midRun ? 'Changes take effect from the next room. Starting size applies to your next run.' : '';
    this.note.classList.toggle('hidden', !midRun);
    this.render();
  }

  set(key, value) {
    this.setup = normalizeSetup({ ...this.setup, [key]: value });
    this.onChange(this.setup);
  }

  render() {
    const s = this.setup;
    const tuningOpen = this.root.querySelector('details')?.open || s.alert !== 1 || s.vision !== 1;
    this.root.textContent = '';
    const field = (label, blurb) => {
      const f = el('div', 'field');
      f.append(el('span', 'lbl', label));
      const row = el('div', 'chips');
      f.append(row);
      if (blurb) f.append(el('div', 'blurb', blurb));
      this.root.append(f);
      return row;
    };
    const chips = (row, key, options) => {
      for (const [value, label, tag] of options) {
        const b = el('button', `chip${s[key] === value ? ' sel' : ''}`, label);
        if (tag) b.append(el('small', '', tag));
        b.addEventListener('click', () => {
          this.onClick();
          this.set(key, value);
          this.render();
        });
        row.append(b);
      }
    };

    const p = PRESETS[s.difficulty];
    chips(field('DIFFICULTY', p.blurb), 'difficulty', Object.values(PRESETS).map((x) => [x.id, x.name, x.tag]));
    chips(field('RAMP PACE', RAMPS[s.ramp].blurb), 'ramp', Object.values(RAMPS).map((x) => [x.id, x.name]));
    chips(field('STARTING SIZE', this.forecast()), 'start', Object.values(STARTS).map((x) => [x.id, x.name, x.tier === 1 ? 'Room 1' : `Tier ${x.tier}`]));
    chips(field('SETTING', s.theme === 'random' ? 'A new setting every room.' : `Every room: ${THEMES[s.theme]?.place || ''}.`), 'theme', [['random', 'Endless Shuffle'], ...Object.values(THEMES).map((t) => [t.id, t.name])]);

    // fine tuning
    const d = el('details', 'tuning');
    d.open = tuningOpen;
    d.append(el('summary', '', 'FINE TUNING'));
    const mods = resolveMods(s);
    const slider = (key, label, [lo, hi], effective) => {
      const wrap = el('label', 'slider');
      const head = el('div', 'slider-head');
      const val = el('b', '', `${Math.round(s[key] * 100)}%`);
      head.append(el('span', '', label), val);
      const input = el('input');
      Object.assign(input, { type: 'range', min: String(lo), max: String(hi), step: '0.05', value: String(s[key]) });
      const eff = el('div', 'blurb', effective(mods));
      input.addEventListener('input', () => {
        this.set(key, parseFloat(input.value));
        val.textContent = `${Math.round(this.setup[key] * 100)}%`;
        eff.textContent = effective(resolveMods(this.setup));
      });
      wrap.append(head, input, eff);
      d.append(wrap);
    };
    slider('alert', 'GUARD ALERTNESS', ALERT_RANGE, (m) => `Guards notice you ${m.detect.toFixed(2)}× as fast as Operative.`);
    slider('vision', 'VISION RANGE', VISION_RANGE, (m) => `Cones reach ${m.vision.toFixed(2)}× as far as Operative.`);
    const reset = el('button', 'chip', 'Reset sliders');
    reset.addEventListener('click', () => {
      this.onClick();
      this.setup = normalizeSetup({ ...this.setup, alert: 1, vision: 1 });
      this.onChange(this.setup);
      this.render();
    });
    d.append(reset);
    this.root.append(d);
  }

  /** "Room 1 Compact → Room 5 Standard → …" for the current ramp. */
  forecast() {
    const s = this.setup;
    const shift = PRESETS[s.difficulty].sizeShift;
    const rooms = RAMPS[s.ramp].rate === 0 ? [1] : [1, 5, 10, 20];
    const parts = rooms.map((n) => `Room ${n}: ${sizeClass(tierFor(n, s) + shift).name}`);
    return RAMPS[s.ramp].rate === 0 ? `${parts[0]}, forever.` : parts.join('  →  ');
  }
}
