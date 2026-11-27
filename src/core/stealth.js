// Sight, detection and sleeper-hold maths. Pure functions, shared by the game
// loop, the room solver and the unit tests.

import { hasLineOfSight } from './grid.js';
import { angDiff } from './patrol.js';

export const DEFAULT_VISION = { range: 7, half: 0.52 }; // ~30 degrees either side

export const PERIPHERAL_HALF = 1.75; // ~100 degrees either side (~200 deg total human peripheral FOV)
export const PERIPHERAL_RANGE_RATIO = 0.36; // standing peripheral reach as a fraction of main cone range
export const PERIPHERAL_MIN_RANGE = 1.8; // minimum standing peripheral reach (metres)
export const PERIPHERAL_MAX_RANGE = 3.2; // maximum standing peripheral reach (metres)
export const PERIPHERAL_CROUCH_MULT = 0.72; // crouching shrinks peripheral detection reach
export const PERIPHERAL_DETECT_MULT = 0.72; // peripheral vision fills detection slightly slower than direct gaze
export const CLOSE_STAND_RANGE = 1.65; // standing this close behind/beside a guard is noticed; must crouch to sneak up

export const CHOKE_RANGE = 1.35; // metres
export const CHOKE_REAR_ARC = 1.15; // radians either side of "directly behind"
export const BUMP_RANGE = 0.8; // walking into a guard's front at this range is noticed at once
export const BUMP_FRONT_ARC = 1.75; // radians either side of facing that count as "front"
export const CALLOUT_RADIUS = 8.5; // metres a guard's "HEY!" shout carries to nearby colleagues
export const ALERT_SEARCH_TIME = 12; // seconds a guard stays heightened after finding a downed guard or hearing a shout
export const ALERT_DETECT_MULT = 1.4; // detection fill multiplier while heightened

const HEARABLE_STATES = new Set(['patrol', 'suspicious', 'investigate', 'look', 'return']);

/** Nearby awake guards within earshot of a colleague's callout. */
export function guardsInEarshot(guards, caller, radius = CALLOUT_RADIUS) {
  const r2 = radius * radius;
  const out = [];
  for (const g of guards) {
    if (g === caller || !HEARABLE_STATES.has(g.state)) continue;
    const dx = g.pose.x - caller.pose.x;
    const dz = g.pose.z - caller.pose.z;
    if (dx * dx + dz * dz <= r2) out.push(g);
  }
  return out;
}

/** Guard vision cone while heightened (after spotting a downed colleague or hearing a shout). */
export function effectiveVision(vis, heightened) {
  if (!heightened) return vis;
  return { range: vis.range * 1.12, half: vis.half * 1.08 };
}

export function inCone(pose, x, z, range, half) {
  const dx = x - pose.x;
  const dz = z - pose.z;
  const d2 = dx * dx + dz * dz;
  if (d2 > range * range) return false;
  if (d2 < 1e-6) return true;
  return Math.abs(angDiff(pose.ang, Math.atan2(dz, dx))) <= half;
}

/** Guard peripheral vision arc (wide, short-range awareness to either side). */
export function peripheralVision(vis = DEFAULT_VISION, crouched = false) {
  const base = Math.min(PERIPHERAL_MAX_RANGE, Math.max(PERIPHERAL_MIN_RANGE, vis.range * PERIPHERAL_RANGE_RATIO));
  return {
    range: crouched ? base * PERIPHERAL_CROUCH_MULT : base,
    half: Math.max(vis.half, PERIPHERAL_HALF),
  };
}

/**
 * How (if at all) a guard at `pose` sees a target at (x, z):
 *  - 'direct'     inside the main focused vision cone
 *  - 'peripheral' inside the wide, close-range peripheral arc to either side
 *  - 'close'      standing too close (360°) — must crouch to sneak up behind
 *  - null         unseen
 * A crouching target is hidden by waist-high cover; a standing one is only
 * hidden by full walls.
 */
export function visionHit(room, pose, x, z, crouched, vis = DEFAULT_VISION, padRange = 0, padAngle = 0) {
  if (inCone(pose, x, z, vis.range + padRange, vis.half + padAngle)) {
    return hasLineOfSight(room, pose.x, pose.z, x, z, crouched) ? 'direct' : null;
  }
  const periph = peripheralVision(vis, crouched);
  if (inCone(pose, x, z, periph.range + padRange, Math.min(Math.PI, periph.half + padAngle))) {
    return hasLineOfSight(room, pose.x, pose.z, x, z, crouched) ? 'peripheral' : null;
  }
  if (!crouched) {
    const dx = x - pose.x;
    const dz = z - pose.z;
    const closeR = CLOSE_STAND_RANGE + padRange;
    if (dx * dx + dz * dz <= closeR * closeR && hasLineOfSight(room, pose.x, pose.z, x, z, false)) {
      return 'close';
    }
  }
  return null;
}

/**
 * Can a guard at `pose` see a target at (x, z)? A crouching target is hidden by
 * waist-high cover; a standing one is only hidden by full walls.
 */
export function canSee(room, pose, x, z, crouched, vis = DEFAULT_VISION, padRange = 0, padAngle = 0) {
  return visionHit(room, pose, x, z, crouched, vis, padRange, padAngle) !== null;
}

/** Touching distance in front of a guard: they notice even at the edge of their cone. */
export function isBumping(room, pose, x, z) {
  const dx = x - pose.x;
  const dz = z - pose.z;
  const d = Math.hypot(dx, dz);
  if (d > BUMP_RANGE) return false;
  if (d > 1e-6 && Math.abs(angDiff(pose.ang, Math.atan2(dz, dx))) > BUMP_FRONT_ARC) return false;
  return hasLineOfSight(room, pose.x, pose.z, x, z, false);
}

/**
 * Sleeper hold check: the agent must be crouching, close, and inside the
 * guard's rear blind spot. Returns true when a choke-out can begin.
 */
export function canChoke(pose, px, pz, crouched = true) {
  if (!crouched) return false;
  const dx = px - pose.x;
  const dz = pz - pose.z;
  const d = Math.hypot(dx, dz);
  if (d > CHOKE_RANGE || d < 1e-6) return false;
  const behind = pose.ang + Math.PI;
  return Math.abs(angDiff(behind, Math.atan2(dz, dx))) <= CHOKE_REAR_ARC;
}

/**
 * Detection meter fill rate per second (1.0 = spotted). Point blank is nearly
 * instant; the far edge of the cone gives about a second of grace. Crouching
 * makes you a smaller, slower-to-notice shape.
 */
export function detectRate(dist, range, crouched) {
  const k = Math.min(1, Math.max(0, (dist - 1.5) / Math.max(0.1, range - 1.5)));
  const seconds = 0.22 + k * 0.95;
  return (crouched ? 0.75 : 1) / seconds;
}

/** Rank for a cleared room. Pure so it can be tested. */
export function rankFor({ time, par, knockouts, closeCalls }) {
  let score = 100;
  score -= knockouts * 12;
  score -= Math.min(24, closeCalls * 8);
  const over = time / Math.max(1, par * 1.5) - 1;
  if (over > 0) score -= Math.min(40, Math.round(over * 50));
  const rank = score >= 90 ? 'S' : score >= 68 ? 'A' : 'B';
  return { rank, score: Math.max(0, score), ghost: knockouts === 0 };
}
