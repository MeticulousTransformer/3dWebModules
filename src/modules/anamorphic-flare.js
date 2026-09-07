/**
 * ANAMORPHIC FLARE
 *
 * What an anamorphic lens does to a bright light: a long horizontal blue
 * streak, a row of ghosts strung along the line from the light through the
 * middle of the frame, and a warm halo where the light has bled into the
 * emulsion.
 *
 * The ghosts are not decoration. Light bounces between glass surfaces inside a
 * lens, and each bounce comes back out slightly off, landing on the far side
 * of the optical axis from the source. That is why flare ghosts always march
 * through the centre — and why moving the light moves the whole chain.
 *
 * One fullscreen shader. No geometry at all.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/fullscreen.js ../lib/glsl.js
 *                   ../lib/device.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createFullscreenQuad } from '../lib/fullscreen.js';
import { GLSL_NOISE, GLSL_FBM, GLSL_HASH } from '../lib/glsl.js';
import { scale } from '../lib/device.js';
import { STUDIO } from '../lib/palette.js';

export const defaults = {
  streak: 1,      // length of the horizontal smear
  ghosts: 1,      // strength of the internal reflections
  halation: 1,    // the warm bleed around the source
  dirt: 0.55,     // how filthy the front element is
  blades: 7,      // the ghosts take the shape of the iris
};

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uAspect;
uniform vec2  uLightA;   // the main source, in aspect-corrected -1..1
uniform vec2  uLightB;   // a smaller one, behind
uniform float uStreak;
uniform float uGhosts;
uniform float uHalation;
uniform float uDirt;
uniform float uBlades;

${GLSL_HASH}
${GLSL_NOISE}
${GLSL_FBM}

/** Distance to the edge of a regular polygon, scaled so the edge sits at 1. */
float apertureShape(vec2 p, float rotation) {
  float angle = atan(p.y, p.x) + rotation;
  float wedge = 6.2831853 / uBlades;
  return cos(floor(0.5 + angle / wedge) * wedge - angle) * length(p);
}

