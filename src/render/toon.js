// The shared look: hard-stepped cel shading, flat facets and black ink.
//
//  toon()        – MeshToonMaterial with a 4-band gradient + flat shading, so
//                  light breaks into comic ink blocks instead of soft gradients
//  inkHull()     – inverted-hull black outline for a mesh (characters, loot)
//  inkEdges()    – black EdgesGeometry lines for hard-surface props and walls

import * as THREE from 'three';

let gradient = null;
/** 5 bands: deep shadow, shadow, half-tone, light, highlight. Stepped, but not harsh. */
export function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([64, 64, 64, 255, 104, 104, 104, 255, 150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 5, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const SUPPORTED = ['map', 'emissive', 'emissiveMap', 'emissiveIntensity', 'transparent', 'opacity', 'side', 'depthWrite', 'alphaTest', 'fog'];

/** Cel-shaded material. PBR-only options (roughness, metalness) are ignored. */
export function toon(color, opts = {}) {
  const params = { color, gradientMap: toonGradient() };
  for (const k of SUPPORTED) if (opts[k] !== undefined) params[k] = opts[k];
  const m = new THREE.MeshToonMaterial(params);
  m.flatShading = opts.flatShading !== false;
  return m;
}

/** Emissive toon material for screens, lamps and glowing trim. */
export function glowToon(color, intensity = 2) {
  const m = toon(0x0a0a0a, { emissive: color, emissiveIntensity: intensity });
  return m;
}

/**
 * Stepped fresnel rim: a hard-edged sliver of light on the faces turned away
 * from the camera, the way an inker leaves a highlight on a dark figure.
 */
export function rimify(mat, color = 0xffffff, strength = 0.55) {
  const rim = new THREE.Color(color).multiplyScalar(strength);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: rim };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 uRim;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        `float rimF = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
         outgoingLight += uRim * smoothstep(0.58, 0.74, rimF);
         #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => `rim:${rim.getHexString()}`;
  return mat;
}

const INK = new THREE.MeshBasicMaterial({ color: 0x04100c, side: THREE.BackSide });
const INK_LINE = new THREE.LineBasicMaterial({ color: 0x030303 });
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _centre = new THREE.Vector3();

/**
 * Inverted-hull outline: the same geometry again, slightly larger, back faces
 * only, pure black. `thickness` is in world units (before any parent scaling).
 */
export function inkHull(mesh, thickness = 0.014) {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  _box.copy(geo.boundingBox);
  _box.getSize(_size);
  _box.getCenter(_centre);
  const hull = new THREE.Mesh(geo, INK);
  const sx = 1 + (2 * thickness) / Math.max(1e-4, _size.x * mesh.scale.x);
  const sy = 1 + (2 * thickness) / Math.max(1e-4, _size.y * mesh.scale.y);
  const sz = 1 + (2 * thickness) / Math.max(1e-4, _size.z * mesh.scale.z);
  hull.scale.set(sx, sy, sz);
  hull.position.set(_centre.x * (1 - sx), _centre.y * (1 - sy), _centre.z * (1 - sz));
  hull.userData.ink = true;
  mesh.add(hull);
  return hull;
}

/** Outline every mesh under `root` that isn't already ink. */
export function inkAll(root, thickness = 0.014) {
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.ink && !o.userData.noInk && !o.material.transparent) meshes.push(o);
  });
  for (const m of meshes) inkHull(m, thickness);
}

const edgeCache = new WeakMap();
/** Black crease lines for a hard-surface mesh (shared per geometry). */
export function inkEdges(mesh, angle = 28) {
  let eg = edgeCache.get(mesh.geometry);
  if (!eg) {
    eg = new THREE.EdgesGeometry(mesh.geometry, angle);
    edgeCache.set(mesh.geometry, eg);
  }
  const lines = new THREE.LineSegments(eg, INK_LINE);
  lines.userData.ink = true;
  mesh.add(lines);
  return lines;
}

export { INK_LINE };
