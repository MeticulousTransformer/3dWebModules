/**
 * PSILOCYBIN FIELD
 *
 * Domain-warped noise folded through a kaleidoscope and coloured with a cosine
 * palette. Noise pushed through noise pushed through noise — which is, roughly,
 * what the visual cortex does when it stops taking instructions from the eyes.
 *
 * One fullscreen shader, no geometry. Octave count drops on phones.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/fullscreen.js ../lib/glsl.js ../lib/device.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createFullscreenQuad } from '../lib/fullscreen.js';
import { GLSL_NOISE, GLSL_FBM, GLSL_ROTATE } from '../lib/glsl.js';
import { scale } from '../lib/device.js';
import { PALETTE } from '../lib/palette.js';
import { createParamSetter } from '../lib/params.js';

export const defaults = {
  sectors: 6,      // kaleidoscope mirrors. 1 turns it off.
  zoom: 2.4,
  speed: 1,
  octaves: 0,      // 0 = pick from the device
};

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uAspect;
uniform float uZoom;
uniform float uSpeed;
uniform float uSectors;
uniform int   uOctaves;
uniform vec2  uPointer;

${GLSL_NOISE}
${GLSL_FBM}
${GLSL_ROTATE}

/** Inigo Quilez's cosine palette. Cheap, smooth, endlessly tunable. */
vec3 palette(float t) {
  vec3 base   = vec3(0.52, 0.40, 0.55);
  vec3 amp    = vec3(0.48, 0.42, 0.50);
  vec3 freq   = vec3(1.00, 1.00, 1.00);
  vec3 phase  = vec3(0.00, 0.22, 0.55);
  return base + amp * cos(6.28318 * (freq * t + phase));
}

void main() {
  vec2 p = (vUv * 2.0 - 1.0);
  p.x *= uAspect;

  // Drift the whole field towards wherever the finger is.
  p -= uPointer * 0.35;

  float time = uTime * uSpeed;

  // Kaleidoscope: fold the plane into one wedge and mirror it.
  if (uSectors > 1.5) {
    float angle = atan(p.y, p.x);
    float radius = length(p);
    float wedge = 6.28318 / uSectors;
    angle = mod(angle + time * 0.05, wedge);
    angle = abs(angle - wedge * 0.5);
    p = vec2(cos(angle), sin(angle)) * radius;
  }

  p *= uZoom;
  p = rot2(time * 0.06) * p;

  // Three passes of domain warping. Each one drags the next through itself.
  vec3 q = vec3(p, time * 0.10);
  float warpA = fbm(q, uOctaves);
  float warpB = fbm(q + vec3(warpA * 1.7, warpA * 1.2, 0.31), uOctaves);
  float field = fbm(q + vec3(warpB * 2.2, warpB * 1.8, -0.24), uOctaves);

  float radius = length(p);

  // Concentric membranes breathing outwards from the centre.
  float rings = sin(field * 9.0 - radius * 3.0 - time * 1.6);
  float shade = field * 0.55 + rings * 0.18 + radius * 0.10 + time * 0.035;

  vec3 color = palette(shade);

  // Push saturation and pull the darks down, so it glows instead of muddying.
  color = pow(color, vec3(1.35));
  color *= 1.0 + 0.7 * pow(abs(rings), 6.0);

  // Bright core, dark edges.
  color *= 1.25 - 0.5 * smoothstep(0.4, 2.2, radius);

  gl_FragColor = vec4(color, 1.0);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    antialias: false,
    // Heavy per-pixel maths, so do not render it at full retina resolution.
    maxPixelRatio: scale(1.25, 1.75),
  });
  const pointer = createPointer(canvas);

  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uZoom: { value: params.zoom },
    uSpeed: { value: params.speed },
    uSectors: { value: params.sectors },
    uOctaves: { value: params.octaves || scale(3, 5) },
    uPointer: { value: new THREE.Vector2(0, 0) },
  };

  const quad = createFullscreenQuad(FRAGMENT_SHADER, uniforms);
  stage.scene.add(quad.mesh);

  stage.onResize(({ width, height }) => {
    uniforms.uAspect.value = width / height;
  });

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);
    uniforms.uTime.value = time;
    uniforms.uPointer.value.set(pointer.x, pointer.y);
  });

  stage.onDispose(() => {
    pointer.dispose();
    quad.dispose();
  });

  stage.setParam = createParamSetter(params, {
    sectors: (value) => { uniforms.uSectors.value = value; },
    zoom: (value) => { uniforms.uZoom.value = value; },
    speed: (value) => { uniforms.uSpeed.value = value; },
    octaves: (value) => { uniforms.uOctaves.value = value; },
  });

  return stage.start();
}
