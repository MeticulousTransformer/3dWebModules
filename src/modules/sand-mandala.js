/**
 * SAND MANDALA
 *
 * Laid down grain by grain from the centre outwards, held for a while, then
 * swept away — and started again. That is the whole point of a sand mandala,
 * and it is also, conveniently, a very cheap animation: nothing moves except
 * one "how much has been drawn" number and one "how far gone" number.
 *
 * Both the build and the dissolve happen entirely in the vertex shader, so
 * fourteen thousand grains cost the CPU nothing per frame.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/device.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { scale } from '../lib/device.js';
import { PALETTE } from '../lib/palette.js';

export const defaults = {
  grains: 0,             // 0 = pick from the device
  buildSeconds: 13,
  holdSeconds: 5,
  dissolveSeconds: 4.5,
  spin: 0.05,
};

const TAU = Math.PI * 2;

/**
 * The mandala, described as rings. `symmetry` is how many petals that ring
 * has, `petal` is how far the radius swings in and out, `spread` is how loose
 * the sand is, `share` is what fraction of all grains it gets.
 */
const BANDS = [
  { radius: 0.12, symmetry: 8,  petal: 0.04,  spread: 0.022, share: 0.06, color: PALETTE.gold },
  { radius: 0.28, symmetry: 16, petal: 0.07,  spread: 0.026, share: 0.13, color: PALETTE.vermilion },
  { radius: 0.44, symmetry: 8,  petal: 0.11,  spread: 0.030, share: 0.17, color: PALETTE.cyan },
  { radius: 0.60, symmetry: 24, petal: 0.06,  spread: 0.024, share: 0.17, color: PALETTE.gold },
  { radius: 0.76, symmetry: 12, petal: 0.10,  spread: 0.032, share: 0.20, color: PALETTE.violet },
  { radius: 0.92, symmetry: 48, petal: 0.035, spread: 0.020, share: 0.13, color: PALETTE.bone },
];

const SPOKE_SHARE = 0.08;   // radial lines through everything
const WALL_SHARE = 0.06;    // the square palace wall around the outside
const WALL_HALF = 1.06;

