// The printed-page finishing pass. Runs last, in display space, at full native
// resolution: no downsampling, no pixel grid.
//
//  1. ink accents     – thin dark contours on decisive luma edges
//  2. colour grade    – rich graphic-novel colour: inky tinted shadows, warm lift
//  3. Ben-Day screen  – a rotated halftone dot screen in the shadow midtones,
//                       the signature look of four-colour print
//  4. soft vignette

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const ComicShader = {
  name: 'ComicShader',
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uDot: { value: 6 },
    uHalftone: { value: 0.6 },
    uInk: { value: 0.4 },
    uVignette: { value: 0.42 },
    uShadow: { value: new THREE.Color(0x141a52) },
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
    uniform float uDot, uHalftone, uInk, uVignette;
    uniform vec3 uShadow, uHi;
    varying vec2 vUv;

    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

    void main() {
      vec2 px = 1.0 / uRes;
      vec3 c = texture2D(tDiffuse, vUv).rgb;

      // thin ink accents
      float l0 = luma(c);
      float lx = luma(texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb) - luma(texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb);
      float ly = luma(texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb) - luma(texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb);
      float edge = smoothstep(0.16, 0.42, length(vec2(lx, ly)));
      c = mix(c, c * 0.25, edge * uInk * smoothstep(0.03, 0.35, l0));

      // graphic-novel grade
      c = max(c - 0.01, 0.0) * 1.05;
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.25);
      float L = luma(c);
      c = mix(vec3(L), c, 1.18);
      c += uShadow * 0.3 * (1.0 - smoothstep(0.0, 0.36, L));
      c *= mix(vec3(1.0), uHi, 0.2 * smoothstep(0.45, 1.0, L));

      // Ben-Day dots in the shadow midtones
      float ca = 0.8660254, sa = 0.5;
      vec2 g = mat2(ca, -sa, sa, ca) * (gl_FragCoord.xy / uDot);
      float d = length(fract(g) - 0.5);
      float band = smoothstep(0.035, 0.11, L) * (1.0 - smoothstep(0.3, 0.46, L));
      float radius = 0.44 * (1.0 - smoothstep(0.04, 0.46, L));
      float dotv = 1.0 - smoothstep(radius - 0.07, radius + 0.07, d);
      c = mix(c, c * 0.55 + uShadow * 0.12, dotv * band * uHalftone);

      vec2 v = (vUv - 0.5) * vec2(1.0, 0.9);
      c *= 1.0 - uVignette * smoothstep(0.4, 0.98, length(v) * 1.15);

      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export const VISUAL_STYLES = {
  print: { name: 'Comic Print', halftone: 0.6, ink: 0.4, vignette: 0.42 },
  ink: { name: 'Clean Ink', halftone: 0, ink: 0.5, vignette: 0.34 },
};

export function createComicPass() {
  const pass = new ShaderPass(ComicShader);
  const u = pass.uniforms;
  let style = VISUAL_STYLES.print;
  const apply = () => {
    u.uHalftone.value = style.halftone;
    u.uInk.value = style.ink;
    u.uVignette.value = style.vignette;
  };
  return {
    pass,
    setStyle(id) {
      style = VISUAL_STYLES[id] || VISUAL_STYLES.print;
      apply();
    },
    setSize(w, h) {
      u.uRes.value.set(w, h);
      u.uDot.value = Math.max(4, h / 150); // dot pitch scales with the screen, like print
      apply();
    },
    setGrade(shadow, hi) {
      u.uShadow.value.setHex(shadow);
      u.uHi.value.setHex(hi);
    },
    setTime() {},
  };
}
