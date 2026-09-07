/**
 * REACTION DIFFUSION
 *
 * Two imaginary chemicals. A feeds, B eats A and turns into more B, B decays.
 * That is the entire rule, and out of it come coral, fingerprints, cell
 * division and leopard spots. Alan Turing worked this out in 1952 to explain
 * how an animal with identical cells everywhere ends up with a pattern.
 *
 *   A' = A + (Da*lap(A) - A*B*B + feed*(1-A)) * dt
 *   B' = B + (Db*lap(B) + A*B*B - (kill+feed)*B) * dt
 *
 * The state lives in a texture and never comes back to the CPU — see
 * ../lib/pingpong.js. Feed and kill drift slowly, which walks the simulation
 * through completely different pattern regimes. Touch it to seed more B.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/pingpong.js ../lib/fullscreen.js
 *                   ../lib/params.js ../lib/device.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createPingPong } from '../lib/pingpong.js';
import { createFullscreenQuad } from '../lib/fullscreen.js';
import { createParamSetter } from '../lib/params.js';
import { scale } from '../lib/device.js';
import { PALETTE } from '../lib/palette.js';

export const defaults = {
  resolution: 0,     // 0 = pick from the device
  stepsPerFrame: 0,  // 0 = pick from the device
  drift: 1,          // how fast feed and kill wander. 0 freezes the regime.
  zoom: 1,
};

const SIMULATION_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D uState;
uniform vec2  uTexel;
uniform float uFeed;
uniform float uKill;
uniform float uDiffusionA;
uniform float uDiffusionB;
uniform float uDelta;
uniform vec2  uPaint;
uniform float uPainting;

/** Nine-point Laplacian: the classic 0.2 / 0.05 stencil. */
vec2 laplacian(vec2 uv) {
  vec2 sum = texture2D(uState, uv).rg * -1.0;

  sum += texture2D(uState, uv + vec2( uTexel.x, 0.0)).rg * 0.2;
  sum += texture2D(uState, uv + vec2(-uTexel.x, 0.0)).rg * 0.2;
  sum += texture2D(uState, uv + vec2(0.0,  uTexel.y)).rg * 0.2;
  sum += texture2D(uState, uv + vec2(0.0, -uTexel.y)).rg * 0.2;

  sum += texture2D(uState, uv + vec2( uTexel.x,  uTexel.y)).rg * 0.05;
  sum += texture2D(uState, uv + vec2(-uTexel.x, -uTexel.y)).rg * 0.05;
  sum += texture2D(uState, uv + vec2( uTexel.x, -uTexel.y)).rg * 0.05;
  sum += texture2D(uState, uv + vec2(-uTexel.x,  uTexel.y)).rg * 0.05;

  return sum;
}

