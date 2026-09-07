/**
 * ENSO / VOID
 *
 * The zen circle, painted in one breath and left open. The stroke is a ribbon
 * of triangles whose width follows a brush pressure curve, revealed left to
 * right, held, then let go — and drawn again slightly differently every time,
 * because it is never the same circle twice.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/glsl.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { GLSL_HASH } from '../lib/glsl.js';
import { PALETTE } from '../lib/palette.js';
import { createParamSetter } from '../lib/params.js';

export const defaults = {
  radius: 1.12,
  brushWidth: 0.24,
  drawSeconds: 3.2,
  holdSeconds: 3.4,
  fadeSeconds: 1.4,
  inkColor: PALETTE.bone,
};

const SAMPLES = 360;

/** Layered sines. Not real noise, but deterministic, cheap and organic enough. */
function wobble(t, seed, frequency, amplitude) {
  return (
    Math.sin(t * frequency + seed) * amplitude +
    Math.sin(t * frequency * 2.7 + seed * 1.7) * amplitude * 0.45 +
    Math.sin(t * frequency * 5.3 + seed * 2.9) * amplitude * 0.2
  );
}

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform vec3  uColor;
uniform float uProgress;  // how much of the stroke has been painted, 0..1
uniform float uOpacity;

${GLSL_HASH}