/** The long thin smear. Very wide, very shallow, and blue, which is the tell. */
float anamorphicStreak(vec2 p, vec2 light, float width, float reach) {
  vec2 d = p - light;
  float across = exp(-abs(d.y) / width);
  float along = exp(-abs(d.x) / reach);
  // A hard bright core along the very middle of the streak.
  float core = exp(-abs(d.y) / (width * 0.22)) * exp(-abs(d.x) / (reach * 0.55));
  return across * along + core * 0.8;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p.x *= uAspect;

  vec3 color = vec3(0.0);

  // A barely-there gradient, so the frame is not mathematically black.
  color += vec3(0.012, 0.014, 0.020) * (1.0 - length(p) * 0.35);

  // Grime on the front element. Flare picks it up; nothing else does.
  float grime = fbm(vec3(p * 3.2, 0.0), 4) * 0.5 + 0.5;
  grime = mix(1.0, 0.45 + grime, uDirt);

  for (int which = 0; which < 2; which++) {
    vec2 light = which == 0 ? uLightA : uLightB;
    float power = which == 0 ? 1.0 : 0.42;

    vec2 d = p - light;
    float distance = length(d);

    // The source itself.
    color += vec3(1.0, 0.96, 0.90) * power * exp(-distance * 26.0) * 1.4;

    // Halation: the warm bloom emulsion puts around a hot highlight.
    color += vec3(1.0, 0.58, 0.28) * power * uHalation * exp(-distance * 3.4) * 0.42;
    color += vec3(1.0, 0.82, 0.58) * power * uHalation * exp(-distance * 8.0) * 0.46;

    // The streak, in three slightly different widths so the edge is not flat.
    float streak = anamorphicStreak(p, light, 0.016, 0.85 * uStreak) * 1.00
                 + anamorphicStreak(p, light, 0.055, 0.55 * uStreak) * 0.35
                 + anamorphicStreak(p, light, 0.140, 0.34 * uStreak) * 0.14;
    color += vec3(0.36, 0.58, 1.0) * streak * power * grime * 1.1;

    // Ghosts, marching along the line from the light through the centre.
    // Each one is an image of the iris, so each one is a polygon.
    for (int i = 1; i <= 6; i++) {
      float step = float(i);
      float placement = -0.42 * step;               // past the centre, and beyond
      vec2 ghostCentre = light * placement;
      float size = 0.055 + 0.045 * mod(step, 3.0);

      vec2 q = (p - ghostCentre) / size;
      float shape = 1.0 - smoothstep(0.72, 1.0, apertureShape(q, 0.3));
      float ring = smoothstep(0.55, 0.98, apertureShape(q, 0.3));

      // Each bounce has its own coating colour, which is why a flare chain is
      // never all one hue.
      vec3 coating = vec3(
        0.5 + 0.5 * sin(step * 1.7),
        0.5 + 0.5 * sin(step * 2.3 + 2.0),
        0.5 + 0.5 * sin(step * 1.1 + 4.0)
      );

      color += coating * shape * (0.10 + ring * 0.16) * uGhosts * power * grime;
    }
  }

  // A faint ring near the edge of the frame: the last internal reflection.
  float halo = smoothstep(0.62, 0.70, length(p)) * (1.0 - smoothstep(0.70, 0.80, length(p)));
  color += vec3(0.30, 0.45, 0.85) * halo * 0.10 * uGhosts;

  // Grain, and a vignette, because this is film.
  float grain = hash21(vUv * 700.0 + fract(uTime) * 91.0) - 0.5;
  color += grain * 0.030;
  color *= 1.0 - 0.42 * pow(length(p) * 0.62, 2.2);

  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: STUDIO.gate,
    antialias: false,
    maxPixelRatio: scale(1.25, 1.75),
  });
  const pointer = createPointer(canvas);

  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uLightA: { value: new THREE.Vector2(0.4, 0.25) },
    uLightB: { value: new THREE.Vector2(-0.6, -0.2) },
    uStreak: { value: params.streak },
    uGhosts: { value: params.ghosts },
    uHalation: { value: params.halation },
    uDirt: { value: params.dirt },
    uBlades: { value: params.blades },
  };

  const quad = createFullscreenQuad(FRAGMENT_SHADER, uniforms);
  stage.scene.add(quad.mesh);

  stage.onResize(({ width, height }) => {
    uniforms.uAspect.value = width / height;
  });

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);
    uniforms.uTime.value = time;

    const aspect = uniforms.uAspect.value;

    // The main light follows a finger, and drifts on its own when there is none.
    const targetX = pointer.active ? pointer.x * aspect * 0.8 : Math.sin(time * 0.21) * aspect * 0.55;
    const targetY = pointer.active ? pointer.y * 0.6 : Math.sin(time * 0.13 + 1.1) * 0.35;

    uniforms.uLightA.value.x += (targetX - uniforms.uLightA.value.x) * Math.min(1, dt * 2.4);
    uniforms.uLightA.value.y += (targetY - uniforms.uLightA.value.y) * Math.min(1, dt * 2.4);

    uniforms.uLightB.value.set(
      Math.sin(time * 0.17 + 2.4) * aspect * 0.62,
      Math.cos(time * 0.11 + 0.7) * 0.42,
    );
  });

  stage.onDispose(() => {
    pointer.dispose();
    quad.dispose();
  });

  stage.setParam = createParamSetter(params, {
    streak: (value) => { uniforms.uStreak.value = value; },
    ghosts: (value) => { uniforms.uGhosts.value = value; },
    halation: (value) => { uniforms.uHalation.value = value; },
    dirt: (value) => { uniforms.uDirt.value = value; },
    blades: (value) => { uniforms.uBlades.value = value; },
  });

  return stage.start();
}
