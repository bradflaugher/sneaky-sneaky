// The finishing pass: a restrained, art-directed "noir hybrid". Runs last, in
// display space. Everything here is subtle on purpose; the scene should read
// as a clean composed still, not as a filter.
//
//  1. retro-crisp sampling – snaps to whole device pixels (2x on dense screens)
//  2. hairline ink         – only strong luma edges get a thin dark contour
//  3. emerald-noir grade   – shadows fall to the theme's green, highlights lift warm
//  4. whisper dither       – 4x4 Bayer, in deep shadow only, to keep gradients alive
//  5. fine grain + soft editorial vignette

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const ComicShader = {
  name: 'ComicShader',
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPixel: { value: 3 },
    uTime: { value: 0 },
    uDither: { value: 1 },
    uInk: { value: 0.85 },
    uGrain: { value: 0.045 },
    uVignette: { value: 0.62 },
    uShadow: { value: new THREE.Color(0x0a1428) },
    uHi: { value: new THREE.Color(0xffffff) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uPixel, uTime, uDither, uInk, uGrain, uVignette;
    uniform vec3 uShadow, uHi;
    varying vec2 vUv;

    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float bayer4(vec2 p) {
      int x = int(mod(p.x, 4.0));
      int y = int(mod(p.y, 4.0));
      const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
      return (m[y * 4 + x] + 0.5) / 16.0;
    }

    void main() {
      vec2 px = uPixel / uRes;                       // one virtual pixel, in uv
      vec2 cell = floor(vUv / px);
      vec2 uv = (cell + 0.5) * px;
      vec3 c = texture2D(tDiffuse, uv).rgb;

      // hairline ink: only decisive edges, and gentler in the dark
      float l0 = luma(c);
      float lx = luma(texture2D(tDiffuse, uv + vec2(px.x, 0.0)).rgb) - luma(texture2D(tDiffuse, uv - vec2(px.x, 0.0)).rgb);
      float ly = luma(texture2D(tDiffuse, uv + vec2(0.0, px.y)).rgb) - luma(texture2D(tDiffuse, uv - vec2(0.0, px.y)).rgb);
      float edge = smoothstep(0.2, 0.5, length(vec2(lx, ly)));
      c *= 1.0 - edge * uInk * smoothstep(0.02, 0.4, l0);

      // emerald-noir grade: a soft filmic shoulder, green shadows, warm lift
      c = max(c - 0.012, 0.0) * 1.06;
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
      float L = luma(c);
      c = mix(vec3(L), c, 1.08);
      c += uShadow * 0.34 * (1.0 - smoothstep(0.0, 0.34, L));
      c *= mix(vec3(1.0), uHi, 0.22 * smoothstep(0.45, 1.0, L));

      // whisper dither, deep shadow only
      float deep = 1.0 - smoothstep(0.03, 0.2, L);
      vec3 q = floor(c * 40.0 + bayer4(cell)) / 40.0;
      c = mix(c, q, uDither * deep);

      c += (hash(cell + fract(uTime) * 91.7) - 0.5) * uGrain;

      vec2 d = (vUv - 0.5) * vec2(1.0, 0.9);
      c *= 1.0 - uVignette * smoothstep(0.38, 0.95, length(d) * 1.15);

      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export const VISUAL_STYLES = {
  noir: { name: 'Noir Hybrid', pixelRows: 900, dither: 0.8, grain: 0.016, ink: 0.3, vignette: 0.5 },
  clean: { name: 'Clean Crisp', pixelRows: 0, dither: 0, grain: 0, ink: 0.18, vignette: 0.38 },
};

export function createComicPass() {
  const pass = new ShaderPass(ComicShader);
  const u = pass.uniforms;
  let style = VISUAL_STYLES.noir;
  let height = 720;
  const apply = () => {
    // virtual pixels are whole device pixels, so the grid stays razor sharp
    // 1 device pixel on ordinary screens, 2 on dense ones: crisp, never chunky
    u.uPixel.value = style.pixelRows ? Math.max(1, Math.round(height / style.pixelRows)) : 1;
    u.uDither.value = style.dither;
    u.uGrain.value = style.grain;
    u.uInk.value = style.ink;
    u.uVignette.value = style.vignette;
  };
  return {
    pass,
    setStyle(id) {
      style = VISUAL_STYLES[id] || VISUAL_STYLES.noir;
      apply();
    },
    setSize(w, h) {
      u.uRes.value.set(w, h);
      height = h;
      apply();
    },
    setGrade(shadow, hi) {
      u.uShadow.value.setHex(shadow);
      u.uHi.value.setHex(hi);
    },
    setTime(t) {
      u.uTime.value = t;
    },
  };
}
