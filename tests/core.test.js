import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG, hashSeed } from '../src/core/rng.js';
import { castRay, hasLineOfSight, findPath } from '../src/core/grid.js';
import { buildTimeline, poseAt, angDiff, TURN_SPEED } from '../src/core/patrol.js';
import { canSee, canChoke, inCone, detectRate, isBumping, rankFor, CHOKE_RANGE, CHOKE_REAR_ARC, DEFAULT_VISION } from '../src/core/stealth.js';
import { LOOT } from '../src/core/loot.js';
import { THEME_IDS, THEMES } from '../src/core/themes.js';
import { roomFromAscii } from './helpers.js';

test('rng: same seed gives the same stream, different seeds differ', () => {
  const a = new RNG('otter');
  const b = new RNG('otter');
  const c = new RNG('ferret');
  const sa = Array.from({ length: 50 }, () => a.next());
  const sb = Array.from({ length: 50 }, () => b.next());
  const sc = Array.from({ length: 50 }, () => c.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.ok(sa.every((v) => v >= 0 && v < 1));
  assert.equal(hashSeed('x'), hashSeed('x'));
});

test('rng: int is inclusive and in range, shuffle keeps members', () => {
  const r = new RNG(7);
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(r.int(2, 5));
  assert.deepEqual([...seen].sort(), [2, 3, 4, 5]);
  assert.deepEqual(r.shuffle([1, 2, 3, 4, 5]).sort(), [1, 2, 3, 4, 5]);
});

const ROOM = roomFromAscii([
  '##########',
  '#........#',
  '#...o....#',
  '#...o..#.#',
  '#......#.#',
  '##########',
]);

test('raycast: walls stop rays at the right distance', () => {
  assert.ok(Math.abs(castRay(ROOM, 1.5, 1.5, 1, 0, 50, false) - 7.5) < 1e-9);
  assert.ok(Math.abs(castRay(ROOM, 1.5, 1.5, -1, 0, 50, false) - 0.5) < 1e-9);
  assert.equal(castRay(ROOM, 1.5, 1.5, 1, 0, 3, false), 3);
});

test('line of sight: cover hides a crouching agent but not a standing one', () => {
  // Guard at (1.5, 2.5) looking east across the cover cell at (4, 2).
  assert.equal(hasLineOfSight(ROOM, 1.5, 2.5, 6.5, 2.5, false), true, 'standing: seen over cover');
  assert.equal(hasLineOfSight(ROOM, 1.5, 2.5, 6.5, 2.5, true), false, 'crouched: hidden by cover');
  assert.ok(Math.abs(castRay(ROOM, 1.5, 2.5, 1, 0, 50, true) - 2.5) < 1e-9);
});

test('line of sight: full walls block everyone, open floor blocks no one', () => {
  assert.equal(hasLineOfSight(ROOM, 5.5, 3.5, 8.5, 3.5, false), false);
  assert.equal(hasLineOfSight(ROOM, 5.5, 3.5, 8.5, 3.5, true), false);
  assert.equal(hasLineOfSight(ROOM, 1.5, 1.5, 8.5, 1.5, true), true);
  assert.equal(hasLineOfSight(ROOM, 1.5, 1.5, 6.5, 4.5, false), true);
  assert.equal(hasLineOfSight(ROOM, 1.5, 1.5, 6.5, 4.5, true), false, "cover in the way");
  assert.equal(hasLineOfSight(ROOM, 2.2, 2.2, 2.2, 2.2, true), true);
});

test('line of sight is symmetric', () => {
  const r = new RNG(11);
  for (let i = 0; i < 400; i++) {
    const ax = r.range(1.1, 8.9);
    const az = r.range(1.1, 4.9);
    const bx = r.range(1.1, 8.9);
    const bz = r.range(1.1, 4.9);
    const blockedCell = (x, z) => ROOM.cells[Math.floor(z) * ROOM.w + Math.floor(x)] !== 0;
    if (blockedCell(ax, az) || blockedCell(bx, bz)) continue;
    assert.equal(hasLineOfSight(ROOM, ax, az, bx, bz, true), hasLineOfSight(ROOM, bx, bz, ax, az, true));
  }
});

test('vision cone: range, angle and occlusion', () => {
  const pose = { x: 1.5, z: 1.5, ang: 0 };
  assert.equal(inCone(pose, 5, 1.5, 7, 0.5), true);
  assert.equal(inCone(pose, 9, 1.5, 7, 0.5), false, 'out of range');
  assert.equal(inCone(pose, 1.5, 4, 7, 0.5), false, 'out of angle');
  assert.equal(inCone(pose, 0.6, 1.5, 7, 0.5), false, 'behind');
  assert.equal(canSee(ROOM, pose, 6.5, 1.5, true), true);
  const pose2 = { x: 1.5, z: 2.5, ang: 0 };
  assert.equal(canSee(ROOM, pose2, 6.5, 2.5, false), true);
  assert.equal(canSee(ROOM, pose2, 6.5, 2.5, true), false);
  // cone wraps correctly across the +-PI seam
  const west = { x: 5.5, z: 1.5, ang: Math.PI };
  assert.equal(inCone(west, 2.5, 1.2, 7, 0.5), true);
  assert.equal(inCone(west, 2.5, 1.8, 7, 0.5), true);
});

test('choke-out: only from close behind', () => {
  const g = { x: 5, z: 5, ang: 0 }; // facing +x
  assert.equal(canChoke(g, 4.2, 5), true, 'directly behind');
  assert.equal(canChoke(g, 5.8, 5), false, 'in front');
  assert.equal(canChoke(g, 5, 4.2), false, 'beside (left)');
  assert.equal(canChoke(g, 5, 5.8), false, 'beside (right)');
  assert.equal(canChoke(g, 3, 5), false, 'behind but too far');
  // sweep the whole circle and compare against the definition
  for (let i = 0; i < 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const want = Math.abs(angDiff(Math.PI, a)) <= CHOKE_REAR_ARC;
    assert.equal(canChoke(g, 5 + Math.cos(a), 5 + Math.sin(a)), want, `angle ${i}`);
  }
  // rotating guard and agent together changes nothing
  for (let i = 0; i < 16; i++) {
    const rot = (i / 16) * Math.PI * 2;
    const gp = { x: 0, z: 0, ang: rot };
    assert.equal(canChoke(gp, -Math.cos(rot) * 1.0, -Math.sin(rot) * 1.0), true);
    assert.equal(canChoke(gp, Math.cos(rot) * 1.0, Math.sin(rot) * 1.0), false);
  }
  assert.ok(CHOKE_RANGE > 1 && CHOKE_RANGE < 2);
  assert.ok(CHOKE_REAR_ARC < Math.PI / 2, 'rear arc must not reach the flanks');
});

test('choke-out rear arc never overlaps the vision cone', () => {
  assert.ok(Math.PI - CHOKE_REAR_ARC > DEFAULT_VISION.half + 0.3);
});

test('bumping into the front of a guard is noticed; behind is not', () => {
  const g = { x: 5.5, z: 1.5, ang: 0 };
  assert.equal(isBumping(ROOM, g, 6.1, 1.5), true);
  assert.equal(isBumping(ROOM, g, 4.9, 1.5), false);
  assert.equal(isBumping(ROOM, g, 7.5, 1.5), false);
});

test('detection is faster up close and slower when crouched', () => {
  assert.ok(detectRate(1, 7, false) > detectRate(4, 7, false));
  assert.ok(detectRate(4, 7, false) > detectRate(7, 7, false));
  assert.ok(detectRate(4, 7, true) < detectRate(4, 7, false));
  assert.ok(1 / detectRate(7, 7, false) > 1, 'about a second of grace at the edge');
  assert.ok(1 / detectRate(0.5, 7, false) < 0.3);
});

test('rank: ghost + fast = S, knockouts and dawdling cost you', () => {
  assert.equal(rankFor({ time: 30, par: 30, knockouts: 0, closeCalls: 0 }).rank, 'S');
  assert.equal(rankFor({ time: 30, par: 30, knockouts: 0, closeCalls: 0 }).ghost, true);
  assert.equal(rankFor({ time: 30, par: 30, knockouts: 2, closeCalls: 0 }).rank, 'A');
  assert.equal(rankFor({ time: 30, par: 30, knockouts: 2, closeCalls: 0 }).ghost, false);
  assert.equal(rankFor({ time: 300, par: 30, knockouts: 3, closeCalls: 3 }).rank, 'B');
});

test('patrol timelines: continuous, periodic, constant speed', () => {
  const defs = [
    { kind: 'loop', pts: [{ x: 1.5, z: 1.5 }, { x: 5.5, z: 1.5 }, { x: 5.5, z: 4.5 }, { x: 1.5, z: 4.5 }], speed: 1.5, wait: 0.8 },
    { kind: 'pingpong', pts: [{ x: 1.5, z: 1.5 }, { x: 8.5, z: 1.5 }], speed: 1.6, wait: 1.2 },
    { kind: 'lookout', pts: [{ x: 3.5, z: 3.5 }], angles: [0.3, 1.9], dwell: 2, sweepSpeed: 1.1, speed: 1 },
    { kind: 'lookout', pts: [{ x: 3.5, z: 3.5 }], angles: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2], dwell: 1.5, sweepSpeed: 1, speed: 1 },
  ];
  for (const def of defs) {
    const tl = buildTimeline(def);
    assert.ok(tl.period > 1);
    const dt = 0.02;
    let prev = poseAt(tl, 0, {});
    for (let t = dt; t < tl.period * 2.2; t += dt) {
      const p = poseAt(tl, t, {});
      const moved = Math.hypot(p.x - prev.x, p.z - prev.z);
      assert.ok(moved <= def.speed * dt + 1e-6, `${def.kind} teleported at t=${t}`);
      const turned = Math.abs(angDiff(prev.ang, p.ang));
      assert.ok(turned <= TURN_SPEED * dt + 1e-6 || moved > 0 || turned < 1e-6, `${def.kind} snapped heading at t=${t}`);
      prev = p;
    }
    const a = poseAt(tl, 1.234, {});
    const b = poseAt(tl, 1.234 + tl.period * 3, {});
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6);
  }
});

