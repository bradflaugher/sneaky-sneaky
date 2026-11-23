// HD-2D characters: hand-inked 2D comic sprites standing in the 3D world.
//
// Each character is one camera-facing standee plane. Every frame we work out
// which way the character is facing relative to the camera, pick one of five
// drawn views (mirroring for the other side), pick the pose frame, and swap
// the plane's texture. Frames are illustrated on demand by sprites.js and
// cached per character. The plane casts a real shadow (alpha-tested) and sits
// on a soft contact shadow.

import * as THREE from 'three';
import { drawCharacterFrame, frameKey, WALK_FRAMES, FRAME_METRES, GROUND_LINE } from './sprites.js';
import { glowTexture } from './textures.js';
import { thiefLook, guardLook } from '../core/cast.js';

const view = { yaw: 0, pitch: 0.9 };
/** Tell the sprites where the camera is (orbit yaw and pitch). Call once per frame. */
export function setSpriteCamera(yaw, pitch) {
  view.yaw = yaw;
  view.pitch = pitch;
}

const planeGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5 - (1 - GROUND_LINE), 0);
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/**
 * Build a character rig from a look (see core/cast.js).
 * opts.resolution: frame size in px (512 for the thief, 384 for guards).
 */
export function buildCharacter(look, { resolution = 384 } = {}) {
  const root = new THREE.Group();
  const size = FRAME_METRES;
  const holder = new THREE.Group();
  holder.rotation.order = 'YXZ';
  root.add(holder);

  const mat = new THREE.MeshBasicMaterial({ transparent: false, alphaTest: 0.5, side: THREE.DoubleSide, fog: true });
  mat.alphaToCoverage = true; // smooth sprite edges wherever MSAA is on
  if (look.holo) {
    mat.transparent = true;
    mat.alphaTest = 0.05;
    mat.alphaToCoverage = false;
    mat.depthWrite = false;
    mat.blending = THREE.AdditiveBlending;
    mat.color.setScalar(1.25);
  }
  const plane = new THREE.Mesh(planeGeo, mat);
  plane.scale.set(size, size, 1);
  plane.castShadow = !look.holo;
  plane.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.5, side: THREE.DoubleSide });
  plane.renderOrder = 20;
  holder.add(plane);

  const blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ color: look.holo ? 0x3ae8ff : 0x000000, map: glowTexture(), transparent: true, opacity: look.holo ? 0.25 : 0.55, depthWrite: false, blending: look.holo ? THREE.AdditiveBlending : THREE.NormalBlending }));
  blob.scale.set(1.05 * look.build.bulk, 1, 0.7 * look.build.bulk);
  blob.position.y = 0.03;
  blob.renderOrder = 4;
  root.add(blob);

  const rig = {
    root,
    holder,
    plane,
    blob,
    look,
    resolution,
    frames: new Map(),
    current: '',
    phase: 0,
    height: 1.9 * look.build.height,
    holo: !!look.holo,
    silhouette: null,
  };
  showFrame(rig, { mode: 'normal', crouch: false, walk: -1, alt: 0 }, 0);
  return rig;
}

function showFrame(rig, key, viewIndex) {
  const id = frameKey(key, viewIndex);
  if (id === rig.current) return;
  let tex = rig.frames.get(id);
  if (!tex) {
    const c = document.createElement('canvas');
    c.width = c.height = rig.resolution;
    drawCharacterFrame(c.getContext('2d'), rig.resolution, rig.look, key, viewIndex);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    rig.frames.set(id, tex);
  }
  rig.current = id;
  rig.plane.material.map = tex;
  rig.plane.customDepthMaterial.map = tex;
  if (!rig.mapped) {
    // the first map assignment changes the shader; later swaps do not
    rig.plane.material.needsUpdate = true;
    rig.plane.customDepthMaterial.needsUpdate = true;
    rig.mapped = true;
  }
  if (rig.silhouette) rig.silhouette.material.uniforms.map.value = tex;
}

/** Draw the character as a flat ghost wherever scenery hides it. */
export function addSilhouette(rig, color = 0x7fd0ff) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: rig.plane.material.map }, color: { value: new THREE.Color(color) } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // test depth 0.7 m nearer, so only real scenery counts as "in front"
        vec4 nearer = projectionMatrix * (mv + vec4(0.0, 0.0, 0.7, 0.0));
        gl_Position.z = nearer.z / nearer.w * gl_Position.w;
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 color;
      varying vec2 vUv;
      void main() {
        float a = texture2D(map, vUv).a;
        if (a < 0.5) discard;
        gl_FragColor = vec4(color, 0.42);
      }`,
    transparent: true,
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const s = new THREE.Mesh(planeGeo, mat);
  s.renderOrder = 50;
  rig.plane.add(s);
  rig.silhouette = s;
}

/**
 * Pick and show the right frame.
 * p: { speed (m/s), crouch, mode, t }   modes: normal | choking | held | sleep | alert | look | suspicious
 */
export function animateCharacter(rig, p, dt) {
  const speed = p.speed || 0;
  const moving = speed > 0.08 && (p.mode === 'normal' || !p.mode);
  rig.phase += speed * dt * (p.crouch ? 5.2 : 4.4);
  const t = p.t || 0;
  const key = {
    mode: p.mode || 'normal',
    crouch: !!p.crouch,
    walk: moving ? Math.floor((rig.phase / (Math.PI * 2)) * WALK_FRAMES) % WALK_FRAMES : -1,
    alt: p.mode === 'held' ? Math.floor(t * 9) % 2 : p.mode === 'look' ? (Math.sin(t * 2.1) > 0 ? 1 : 0) : 0,
  };

  // facing relative to the camera: 0 = towards us, + = screen right
  let phi = rig.root.rotation.y - view.yaw;
  phi = Math.atan2(Math.sin(phi), Math.cos(phi));
  const viewIndex = key.mode === 'sleep' ? 0 : Math.min(4, Math.round(Math.abs(phi) / (Math.PI / 4)));
  const flip = key.mode === 'sleep' ? Math.sin(rig.root.rotation.y * 3.1) < 0 : phi < 0;
  showFrame(rig, key, viewIndex);
  rig.plane.scale.x = (flip ? -1 : 1) * FRAME_METRES;

  // stand the plane up facing the camera; lean it back as the camera climbs
  // so the figure never collapses into a sliver from above
  rig.holder.rotation.y = view.yaw - rig.root.rotation.y;
  rig.holder.rotation.x = -Math.max(0, Math.min(0.72, (view.pitch - 0.5) * 0.85));
  rig.blob.scale.x = (key.mode === 'sleep' ? 2.0 : 1.05) * rig.look.build.bulk;
  rig.blob.rotation.y = rig.holder.rotation.y;
}

/** Snap to a pose immediately (sprites have no blending, so this is just an update). */
export function settleCharacter(rig, p) {
  animateCharacter(rig, p, 0);
}

export function disposeCharacter(rig) {
  for (const tex of rig.frames.values()) tex.dispose();
  rig.frames.clear();
  rig.plane.material.dispose();
  rig.plane.customDepthMaterial.dispose();
  rig.blob.material.dispose();
  if (rig.silhouette) rig.silhouette.material.dispose();
  rig.root.removeFromParent();
}

/** three.js yaw for a core heading angle (direction = cos a, sin a in XZ). */
export const yawOf = (ang) => Math.PI / 2 - ang;

export const guardSpec = (themeId, rng) => guardLook(themeId, rng);
export const agentSpec = () => thiefLook();
