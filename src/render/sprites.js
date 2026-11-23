// Procedural comic-book character art.
//
// Every character in the game is a 2D illustration drawn here with Canvas2D:
// variable-weight black ink, flat colour, a cel-shaded fold on the shadow side,
// a rim highlight on the lit side and a Ben-Day dot screen in the shadows.
//
// There are no hand-made frames. A tiny 3D skeleton is posed (walk cycle,
// crouch, sleeper hold, startled recoil...), projected from one of five view
// angles (front, 3/4 front, profile, 3/4 back, back; the other three are
// mirrors) and then *drawn over* as inked shapes. That gives every character
// every pose from every direction, HD-2D style, from a description alone.

export const VIEW_COUNT = 5; // 0 front .. 4 back, in 45 degree steps
export const WALK_FRAMES = 6;
export const FRAME_METRES = 2.45; // world height covered by one square frame
export const GROUND_LINE = 0.965; // fraction of the frame height where feet rest

const THIGH = 0.43;
const SHIN = 0.45;
const UPPER = 0.29;
const FORE = 0.27;

const css = (hex, a = 1) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
const scale = (hex, k) => {
  const c = (s) => Math.max(0, Math.min(255, Math.round(((hex >> s) & 255) * k)));
  return (c(16) << 16) | (c(8) << 8) | c(0);
};
const lift = (hex, k) => {
  const c = (s) => Math.round(((hex >> s) & 255) + (255 - ((hex >> s) & 255)) * k);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};

// ------------------------------------------------------------------ pose

/**
 * Joint angles for a pose. `walk` is a walk-cycle frame index, or -1 when
 * standing still. `alt` picks between the two frames of two-frame poses.
 * Positive limb angles swing backwards, negative forwards.
 */
export function jointPose(mode, crouch, walk = -1, alt = 0, stance = 'guard') {
  const moving = walk >= 0;
  const ph = moving ? (walk / WALK_FRAMES) * Math.PI * 2 : 0;
  const amp = moving ? 1 : 0;
  const T = { py: 0.92, bob: 0, torsoRX: 0.04, torsoRY: 0, headRX: 0, headYaw: 0, aLx: 0, aLz: 0.1, eL: -0.2, aRx: 0, aRz: 0.1, eR: -0.2, lLx: 0, kL: 0, lRx: 0, kR: 0, lz: 0.035, mood: 'calm', sleep: false };
  if (mode === 'sleep') return { ...T, sleep: true, mood: 'sleep', aLz: 0.5, aRz: 0.35, eL: -0.4, eR: -0.9, lz: 0.1, kL: 0.35 };
  if (crouch) {
    T.py = 0.55 + Math.abs(Math.sin(ph)) * 0.02 * amp;
    T.torsoRX = 0.72;
    T.headRX = -0.55;
    T.lLx = -1.2 - Math.sin(ph) * 0.42 * amp;
    T.lRx = -1.2 + Math.sin(ph) * 0.42 * amp;
    T.kL = 2.05 + Math.cos(ph) * 0.3 * amp;
    T.kR = 2.05 - Math.cos(ph) * 0.3 * amp;
    T.aLx = -0.7 + Math.sin(ph) * 0.38 * amp;
    T.aRx = -0.7 - Math.sin(ph) * 0.38 * amp;
    T.eL = T.eR = -1.1;
    T.aLz = T.aRz = 0.2;
  } else {
    T.bob = Math.abs(Math.cos(ph)) * 0.03 * amp;
    T.torsoRX = 0.05 + amp * 0.1;
    T.torsoRY = Math.sin(ph) * 0.2 * amp;
    T.lLx = -Math.sin(ph) * 0.72 * amp;
    T.lRx = Math.sin(ph) * 0.72 * amp;
    T.kL = Math.max(0, Math.cos(ph)) * 1.1 * amp;
    T.kR = Math.max(0, -Math.cos(ph)) * 1.1 * amp;
    T.aLx = Math.sin(ph) * 0.62 * amp;
    T.aRx = -Math.sin(ph) * 0.62 * amp;
    T.eL = T.eR = -0.25 - amp * 0.6;
  }
  if (!moving && !crouch) {
    // nobody stands like a mannequin: weight on one leg, elbows and knees soft
    Object.assign(T, { torsoRY: 0.14, aLz: 0.16, aRz: 0.13, aLx: 0.1, aRx: -0.12, eL: -0.38, eR: -0.52, lLx: -0.07, lRx: 0.06, kL: 0.12, kR: 0.1, lz: 0.07 });
    // the thief never fully relaxes: coiled, low, ready to move
    if (stance === 'thief') Object.assign(T, { py: 0.87, torsoRX: 0.17, headRX: -0.1, torsoRY: 0.2, aLx: -0.22, aRx: 0.14, eL: -0.95, eR: -0.78, aLz: 0.22, aRz: 0.2, lLx: -0.3, kL: 0.42, lRx: 0.12, kR: 0.3, lz: 0.09 });
  } else if (moving && !crouch && stance === 'thief') {
    T.torsoRX += 0.1;
    T.eL = T.eR = -1.05;
  }
  if (mode === 'choking') {
    Object.assign(T, { aLx: -1.45, aRx: -1.25, eL: -1.5, eR: -1.6, aLz: -0.2, aRz: -0.15, torsoRX: 0.24, py: 0.84, lLx: -0.3, kL: 0.5, lRx: 0.25, kR: 0.3 });
  } else if (mode === 'held') {
    const f = alt ? 0.35 : -0.35;
    Object.assign(T, { torsoRX: -0.3, headRX: -0.3, aLx: -2.3 + f, aRx: -2.3 - f, eL: -1.3, eR: -1.3, aLz: 0.5, aRz: 0.5, py: 0.82, kL: 0.5, kR: 0.5, lLx: -0.3, lRx: -0.3, mood: 'alert' });
  } else if (mode === 'alert') {
    Object.assign(T, { torsoRX: -0.22, headRX: -0.12, aLx: -0.25, aRx: -0.4, aLz: 0.75, aRz: 0.6, eL: -2.3, eR: -2.0, lz: 0.16, lLx: -0.15, lRx: 0.2, kR: 0.25, mood: 'alert' });
  } else if (mode === 'look') {
    Object.assign(T, { headYaw: alt ? 0.75 : -0.75, torsoRY: alt ? 0.2 : -0.2, aRx: -2.1, eR: -1.9, aRz: 0.45, mood: 'wary' });
  } else if (mode === 'suspicious') {
    Object.assign(T, { headRX: 0.1, torsoRX: 0.18, aRx: -1.05, eR: -2.1, mood: 'wary' });
  }
  return T;
}

