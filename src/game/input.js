// Keyboard, mouse and touch, normalised into one small state object.
//
// Touch: left side of the screen is a floating analog thumbstick, the rest is
// drag-to-orbit (pinch to zoom). Buttons are real DOM elements so they get
// their own pointers and never fight the stick.

const KEYMAP = {
  KeyE: 'action',
  Space: 'action',
  Enter: 'confirm',
  KeyC: 'crouch',
  KeyQ: 'knock',
  KeyF: 'knock',
  KeyV: 'cam',
  KeyR: 'retry',
  KeyM: 'mute',
  Escape: 'pause',
  KeyP: 'pause',
};

export class Input {
  constructor(canvas, els) {
    this.canvas = canvas;
    this.els = els;
    this.keys = new Set();
    this.edges = new Set();
    this.move = { x: 0, y: 0 };
    this.orbit = { dx: 0, dy: 0, zoom: 0 };
    this.shift = false;
    this.isTouch = false;
    this.enabled = true;
    this.stick = null; // { id, ox, oy, x, y }
    this.drags = new Map(); // pointerId -> { x, y }
    this.pinch = 0;
    this.onFirstGesture = null;
    this._bind();
  }

  _gesture() {
    if (this.onFirstGesture) this.onFirstGesture();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.code === 'Escape' || e.code === 'Enter') e.target.blur();
        return;
      }
      this._gesture();
      if (e.repeat) {
        if (KEYMAP[e.code] || e.code.startsWith('Arrow')) e.preventDefault();
        return;
      }
      const onButton = document.activeElement instanceof HTMLButtonElement;
      if ((e.code === 'Space' || e.code === 'Enter') && onButton) return; // the focused button handles it
      this.keys.add(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shift = true;
      const a = KEYMAP[e.code];
      if (a) {
        this.edges.add(a);
        if (e.code === 'Space') this.edges.add('confirm');
      }
      if (a || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shift = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.shift = false;
      this._endStick();
      this.drags.clear();
    });

    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      this._gesture();
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        // pointer already gone (or synthetic): capture is only a nicety
      }
      if (e.pointerType === 'touch') {
        this.isTouch = true;
        const leftZone = e.clientX < window.innerWidth * 0.45;
        if (leftZone && !this.stick) {
          this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
          this._drawStick();
          return;
        }
      }
      this.drags.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.pinch = 0;
    });
    c.addEventListener('pointermove', (e) => {
      if (this.stick && e.pointerId === this.stick.id) {
        const R = 56;
        let dx = e.clientX - this.stick.ox;
        let dy = e.clientY - this.stick.oy;
        const d = Math.hypot(dx, dy);
        if (d > R) {
          // the stick base follows a thumb that drags past the rim
          this.stick.ox += (dx / d) * (d - R);
          this.stick.oy += (dy / d) * (d - R);
          dx = (dx / d) * R;
          dy = (dy / d) * R;
        }
        this.stick.x = dx / R;
        this.stick.y = dy / R;
        this._drawStick();
        return;
      }
      const p = this.drags.get(e.pointerId);
      if (!p) return;
      if (this.drags.size >= 2) {
        const before = this._spread();
        p.x = e.clientX;
        p.y = e.clientY;
        const after = this._spread();
        this.orbit.zoom -= (after - before) * 0.02;
        return;
      }
      const k = e.pointerType === 'touch' ? 0.0075 : 0.0055;
      this.orbit.dx += (e.clientX - p.x) * k;
      this.orbit.dy += (e.clientY - p.y) * k;
      p.x = e.clientX;
      p.y = e.clientY;
    });
    const up = (e) => {
      if (this.stick && e.pointerId === this.stick.id) this._endStick();
      this.drags.delete(e.pointerId);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.orbit.zoom += Math.sign(e.deltaY) * 0.9;
      },
      { passive: false },
    );

    // On-screen buttons
    for (const [id, action] of Object.entries(this.els.buttons || {})) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._gesture();
        if (e.pointerType === 'touch') this.isTouch = true;
        this.edges.add(action);
        el.classList.add('down');
        if (navigator.vibrate && e.pointerType === 'touch') navigator.vibrate(8);
      });
      const rel = () => el.classList.remove('down');
      el.addEventListener('pointerup', rel);
      el.addEventListener('pointercancel', rel);
      el.addEventListener('pointerleave', rel);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  _spread() {
    const pts = [...this.drags.values()];
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  _endStick() {
    this.stick = null;
    this._drawStick();
  }

  _drawStick() {
    const { stick, knob } = this.els;
    if (!stick) return;
    if (!this.stick) {
      stick.classList.remove('on');
      return;
    }
    stick.classList.add('on');
    stick.style.transform = `translate(${this.stick.ox}px, ${this.stick.oy}px)`;
    knob.style.transform = `translate(${this.stick.x * 56}px, ${this.stick.y * 56}px)`;
  }

  /** Call once per frame before reading. */
  poll(dt) {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    const m = Math.hypot(x, y);
    if (m > 0) {
      x /= m;
      y /= m;
    } else if (this.stick) {
      // analog: dead zone, then a soft curve so a light tilt is a tiptoe
      const sm = Math.hypot(this.stick.x, this.stick.y);
      if (sm > 0.14) {
        const out = Math.min(1, (sm - 0.14) / 0.8);
        x = (this.stick.x / sm) * out;
        y = (-this.stick.y / sm) * out;
      }
    }
    this.move.x = x;
    this.move.y = y;
    if (k.has('KeyJ')) this.orbit.dx += 2.2 * dt;
    if (k.has('KeyL')) this.orbit.dx -= 2.2 * dt;
  }

  /** True once per press. */
  take(action) {
    if (!this.edges.has(action)) return false;
    this.edges.delete(action);
    return true;
  }

  endFrame() {
    this.edges.clear();
    this.orbit.dx = this.orbit.dy = this.orbit.zoom = 0;
  }
}
