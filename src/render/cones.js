// Diegetic vision cones: a floor-hugging fan per guard whose rays are clipped
// by the same grid raycast the detection logic uses, so what you see is
// exactly what they see. Two layers:
//   banded fill  – where even a crouching agent is visible
//   crosshatch   – the extra area visible only over waist-high cover (standing)

import * as THREE from 'three';
import { castRay } from '../core/grid.js';
import { peripheralVision } from '../core/stealth.js';

const RAYS = 40;
const PERIPH_RAYS = 14; // rays per peripheral wing (left & right)
const CALM = new THREE.Color(0x3ae8ff);
const WARY = new THREE.Color(0xffd23a);
const HOT = new THREE.Color(0xe5352b);

const VERT = `
attribute float aDist;
varying float vDist;
varying vec3 vWorld;
void main() {
  vDist = aDist;
  vWorld = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`;
// Graphic-novel cones: a clean translucent wash with a halftone dot fill where
// even a crouching thief is seen, and dots alone where only a standing one is.
const FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uStripe;
varying float vDist;
varying vec3 vWorld;
void main() {
  vec2 cell = fract(vWorld.xz * 2.6) - 0.5;
  float dots = 1.0 - smoothstep(0.2, 0.26, length(cell) + vDist * 0.16);
  float wash = 0.62 - 0.32 * vDist + 0.04 * sin(vDist * 12.0 - uTime * 2.0);
  float fill = mix(wash + dots * 0.5, dots * 0.85, uStripe);
  float rim = smoothstep(0.96, 0.985, vDist);
  gl_FragColor = vec4(uColor * (1.05 + rim * 0.3), min(1.0, uOpacity * fill + rim * 0.45));
}`;

function makeLayer(opacity, stripe, y, rays = RAYS) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((rays + 2) * 3);
  const dist = new Float32Array(rays + 2);
  const idx = [];
  for (let i = 0; i < rays; i++) idx.push(0, i + 2, i + 1);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: opacity }, uTime: { value: 0 }, uStripe: { value: stripe } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return { mesh, pos, dist, geo, mat, y, base: opacity, rays };
}

function makeOutline(rays, opacity) {
  const pos = new Float32Array((rays + 3) * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x3ae8ff, transparent: true, opacity, depthWrite: false });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false;
  line.renderOrder = 6;
  return { line, pos, geo, mat, rays };
}

export function createCone(parent) {
  const low = makeLayer(0.34, 0, 0.05);
  const high = makeLayer(0.3, 1, 0.045);
  // softer peripheral shoulder wings (left & right of the main cone, no overlap)
  const periphLowL = makeLayer(0.2, 0, 0.048, PERIPH_RAYS);
  const periphLowR = makeLayer(0.2, 0, 0.048, PERIPH_RAYS);
  const periphHighL = makeLayer(0.18, 1, 0.043, PERIPH_RAYS);
  const periphHighR = makeLayer(0.18, 1, 0.043, PERIPH_RAYS);
  const allLayers = [low, high, periphLowL, periphLowR, periphHighL, periphHighR];

  // hard inked outline around the main cone, softer outline around the peripheral wings
  const outline = makeOutline(RAYS, 0.95);
  const outlineL = makeOutline(PERIPH_RAYS, 0.52);
  const outlineR = makeOutline(PERIPH_RAYS, 0.52);
  const allOutlines = [outline, outlineL, outlineR];

  parent.add(...allLayers.map((l) => l.mesh), ...allOutlines.map((o) => o.line));
  const color = new THREE.Color();

  const fillArc = (layer, room, pose, a0, a1, range, coverBlocks) => {
    const { pos, dist, rays } = layer;
    pos[0] = pose.x;
    pos[1] = layer.y;
    pos[2] = pose.z;
    dist[0] = 0;
    for (let i = 0; i <= rays; i++) {
      const a = a0 + ((a1 - a0) * i) / rays;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const d = castRay(room, pose.x, pose.z, dx, dz, range, coverBlocks);
      const o = (i + 1) * 3;
      pos[o] = pose.x + dx * d;
      pos[o + 1] = layer.y;
      pos[o + 2] = pose.z + dz * d;
      dist[i + 1] = d / range;
    }
    layer.geo.attributes.position.needsUpdate = true;
    layer.geo.attributes.aDist.needsUpdate = true;
  };

  const syncOutline = (o, layer, y) => {
    o.pos.set(layer.pos.subarray(0, 3), 0);
    o.pos.set(layer.pos.subarray(3), 3);
    o.pos.set(layer.pos.subarray(0, 3), (o.rays + 2) * 3);
    for (let i = 1; i < o.pos.length; i += 3) o.pos[i] = y;
    o.geo.attributes.position.needsUpdate = true;
    o.mat.color.copy(color);
  };

  return {
    /** meter: 0..1 detection, alert: true once spotted. */
    update(room, pose, vis, meter, alert, t) {
      const pLow = peripheralVision(vis, true);
      const pHigh = peripheralVision(vis, false);
      fillArc(low, room, pose, pose.ang - vis.half, pose.ang + vis.half, vis.range, true);
      fillArc(high, room, pose, pose.ang - vis.half, pose.ang + vis.half, vis.range, false);
      fillArc(periphLowL, room, pose, pose.ang - pLow.half, pose.ang - vis.half, pLow.range, true);
      fillArc(periphLowR, room, pose, pose.ang + vis.half, pose.ang + pLow.half, pLow.range, true);
      fillArc(periphHighL, room, pose, pose.ang - pHigh.half, pose.ang - vis.half, pHigh.range, false);
      fillArc(periphHighR, room, pose, pose.ang + vis.half, pose.ang + pHigh.half, pHigh.range, false);

      if (alert) color.copy(HOT);
      else if (meter < 0.5) color.copy(CALM).lerp(WARY, meter * 2);
      else color.copy(WARY).lerp(HOT, (meter - 0.5) * 2);

      syncOutline(outline, high, 0.06);
      syncOutline(outlineL, periphHighL, 0.056);
      syncOutline(outlineR, periphHighR, 0.056);

      for (const l of allLayers) {
        l.mat.uniforms.uColor.value.copy(color);
        l.mat.uniforms.uTime.value = t;
        l.mat.uniforms.uOpacity.value = l.base * (1 + meter * 0.8);
      }
    },
    setVisible(v) {
      for (const l of allLayers) l.mesh.visible = v;
      for (const o of allOutlines) o.line.visible = v;
    },
    dispose() {
      for (const o of allOutlines) {
        o.line.removeFromParent();
        o.geo.dispose();
        o.mat.dispose();
      }
      for (const l of allLayers) {
        l.mesh.removeFromParent();
        l.geo.dispose();
        l.mat.dispose();
      }
    },
  };
}