/** Forward kinematics: 3D joint positions (metres, character faces +Z). */
export function solveSkeleton(p, b) {
  const lean = p.torsoRX + b.slouch;
  const P = [0, (p.py + p.bob) * b.height, 0];
  const up = [0, Math.cos(lean), Math.sin(lean)];
  const H = b.height;
  const at = (k) => [P[0], P[1] + up[1] * k * H, P[2] + up[2] * k * H];
  const neck = at(0.6);
  const hl = lean + p.headRX;
  const head = [0, neck[1] + Math.cos(hl) * 0.215 * b.head, neck[2] + Math.sin(hl) * 0.215 * b.head];
  const sw = b.shoulders;
  const arm = (side, ax, az, ex) => {
    const base = at(0.49);
    const armSw = sw * 0.88;
    const S = [base[0] + side * armSw * Math.cos(p.torsoRY), base[1], base[2] - side * armSw * Math.sin(p.torsoRY)];
    const th = lean * 0.5 + ax;
    const E = [S[0] + side * Math.sin(az) * UPPER * H, S[1] - Math.cos(th) * Math.cos(az) * UPPER * H, S[2] - Math.sin(th) * Math.cos(az) * UPPER * H];
    const t2 = th + ex;
    const W = [E[0] + side * Math.sin(az) * 0.5 * FORE * H, E[1] - Math.cos(t2) * FORE * H, E[2] - Math.sin(t2) * FORE * H];
    const hand = [W[0], W[1] - Math.cos(t2) * 0.06, W[2] - Math.sin(t2) * 0.06];
    return { S, E, W, hand };
  };
  const leg = (side, lx, kx) => {
    const Hp = [side * 0.1 * b.bulk, P[1], 0];
    const K = [Hp[0] + side * p.lz * THIGH, Hp[1] - Math.cos(lx) * THIGH * H, -Math.sin(lx) * THIGH * H];
    const t2 = lx + kx;
    const A = [K[0], Math.max(0.05, K[1] - Math.cos(t2) * SHIN * H), K[2] - Math.sin(t2) * SHIN * H];
    const toe = [A[0], Math.max(0.03, A[1] - 0.03), A[2] + 0.17];
    return { Hp, K, A, toe };
  };
  return { P, chest: at(0.36), top: at(0.56), neck, head, armL: arm(1, p.aLx, p.aLz, p.eL), armR: arm(-1, p.aRx, p.aRz, p.eR), legL: leg(1, p.lLx, p.kL), legR: leg(-1, p.lRx, p.kR), lean };
}

// ------------------------------------------------------------------ ink

function makeStyle(look, size) {
  const holo = !!look.holo;
  return {
    size,
    S: size / FRAME_METRES,
    lw: size * 0.0072,
    holo,
    ink: holo ? css(look.accent) : css(look.ink ?? 0x0b0d12),
    thief: look.role === 'thief',
  };
}

/** Tapered capsule from a to b. */
function capsule(g, a, b, ra, rb) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  g.beginPath();
  g.arc(a.x, a.y, ra, ang + Math.PI / 2, ang + (3 * Math.PI) / 2);
  g.arc(b.x, b.y, rb, ang - Math.PI / 2, ang + Math.PI / 2);
  g.closePath();
}

/**
 * Ink and paint one shape: a heavy outline (heavier on the underside), flat
 * colour, a cel fold on the lower-right and a rim highlight on the upper-left.
 */
function inkOnly(g, st, path) {
  const lw = st.lw;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  path();
  g.strokeStyle = st.ink;
  g.lineWidth = st.holo ? lw * 0.9 : lw * 2;
  g.stroke();
  if (st.holo) return;
  g.save();
  g.translate(lw * 0.45, lw * 0.95);
  path();
  g.fillStyle = st.ink;
  g.fill();
  g.restore();
}

function inkFill(g, st, path, color, { fold = 0.3, r = 12, hl = true, shadeK = 0.68, noInk = false } = {}) {
  const lw = st.lw;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (st.holo) {
    path();
    g.fillStyle = 'rgba(8,16,40,0.82)';
    g.fill();
    if (!noInk) {
      g.strokeStyle = st.ink;
      g.lineWidth = lw * 0.9;
      g.stroke();
    }
    return;
  }
  if (!noInk) inkOnly(g, st, path);
  path();
  g.fillStyle = css(scale(color, shadeK));
  g.fill();
  g.save();
  path();
  g.clip();
  g.translate(-r * fold, -r * fold * 0.75);
  path();
  g.fillStyle = css(color);
  g.fill();
  if (hl) {
    g.translate(r * fold + lw * 1.5, r * fold * 0.75 + lw * 1.5);
    path();
    g.strokeStyle = st.thief ? st.rim : css(lift(color, 0.42));
    g.lineWidth = st.thief ? lw * 1.15 : lw * 0.9;
    g.stroke();
  }
  g.restore();
}

function line(g, st, pts, w = 1, color = null) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.strokeStyle = color || st.ink;
  g.lineWidth = st.lw * w;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke();
}

const ell = (g, x, y, rx, ry, rot = 0) => () => {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
};

// ------------------------------------------------------------------ head

