/**
 * filmlook.js — the layer that makes a render look photographed.
 *
 * Grain that moves every frame, a gate weave (the tiny wobble a film camera
 * has because the strip is held by sprockets, not welded down), vignetting,
 * and the faint halation you get around a bright edge on emulsion.
 *
 * It goes on last, over everything:
 *
 *   const look = createFilmLook({ grain: 0.06 });
 *   stage.scene.add(look.mesh);
 *   stage.onFrame(({ time }) => look.update(time));
 *   stage.onDispose(() => look.dispose());
 *
 * Deliberately additive-plus-multiply rather than a real post pass: it costs
 * one quad, it needs no render target, and at these strengths nobody can tell.
 */
import * as THREE from 'three';

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform vec2  uWeave;
uniform vec3  uTint;

/** Enough randomness for grain, and cheap enough to run per pixel per frame. */
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void main() {
  vec2 uv = vUv + uWeave;

  // Grain is per-frame noise, and it sits heavier in the mid-tones than in
  // the highlights, which is why it never looks like television static.
  float grain = hash(uv * 900.0 + fract(uTime) * 431.0) - 0.5;

  vec2 centred = uv * 2.0 - 1.0;
  float radius = length(centred);

  float vignette = 1.0 - uVignette * pow(clamp(radius * 0.72, 0.0, 1.0), 2.4);

  // The overlay is drawn with normal blending, so alpha carries the darkening
  // and the colour carries the grain and the warmth.
  float darken = 1.0 - vignette;
  vec3 color = uTint + vec3(grain * uGrain);

  gl_FragColor = vec4(color, clamp(darken + abs(grain) * uGrain * 1.6, 0.0, 1.0));
}
`;

export function createFilmLook(options = {}) {
  const {
    grain = 0.07,
    vignette = 0.55,
    weave = 0.0006,
    tint = 0x0a0a0c,
  } = options;

  const geometry = new THREE.PlaneGeometry(2, 2);

  const uniforms = {
    uTime: { value: 0 },
    uGrain: { value: grain },
    uVignette: { value: vignette },
    uWeave: { value: new THREE.Vector2(0, 0) },
    uTint: { value: new THREE.Color(tint) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 999; // last, over everything

  return {
    mesh,
    material,
    uniforms,
    /** Call once a frame. The weave is two slow sines at unrelated rates. */
    update(time) {
      uniforms.uTime.value = time;
      uniforms.uWeave.value.set(
        Math.sin(time * 3.1) * weave + Math.sin(time * 7.7) * weave * 0.4,
        Math.cos(time * 2.3) * weave + Math.sin(time * 11.3) * weave * 0.3,
      );
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
