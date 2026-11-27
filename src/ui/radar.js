// Soliton-style tactical radar: north-up minimap with live guard cones.

import { WALL, COVER, castRay } from '../core/grid.js';
import { VENT_COLORS } from '../render/themeArt.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

export class Radar {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.room = null;
  }

  setRoom(room) {
    this.room = room;
    const S = this.canvas.width;
    this.bg.width = this.bg.height = S;
    const scale = Math.min(S / room.w, S / room.h);
    this.scale = scale;
    this.ox = (S - room.w * scale) / 2;
    this.oy = (S - room.h * scale) / 2;
    const g = this.bg.getContext('2d');
    g.fillStyle = '#101626';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(246,239,220,0.06)';
    g.lineWidth = 1;
    for (let i = 0; i <= S; i += S / 10) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, S);
      g.moveTo(0, i);
      g.lineTo(S, i);
      g.stroke();
    }
    for (let y = 0; y < room.h; y++)
      for (let x = 0; x < room.w; x++) {
        const c = room.cells[y * room.w + x];
        if (c === WALL) g.fillStyle = 'rgba(246,239,220,0.82)';
        else if (c === COVER) g.fillStyle = 'rgba(246,239,220,0.3)';
        else g.fillStyle = 'rgba(246,239,220,0.05)';
        g.fillRect(this.ox + x * scale, this.oy + y * scale, scale + 0.5, scale + 0.5);
      }
    room.vents.forEach((v, i) => {
      g.fillStyle = hex(VENT_COLORS[i % VENT_COLORS.length]);
      for (const e of [v.a, v.b]) g.fillRect(this.ox + (e.cx + 0.15) * scale, this.oy + (e.cy + 0.15) * scale, scale * 0.7, scale * 0.7);
      g.strokeStyle = hex(VENT_COLORS[i % VENT_COLORS.length]);
      g.globalAlpha = 0.35;
      g.setLineDash([3, 4]);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(this.ox + (v.a.cx + 0.5) * scale, this.oy + (v.a.cy + 0.5) * scale);
      g.lineTo(this.ox + (v.b.cx + 0.5) * scale, this.oy + (v.b.cy + 0.5) * scale);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
    });
  }

  draw(state, t) {
    const room = this.room;
    if (!room) return;
    const g = this.g;
    const s = this.scale;
    const X = (x) => this.ox + x * s;
    const Y = (z) => this.oy + z * s;
    g.drawImage(this.bg, 0, 0);

    // lasers + switches
    room.lasers.forEach((l, i) => {
      if (!state.lasers[i]) return;
      g.strokeStyle = '#ff3b30';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(X(l.x0), Y(l.z0));
      g.lineTo(X(l.x1), Y(l.z1));
      g.stroke();
    });
    room.switches.forEach((sw) => {
      g.fillStyle = state.lasers[sw.laser] ? '#ff3b30' : '#33ff88';
      g.beginPath();
      g.moveTo(X(sw.cx + 0.5), Y(sw.cy + 0.1));
      g.lineTo(X(sw.cx + 0.9), Y(sw.cy + 0.5));
      g.lineTo(X(sw.cx + 0.5), Y(sw.cy + 0.9));
      g.lineTo(X(sw.cx + 0.1), Y(sw.cy + 0.5));
      g.fill();
    });

    // objective markers
    const blink = 0.55 + 0.45 * Math.sin(t * 6);
    if (!state.hasLoot) {
      g.fillStyle = `rgba(255,210,122,${blink})`;
      g.beginPath();
      g.arc(X(room.loot.x), Y(room.loot.z), s * 0.55, 0, 7);
      g.fill();
      g.strokeStyle = '#ffd27a';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(X(room.loot.x), Y(room.loot.z), s * (0.8 + blink * 0.4), 0, 7);
      g.stroke();
    }
    g.strokeStyle = state.hasLoot ? `rgba(90,255,154,${blink})` : 'rgba(140,160,175,0.7)';
    g.lineWidth = 2;
    g.strokeRect(X(room.exit.cx + 0.1), Y(room.exit.cy + 0.1), s * 0.8, s * 0.8);
    if (state.hasLoot) {
      g.fillStyle = `rgba(90,255,154,${blink * 0.6})`;
      g.fillRect(X(room.exit.cx + 0.1), Y(room.exit.cy + 0.1), s * 0.8, s * 0.8);
    }

    // guards and their real, occluded cones
    for (const gd of state.guards) {
      if (gd.asleep) {
        g.fillStyle = '#6f8090';
        g.font = `bold ${s * 1.3}px sans-serif`;
        g.fillText('z', X(gd.x) - s * 0.3, Y(gd.z) + s * 0.4);
        continue;
      }
      const col = gd.alert ? '229,53,43' : gd.meter > 0.3 || gd.wary ? '255,210,58' : '58,232,255';
      if (gd.periphRange && gd.periphHalf) {
        g.fillStyle = `rgba(${col},0.16)`;
        g.beginPath();
        g.moveTo(X(gd.x), Y(gd.z));
        const PN = 18;
        for (let i = 0; i <= PN; i++) {
          const a = gd.ang - gd.periphHalf + (2 * gd.periphHalf * i) / PN;
          const d = castRay(room, gd.x, gd.z, Math.cos(a), Math.sin(a), gd.periphRange, false);
          g.lineTo(X(gd.x + Math.cos(a) * d), Y(gd.z + Math.sin(a) * d));
        }
        g.fill();
      }
      g.fillStyle = `rgba(${col},0.33)`;
      g.beginPath();
      g.moveTo(X(gd.x), Y(gd.z));
      const N = 12;
      for (let i = 0; i <= N; i++) {
        const a = gd.ang - gd.half + (2 * gd.half * i) / N;
        const d = castRay(room, gd.x, gd.z, Math.cos(a), Math.sin(a), gd.range, false);
        g.lineTo(X(gd.x + Math.cos(a) * d), Y(gd.z + Math.sin(a) * d));
      }
      g.fill();
      g.fillStyle = `rgb(${col})`;
      g.beginPath();
      g.arc(X(gd.x), Y(gd.z), Math.max(3, s * 0.42), 0, 7);
      g.fill();
    }

    // the agent
    if (state.player) {
      const p = state.player;
      g.save();
      g.translate(X(p.x), Y(p.z));
      g.rotate(p.ang);
      g.fillStyle = '#ffffff';
      g.shadowColor = '#3ae8ff';
      g.shadowBlur = 8;
      g.beginPath();
      g.moveTo(s * 0.75, 0);
      g.lineTo(-s * 0.5, s * 0.5);
      g.lineTo(-s * 0.2, 0);
      g.lineTo(-s * 0.5, -s * 0.5);
      g.fill();
      g.restore();
    }

    // sweep line
    const sw = ((t * 0.35) % 1) * this.canvas.height;
    const gr = g.createLinearGradient(0, sw - 26, 0, sw);
    gr.addColorStop(0, 'rgba(246,239,220,0)');
    gr.addColorStop(1, 'rgba(246,239,220,0.1)');
    g.fillStyle = gr;
    g.fillRect(0, sw - 26, this.canvas.width, 26);
  }
}
