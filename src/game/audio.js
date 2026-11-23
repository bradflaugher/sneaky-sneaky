// Everything you hear is synthesised live with the Web Audio API.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.tension = 0;
    this.musicOn = false;
    this._step = 0;
    this._nextTime = 0;
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.5;
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 700;
      this.musicBus.connect(this.musicFilter).connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, len);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._timer = setInterval(() => this._schedule(), 60);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.03);
  }

  // ---- primitives
  _tone({ type = 'sine', f = 440, f2 = null, t = 0, dur = 0.2, vol = 0.2, attack = 0.005, bus = null, slide = null }) {
    if (!this.ctx) return;
    const c = this.ctx;
    const at = c.currentTime + t;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + (slide || dur));
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(bus || this.master);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  _noise({ t = 0, dur = 0.2, vol = 0.2, f = 1000, q = 1, type = 'bandpass', f2 = null, attack = 0.004, bus = null }) {
    if (!this.ctx) return;
    const c = this.ctx;
    const at = c.currentTime + t;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, at);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, at + dur);
    fl.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(fl).connect(g).connect(bus || this.master);
    s.start(at, Math.random());
    s.stop(at + dur + 0.05);
  }

  // ---- adaptive stealth pulse
  startMusic() {
    this.musicOn = true;
    if (this.ctx) this._nextTime = this.ctx.currentTime + 0.1;
  }
  stopMusic() {
    this.musicOn = false;
  }
  setTension(x) {
    this.tension += (x - this.tension) * 0.08;
    if (this.musicFilter) this.musicFilter.frequency.setTargetAtTime(520 + this.tension * 2600, this.ctx.currentTime, 0.2);
  }

  _schedule() {
    if (!this.ctx || !this.musicOn || this.ctx.state !== 'running') return;
    const c = this.ctx;
    if (this._nextTime < c.currentTime) this._nextTime = c.currentTime + 0.05;
    const bpm = 82 + this.tension * 34;
    const sixteenth = 60 / bpm / 4;
    const ROOT = 38; // D2
    const BASS = [0, -1, 0, -1, 0, -1, 3, -1, 0, -1, 0, -1, -2, -1, 5, 3];
    const LEAD = [12, -1, -1, 15, -1, -1, 14, -1, -1, 10, -1, -1, 7, -1, 8, -1];
    while (this._nextTime < c.currentTime + 0.2) {
      const t = this._nextTime - c.currentTime;
      const i = this._step % 16;
      const bar = Math.floor(this._step / 16);
      const b = BASS[i];
      if (b >= 0) {
        this._tone({ type: 'triangle', f: NOTE(ROOT + b), t, dur: 0.22, vol: 0.34, bus: this.musicBus });
        this._tone({ type: 'sine', f: NOTE(ROOT + b - 12), t, dur: 0.26, vol: 0.3, bus: this.musicBus });
      }
      if (i % 4 === 2) this._noise({ t, dur: 0.04, vol: 0.05 + this.tension * 0.06, f: 6500, q: 2, bus: this.musicBus });
      if (this.tension > 0.35 && i % 2 === 1) this._noise({ t, dur: 0.025, vol: 0.05, f: 9000, q: 3, bus: this.musicBus });
      if (i % 8 === 0) this._tone({ type: 'sine', f: 62, f2: 38, t, dur: 0.16, vol: 0.4, bus: this.musicBus });
      const l = LEAD[i];
      if (l >= 0 && bar % 4 >= 2) this._tone({ type: 'square', f: NOTE(ROOT + 12 + l), t, dur: 0.16, vol: 0.035 + this.tension * 0.03, bus: this.musicBus });
      if (this.tension > 0.6 && i % 4 === 0) this._tone({ type: 'sawtooth', f: NOTE(ROOT + 13), t, dur: 0.12, vol: 0.06, bus: this.musicBus });
      this._nextTime += sixteenth;
      this._step++;
    }
  }

  // ---- sound effects
  step(crouched, loud) {
    this._noise({ dur: 0.07, vol: crouched ? 0.035 : loud ? 0.16 : 0.07, f: crouched ? 500 : 900, q: 0.8, type: 'lowpass' });
    if (!crouched) this._tone({ f: 95, f2: 60, dur: 0.06, vol: loud ? 0.12 : 0.05 });
  }
  ventStep() {
    this._noise({ dur: 0.12, vol: 0.16, f: 1800, q: 6 });
    this._tone({ type: 'square', f: 140 + Math.random() * 40, f2: 90, dur: 0.1, vol: 0.06 });
    this._tone({ type: 'triangle', f: 820 + Math.random() * 200, dur: 0.18, vol: 0.03 });
  }
  ventOpen() {
    this._noise({ dur: 0.25, vol: 0.2, f: 2400, f2: 500, q: 3 });
    this._tone({ type: 'square', f: 220, f2: 110, dur: 0.14, vol: 0.08 });
  }
  choke() {
    this._noise({ dur: 0.5, vol: 0.28, f: 300, f2: 2400, q: 1.2 });
    this._tone({ type: 'sawtooth', f: 180, f2: 70, dur: 0.5, vol: 0.09 });
    this._tone({ type: 'sine', f: 520, f2: 180, t: 0.42, dur: 0.5, vol: 0.14 });
    this._noise({ t: 0.6, dur: 0.18, vol: 0.2, f: 220, type: 'lowpass' });
  }
  zzz() {
    this._tone({ type: 'sine', f: 190, f2: 250, dur: 0.6, vol: 0.035 });
    this._noise({ t: 0.7, dur: 0.6, vol: 0.02, f: 500, q: 2 });
  }
  knock() {
    for (const t of [0, 0.13]) {
      this._tone({ type: 'triangle', f: 330, f2: 190, t, dur: 0.09, vol: 0.4 });
      this._noise({ t, dur: 0.05, vol: 0.25, f: 1500, q: 1 });
      this._tone({ type: 'triangle', f: 330, f2: 190, t: t + 0.22, dur: 0.09, vol: 0.09 });
      this._tone({ type: 'triangle', f: 330, f2: 190, t: t + 0.44, dur: 0.09, vol: 0.03 });
    }
  }
  whistle() {
    this._tone({ type: 'sine', f: 1300, f2: 1900, dur: 0.16, vol: 0.14, attack: 0.02 });
    this._tone({ type: 'sine', f: 1900, f2: 1200, t: 0.17, dur: 0.22, vol: 0.14, attack: 0.02 });
  }
  suspicious() {
    this._tone({ type: 'square', f: NOTE(71), dur: 0.1, vol: 0.09 });
    this._tone({ type: 'square', f: NOTE(77), t: 0.1, dur: 0.2, vol: 0.09 });
  }
  /** The "!" sting: a sharp, dissonant stab. */
  alert() {
    for (const [n, type] of [[81, 'sawtooth'], [87, 'sawtooth'], [93, 'square'], [69, 'sawtooth']]) {
      this._tone({ type, f: NOTE(n) * 0.5, f2: NOTE(n), slide: 0.05, dur: 0.75, vol: 0.14, attack: 0.002 });
    }
    this._noise({ dur: 0.3, vol: 0.3, f: 4000, f2: 800, q: 0.7 });
    this._tone({ type: 'sine', f: 110, f2: 45, dur: 0.6, vol: 0.5 });
  }
  fail() {
    [57, 53, 50, 45].forEach((n, i) => this._tone({ type: 'triangle', f: NOTE(n), t: 0.5 + i * 0.16, dur: 0.4, vol: 0.2 }));
  }
  chime() {
    [74, 78, 81, 86, 90].forEach((n, i) => this._tone({ type: 'sine', f: NOTE(n), t: i * 0.07, dur: 0.5, vol: 0.16 }));
    this._tone({ type: 'triangle', f: NOTE(98), t: 0.35, dur: 0.8, vol: 0.07 });
  }
  switchFlip() {
    this._tone({ type: 'square', f: 600, dur: 0.05, vol: 0.14 });
    this._tone({ type: 'square', f: 900, t: 0.07, dur: 0.08, vol: 0.14 });
    this._tone({ type: 'sawtooth', f: 900, f2: 80, t: 0.15, dur: 0.6, vol: 0.12 });
  }
  fanfare() {
    const seq = [[62, 0], [66, 0.13], [69, 0.26], [74, 0.39], [73, 0.62], [74, 0.75], [78, 0.9]];
    for (const [n, t] of seq) {
      this._tone({ type: 'square', f: NOTE(n), t, dur: n === 78 ? 0.9 : 0.2, vol: 0.1 });
      this._tone({ type: 'triangle', f: NOTE(n - 12), t, dur: n === 78 ? 0.9 : 0.2, vol: 0.14 });
    }
    this._tone({ type: 'triangle', f: NOTE(50), t: 0.9, dur: 1.0, vol: 0.2 });
    this._tone({ type: 'triangle', f: NOTE(69), t: 0.9, dur: 1.0, vol: 0.09 });
  }
  ui() {
    this._tone({ type: 'square', f: 880, dur: 0.04, vol: 0.06 });
  }
  uiBig() {
    this._tone({ type: 'square', f: 660, dur: 0.06, vol: 0.08 });
    this._tone({ type: 'square', f: 990, t: 0.06, dur: 0.1, vol: 0.08 });
  }
}