function drawHead(g, st, hx, hy, r, yaw, look, mood) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const lw = st.lw;

  if (st.thief) {
    // a plain black mask: no hair, no face, just eyes
    inkFill(g, st, ell(g, hx + fx * 0.04 * r, hy, r * 0.93, r * 1.06), look.suit, { r, fold: 0.26 });
    g.save();
    ell(g, hx + fx * 0.04 * r, hy, r * 0.93, r * 1.06)();
    g.clip();
    if (fz > -0.2) {
      // the eye opening: a slightly lighter band, so the eyes sit in something
      g.beginPath();
      g.ellipse(hx + fx * 0.5 * r, hy + 0.03 * r, r * (0.42 + 0.42 * Math.max(0, fz)), r * 0.2, 0, 0, Math.PI * 2);
      g.fillStyle = css(scale(look.suit, 2.0));
      g.fill();
      g.strokeStyle = st.rim;
      g.globalAlpha = 0.5;
      g.lineWidth = lw * 0.6;
      g.stroke();
      g.globalAlpha = 1;
    } else {
      g.globalAlpha = 0.4;
      line(g, st, [hx, hy - r, hx - fx * 0.1 * r, hy + r], 0.6, st.rim);
      g.globalAlpha = 1;
    }
    g.restore();
    for (const e of [1, -1]) {
      const depth = fz * 0.85 - e * fx * 0.4;
      if (depth < 0.14) continue;
      const ex = hx + (fx * 0.52 + e * 0.35 * fz) * r;
      const ey = hy + 0.02 * r;
      const w = 0.24 * r * Math.min(1, depth + 0.25);
      g.beginPath();
      g.ellipse(ex, ey, w, mood === 'alert' ? 0.15 * r : 0.1 * r, e * -0.16, 0, Math.PI * 2);
      g.fillStyle = css(look.eyes);
      g.fill();
      g.beginPath();
      g.arc(ex + fx * 0.06 * r, ey, 0.05 * r, 0, Math.PI * 2);
      g.fillStyle = st.ink;
      g.fill();
    }
    return;
  }

  const skin = look.skin;
  const hair = look.hair;
  const covered = look.hat === 'visor'; // a full helmet: no face at all
  const bald = look.hairStyle === 'bald' || covered || look.hat === 'helmet';
  const jaw = look.build.jaw || 1;

  // ---- hair mass behind the head
  if (!bald) {
    const big = look.hairStyle === 'curly' ? 1.14 : look.hairStyle === 'buzz' ? 1.0 : 1.06;
    inkFill(g, st, ell(g, hx - fx * 0.16 * r, hy - 0.08 * r, r * big, r * 1.08 * big), hair, { r, fold: 0.22 });
    if (look.hairStyle === 'bob') inkFill(g, st, ell(g, hx - fx * 0.3 * r, hy + 0.42 * r, r * 0.92, r * 0.62), hair, { r, fold: 0.2 });
    if (look.hairStyle === 'bun') inkFill(g, st, ell(g, hx - fx * 0.85 * r, hy - 0.86 * r, r * 0.36, r * 0.34), hair, { r: r * 0.4 });
    if (look.hairStyle === 'curly') for (let i = 0; i < 6; i++) inkFill(g, st, ell(g, hx + Math.cos(2.4 + i * 0.75) * r * 0.95 - fx * 0.15 * r, hy + Math.sin(2.4 + i * 0.75) * r * 0.9 - 0.1 * r, r * 0.34, r * 0.34), hair, { r: r * 0.3, hl: false });
  }

  // ---- ears
  for (const e of [1, -1]) {
    const depth = -e * 0.9 * fx - 0.1 * fz;
    if (depth < -0.45 || covered) continue;
    const exx = hx + (e * 0.9 * fz - 0.12 * fx) * r;
    inkFill(g, st, ell(g, exx, hy + 0.08 * r, r * 0.16, r * 0.24), skin, { r: r * 0.2, hl: false });
    if (look.prop === 'earpiece' && e === 1) {
      // a coiled earpiece wire running down behind the collar
      g.beginPath();
      g.moveTo(exx, hy + 0.2 * r);
      for (let i = 1; i <= 10; i++) g.lineTo(exx - 0.06 * r + (i % 2 ? 0.09 : -0.03) * r, hy + (0.2 + i * 0.1) * r);
      g.strokeStyle = st.ink;
      g.lineWidth = lw * 0.7;
      g.stroke();
    }
  }

  const headPath = () => {
    g.beginPath();
    g.ellipse(hx + fx * 0.05 * r, hy - 0.08 * r, r * 0.9, r * 0.95, 0, Math.PI, 0);
    // cheeks taper to a chin that follows the facing direction
    g.bezierCurveTo(hx + fx * 0.05 * r + r * 0.9, hy + 0.45 * r * jaw, hx + fx * 0.2 * r + r * 0.5 * jaw, hy + 1.02 * r, hx + fx * 0.22 * r, hy + 1.04 * r);
    g.bezierCurveTo(hx + fx * 0.2 * r - r * 0.5 * jaw, hy + 1.02 * r, hx + fx * 0.05 * r - r * 0.9, hy + 0.45 * r * jaw, hx + fx * 0.05 * r - r * 0.9, hy - 0.08 * r);
    g.closePath();
  };
  const faceVisible = fz > -0.3;
  if (bald || faceVisible) {
    inkFill(g, st, headPath, covered ? look.top : skin, { r, fold: 0.24 });
    if (!covered && !st.holo) {
      // a hard cel shadow plane down the side of the face away from the light
      g.save();
      headPath();
      g.clip();
      g.fillStyle = css(scale(skin, 0.74));
      g.beginPath();
      g.ellipse(hx + 0.95 * r, hy + 0.3 * r, r * 0.62, r * 1.25, -0.2, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(hx + fx * 0.2 * r, hy + 1.2 * r, r * 0.8, r * 0.34, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    if (!bald) {
      // hairline: a cap over the forehead plus the side nearest the back of the head
      g.save();
      headPath();
      g.clip();
      g.fillStyle = css(hair);
      const depthCap = look.hairStyle === 'buzz' ? 0.5 : look.hairStyle === 'slick' ? 0.56 : 0.66;
      g.beginPath();
      g.ellipse(hx - fx * 0.45 * r, hy - 0.72 * r, r * 1.2, r * depthCap, fx * -0.25, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = st.ink;
      g.lineWidth = lw * 0.8;
      g.stroke();
      if (Math.abs(fx) > 0.2) {
        g.beginPath();
        g.ellipse(hx - fx * 1.0 * r, hy, r * (0.2 + 0.42 * Math.abs(fx)), r * 1.1, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      g.restore();
    }
  }

  // ---- face
  if (faceVisible && !covered) {
    if (look.beard) {
      g.save();
      headPath();
      g.clip();
      g.fillStyle = css(scale(hair, 0.9), 0.92);
      g.beginPath();
      g.ellipse(hx + fx * 0.3 * r, hy + 0.82 * r, r * 0.85, r * 0.5, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    const eyes = [];
    for (const e of [1, -1]) {
      const depth = fz * 0.85 - e * fx * 0.4;
      if (depth < 0.12) continue;
      const ex = hx + (fx * 0.52 + e * 0.34 * fz) * r;
      const ey = hy + 0.06 * r;
      eyes.push(ex);
      const w = 0.17 * r * Math.min(1, depth + 0.3);
      if (mood === 'sleep') {
        g.beginPath();
        g.arc(ex, ey - 0.02 * r, w, 0.15, Math.PI - 0.15);
        g.strokeStyle = st.ink;
        g.lineWidth = lw * 0.9;
        g.stroke();
      } else if (look.eyewear !== 'shades') {
        g.beginPath();
        g.ellipse(ex, ey, w, (mood === 'alert' ? 0.13 : 0.085) * r, 0, 0, Math.PI * 2);
        g.fillStyle = '#f6f2e8';
        g.fill();
        g.strokeStyle = st.ink;
        g.lineWidth = lw * 0.7;
        g.stroke();
        g.beginPath();
        g.arc(ex + fx * 0.04 * r, ey + 0.01 * r, 0.05 * r, 0, Math.PI * 2);
        g.fillStyle = st.ink;
        g.fill();
      }
      if (look.weary && mood === 'calm' && look.eyewear !== 'shades') {
        // heavy lids and a bag under the eye: it has been a long shift
        g.beginPath();
        g.ellipse(ex, ey - 0.045 * r, w * 1.05, 0.06 * r, 0, Math.PI, 0);
        g.closePath();
        g.fillStyle = css(scale(skin, 0.8));
        g.fill();
        line(g, st, [ex - w, ey - 0.02 * r, ex + w, ey - 0.02 * r], 0.8);
        g.beginPath();
        g.arc(ex, ey + 0.1 * r, w * 0.8, 0.3, Math.PI - 0.3);
        g.strokeStyle = 'rgba(11,13,18,0.45)';
        g.lineWidth = lw * 0.5;
        g.stroke();
      }
      // brows carry the expression
      const raise = mood === 'alert' ? 0.16 : mood === 'wary' && e === 1 ? 0.12 : 0;
      const stern = look.weary && mood === 'calm' ? -0.06 : mood === 'calm' || mood === 'wary' ? (look.archetype === 'tactical' ? 0.1 : 0.06) : -0.02;
      if (mood !== 'sleep') line(g, st, [ex - e * 0.2 * r, ey - (0.2 + raise) * r - stern * r, ex + e * 0.16 * r, ey - (0.17 + raise) * r + stern * r], 1.25, css(scale(hair, 0.7)));
    }
    // nose: a full profile wedge side-on, a small tick head-on
    const nx = hx + fx * 0.66 * r;
    const tip = hx + fx * (0.7 + 0.42 * Math.abs(fx)) * r + (1 - Math.abs(fx)) * 0.07 * r;
    if (Math.abs(fx) > 0.45) {
      g.beginPath();
      g.moveTo(nx, hy + 0.0 * r);
      g.lineTo(tip, hy + 0.34 * r);
      g.lineTo(nx, hy + 0.4 * r);
      g.closePath();
      g.fillStyle = css(skin);
      g.fill();
    }
    line(g, st, [nx, hy + 0.04 * r, tip, hy + 0.33 * r, hx + fx * 0.6 * r, hy + 0.38 * r], 0.8);
    // mouth
    const mx = hx + fx * 0.5 * r;
    const mw = 0.24 * r * Math.max(0.35, fz);
    if (mood === 'alert') {
      g.beginPath();
      g.ellipse(mx, hy + 0.66 * r, mw * 0.6, 0.11 * r, 0, 0, Math.PI * 2);
      g.fillStyle = st.ink;
      g.fill();
    } else line(g, st, [mx - mw, hy + 0.64 * r, mx + mw, hy + (mood === 'sleep' ? 0.66 : 0.62) * r], 0.85);
    if (look.mustache) {
      g.beginPath();
      g.ellipse(mx + fx * 0.05 * r, hy + 0.5 * r, mw * 1.5, 0.085 * r, 0, 0, Math.PI * 2);
      g.fillStyle = css(scale(hair, 0.85));
      g.fill();
      g.strokeStyle = st.ink;
      g.lineWidth = lw * 0.6;
      g.stroke();
    }
    if (look.archetype === 'tactical' && !st.holo) {
      // a stern band of shadow under the brow
      g.save();
      headPath();
      g.clip();
      g.fillStyle = 'rgba(11,13,18,0.3)';
      g.fillRect(hx - r * 1.2, hy - 0.2 * r, r * 2.4, 0.2 * r);
      g.restore();
    }
    // eyewear
    if (eyes.length && look.eyewear === 'shades') {
      const x0 = Math.min(...eyes) - 0.22 * r;
      const x1 = Math.max(...eyes) + 0.22 * r;
      const p = () => {
        g.beginPath();
        g.roundRect(x0, hy - 0.08 * r, x1 - x0, 0.26 * r, 0.08 * r);
      };
      inkFill(g, st, p, 0x14161c, { r: r * 0.3, fold: 0.2 });
      line(g, st, [x0 + 0.08 * r, hy - 0.02 * r, x0 + 0.24 * r, hy - 0.02 * r], 0.7, 'rgba(255,255,255,0.75)');
    } else if (look.eyewear === 'glasses') {
      for (const ex of eyes) {
        g.beginPath();
        g.arc(ex, hy + 0.06 * r, 0.19 * r, 0, Math.PI * 2);
        g.strokeStyle = st.ink;
        g.lineWidth = lw * 0.8;
        g.stroke();
      }
    }
  }

  // ---- headwear
  const hat = look.hat;
  const hatCol = hat === 'beret' || hat === 'beanie' ? look.accent : scale(look.top, 0.62);
  if (hat === 'cap') {
    g.save();
    if (look.weary) {
      // pushed back and tilted
      g.translate(hx, hy);
      g.rotate(-0.16);
      g.translate(-hx, -hy);
    }
    const crown = () => {
      g.beginPath();
      g.ellipse(hx - fx * 0.04 * r, hy - 0.42 * r, r * 1.0, r * 0.74, 0, Math.PI, 0);
      g.closePath();
    };
    if (fz > -0.5) inkFill(g, st, ell(g, hx + fx * 0.8 * r, hy - 0.4 * r, r * (0.42 + 0.5 * Math.max(0, fz)), r * 0.15), scale(hatCol, 0.7), { r: r * 0.3, hl: false });
    inkFill(g, st, crown, hatCol, { r, fold: 0.22 });
    if (fz > 0.3) inkFill(g, st, ell(g, hx + fx * 0.5 * r, hy - 0.7 * r, r * 0.13, r * 0.14), 0xe0b040, { r: r * 0.2, hl: false });
    g.restore();
  } else if (hat === 'beret') {
    inkFill(g, st, ell(g, hx - 0.14 * r, hy - 0.74 * r, r * 1.08, r * 0.46, -0.2), hatCol, { r, fold: 0.22 });
    line(g, st, [hx - 0.1 * r, hy - 1.18 * r, hx - 0.06 * r, hy - 1.3 * r], 1.1);
    if (fz > 0.2) inkFill(g, st, ell(g, hx + fx * 0.3 * r + 0.35 * r, hy - 0.66 * r, r * 0.1, r * 0.1), 0xe0b040, { r: r * 0.2, hl: false });
  } else if (hat === 'beanie') {
    const dome = () => {
      g.beginPath();
      g.ellipse(hx, hy - 0.3 * r, r * 0.98, r * 0.95, 0, Math.PI, 0);
      g.closePath();
    };
    inkFill(g, st, dome, hatCol, { r, fold: 0.22 });
    const band = () => {
      g.beginPath();
      g.roundRect(hx - 1.02 * r, hy - 0.46 * r, 2.04 * r, 0.26 * r, 0.1 * r);
    };
    inkFill(g, st, band, scale(hatCol, 0.75), { r: r * 0.3, hl: false });
  } else if (hat === 'fedora') {
    inkFill(g, st, ell(g, hx, hy - 0.48 * r, r * 1.5, r * 0.2), hatCol, { r: r * 0.4, hl: false });
    const crown = () => {
      g.beginPath();
      g.moveTo(hx - 0.86 * r, hy - 0.52 * r);
      g.quadraticCurveTo(hx - 0.8 * r, hy - 1.42 * r, hx - 0.1 * r, hy - 1.28 * r);
      g.quadraticCurveTo(hx + 0.75 * r, hy - 1.44 * r, hx + 0.86 * r, hy - 0.52 * r);
      g.closePath();
    };
    inkFill(g, st, crown, hatCol, { r, fold: 0.22 });
    g.fillStyle = css(look.accent);
    g.fillRect(hx - 0.86 * r, hy - 0.72 * r, 1.72 * r, 0.14 * r);
  } else if (hat === 'helmet') {
    const dome = () => {
      g.beginPath();
      g.ellipse(hx, hy - 0.16 * r, r * 1.08, r * 1.02, 0, Math.PI, 0);
      g.lineTo(hx + 1.14 * r, hy - 0.04 * r);
      g.lineTo(hx - 1.14 * r, hy - 0.04 * r);
      g.closePath();
    };
    inkFill(g, st, dome, scale(look.top, 0.8), { r, fold: 0.22 });
    line(g, st, [hx - fx * 0.2 * r - 0.8 * r, hy - 0.02 * r, hx + fx * 0.2 * r, hy + 0.95 * r], 0.7);
  } else if (hat === 'visor') {
    inkFill(g, st, ell(g, hx, hy - 0.02 * r, r * 1.04, r * 1.1), lift(look.top, 0.1), { r, fold: 0.24 });
    if (fz > -0.25) {
      const w = r * (0.5 + 0.55 * Math.max(0, fz));
      const cx = hx + fx * 0.5 * r;
      const band = () => {
        g.beginPath();
        g.roundRect(cx - w, hy - 0.14 * r, w * 2, 0.4 * r, 0.16 * r);
      };
      inkFill(g, st, band, look.accent, { r: r * 0.3, fold: 0.15, shadeK: 0.8 });
      line(g, st, [cx - w * 0.7, hy - 0.04 * r, cx - w * 0.1, hy - 0.04 * r], 0.9, 'rgba(255,255,255,0.9)');
    }
    line(g, st, [hx - fx * 0.7 * r, hy - 1.0 * r, hx - fx * 0.9 * r, hy + 0.6 * r], 0.7);
  } else if (hat === 'headset') {
    g.beginPath();
    g.ellipse(hx, hy - 0.1 * r, r * 1.05, r * 1.08, 0, Math.PI * 1.08, Math.PI * 1.92);
    g.strokeStyle = st.ink;
    g.lineWidth = lw * 2.2;
    g.stroke();
    const side = fx >= 0 ? -1 : 1;
    inkFill(g, st, ell(g, hx + side * 0.92 * r * Math.max(0.3, Math.abs(fz)), hy + 0.1 * r, r * 0.24, r * 0.32), look.accent, { r: r * 0.3 });
    if (fz > 0) line(g, st, [hx + side * 0.8 * r, hy + 0.3 * r, hx + fx * 0.4 * r, hy + 0.7 * r], 0.8);
  }
}

// ------------------------------------------------------------------ figure

function drawFigure(g, st, look, pose, phi, cx, gy) {
  const b = look.build;
  const sk = solveSkeleton(pose, b);
  const S = st.S;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const pr = (p) => ({ x: cx + (p[0] * c + p[2] * s) * S, y: gy - p[1] * S, d: -p[0] * s + p[2] * c });
  const fx = s;
  const fz = c;
  const thief = st.thief;
  const top = thief ? look.suit : look.top;
  const bottom = thief ? look.suit : look.bottom;
  const skin = thief ? look.suit : look.skin;
  const glove = thief ? look.suit : look.archetype === 'tech' || look.archetype === 'tactical' ? 0x1c1e24 : look.skin;
  const shoe = thief ? scale(look.suit, 0.8) : 0x14151a;
  const bulk = b.bulk;
  const R = (m) => m * S * bulk * 1.24; // comic proportions: chunkier than life

  const limb = (a, bb, ra, rb, color, opt) => inkFill(g, st, () => capsule(g, a, bb, ra, rb), color, { r: Math.max(ra, rb), ...opt });
  /** Several capsules inked as ONE shape, so joints carry no outline. parts: [a, b, ra, rb, colour, opts] */
  const chain = (parts) => {
    for (const [a, bb, ra, rb] of parts) inkOnly(g, st, () => capsule(g, a, bb, ra, rb));
    for (const [a, bb, ra, rb, color, opt] of parts) inkFill(g, st, () => capsule(g, a, bb, ra, rb), color, { r: Math.max(ra, rb), noInk: true, hl: !thief, ...opt });
  };

  const foldInk = st.holo ? null : thief ? st.rim : 'rgba(11,13,18,0.5)';
  /** Two short inked creases on the inside of a bent joint. J: joint, A: the point before it. */
  const crease = (J, A, r) => {
    if (!foldInk) return;
    const ang = Math.atan2(J.y - A.y, J.x - A.x);
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    g.globalAlpha = thief ? 0.55 : 1;
    for (const o of [-0.4, 0.2]) line(g, st, [J.x + nx * r * 0.75 + ux * r * o, J.y + ny * r * 0.75 + uy * r * o, J.x + nx * r * 0.05 + ux * r * (o + 0.3), J.y + ny * r * 0.05 + uy * r * (o + 0.3)], 0.55, foldInk);
    g.globalAlpha = 1;
  };

  const drawLeg = (L) => {
    const Hp = pr(L.Hp);
    const K = pr(L.K);
    const A = pr(L.A);
    const toe = pr(L.toe);
    chain([
      [K, A, R(0.074), R(0.046), bottom],
      [Hp, K, R(0.108), R(0.072), bottom],
    ]);
    crease(K, Hp, R(0.072));
    // a fitted boot: cuff, heel, rounded toe and a pale sole line
    const heel = { x: A.x - (toe.x - A.x) * 0.25, y: A.y + R(0.012) };
    const cuff = { x: A.x + (K.x - A.x) * 0.3, y: A.y + (K.y - A.y) * 0.3 };
    chain([
      [cuff, A, R(0.056), R(0.05), shoe, { hl: false }],
      [heel, { x: toe.x, y: toe.y + R(0.004) }, R(0.058), R(0.048), shoe, { hl: false }],
    ]);
    if (!st.holo) line(g, st, [heel.x - R(0.03), heel.y + R(0.05), toe.x + R(0.03), toe.y + R(0.046)], 0.7, thief ? st.rim : 'rgba(210,214,226,0.75)');
  };
  const drawArm = (Arm, near) => {
    const Sh = pr(Arm.S);
    const E = pr(Arm.E);
    const W = pr(Arm.W);
    const Hd = pr(Arm.hand);
    const tip = { x: Hd.x + (Hd.x - W.x) * 1.1, y: Hd.y + (Hd.y - W.y) * 1.1 };
    chain([
      [E, W, R(0.052), R(0.04), top],
      [Sh, E, R(0.06), R(0.05), top],
    ]);
    crease(E, Sh, R(0.05));
    // a gloved hand with a cuff, not a ball
    limb(Hd, tip, R(0.044), R(0.034), glove, { hl: false });
    if (!st.holo) {
      const ang = Math.atan2(W.y - E.y, W.x - E.x) + Math.PI / 2;
      line(g, st, [W.x + Math.cos(ang) * R(0.04), W.y + Math.sin(ang) * R(0.04), W.x - Math.cos(ang) * R(0.04), W.y - Math.sin(ang) * R(0.04)], 0.75, thief ? st.rim : null);
    }
    if (!thief && look.epaulettes) inkFill(g, st, ell(g, Sh.x, Sh.y - R(0.05), R(0.075), R(0.025)), look.accent, { r: R(0.04), hl: false });
    if (!thief && look.beacon && near && !st.holo) {
      // a little shoulder beacon with a soft glow
      const gr = g.createRadialGradient(Sh.x, Sh.y - R(0.06), 0, Sh.x, Sh.y - R(0.06), R(0.11));
      gr.addColorStop(0, css(look.accent, 0.55));
      gr.addColorStop(1, css(look.accent, 0));
      g.fillStyle = gr;
      g.fillRect(Sh.x - R(0.13), Sh.y - R(0.2), R(0.26), R(0.26));
      inkFill(g, st, ell(g, Sh.x, Sh.y - R(0.06), R(0.024), R(0.024)), lift(look.accent, 0.4), { r: R(0.03), hl: false, shadeK: 0.95 });
    }
    if (near && !thief) drawProp(g, st, look, Hd, E, fx, S);
  };

  // ---- order: far arm, legs, coat, torso, near arm(s), head
  const T = pr(sk.top);
  const arms = [sk.armL, sk.armR].map((A) => ({ A, d: pr(A.S).d, inFront: pr(A.E).d > T.d + 0.04 })).sort((p, q) => p.d - q.d);
  const side = Math.abs(fx) > 0.35;
  if (side) {
    drawArm(arms[0].A, false);
  } else {
    for (const item of arms) if (!item.inFront) drawArm(item.A, item === arms[1]);
  }
  const legs = [sk.legL, sk.legR].sort((p, q) => pr(p.K).d - pr(q.K).d);
  legs.forEach(drawLeg);

  const Pp = pr(sk.P);
  const td = (0.175 + b.belly * 0.3) * bulk;
  const taper = b.taper ?? 1;
  const w1 = (b.shoulders * 0.94 * Math.abs(fz) + td * Math.abs(fx)) * S + R(0.015);
  const w2 = (0.185 * bulk * taper * Math.abs(fz) + (td * 0.92 * Math.min(1, taper + 0.08) + b.belly * 0.35) * Math.abs(fx)) * S;
  const ax = T.x - Pp.x;
  const ay = T.y - Pp.y;
  const al = Math.hypot(ax, ay) || 1;
  const ux = ax / al;
  const uy = ay / al;
  const nx = -uy;
  const ny = ux;
  const sgn = nx >= 0 ? 1 : -1; // make +n point screen-right
  const N = { x: nx * sgn, y: ny * sgn };
  const belly = b.belly * S * 0.5 * Math.abs(fx) * (fx >= 0 ? 1 : -1);
  // smooth anatomical shoulders: gentle trapezius slope from neck out to shoulders, tapering to waist
  const drop = R(0.055);
  const TL = { x: T.x - N.x * w1 - ux * drop, y: T.y - N.y * w1 - uy * drop };
  const TR = { x: T.x + N.x * w1 - ux * drop, y: T.y + N.y * w1 - uy * drop };
  const BR = { x: Pp.x + N.x * w2, y: Pp.y + N.y * w2 + R(0.05) };
  const BL = { x: Pp.x - N.x * w2, y: Pp.y - N.y * w2 + R(0.05) };
  const rBot = Math.min(w2 * 0.6, R(0.05));
  const torsoPath = () => {
    g.beginPath();
    g.moveTo(T.x, T.y);
    g.bezierCurveTo(
      T.x + N.x * w1 * 0.65, T.y + N.y * w1 * 0.65 - uy * drop * 0.1,
      TR.x + N.x * R(0.01), TR.y + N.y * R(0.01),
      TR.x - ux * R(0.05), TR.y - uy * R(0.05),
    );
    g.arcTo(BR.x, BR.y, BL.x, BL.y, rBot);
    g.arcTo(BL.x, BL.y, TL.x, TL.y, rBot);
    g.lineTo(TL.x - ux * R(0.05), TL.y - uy * R(0.05));
    g.bezierCurveTo(
      TL.x - N.x * R(0.01), TL.y - N.y * R(0.01),
      T.x - N.x * w1 * 0.65, T.y - N.y * w1 * 0.65 - uy * drop * 0.1,
      T.x, T.y,
    );
    g.closePath();
  };
  const bellyPath = Math.abs(belly) > 1 ? ell(g, (T.x + Pp.x) / 2 + N.x * (w1 + w2) * 0.42 * Math.sign(belly) + belly * 0.5, Pp.y + (T.y - Pp.y) * 0.32, Math.abs(belly) * 0.55 + w2 * 0.2, (Pp.y - T.y) * 0.26) : null;

  // coat tails hang from the waist, over the thighs
  if (!thief && look.coat > 0 && !pose.sleep) {
    // a coat bunches up when its wearer crouches
    const len = look.coat * S * b.height * (pose.py < 0.7 ? 0.42 : 1);
    const hem = w2 * 1.18 + R(0.05);
    const sway = (pose.bob > 0 ? 1 : 0) * R(0.02);
    const coatPath = () => {
      g.beginPath();
      g.moveTo(Pp.x - w2 * 1.02, Pp.y - R(0.04));
      g.lineTo(Pp.x + w2 * 1.02, Pp.y - R(0.04));
      g.quadraticCurveTo(Pp.x + hem + sway, Pp.y + len * 0.6, Pp.x + hem, Pp.y + len);
      g.lineTo(Pp.x - hem, Pp.y + len);
      g.quadraticCurveTo(Pp.x - hem - sway, Pp.y + len * 0.6, Pp.x - w2 * 1.02, Pp.y - R(0.04));
      g.closePath();
    };
    inkFill(g, st, coatPath, top, { r: w2, fold: 0.22 });
    if (!st.holo) for (const e of [-0.55, 0.5]) line(g, st, [Pp.x + e * w2, Pp.y + len * 0.25, Pp.x + e * hem * 0.95, Pp.y + len * 0.96], 0.5, 'rgba(11,13,18,0.42)');
    if (fz > 0.3) line(g, st, [Pp.x + fx * td * S * 0.8, Pp.y, Pp.x + fx * td * S * 0.8 + R(0.02), Pp.y + len], 0.9);
    else if (fz < -0.3) line(g, st, [Pp.x, Pp.y + len * 0.45, Pp.x, Pp.y + len], 0.9);
  }

  if (bellyPath) inkOnly(g, st, bellyPath);
  inkFill(g, st, torsoPath, top, { r: w1, fold: 0.2 });
  if (bellyPath) inkFill(g, st, bellyPath, top, { r: w1, fold: 0.2, noInk: true, hl: false });

  // ---- torso dressing, clipped to the torso
  if (!st.holo) {
    g.save();
    torsoPath();
    g.clip();
    const cl = fx * td * S * 0.85; // where the centre line of the chest lands
    const k = Math.max(0.3, Math.abs(fz)); // horizontal squash as the body turns
    const mid = (t) => ({ x: Pp.x + (T.x - Pp.x) * t + cl, y: Pp.y + (T.y - Pp.y) * t });
    const front = fz > 0.15;
    const back = fz < -0.15;
    if (thief) {
      // one diagonal utility strap, a centre seam and a collar: gear, not a costume
      const dirS = back ? -1 : 1;
      const s0 = { x: T.x - dirS * w1 * 0.72, y: T.y + R(0.02) };
      const s1 = { x: Pp.x + dirS * w2 * 0.95, y: Pp.y - R(0.02) };
      g.beginPath();
      g.moveTo(s0.x - R(0.028), s0.y);
      g.lineTo(s0.x + R(0.028), s0.y);
      g.lineTo(s1.x + R(0.028), s1.y);
      g.lineTo(s1.x - R(0.028), s1.y);
      g.closePath();
      g.fillStyle = css(scale(look.suit, 1.9));
      g.fill();
      g.strokeStyle = st.rim;
      g.globalAlpha = 0.7;
      g.lineWidth = st.lw * 0.6;
      g.stroke();
      g.globalAlpha = 1;
      if (front) {
        const pm = { x: s0.x + (s1.x - s0.x) * 0.55, y: s0.y + (s1.y - s0.y) * 0.55 };
        g.beginPath();
        g.roundRect(pm.x - R(0.04), pm.y - R(0.035), R(0.08), R(0.075), R(0.012));
        g.fillStyle = css(scale(look.suit, 2.3));
        g.fill();
        g.stroke();
        const m0 = mid(0.1);
        const m1 = mid(0.98);
        g.globalAlpha = 0.45;
        line(g, st, [m0.x, m0.y, m1.x, m1.y], 0.6, st.rim);
        g.globalAlpha = 1;
      }
      const nk = mid(1.0);
      g.globalAlpha = 0.7;
      g.beginPath();
      g.ellipse(nk.x - cl, nk.y - R(0.005), R(0.085) * k + R(0.02), R(0.032), 0, 0, Math.PI);
      g.strokeStyle = st.rim;
      g.lineWidth = st.lw * 0.7;
      g.stroke();
      g.globalAlpha = 1;
    } else if (front) {
      const neckP = mid(1.02);
      const chestP = mid(0.52);
      if (look.tie || look.lapels) {
        // shirt V, then the tie; an enforcer wears a dark roll-neck instead
        g.fillStyle = look.tie ? '#f6f1e6' : css(0x23262f);
        g.beginPath();
        g.moveTo(neckP.x - R(0.09) * k, neckP.y);
        g.lineTo(neckP.x + R(0.09) * k, neckP.y);
        g.lineTo(chestP.x, chestP.y);
        g.closePath();
        g.fill();
        g.strokeStyle = st.ink;
        g.lineWidth = st.lw * 0.7;
        g.stroke();
        g.fillStyle = look.tie ? css(look.accent) : 'rgba(0,0,0,0)';
        g.beginPath();
        g.moveTo(neckP.x - R(0.022) * k, neckP.y + R(0.02));
        g.lineTo(neckP.x + R(0.022) * k, neckP.y + R(0.02));
        g.lineTo(chestP.x + R(0.03) * k, chestP.y - R(0.06));
        g.lineTo(chestP.x, chestP.y);
        g.lineTo(chestP.x - R(0.03) * k, chestP.y - R(0.06));
        g.closePath();
        if (look.tie) {
          g.fill();
          g.stroke();
        }
        // lapels: sharp, with a notch
        g.fillStyle = css(scale(top, 0.72));
        for (const e of [1, -1]) {
          g.beginPath();
          g.moveTo(neckP.x + e * R(0.1) * k, neckP.y - R(0.01));
          g.lineTo(neckP.x + e * R(0.21) * k, neckP.y + R(0.07));
          g.lineTo(neckP.x + e * R(0.15) * k, neckP.y + R(0.13));
          g.lineTo(neckP.x + e * R(0.2) * k, neckP.y + R(0.17));
          g.lineTo(chestP.x + e * R(0.012), chestP.y + R(0.03));
          g.closePath();
          g.fill();
          g.stroke();
        }
      } else if (look.coat > 0 || look.archetype === 'enforcer') {
        // double-breasted front: a closing line and buttons
        const a0 = mid(1.0);
        const a1 = mid(0.0);
        line(g, st, [a0.x, a0.y, a1.x, a1.y], 0.9);
        for (const t of [0.72, 0.5, 0.28]) {
          const m = mid(t);
          for (const e of [1, -1]) {
            g.beginPath();
            g.arc(m.x + e * R(0.05) * k, m.y, R(0.014), 0, Math.PI * 2);
            g.fillStyle = css(look.accent);
            g.fill();
            g.strokeStyle = st.ink;
            g.lineWidth = st.lw * 0.5;
            g.stroke();
          }
        }
      } else {
        const a0 = mid(1.0);
        const a1 = mid(0.1);
        line(g, st, [a0.x, a0.y, a1.x, a1.y], 0.7);
      }
      if (look.vest) {
        const v0 = mid(0.86);
        const v1 = mid(0.2);
        g.fillStyle = css(scale(top, 0.55));
        g.strokeStyle = st.ink;
        g.lineWidth = st.lw * 0.8;
        g.beginPath();
        g.roundRect(v1.x - R(0.17) * k, v0.y, R(0.34) * k, v1.y - v0.y, R(0.03));
        g.fill();
        g.stroke();
        g.fillStyle = css(scale(top, 0.4));
        for (const e of [1, -1]) {
          g.beginPath();
          g.roundRect(v1.x + e * R(0.085) * k - R(0.055) * k, v1.y - R(0.13), R(0.11) * k, R(0.1), R(0.015));
          g.fill();
          g.stroke();
        }
        g.fillStyle = css(look.accent);
        g.fillRect(v1.x - R(0.17) * k, v0.y + R(0.05), R(0.34) * k, R(0.022));
        if (look.archetype === 'tech') {
          g.beginPath();
          g.arc(v0.x + R(0.09) * k, v0.y + R(0.12), R(0.022), 0, Math.PI * 2);
          g.fillStyle = css(lift(look.accent, 0.5));
          g.fill();
        }
      }
      if (look.badge) {
        const m = mid(0.74);
        const bx = m.x + R(0.105) * k;
        g.beginPath();
        g.moveTo(bx - R(0.03), m.y - R(0.03));
        g.lineTo(bx + R(0.03), m.y - R(0.03));
        g.lineTo(bx + R(0.026), m.y + R(0.015));
        g.lineTo(bx, m.y + R(0.04));
        g.lineTo(bx - R(0.026), m.y + R(0.015));
        g.closePath();
        g.fillStyle = '#e8b83a';
        g.fill();
        g.strokeStyle = st.ink;
        g.lineWidth = st.lw * 0.6;
        g.stroke();
      }
    } else if (back) {
      const a0 = mid(0.95);
      const a1 = mid(0.05);
      line(g, st, [a0.x, a0.y, a1.x, a1.y], 0.6);
      if (look.vest) {
        const v0 = mid(0.86);
        const v1 = mid(0.25);
        g.fillStyle = css(scale(top, 0.55));
        g.strokeStyle = st.ink;
        g.lineWidth = st.lw * 0.8;
        g.beginPath();
        g.roundRect(v1.x - R(0.17) * k, v0.y, R(0.34) * k, v1.y - v0.y, R(0.03));
        g.fill();
        g.stroke();
      }
    }
    // inked shadow hatching on the side away from the light
    if (!thief) {
      const heavy = look.archetype === 'enforcer';
      const n = heavy ? 9 : 5;
      const hx0 = Pp.x + N.x * w2 * (heavy ? 0.1 : 0.35);
      const hy0 = Pp.y + (T.y - Pp.y) * (heavy ? 0.7 : 0.5);
      for (let i = 0; i < n; i++) line(g, st, [hx0 + i * R(0.03), hy0, hx0 + i * R(0.03) - R(0.05), hy0 + R(0.13) + i * R(0.008)], 0.5, heavy ? 'rgba(11,13,18,0.5)' : 'rgba(11,13,18,0.3)');
    }
    // belt: all the way round
    const bl = mid(0.06);
    g.fillStyle = thief ? css(scale(look.suit, 1.6)) : css(0x15161c);
    g.fillRect(Pp.x - w2 * 1.6, bl.y - R(0.022), w2 * 3.2, R(0.045));
    g.strokeStyle = st.ink;
    g.lineWidth = st.lw * 0.6;
    g.strokeRect(Pp.x - w2 * 1.6, bl.y - R(0.022), w2 * 3.2, R(0.045));
    if (front) {
      g.fillStyle = thief ? st.rim : '#c9a24a';
      g.fillRect(bl.x - R(0.022), bl.y - R(0.018), R(0.044), R(0.036));
    }
    // utility pouches
    if (thief || look.archetype === 'watchman' || look.archetype === 'tactical') {
      g.fillStyle = thief ? css(scale(look.suit, 2.1)) : css(0x23262f);
      for (const e of thief ? [1] : [1, -1]) {
        g.beginPath();
        g.roundRect(Pp.x + e * w2 * 0.62 - R(0.035), bl.y - R(0.012), R(0.07), R(0.075), R(0.012));
        g.fill();
        g.stroke();
      }
    }
    g.restore();
  }

  // ---- neck / scarf
  const Nk = pr(sk.neck);
  const Hd = pr(sk.head);
  const r = 0.172 * S * b.head;
  if (!thief && look.scarf) inkFill(g, st, ell(g, Nk.x, Nk.y + R(0.02), R(0.13), R(0.07)), look.accent, { r: R(0.08) });
  else limb({ x: Nk.x, y: Nk.y + R(0.03) }, { x: (Nk.x + Hd.x) / 2, y: (Nk.y + Hd.y) / 2 }, R(0.064), R(0.058), thief ? look.suit : skin, { hl: false });

  if (!thief && look.collar && !st.holo) {
    // a tailored upturned greatcoat collar framing the neck cleanly
    const collar = () => {
      g.beginPath();
      g.moveTo(Nk.x - R(0.14), Nk.y + R(0.06));
      g.quadraticCurveTo(Nk.x - R(0.15), Nk.y - R(0.05), Nk.x - R(0.09), Nk.y - R(0.06));
      g.lineTo(Nk.x + R(0.09), Nk.y - R(0.06));
      g.quadraticCurveTo(Nk.x + R(0.15), Nk.y - R(0.05), Nk.x + R(0.14), Nk.y + R(0.06));
      g.quadraticCurveTo(Nk.x, Nk.y + R(0.1), Nk.x - R(0.14), Nk.y + R(0.06));
      g.closePath();
    };
    inkFill(g, st, collar, scale(top, 0.82), { r: R(0.1), fold: 0.2 });
  }
  if (!thief && look.beacon && !st.holo && fz > -0.4) {
    // collar tubing from the helmet down to the chest unit
    g.beginPath();
    g.moveTo(Hd.x - fx * r * 0.2 + r * 0.55, Hd.y + r * 0.75);
    g.bezierCurveTo(Hd.x + r * 1.0, Hd.y + r * 1.5, T.x + w1 * 0.75, T.y + R(0.02), T.x + w1 * 0.35, T.y + R(0.2));
    g.strokeStyle = st.ink;
    g.lineWidth = st.lw * 2.6;
    g.lineCap = 'round';
    g.stroke();
    g.strokeStyle = css(lift(look.accent, 0.2));
    g.lineWidth = st.lw * 1.0;
    g.stroke();
  }

  if (side) {
    drawArm(arms[1].A, true);
  } else {
    for (const item of arms) if (item.inFront) drawArm(item.A, item === arms[1]);
  }

  drawHead(g, st, Hd.x, Hd.y, r, phi + pose.headYaw, look, pose.mood);
}

function drawProp(g, st, look, hand, elbow, fx, S) {
  const u = 0.01 * S;
  const dir = fx >= 0 ? 1 : -1;
  const p = look.prop;
  if (p === 'flashlight') {
    const body = () => {
      g.beginPath();
      g.roundRect(hand.x - 3 * u, hand.y - 3 * u, 15 * u * 1, 6 * u, 2 * u);
    };
    g.save();
    g.translate(hand.x, hand.y);
    g.scale(dir, 1);
    g.translate(-hand.x, -hand.y);
    if (!st.holo) {
      g.beginPath();
      g.moveTo(hand.x + 12 * u, hand.y);
      g.lineTo(hand.x + 46 * u, hand.y + 16 * u);
      g.lineTo(hand.x + 46 * u, hand.y - 4 * u);
      g.closePath();
      g.fillStyle = 'rgba(255,230,150,0.22)';
      g.fill();
    }
    inkFill(g, st, body, 0x2a2d36, { r: 4 * u, hl: false });
    inkFill(g, st, ell(g, hand.x + 12 * u, hand.y, 3 * u, 4.5 * u), 0xffe08a, { r: 4 * u, hl: false, shadeK: 0.9 });
    g.restore();
  } else if (p === 'thermos') {
    const body = () => {
      g.beginPath();
      g.roundRect(hand.x - 4 * u, hand.y - 16 * u, 8 * u, 18 * u, 2 * u);
    };
    inkFill(g, st, body, 0xb8c0c8, { r: 5 * u });
    g.fillStyle = css(look.accent);
    g.fillRect(hand.x - 4 * u, hand.y - 16 * u, 8 * u, 4 * u);
  } else if (p === 'mug') {
    const body = () => {
      g.beginPath();
      g.roundRect(hand.x - 5 * u, hand.y - 12 * u, 10 * u, 12 * u, 1.5 * u);
    };
    g.beginPath();
    g.arc(hand.x + 6 * u * dir, hand.y - 6 * u, 3.4 * u, 0, Math.PI * 2);
    g.strokeStyle = st.ink;
    g.lineWidth = st.lw * 1.3;
    g.stroke();
    inkFill(g, st, body, 0xf2ede2, { r: 6 * u });
    g.fillStyle = css(look.accent);
    g.fillRect(hand.x - 5 * u, hand.y - 6 * u, 10 * u, 2.5 * u);
    if (!st.holo) {
      // steam
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = st.lw * 0.8;
      g.lineCap = 'round';
      for (const o of [-2.5, 2]) {
        g.beginPath();
        g.moveTo(hand.x + o * u, hand.y - 14 * u);
        g.bezierCurveTo(hand.x + (o + 4) * u, hand.y - 19 * u, hand.x + (o - 4) * u, hand.y - 23 * u, hand.x + (o + 1) * u, hand.y - 29 * u);
        g.stroke();
      }
    }
  } else if (p === 'keys') {
    g.beginPath();
    g.arc(hand.x, hand.y + 7 * u, 3.5 * u, 0, Math.PI * 2);
    g.strokeStyle = '#c9a24a';
    g.lineWidth = st.lw * 0.9;
    g.stroke();
    line(g, st, [hand.x, hand.y + 10 * u, hand.x + 2 * u, hand.y + 17 * u], 0.8, '#c9a24a');
    line(g, st, [hand.x, hand.y + 10 * u, hand.x - 3 * u, hand.y + 16 * u], 0.8, '#c9a24a');
  } else if (p === 'scanner' || p === 'tablet') {
    const w = p === 'tablet' ? 13 * u : 8 * u;
    const body = () => {
      g.beginPath();
      g.roundRect(hand.x - w / 2, hand.y - 12 * u, w, 13 * u, 2 * u);
    };
    if (!st.holo) {
      const gr = g.createRadialGradient(hand.x, hand.y - 6 * u, 0, hand.x, hand.y - 6 * u, 22 * u);
      gr.addColorStop(0, css(look.accent, 0.4));
      gr.addColorStop(1, css(look.accent, 0));
      g.fillStyle = gr;
      g.fillRect(hand.x - 22 * u, hand.y - 28 * u, 44 * u, 44 * u);
    }
    inkFill(g, st, body, 0x20232b, { r: 5 * u, hl: false });
    g.fillStyle = css(lift(look.accent, 0.3));
    g.fillRect(hand.x - w / 2 + 1.5 * u, hand.y - 10.5 * u, w - 3 * u, 8 * u);
  } else if (p === 'radio') {
    const body = () => {
      g.beginPath();
      g.roundRect(hand.x - 3.5 * u, hand.y - 11 * u, 7 * u, 13 * u, 1.5 * u);
    };
    inkFill(g, st, body, 0x20232b, { r: 4 * u, hl: false });
    line(g, st, [hand.x + 2 * u, hand.y - 11 * u, hand.x + 3 * u, hand.y - 22 * u], 0.9);
    g.fillStyle = css(look.accent);
    g.fillRect(hand.x - 2 * u, hand.y - 8 * u, 4 * u, 2 * u);
  } else if (p === 'baton') {
    const ang = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);
    const tip = { x: hand.x + Math.cos(ang + 0.5 * dir) * 26 * u, y: hand.y + Math.sin(ang + 0.5 * dir) * 26 * u };
    inkFill(g, st, () => capsule(g, hand, tip, 2.4 * u, 2.2 * u), 0x1c1e24, { r: 3 * u, hl: false });
  }
}

// ------------------------------------------------------------------ halftone

const scratches = new Map();
function scratch(size) {
  if (!scratches.has(size)) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    scratches.set(size, c);
  }
  return scratches.get(size);
}

const screens = new Map();
/** Ben-Day dots, dense towards the lower right, used to shade the whole figure. */
function halftone(size) {
  if (screens.has(size)) return screens.get(size);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const pitch = size / 62;
  g.fillStyle = '#000';
  for (let j = -2; j < 66; j++)
    for (let i = -2; i < 66; i++) {
      const x = (i + (j % 2) * 0.5) * pitch;
      const y = j * pitch * 0.866;
      const k = Math.max(0, Math.min(1, (x / size) * 0.75 + (y / size) * 0.55 - 0.42));
      if (k <= 0.02) continue;
      g.beginPath();
      g.arc(x, y, pitch * 0.46 * Math.sqrt(k), 0, Math.PI * 2);
      g.fill();
    }
  screens.set(size, c);
  return c;
}

// ------------------------------------------------------------------ entry

/**
 * Paint one frame of a character into a square canvas context.
 * key: { mode, crouch, walk, alt }   view: 0..4 (front..back, facing right)
 */
export function drawCharacterFrame(g, size, look, key, view) {
  const st = makeStyle(look, size);
  if (st.thief) st.rim = css(look.highlight);
  g.clearRect(0, 0, size, size);
  const pose = jointPose(key.mode, key.crouch, key.walk, key.alt, st.thief ? 'thief' : 'guard');
  const cx = size / 2;
  const gy = size * GROUND_LINE;
  const S = st.S;
  if (pose.sleep) {
    // slumped flat on their back, head to the left
    g.save();
    g.translate(cx + 0.88 * look.build.height * S, gy - 0.34 * S);
    g.rotate(-Math.PI / 2);
    drawFigure(g, st, look, pose, 0.0001, 0, 0);
    g.restore();
  } else {
    drawFigure(g, st, look, pose, (view * Math.PI) / 4 + 0.0001, cx, gy);
  }
  if (!st.holo) {
    // Ben-Day shading across the whole figure
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = st.thief ? 0.45 : 0.2;
    g.drawImage(halftone(size), 0, 0);
    g.restore();
    // Rim light: everything that is figure here but not figure a few pixels
    // down-right is the lit upper-left silhouette edge. Paint that sliver.
    const tmp = scratch(size);
    const tg = tmp.getContext('2d');
    const off = size * 0.0066;
    tg.globalCompositeOperation = 'source-over';
    tg.clearRect(0, 0, size, size);
    tg.drawImage(g.canvas, 0, 0);
    tg.globalCompositeOperation = 'destination-out';
    tg.drawImage(g.canvas, off, off * 1.15);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = st.thief ? '#cfe6ff' : '#ffffff';
    tg.fillRect(0, 0, size, size);
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = st.thief ? 0.95 : 0.6;
    g.drawImage(tmp, 0, 0);
    g.restore();
  } else {
    // hologram scanlines
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = css(look.accent, 0.16);
    for (let y = 0; y < size; y += size / 64) g.fillRect(0, y, size, size / 200);
    g.restore();
  }
}

/** Stable cache key for a frame. */
export const frameKey = (key, view) => `${view}|${key.mode}|${key.crouch ? 1 : 0}|${key.walk}|${key.alt}`;
