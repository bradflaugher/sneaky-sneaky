// Lightweight effects: sound rings, floating glyphs (! ? Zzz), prompt rings,
// sparkles. Everything is pooled per room and thrown away with it.

import * as THREE from 'three';
import { glyphTexture, glowTexture } from './textures.js';

export function createFx(parent) {
  const group = new THREE.Group();
  parent.add(group);
  const live = [];
  const ringGeo = new THREE.RingGeometry(0.93, 1, 64);
  const glow = glowTexture();

  const sprite = (tex, color = 0xffffff) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    s.renderOrder = 60;
    group.add(s);
    return s;
  };

  // The glowing ring that marks the current context-action target.
  const prompt = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.6, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  prompt.rotation.x = -Math.PI / 2;
  prompt.visible = false;
  prompt.renderOrder = 8;
  group.add(prompt);

  return {
    group,
    /** Expanding ring on the floor (knocks, footsteps heard, etc). */
    ring(x, z, color, maxR, dur = 0.9, y = 0.06) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.renderOrder = 7;
      group.add(m);
      live.push({ t: 0, dur, tick: (k) => {
        const e = 1 - Math.pow(1 - k, 3);
        m.scale.setScalar(0.2 + e * maxR);
        m.material.opacity = 0.9 * (1 - k);
      }, end: () => { m.removeFromParent(); m.material.dispose(); } });
    },
    /** A glyph that floats up and fades: Zzz, +1, etc. */
    floatGlyph(ch, color, x, y, z, size = 0.45, dur = 1.8) {
      const s = sprite(glyphTexture(ch, color, color));
      const drift = (Math.random() - 0.5) * 0.5;
      live.push({ t: 0, dur, tick: (k) => {
        s.position.set(x + drift * k + Math.sin(k * 6) * 0.08, y + k * 0.9, z);
        s.scale.setScalar(size * (0.5 + k * 0.8));
        s.material.opacity = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      }, end: () => { s.removeFromParent(); s.material.dispose(); } });
    },
    /** Persistent head icon for a guard; returns a handle. */
    headIcon() {
      const q = sprite(glyphTexture('?', '#ffc233', '#ffb020'));
      const bang = sprite(glyphTexture('!', '#ff3b30', '#ff2a2a'));
      q.visible = bang.visible = false;
      let pop = 0;
      return {
        set(kind, x, y, z, amount, dt) {
          q.visible = kind === '?';
          bang.visible = kind === '!';
          if (kind === '!') {
            pop = Math.min(1, pop + dt * 7);
            const s = 1.0 + Math.sin(pop * Math.PI) * 0.8;
            bang.position.set(x, y + 0.2, z);
            bang.scale.setScalar(0.95 * s);
          } else {
            pop = 0;
            if (kind === '?') {
              q.position.set(x, y + 0.08, z);
              q.scale.setScalar(0.4 + 0.35 * amount);
              q.material.opacity = 0.55 + 0.45 * amount;
            }
          }
        },
        dispose() {
          q.removeFromParent();
          bang.removeFromParent();
          q.material.dispose();
          bang.material.dispose();
        },
      };
    },
    burst(x, y, z, color, n = 16) {
      for (let i = 0; i < n; i++) {
        const s = sprite(glow, color);
        s.material.blending = THREE.AdditiveBlending;
        const a = Math.random() * Math.PI * 2;
        const up = 0.6 + Math.random() * 1.6;
        const sp = 0.4 + Math.random() * 1.4;
        live.push({ t: 0, dur: 0.7 + Math.random() * 0.5, tick: (k) => {
          s.position.set(x + Math.cos(a) * sp * k, y + up * k - 1.6 * k * k, z + Math.sin(a) * sp * k);
          s.scale.setScalar(0.22 * (1 - k * 0.6));
          s.material.opacity = 1 - k;
        }, end: () => { s.removeFromParent(); s.material.dispose(); } });
      }
    },
    setPrompt(target, color, t) {
      prompt.visible = !!target;
      if (!target) return;
      prompt.position.set(target.x, 0.07, target.z);
      prompt.material.color.setHex(color);
      const s = (target.r || 0.6) * (1 + Math.sin(t * 6) * 0.08);
      prompt.scale.setScalar(s / 0.6);
      prompt.rotation.z = t * 1.5;
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.t += dt;
        const k = Math.min(1, p.t / p.dur);
        p.tick(k);
        if (k >= 1) {
          p.end();
          live.splice(i, 1);
        }
      }
    },
    dispose() {
      for (const p of live) p.end();
      live.length = 0;
      group.removeFromParent();
      ringGeo.dispose();
      prompt.geometry.dispose();
      prompt.material.dispose();
    },
  };
}
