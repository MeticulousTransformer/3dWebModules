/**
 * BOKEH FIELD
 *
 * Out-of-focus highlights, done properly.
 *
 * Three details separate believable bokeh from white circles:
 *
 *  1. The shape is the aperture. Seven blades give you seven-sided highlights,
 *     and they only go round when the lens is wide open.
 *  2. Energy is conserved. A highlight spread over four times the area is four
 *     times dimmer — which is why real bokeh gets softer as it gets bigger
 *     instead of turning the frame white.
 *  3. Cat's eye. Away from the middle of the frame the aperture is clipped by
 *     the barrel, so highlights near the edges are cut into lemons whose long
 *     axis runs across the radius. That is what makes a frame look photographed
 *     through something rather than composited.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/random.js ../lib/filmlook.js
 *                   ../lib/device.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createRandom } from '../lib/random.js';
import { createFilmLook } from '../lib/filmlook.js';
import { scale } from '../lib/device.js';
import { STUDIO } from '../lib/palette.js';

export const defaults = {
  lights: 0,        // 0 = pick from the device
  blades: 7,
  aperture: 1.0,    // wide open. lower rounds the shape off and shrinks the discs.
  rackSeconds: 16,  // how long a full focus pull takes
  catsEye: 1,       // 0 turns the edge clipping off
  rim: 0.55,        // brightness of the ring around each highlight
};

const NEAR = -1.2;
const FAR = -9.0;

const VERTEX_SHADER = /* glsl */ `
attribute float aSize;
attribute float aBrightness;
attribute vec3  aTint;

uniform float uFocus;      // the depth that is sharp, in view space
uniform float uAperture;   // bigger means shallower, so bigger discs
uniform float uPixelRatio;

varying vec3  vTint;
varying float vBrightness;
varying vec2  vRadial;     // direction from the middle of the frame
varying float vOffAxis;    // how far out of the middle, 0..1

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);

  // Circle of confusion: how far out of focus this light is.
  float defocus = abs(viewPosition.z - uFocus);
  float coc = 2.0 + defocus * 26.0 * uAperture * aSize;

  gl_PointSize = coc * uPixelRatio;

  // Spread the same light over more area and it must get dimmer, or every
  // out-of-focus frame would clip to white.
  vBrightness = aBrightness * (36.0 / (coc * coc)) * 68.0;
  vTint = aTint;

  vec4 clip = projectionMatrix * viewPosition;
  vec2 ndc = clip.xy / max(0.0001, clip.w);
  vRadial = length(ndc) > 0.001 ? normalize(ndc) : vec2(0.0, 1.0);
  vOffAxis = clamp(length(ndc) * 0.78, 0.0, 1.0);

  gl_Position = clip;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec3  vTint;
varying float vBrightness;
varying vec2  vRadial;
varying float vOffAxis;

uniform float uBlades;
uniform float uRoundness;   // 1 = a circle, 0 = a hard polygon
uniform float uRotation;
uniform float uCatsEye;
uniform float uRim;

/**
 * Distance to a regular polygon's edge, scaled so the edge sits at 1.
 * Blended towards a plain circle, because a lens wide open has a rounder
 * opening than the same lens stopped down.
 */
float apertureShape(vec2 p) {
  float angle = atan(p.y, p.x) + uRotation;
  float wedge = 6.2831853 / uBlades;
  float polygon = cos(floor(0.5 + angle / wedge) * wedge - angle) * length(p);
  return mix(polygon, length(p), uRoundness);
}

void main() {
  // gl_PointCoord runs top-down; flip it so the shape is the right way up.
  vec2 p = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y) * 2.0 - 1.0;

  // Three slightly different scales for the three channels: the lateral
  // colour fringing every fast lens puts on the rim of a highlight.
  float edgeR = 1.0 - smoothstep(0.84, 0.99, apertureShape(p * 0.982));
  float edgeG = 1.0 - smoothstep(0.84, 0.99, apertureShape(p));
  float edgeB = 1.0 - smoothstep(0.84, 0.99, apertureShape(p * 1.018));

  if (edgeR + edgeG + edgeB < 0.002) discard;

  // Cat's eye: the barrel clips the pupil more the further off axis you are.
  vec2 clipCentre = vRadial * vOffAxis * 1.25 * uCatsEye;
  float clipped = 1.0 - smoothstep(0.88, 1.06, length(p - clipCentre));

  vec3 shape = vec3(edgeR, edgeG, edgeB) * clipped;

  // Spherical aberration piles light up at the rim — the soap-bubble look.
  float ring = smoothstep(0.52, 0.96, apertureShape(p)) * clipped;
  float body = 0.72 + ring * uRim * 2.2;

  vec3 color = vTint * shape * body * vBrightness;
  float alpha = max(max(shape.r, shape.g), shape.b) * vBrightness;

  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const count = params.lights || scale(150, 320);
  const random = createRandom(11);

  const stage = createStage(canvas, {
    clearColor: STUDIO.gate,
    camera: { fov: 42, position: [0, 0, 0], far: 30 },
  });
  const pointer = createPointer(canvas);

  // ---- the highlights -----------------------------------------------------
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);
  const tints = new Float32Array(count * 3);

  // Nearly all practicals are some flavour of warm white; a few are cold, and
  // one or two are a sodium orange. Restraint is what makes it read as real.
  const TINTS = [
    [1.00, 0.95, 0.88], [1.00, 0.90, 0.74], [1.00, 0.84, 0.58],
    [0.82, 0.90, 1.00], [1.00, 0.66, 0.34], [1.00, 0.99, 0.96],
    [0.90, 0.80, 0.52], // the brass their site is accented with
  ];

  const drift = [];
  for (let i = 0; i < count; i++) {
    const z = NEAR + random() * (FAR - NEAR);
    // Spread wider the further away, so the frame fills evenly in perspective.
    const spread = 0.9 + Math.abs(z) * 0.62;

    positions[i * 3 + 0] = random.between(-spread, spread);
    positions[i * 3 + 1] = random.between(-spread * 0.7, spread * 0.7);
    positions[i * 3 + 2] = z;

    sizes[i] = random.between(0.45, 1.35);
    brightness[i] = random.between(0.55, 1.0) * random.between(0.6, 1.0);

    const tint = TINTS[Math.floor(random() * TINTS.length)];
    tints[i * 3 + 0] = tint[0];
    tints[i * 3 + 1] = tint[1];
    tints[i * 3 + 2] = tint[2];

    drift.push({
      x: random.between(-0.05, 0.05),
      y: random.between(-0.02, 0.02),
      phase: random() * Math.PI * 2,
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aBrightness', new THREE.BufferAttribute(brightness, 1));
  geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -5), 14);

  const uniforms = {
    uFocus: { value: -4 },
    uAperture: { value: params.aperture },
    uPixelRatio: { value: 1 },
    uBlades: { value: params.blades },
    uRoundness: { value: 0.55 },
    uRotation: { value: 0.2 },
    uCatsEye: { value: params.catsEye },
    uRim: { value: params.rim },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const field = new THREE.Points(geometry, material);
  stage.scene.add(field);

  // ---- grain, vignette, gate weave ---------------------------------------
  const look = createFilmLook({ grain: 0.05, vignette: 0.5 });
  stage.scene.add(look.mesh);

  stage.onResize(() => {
    uniforms.uPixelRatio.value = stage.size.pixelRatio;
  });

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    // A slow rack through the depth of the field, so everything gets a turn
    // at being sharp. A finger takes the focus ring.
    const sweep = pointer.active
      ? pointer.y * 0.5 + 0.5
      : Math.sin((time / params.rackSeconds) * Math.PI * 2) * 0.5 + 0.5;
    uniforms.uFocus.value = NEAR + (FAR - NEAR) * sweep;

    // Wide open the opening is round; stopped down the blades show.
    uniforms.uRoundness.value = Math.min(1, params.aperture * 0.62);
    uniforms.uAperture.value = params.aperture;
    uniforms.uCatsEye.value = params.catsEye;
    uniforms.uRim.value = params.rim;
    uniforms.uRotation.value = 0.2 + time * 0.01;

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] += drift[i].x * dt;
      positions[i * 3 + 1] += drift[i].y * dt + Math.sin(time * 0.3 + drift[i].phase) * dt * 0.01;

      const spread = 0.9 + Math.abs(positions[i * 3 + 2]) * 0.62;
      if (positions[i * 3] > spread) positions[i * 3] = -spread;
      if (positions[i * 3] < -spread) positions[i * 3] = spread;
    }
    geometry.attributes.position.needsUpdate = true;

    // Parallax: the near lights move more than the far ones, for free.
    field.position.x = -pointer.x * 0.25;
    field.position.y = -pointer.y * 0.15;

    look.update(time);
  });

  stage.onDispose(() => {
    pointer.dispose();
    look.dispose();
    geometry.dispose();
    material.dispose();
  });

  stage.setParam = createParamSetter(params, {
    blades: (value) => { uniforms.uBlades.value = value; },
  });

  return stage.start();
}