const VERTEX_SHADER = /* glsl */ `
attribute float aOrder;   // 0..1, the order grains are laid down in
attribute vec3  aColor;
attribute vec3  aDrift;   // where the wind takes this grain

uniform float uProgress;
uniform float uDissolve;
uniform float uSize;

varying vec3  vColor;
varying float vAlpha;

void main() {
  if (aOrder > uProgress) {
    // Not laid down yet. A vertex shader cannot discard, so put it somewhere
    // the clipper will throw away.
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  vec3 displaced = position + aDrift * uDissolve * uDissolve * 2.4;
  vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);

  gl_PointSize = uSize * (6.0 / -viewPosition.z);
  gl_Position = projectionMatrix * viewPosition;

  vColor = aColor;
  // A grain just laid down glints before settling.
  float fresh = smoothstep(uProgress - 0.018, uProgress, aOrder);
  vAlpha = (1.0 - uDissolve) * (0.72 + fresh * 1.1);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision mediump float;
varying vec3  vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float falloff = 1.0 - smoothstep(0.18, 0.5, d);
  gl_FragColor = vec4(vColor, vAlpha * falloff);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const grains = params.grains || scale(9000, 18000);

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 46, position: [0, 0, 2.45] },
  });
  const pointer = createPointer(canvas);

  // ---- lay out every grain ------------------------------------------------
  // Built once into a plain array, then sorted by radius so the mandala grows
  // outward from the centre exactly the way a real one is made.
  const sand = [];
  const colorScratch = new THREE.Color();

  function push(x, y, colorHex) {
    colorScratch.setHex(colorHex);
    sand.push({
      x, y,
      z: (Math.random() - 0.5) * 0.012,
      r: Math.hypot(x, y),
      cr: colorScratch.r, cg: colorScratch.g, cb: colorScratch.b,
    });
  }

  for (const band of BANDS) {
    const count = Math.round(grains * band.share);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const radius =
        band.radius +
        band.petal * Math.sin(angle * band.symmetry) * 0.5 +
        (Math.random() - 0.5) * band.spread;
      push(Math.cos(angle) * radius, Math.sin(angle) * radius, band.color);
    }
  }

  const spokeCount = Math.round(grains * SPOKE_SHARE);
  for (let i = 0; i < spokeCount; i++) {
    const spoke = Math.floor(Math.random() * 24) / 24;
    const angle = spoke * TAU;
    const radius = 0.13 + Math.random() * 0.82;
    push(
      Math.cos(angle) * radius + (Math.random() - 0.5) * 0.008,
      Math.sin(angle) * radius + (Math.random() - 0.5) * 0.008,
      PALETTE.bone,
    );
  }

  const wallCount = Math.round(grains * WALL_SHARE);
  for (let i = 0; i < wallCount; i++) {
    // Walk the perimeter of a square: one random side, one random position.
    const along = (Math.random() * 2 - 1) * WALL_HALF;
    const jitter = (Math.random() - 0.5) * 0.014;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) push(along, WALL_HALF + jitter, PALETTE.gold);
    else if (side === 1) push(along, -WALL_HALF + jitter, PALETTE.gold);
    else if (side === 2) push(WALL_HALF + jitter, along, PALETTE.gold);
    else push(-WALL_HALF + jitter, along, PALETTE.gold);
  }

  sand.sort((a, b) => a.r - b.r);

  // ---- pour it into buffers ----------------------------------------------
  const total = sand.length;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const drift = new Float32Array(total * 3);
  const order = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const grain = sand[i];
    positions[i * 3 + 0] = grain.x;
    positions[i * 3 + 1] = grain.y;
    positions[i * 3 + 2] = grain.z;

    colors[i * 3 + 0] = grain.cr;
    colors[i * 3 + 1] = grain.cg;
    colors[i * 3 + 2] = grain.cb;

    // The wind: outward, upward, and a little sideways.
    const outward = Math.atan2(grain.y, grain.x);
    drift[i * 3 + 0] = Math.cos(outward) * (0.4 + Math.random() * 0.8) + (Math.random() - 0.5) * 0.5;
    drift[i * 3 + 1] = 0.5 + Math.random() * 1.5;
    drift[i * 3 + 2] = (Math.random() - 0.5) * 0.9;

    order[i] = i / (total - 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aDrift', new THREE.BufferAttribute(drift, 3));
  geometry.setAttribute('aOrder', new THREE.BufferAttribute(order, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);

  const uniforms = {
    uProgress: { value: 0 },
    uDissolve: { value: 0 },
    uSize: { value: 1.7 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const mandala = new THREE.Points(geometry, material);
  const table = new THREE.Group();
  table.add(mandala);
  stage.scene.add(table);

  // ---- keep it inside narrow screens -------------------------------------
  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 2.45 * Math.tan((46 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    table.scale.setScalar(Math.min(1, visibleWidth / (WALL_HALF * 2.15)));
  });

  // ---- the cycle ----------------------------------------------------------
  const PAUSE_SECONDS = 1.2;

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    const cycle =
      params.buildSeconds + params.holdSeconds + params.dissolveSeconds + PAUSE_SECONDS;
    const local = time % cycle;

    if (local < params.buildSeconds) {
      uniforms.uProgress.value = local / params.buildSeconds;
      uniforms.uDissolve.value = 0;
    } else if (local < params.buildSeconds + params.holdSeconds) {
      uniforms.uProgress.value = 1;
      uniforms.uDissolve.value = 0;
    } else if (local < cycle - PAUSE_SECONDS) {
      uniforms.uProgress.value = 1;
      const t = (local - params.buildSeconds - params.holdSeconds) / params.dissolveSeconds;
      uniforms.uDissolve.value = t;
    } else {
      uniforms.uProgress.value = 0;
      uniforms.uDissolve.value = 0;
    }

    // The wind that takes it also turns it.
    const gust = 1 + uniforms.uDissolve.value * 3;
    table.rotation.z += params.spin * gust * dt;
    table.rotation.x = pointer.y * 0.45;
    table.rotation.y = pointer.x * 0.45;
  });

  stage.onDispose(() => {
    pointer.dispose();
    geometry.dispose();
    material.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
