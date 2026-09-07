/**
 * MYCELIUM NET
 *
 * A fungal network growing in the dark. Tips crawl along a flow field, branch,
 * die, and are replaced; the whole thing runs on one ring buffer, so it grows
 * forever without ever allocating another byte. Old threads fade out at the
 * back while new ones flare at the front.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js ../lib/device.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { scale } from '../lib/device.js';
import { PALETTE } from '../lib/palette.js';
import { createParamSetter } from '../lib/params.js';

export const defaults = {
  maxSegments: 0,      // 0 = pick from the device
  tipLimit: 0,         // 0 = pick from the device
  ticksPerSecond: 24,  // growth steps per second, independent of frame rate
  stepLength: 0.045,
  branchChance: 0.028,
  fadeSeconds: 9,
  bounds: 2.0,
  coreColor: PALETTE.acid,
  tipColor: PALETTE.violet,
};

/**
 * A smooth divergence-light flow field made of layered sines.
 * Not physically anything — it just curls in a way that reads as organic.
 */
function flowAt(x, y, z, time, out) {
  out.set(
    Math.sin(y * 1.7 + time * 0.30) + Math.sin(z * 2.3 - time * 0.21),
    Math.sin(z * 1.9 + time * 0.33) + Math.sin(x * 2.1 + time * 0.15),
    Math.sin(x * 1.5 - time * 0.27) + Math.sin(y * 2.7 + time * 0.09),
  );
  return out;
}

const VERTEX_SHADER = /* glsl */ `
attribute float aBorn;
attribute float aSeed;

uniform float uTime;
uniform float uFade;

varying float vAlpha;
varying float vSeed;

void main() {
  float age = uTime - aBorn;
  float life = clamp(1.0 - age / uFade, 0.0, 1.0);
  // Fresh growth flares, then settles to a steady glow, then fades away.
  vAlpha = life * (0.72 + 1.15 * exp(-age * 3.0));
  vSeed = aSeed;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision mediump float;

uniform vec3 uCore;
uniform vec3 uTip;

varying float vAlpha;
varying float vSeed;

void main() {
  if (vAlpha <= 0.001) discard;
  gl_FragColor = vec4(mix(uCore, uTip, vSeed), vAlpha);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const maxSegments = params.maxSegments || scale(2600, 6500);
  const tipLimit = params.tipLimit || scale(28, 44);

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 50, position: [0, 0, 5.4], far: 40 },
  });
  const pointer = createPointer(canvas);
  stage.scene.fog = new THREE.FogExp2(PALETTE.void, 0.14);

  // ---- the ring buffer ----------------------------------------------------
  // Two vertices per segment. When we reach the end we start again at zero and
  // overwrite the oldest threads, which by then have already faded out.
  const positions = new Float32Array(maxSegments * 2 * 3);
  const born = new Float32Array(maxSegments * 2);
  const seeds = new Float32Array(maxSegments * 2);
  born.fill(-1000); // everything starts already long dead, so nothing shows

  let writeIndex = 0;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aBorn', new THREE.BufferAttribute(born, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setDrawRange(0, maxSegments * 2);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), params.bounds * 2);

  const uniforms = {
    uTime: { value: 0 },
    uFade: { value: params.fadeSeconds },
    uCore: { value: new THREE.Color(params.coreColor) },
    uTip: { value: new THREE.Color(params.tipColor) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const threads = new THREE.LineSegments(geometry, material);
  const web = new THREE.Group();
  web.add(threads);
  stage.scene.add(web);

  function writeSegment(from, to, time, seed) {
    const a = writeIndex * 6;
    positions[a + 0] = from.x; positions[a + 1] = from.y; positions[a + 2] = from.z;
    positions[a + 3] = to.x;   positions[a + 4] = to.y;   positions[a + 5] = to.z;

    born[writeIndex * 2] = time;
    born[writeIndex * 2 + 1] = time;
    seeds[writeIndex * 2] = seed;
    seeds[writeIndex * 2 + 1] = seed;

    writeIndex = (writeIndex + 1) % maxSegments;
  }

  // ---- the tips -----------------------------------------------------------
  const tips = [];
  const scratchFlow = new THREE.Vector3();
  const scratchNext = new THREE.Vector3();

  function randomDirection() {
    return new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
  }

  function spawnTip(position, direction, seed) {
    if (tips.length >= tipLimit) return;
    tips.push({
      position: position.clone(),
      direction: direction.clone(),
      seed,
      stepsLeft: 50 + Math.floor(Math.random() * 90),
    });
  }

  function seedFromNowhere() {
    const origin = randomDirection().multiplyScalar(params.bounds * 0.75);
    spawnTip(origin, origin.clone().negate().normalize(), Math.random());
  }

  for (let i = 0; i < Math.min(6, tipLimit); i++) seedFromNowhere();

  /** One growth step for every living tip. */
  function grow(time) {
    for (let i = tips.length - 1; i >= 0; i--) {
      const tip = tips[i];

      flowAt(tip.position.x, tip.position.y, tip.position.z, time, scratchFlow);
      tip.direction.addScaledVector(scratchFlow, 0.16).normalize();

      // Curve back inside when a tip wanders out of the sphere.
      const distance = tip.position.length();
      if (distance > params.bounds) {
        tip.direction.addScaledVector(tip.position, -0.5 / distance).normalize();
      }

      scratchNext.copy(tip.position).addScaledVector(tip.direction, params.stepLength);
      writeSegment(tip.position, scratchNext, time, tip.seed);
      tip.position.copy(scratchNext);

      if (Math.random() < params.branchChance) {
        const branchDirection = tip.direction.clone()
          .add(randomDirection().multiplyScalar(0.9))
          .normalize();
        spawnTip(tip.position, branchDirection, Math.min(1, tip.seed + 0.25));
      }

      tip.stepsLeft -= 1;
      if (tip.stepsLeft <= 0) tips.splice(i, 1);
    }

    while (tips.length < 4) seedFromNowhere();
  }

  // ---- animation ----------------------------------------------------------
  let growthDebt = 0;

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);
    uniforms.uTime.value = time;

    // Fixed growth rate, whatever the frame rate is doing.
    growthDebt += dt * params.ticksPerSecond;
    let steps = Math.min(6, Math.floor(growthDebt));
    growthDebt -= steps;
    while (steps-- > 0) grow(time);

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aBorn.needsUpdate = true;
    geometry.attributes.aSeed.needsUpdate = true;

    web.rotation.y += dt * 0.09;
    web.rotation.x += (pointer.y * 0.5 - web.rotation.x) * Math.min(1, dt * 2);
    web.rotation.z = pointer.x * 0.25;
  });

  stage.onDispose(() => {
    pointer.dispose();
    geometry.dispose();
    material.dispose();
  });

  // Grow a network before the first frame, backdating each step so the oldest
  // threads are already faded. The canvas is never empty, even for a moment.
  for (let step = 200; step > 0; step--) grow(-step / params.ticksPerSecond);
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.aBorn.needsUpdate = true;
  geometry.attributes.aSeed.needsUpdate = true;

  stage.setParam = createParamSetter(params, {
    fadeSeconds: (value) => { uniforms.uFade.value = value; },
  });

  return stage.start();
}
