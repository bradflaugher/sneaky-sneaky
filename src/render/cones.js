// Diegetic vision cones: a floor-hugging fan per guard whose rays are clipped
// by the same grid raycast the detection logic uses, so what you see is
// exactly what they see. Two layers:
//   banded fill  – where even a crouching agent is visible
//   crosshatch   – the extra area visible only over waist-high cover (standing)

import * as THREE from 'three';
import { castRay } from '../core/grid.js';

const RAYS = 40;
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

function makeLayer(opacity, stripe, y) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((RAYS + 2) * 3);
  const dist = new Float32Array(RAYS + 2);
  const idx = [];
  for (let i = 0; i < RAYS; i++) idx.push(0, i + 2, i + 1);
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
  return { mesh, pos, dist, geo, mat, y, base: opacity };
}

export function createCone(parent) {
  const low = makeLayer(0.34, 0, 0.05);
  const high = makeLayer(0.3, 1, 0.045);
  // hard inked outline around the whole cone
  const outlinePos = new Float32Array((RAYS + 3) * 3);
  const outlineGeo = new THREE.BufferGeometry();
  outlineGeo.setAttribute('position', new THREE.BufferAttribute(outlinePos, 3));
  const outlineMat = new THREE.LineBasicMaterial({ color: 0x3ae8ff, transparent: true, opacity: 0.95, depthWrite: false });
  const outline = new THREE.Line(outlineGeo, outlineMat);
  outline.frustumCulled = false;
  outline.renderOrder = 6;
  parent.add(high.mesh, low.mesh, outline);
  const color = new THREE.Color();

  const fill = (layer, room, pose, vis, coverBlocks) => {
    const { pos, dist } = layer;
    pos[0] = pose.x;
    pos[1] = layer.y;
    pos[2] = pose.z;
    dist[0] = 0;
    for (let i = 0; i <= RAYS; i++) {
      const a = pose.ang - vis.half + (2 * vis.half * i) / RAYS;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const d = castRay(room, pose.x, pose.z, dx, dz, vis.range, coverBlocks);
      const o = (i + 1) * 3;
      pos[o] = pose.x + dx * d;
      pos[o + 1] = layer.y;
      pos[o + 2] = pose.z + dz * d;
      dist[i + 1] = d / vis.range;
    }
    layer.geo.attributes.position.needsUpdate = true;
    layer.geo.attributes.aDist.needsUpdate = true;
  };

  return {
    /** meter: 0..1 detection, alert: true once spotted. */
    update(room, pose, vis, meter, alert, t) {
      fill(low, room, pose, vis, true);
      fill(high, room, pose, vis, false);
      if (alert) color.copy(HOT);
      else if (meter < 0.5) color.copy(CALM).lerp(WARY, meter * 2);
      else color.copy(WARY).lerp(HOT, (meter - 0.5) * 2);
      outlinePos.set(high.pos.subarray(0, 3), 0);
      outlinePos.set(high.pos.subarray(3), 3);
      outlinePos.set(high.pos.subarray(0, 3), (RAYS + 2) * 3);
      for (let i = 1; i < outlinePos.length; i += 3) outlinePos[i] = 0.06;
      outlineGeo.attributes.position.needsUpdate = true;
      outlineMat.color.copy(color);
      for (const l of [low, high]) {
        l.mat.uniforms.uColor.value.copy(color);
        l.mat.uniforms.uTime.value = t;
        l.mat.uniforms.uOpacity.value = l.base * (1 + meter * 0.8);
      }
    },
    setVisible(v) {
      low.mesh.visible = high.mesh.visible = outline.visible = v;
    },
    dispose() {
      outline.removeFromParent();
      outlineGeo.dispose();
      outlineMat.dispose();
      for (const l of [low, high]) {
        l.mesh.removeFromParent();
        l.geo.dispose();
        l.mat.dispose();
      }
    },
  };
}
