// The PS1 x 90s-comic finishing pass. Runs last, in display space.
//
//  1. hybrid pixelation  – snap to a chunky virtual pixel grid (PS1 Comic only)
//  2. ink contours       – darken luma edges so forms read as inked line art
//  3. noir grade         – crushed blacks, stark highlights, tinted shadows
//  4. ordered dithering  – 4x4 Bayer + colour quantisation, heaviest in shadow
//  5. film grain + vignette

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

      // ink contours from luma discontinuities
      float l0 = luma(c);
      float lx = luma(texture2D(tDiffuse, uv + vec2(px.x, 0.0)).rgb) - luma(texture2D(tDiffuse, uv - vec2(px.x, 0.0)).rgb);
      float ly = luma(texture2D(tDiffuse, uv + vec2(0.0, px.y)).rgb) - luma(texture2D(tDiffuse, uv - vec2(0.0, px.y)).rgb);
      float edge = smoothstep(0.09, 0.26, length(vec2(lx, ly)));
      c *= 1.0 - edge * uInk * (0.45 + 0.55 * smoothstep(0.0, 0.5, l0));

      // noir grade: crush the blacks, push the highlights, tint both ends
      c = max(c - 0.02, 0.0) * 1.12;
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.35);
      float L = luma(c);
      c = mix(vec3(L), c, 1.15);
      c += uShadow * 0.22 * (1.0 - smoothstep(0.0, 0.3, L));
      c *= mix(vec3(1.0), uHi, 0.3 * smoothstep(0.5, 1.0, L));

      // 4x4 Bayer ordered dither with PS1-ish colour depth, coarsest in the dark
      float levels = mix(14.0, 30.0, smoothstep(0.0, 0.4, L));
      vec3 q = floor(c * levels + bayer4(cell)) / levels;
      c = mix(c, q, uDither * smoothstep(0.004, 0.03, L)); // true black stays clean ink

      c += (hash(cell + fract(uTime) * 91.7) - 0.5) * uGrain * (0.35 + L);

      vec2 d = (vUv - 0.5) * vec2(1.0, 0.88);
      c *= 1.0 - uVignette * smoothstep(0.32, 0.86, length(d) * 1.2);

      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export const VISUAL_STYLES = {
  ps1: { name: 'PS1 Comic', pixelRows: 420, dither: 1, grain: 0.05 },
  crisp: { name: 'Crisp Ink', pixelRows: 0, dither: 0.25, grain: 0.03 },
};

export function createComicPass() {
  const pass = new ShaderPass(ComicShader);
  const u = pass.uniforms;
  let style = VISUAL_STYLES.ps1;
  let height = 720;
  const apply = () => {
    // virtual pixels are whole device pixels, so the grid stays razor sharp
    u.uPixel.value = style.pixelRows ? Math.max(2, Math.round(height / style.pixelRows)) : 1;
    u.uDither.value = style.dither;
    u.uGrain.value = style.grain;
  };
  return {
    pass,
    setStyle(id) {
      style = VISUAL_STYLES[id] || VISUAL_STYLES.ps1;
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