void main() {
  // Nothing is painted past the brush head.
  if (vUv.x > uProgress) discard;

  // Soft edges across the stroke, hard-ish in the middle: wet ink on paper.
  float across = abs(vUv.y * 2.0 - 1.0);
  float body = 1.0 - smoothstep(0.55, 1.0, across);

  // Dry brush: streaks along the stroke that thin out towards the tail.
  float streak = hash21(vec2(floor(vUv.y * 22.0), floor(vUv.x * 900.0) * 0.13));
  float dryness = smoothstep(0.25, 1.0, vUv.x) * 0.55;
  body *= 1.0 - dryness * step(streak, 0.42);

  // The head of the brush is wetter and darker.
  float head = smoothstep(uProgress - 0.03, uProgress, vUv.x);
  vec3 color = uColor * (1.0 + head * 0.6);

  gl_FragColor = vec4(color, body * uOpacity);
  if (gl_FragColor.a < 0.01) discard;
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 46, position: [0, 0, 3.4] },
  });

  // ---- the ribbon ---------------------------------------------------------
  // Two vertices per sample (one either side of the path). Allocated once and
  // rewritten in place every time the circle is redrawn.
  const positions = new Float32Array(SAMPLES * 2 * 3);
  const uvs = new Float32Array(SAMPLES * 2 * 2);
  const indices = [];

  for (let i = 0; i < SAMPLES - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    uvs[i * 4 + 0] = t; uvs[i * 4 + 1] = 0;
    uvs[i * 4 + 2] = t; uvs[i * 4 + 3] = 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  /** Rewrite the stroke with a new hand. */
  function paint(seed) {
    const sweep = Math.PI * 2 * (0.90 + (seed % 1) * 0.06); // an open circle
    const start = -Math.PI * 0.42 + wobble(seed, seed, 1, 0.3);
    const driftX = wobble(seed, seed * 3.1, 1, 0.05);
    const driftY = wobble(seed, seed * 5.7, 1, 0.05);

    for (let i = 0; i < SAMPLES; i++) {
      const t = i / (SAMPLES - 1);
      const angle = start + sweep * t;

      const radius = params.radius * (1 + wobble(t * 6.283, seed, 1.6, 0.035));
      const x = Math.cos(angle) * radius + driftX;
      const y = Math.sin(angle) * radius + driftY;

      // Brush pressure: light at the start, heaviest a third of the way in,
      // trailing off to nothing at the end.
      const pressure =
        Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.06)), 0.42) *
        (1 + wobble(t * 6.283, seed * 2.2, 4.5, 0.22)) *
        (0.72 + 0.5 * Math.exp(-Math.pow((t - 0.3) * 3.2, 2)));
      const halfWidth = params.brushWidth * 0.5 * Math.max(0.04, pressure);

      // Perpendicular to the path, in the plane of the paper.
      const normalX = -Math.sin(angle);
      const normalY = Math.cos(angle);

      const o = i * 6;
      positions[o + 0] = x - normalX * halfWidth;
      positions[o + 1] = y - normalY * halfWidth;
      positions[o + 2] = 0;
      positions[o + 3] = x + normalX * halfWidth;
      positions[o + 4] = y + normalY * halfWidth;
      positions[o + 5] = 0;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeBoundingSphere();
  }

  const uniforms = {
    uColor: { value: new THREE.Color(params.inkColor) },
    uProgress: { value: 0 },
    uOpacity: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const stroke = new THREE.Mesh(geometry, material);
  const paper = new THREE.Group();
  paper.add(stroke);
  stage.scene.add(paper);

  // ---- the seal, stamped once the circle is finished ----------------------
  const sealShape = new THREE.Shape();
  sealShape.moveTo(-0.09, -0.09);
  sealShape.lineTo(0.09, -0.09);
  sealShape.lineTo(0.09, 0.09);
  sealShape.lineTo(-0.09, 0.09);
  sealShape.closePath();

  const sealGeometry = new THREE.BufferGeometry().setFromPoints(sealShape.getPoints());
  const sealMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.vermilion, transparent: true, opacity: 0,
  });
  const seal = new THREE.LineLoop(sealGeometry, sealMaterial);
  seal.position.set(0.86, -0.86, 0);
  paper.add(seal);

  // ---- dust in the air ----------------------------------------------------
  const dustCount = 90;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3 + 0] = (Math.random() - 0.5) * 5;
    dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 4;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 2 - 0.6;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    color: PALETTE.bone, size: 0.012, transparent: true, opacity: 0.35, depthWrite: false,
  }));
  stage.scene.add(dust);

  // ---- keep the circle inside narrow phone screens ------------------------
  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 3.4 * Math.tan((46 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    const needed = (params.radius + params.brushWidth) * 2.35;
    paper.scale.setScalar(Math.min(1, visibleWidth / needed));
  });

  // ---- the breath cycle ---------------------------------------------------
  let cycle = -1;

  paint(1.234);

  stage.onFrame(({ time, dt }) => {
    // Read every frame, so the timings can be tuned live.
    const cycleLength = params.drawSeconds + params.holdSeconds + params.fadeSeconds;
    const currentCycle = Math.floor(time / cycleLength);
    if (currentCycle !== cycle) {
      cycle = currentCycle;
      paint(currentCycle * 3.77 + 1.234); // a new hand each time round
    }

    const local = time % cycleLength;

    if (local < params.drawSeconds) {
      // Ease out: the brush starts fast and settles.
      const t = local / params.drawSeconds;
      uniforms.uProgress.value = 1 - Math.pow(1 - t, 2.2);
      uniforms.uOpacity.value = 1;
      sealMaterial.opacity = 0;
    } else if (local < params.drawSeconds + params.holdSeconds) {
      uniforms.uProgress.value = 1;
      uniforms.uOpacity.value = 1;
      const held = (local - params.drawSeconds) / params.holdSeconds;
      sealMaterial.opacity = Math.min(0.85, held * 3);
    } else {
      const t = (local - params.drawSeconds - params.holdSeconds) / params.fadeSeconds;
      uniforms.uOpacity.value = 1 - t;
      sealMaterial.opacity = 0.85 * (1 - t);
    }

    dust.rotation.z += dt * 0.02;
    paper.rotation.z = Math.sin(time * 0.2) * 0.01;
  });

  stage.onDispose(() => {
    geometry.dispose();
    material.dispose();
    sealGeometry.dispose();
    sealMaterial.dispose();
    dustGeometry.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
