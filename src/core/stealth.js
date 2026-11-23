// Sight, detection and sleeper-hold maths. Pure functions, shared by the game
// loop, the room solver and the unit tests.

import { hasLineOfSight } from './grid.js';
import { angDiff } from './patrol.js';

export const DEFAULT_VISION = { range: 7, half: 0.52 }; // ~30 degrees either side

export const CHOKE_RANGE = 1.35; // metres
export const CHOKE_REAR_ARC = 1.15; // radians either side of "directly behind"
export const BUMP_RANGE = 0.8; // walking into a guard's front at this range is noticed at once
export const BUMP_FRONT_ARC = 1.75; // radians either side of facing that count as "front"

export function inCone(pose, x, z, range, half) {
  const dx = x - pose.x;
  const dz = z - pose.z;
  const d2 = dx * dx + dz * dz;
  if (d2 > range * range) return false;
  if (d2 < 1e-6) return true;
  return Math.abs(angDiff(pose.ang, Math.atan2(dz, dx))) <= half;
}

/**
 * Can a guard at `pose` see a target at (x, z)? A crouching target is hidden by
 * waist-high cover; a standing one is only hidden by full walls.
 */
export function canSee(room, pose, x, z, crouched, vis = DEFAULT_VISION, padRange = 0, padAngle = 0) {
  if (!inCone(pose, x, z, vis.range + padRange, vis.half + padAngle)) return false;
  return hasLineOfSight(room, pose.x, pose.z, x, z, crouched);
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
 * Sleeper hold check: the agent must be close and inside the guard's rear arc.
 * Returns true when a choke-out can begin.
 */
export function canChoke(pose, px, pz) {
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