void main() {
  vec2 state = texture2D(uState, vUv).rg;
  float a = state.r;
  float b = state.g;

  vec2 lap = laplacian(vUv);
  float reaction = a * b * b;

  float nextA = a + (uDiffusionA * lap.r - reaction + uFeed * (1.0 - a)) * uDelta;
  float nextB = b + (uDiffusionB * lap.g + reaction - (uKill + uFeed) * b) * uDelta;

  // A finger seeds fresh B, which is how you draw with chemistry.
  float brush = uPainting * (1.0 - smoothstep(0.0, 0.04, distance(vUv, uPaint)));
  nextB = mix(nextB, 1.0, brush);

  gl_FragColor = vec4(clamp(nextA, 0.0, 1.0), clamp(nextB, 0.0, 1.0), 0.0, 1.0);
}
`;

const DISPLAY_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D uState;
uniform vec2  uTexel;
uniform vec2  uScale;
uniform vec3  uLow;
uniform vec3  uMid;
uniform vec3  uHigh;

void main() {
  // The simulation is square and wraps, so scaling the lookup just shows more
  // of the pattern on a wide canvas instead of stretching it.
  vec2 uv = (vUv - 0.5) * uScale + 0.5;

  float b = texture2D(uState, uv).g;

  // Slope of B gives a crisp rim around every structure.
  float dx = texture2D(uState, uv + vec2(uTexel.x, 0.0)).g
           - texture2D(uState, uv - vec2(uTexel.x, 0.0)).g;
  float dy = texture2D(uState, uv + vec2(0.0, uTexel.y)).g
           - texture2D(uState, uv - vec2(0.0, uTexel.y)).g;
  float edge = length(vec2(dx, dy)) * 9.0;

  vec3 color = mix(uLow, uMid, smoothstep(0.04, 0.26, b));
  color = mix(color, uHigh, smoothstep(0.26, 0.44, b));
  color += uHigh * edge * 0.75;

  vec2 v = vUv * 2.0 - 1.0;
  color *= 1.0 - 0.25 * dot(v, v);

  gl_FragColor = vec4(color, 1.0);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const resolution = params.resolution || scale(256, 420);
  const stepsPerFrame = params.stepsPerFrame || scale(6, 12);

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    antialias: false,
    maxPixelRatio: scale(1.25, 1.75),
  });
  const pointer = createPointer(canvas);

  // ---- the chemistry ------------------------------------------------------
  const simulation = createPingPong(stage.renderer, {
    size: resolution,
    fragmentShader: SIMULATION_SHADER,
    uniforms: {
      uFeed: { value: 0.037 },
      uKill: { value: 0.060 },
      uDiffusionA: { value: 1.0 },
      uDiffusionB: { value: 0.5 },
      uDelta: { value: 1.0 },
      uPaint: { value: new THREE.Vector2(0.5, 0.5) },
      uPainting: { value: 0 },
    },
    // Start with A everywhere and a scattering of B to get things going.
    seed: (context, width, height) => {
      context.fillStyle = '#ff0000';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#ffff00'; // red stays 1, green becomes 1
      for (let i = 0; i < 16; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const r = width * (0.015 + Math.random() * 0.025);
        context.beginPath();
        context.arc(x, y, r, 0, Math.PI * 2);
        context.fill();
      }
    },
  });

  // ---- what you see -------------------------------------------------------
  const displayUniforms = {
    uState: { value: simulation.texture },
    uTexel: { value: new THREE.Vector2(1 / resolution, 1 / resolution) },
    uScale: { value: new THREE.Vector2(1, 1) },
    uLow: { value: new THREE.Color(0x060810) },
    uMid: { value: new THREE.Color(PALETTE.violet).multiplyScalar(0.55) },
    uHigh: { value: new THREE.Color(PALETTE.cyan) },
  };

  const quad = createFullscreenQuad(DISPLAY_SHADER, displayUniforms);
  stage.scene.add(quad.mesh);

  stage.onResize(({ width, height }) => {
    const aspect = width / height;
    // Show more sideways on a wide canvas, more vertically on a tall one.
    displayUniforms.uScale.value.set(
      params.zoom * Math.max(1, aspect),
      params.zoom * Math.max(1, 1 / aspect),
    );
  });

  // ---- animation ----------------------------------------------------------
  const chemistry = simulation.uniforms;

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    // Wander slowly through (feed, kill) space. Every region of it grows a
    // different creature: coral, worms, mitosis, spots.
    const wander = time * params.drift;
    chemistry.uFeed.value = 0.030 + (Math.sin(wander * 0.047) * 0.5 + 0.5) * 0.028;
    chemistry.uKill.value = 0.0565 + (Math.sin(wander * 0.031 + 2.1) * 0.5 + 0.5) * 0.0085;

    chemistry.uPaint.value.set(pointer.x * 0.5 + 0.5, pointer.y * 0.5 + 0.5);
    chemistry.uPainting.value = pointer.down ? 1 : 0;

    for (let i = 0; i < stepsPerFrame; i++) simulation.step();
    displayUniforms.uState.value = simulation.texture;
  });

  stage.onDispose(() => {
    pointer.dispose();
    simulation.dispose();
    quad.dispose();
  });

  stage.setParam = createParamSetter(params, {
    zoom: (value) => {
      const aspect = stage.size.width / stage.size.height;
      displayUniforms.uScale.value.set(
        value * Math.max(1, aspect),
        value * Math.max(1, 1 / aspect),
      );
    },
  });

  return stage.start();
}
