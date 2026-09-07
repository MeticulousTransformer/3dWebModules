/**
 * CHLADNI PLATE
 *
 * Sand on a vibrating plate. Particles jump around in proportion to how hard
 * the plate is moving under them, so they end up stranded on the nodal lines
 * where it is not moving at all. Nobody draws the pattern — it is what is left
 * over when everything that can move, has.
 *
 *   s(x, y) = cos(n pi x) cos(m pi y) - cos(m pi x) cos(n pi y)
 *
 * Change n and m and you change the note.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js ../lib/device.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { scale } from '../lib/device.js';
import { PALETTE } from '../lib/palette.js';

export const defaults = {
  count: 0,           // 0 = pick from the device
  plateSize: 3.6,
  holdSeconds: 5.5,   // how long one note is held
  morphSeconds: 1.8,  // how long it takes to slide to the next
  jitter: 0.0032,     // how far a particle hops per unit of plate movement
  minJitter: 0.00016, // brownian floor, so the pattern keeps breathing
};

/** The standing wave on a square plate clamped at the centre. x, y in 0..1. */
function chladni(x, y, n, m) {
  return (
    Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) -
    Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y)
  );
}

const VERTEX_SHADER = /* glsl */ `
attribute float aStillness;
uniform float uSize;
varying float vStillness;

void main() {
  vStillness = aStillness;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * (1.0 + vStillness) * (6.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision mediump float;
uniform vec3 uSettled;
uniform vec3 uMoving;
varying float vStillness;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float falloff = 1.0 - smoothstep(0.1, 0.5, d);
  vec3 color = mix(uMoving, uSettled, vStillness);
  gl_FragColor = vec4(color, falloff * (0.18 + vStillness * 0.82));
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const count = params.count || scale(9000, 18000);

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 42, position: [0, 3.4, 4.2], lookAt: [0, 0, 0], far: 40 },
  });
  const pointer = createPointer(canvas);

  // Particles live in plate space (0..1, 0..1) and are mapped out to the world
  // only when the buffer is written. Keeps the maths clean.
  const plateX = new Float32Array(count);
  const plateY = new Float32Array(count);
  const positions = new Float32Array(count * 3);
  const stillness = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    plateX[i] = Math.random();
    plateY[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aStillness', new THREE.BufferAttribute(stillness, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), params.plateSize);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: 1.5 },
      uSettled: { value: new THREE.Color(PALETTE.cyan) },
      uMoving: { value: new THREE.Color(PALETTE.gold) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const sand = new THREE.Points(geometry, material);
  stage.scene.add(sand);

  // ---- the plate itself ---------------------------------------------------
  const half = params.plateSize / 2;
  const frameGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-half, 0, -half),
    new THREE.Vector3(half, 0, -half),
    new THREE.Vector3(half, 0, half),
    new THREE.Vector3(-half, 0, half),
  ]);
  const frame = new THREE.LineLoop(frameGeometry, new THREE.LineBasicMaterial({
    color: PALETTE.smoke, transparent: true, opacity: 0.9,
  }));
  stage.scene.add(frame);

  // ---- which note is playing ----------------------------------------------
  const cycleLength = params.holdSeconds + params.morphSeconds;
  let fromNote = { n: 3, m: 5 };
  let toNote = { n: 5, m: 2 };
  let currentCycle = 0;

  function nextNote(previous) {
    // Two different integers, 1..8. Equal values give a blank plate.
    let n = 1 + Math.floor(Math.random() * 8);
    let m = 1 + Math.floor(Math.random() * 8);
    if (n === m) m = (m % 8) + 1;
    if (n === previous.n && m === previous.m) n = (n % 8) + 1;
    return { n, m };
  }

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    const cycle = Math.floor(time / cycleLength);
    if (cycle !== currentCycle) {
      currentCycle = cycle;
      fromNote = toNote;
      toNote = nextNote(fromNote);
    }

    // Hold, then slide smoothly to the next note.
    const local = time % cycleLength;
    const morph = local <= params.holdSeconds
      ? 0
      : smoothstep((local - params.holdSeconds) / params.morphSeconds);

    const n = fromNote.n + (toNote.n - fromNote.n) * morph;
    const m = fromNote.m + (toNote.m - fromNote.m) * morph;

    // Touching the plate drives it harder, so the sand scatters and re-settles.
    const drive = 1 + (pointer.active ? 2.5 * (0.4 + Math.abs(pointer.x)) : 0);
    const wave = Math.sin(time * 7.0) * 0.06;

    for (let i = 0; i < count; i++) {
      const value = chladni(plateX[i], plateY[i], n, m);
      const amplitude = Math.abs(value);

      // Big amplitude means the plate is throwing this grain around.
      const hop = (params.minJitter + amplitude * params.jitter) * drive;
      plateX[i] = clamp01(plateX[i] + (Math.random() - 0.5) * hop * 60);
      plateY[i] = clamp01(plateY[i] + (Math.random() - 0.5) * hop * 60);

      positions[i * 3 + 0] = (plateX[i] - 0.5) * params.plateSize;
      positions[i * 3 + 1] = value * wave;
      positions[i * 3 + 2] = (plateY[i] - 0.5) * params.plateSize;

      stillness[i] = 1 - Math.min(1, amplitude * 1.6);
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aStillness.needsUpdate = true;

    const swing = Math.sin(time * 0.11) * 0.35 + pointer.x * 0.5;
    sand.rotation.y = swing;
    frame.rotation.y = swing;
  });

  stage.onDispose(() => {
    pointer.dispose();
    geometry.dispose();
    material.dispose();
    frameGeometry.dispose();
  });

  return stage.start();
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(t) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}