test('ping-pong reaches both ends and walks back along the same line', () => {
  const tl = buildTimeline({ kind: 'pingpong', pts: [{ x: 1.5, z: 2.5 }, { x: 7.5, z: 2.5 }], speed: 1.5, wait: 1 });
  let minX = Infinity;
  let maxX = -Infinity;
  for (let t = 0; t < tl.period; t += 0.05) {
    const p = poseAt(tl, t, {});
    assert.ok(Math.abs(p.z - 2.5) < 1e-9);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
  }
  assert.ok(minX < 1.6 && maxX > 7.4);
});

test('angDiff is the shortest signed turn', () => {
  assert.ok(Math.abs(angDiff(0, Math.PI / 2) - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(angDiff(3, -3) - (Math.PI * 2 - 6)) < 1e-12);
  assert.ok(Math.abs(angDiff(0.1, 0.1 + Math.PI * 4)) < 1e-9);
});

test('pathfinding walks around cover', () => {
  const p = findPath(ROOM, 3, 2, 5, 2);
  assert.ok(p && p.length > 3);
  for (const c of p) assert.equal(ROOM.cells[c.cy * ROOM.w + c.cx], 0);
  assert.equal(findPath(ROOM, 1, 1, 4, 2), null, 'cannot path into cover');
});

test('loot: 24+ unique items, every theme has locals', () => {
  assert.ok(LOOT.length >= 24);
  assert.equal(new Set(LOOT.map((l) => l.id)).size, LOOT.length);
  assert.equal(new Set(LOOT.map((l) => l.name)).size, LOOT.length);
  assert.equal(new Set(LOOT.map((l) => l.prop)).size, LOOT.length, 'every item has a distinct prop');
  assert.equal(THEME_IDS.length, 6);
  for (const id of THEME_IDS) {
    assert.ok(LOOT.some((l) => l.themes && l.themes.includes(id)), `no loot for ${id}`);
    assert.ok(THEMES[id].covers.length > 0);
  }
});
