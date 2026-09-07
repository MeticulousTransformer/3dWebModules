/**
 * OUROBOROS
 *
 * The serpent that eats its own tail, and keeps moving while it does it.
 *
 * three.js gives you TubeGeometry, but a tube of constant radius cannot be a
 * snake — a snake is thick at the head and thin at the tail. So this builds
 * the tube by hand: walk the spine, carry a frame along it, and ring vertices
 * around each step at whatever radius that step should be.
 *
 * The frame is carried by parallel transport rather than taken from the
 * Frenet formulas, because a Frenet frame flips over at every inflection
 * point and the scales would tear.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/textures.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createGradientEnvironment, createRadialGlowTexture } from '../lib/textures.js';
import { PALETTE, CSS_PALETTE } from '../lib/palette.js';

export const defaults = {
  thickness: 0.115,   // radius at the thickest part of the body
  undulation: 0.16,   // how far the travelling wave lifts the body
  waves: 3,           // how many waves fit around the ring
  glide: 0.55,        // how fast the wave travels
  spin: 0.13,
};

const SPINE_STEPS = 190;
const RING_STEPS = 14;
const RING_RADIUS = 1.05;
const GAP = 0.055;         // the bite: the spine stops short of closing

/** Where the spine is at t (0..1 along the body, 0 = head). */
function spineAt(t, time, params, out) {
  const angle = (GAP + t * (1 - GAP)) * Math.PI * 2;
  const wave = Math.sin(t * Math.PI * 2 * params.waves - time * params.glide);
  const radius = RING_RADIUS + wave * params.undulation * 0.45;
  return out.set(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
    wave * params.undulation,
  );
}

/** How thick the body is at t. Fat behind the head, tapering to a point. */
function radiusAt(t, thickness) {
  const taper = Math.pow(1 - t, 0.75);
  const neck = 1 + 0.35 * Math.exp(-Math.pow((t - 0.09) * 9, 2));
  return thickness * (0.10 + 0.90 * taper) * neck;
}

/** A repeating pattern of scales, drawn once onto a canvas. */
function createScaleTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  context.fillStyle = '#241a12';
  context.fillRect(0, 0, size, size);

  const rows = 16;
  const columns = 16;
  const cellWidth = size / columns;
  const cellHeight = size / rows;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const x = column * cellWidth + (row % 2 ? cellWidth / 2 : 0);
      const y = row * cellHeight + cellHeight / 2;

      const shade = 0.55 + Math.random() * 0.45;
      context.fillStyle = `rgba(${Math.round(190 * shade)},${Math.round(140 * shade)},${Math.round(60 * shade)},1)`;
      context.beginPath();
      context.ellipse(x, y, cellWidth * 0.46, cellHeight * 0.60, 0, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = 'rgba(20,14,8,0.8)';
      context.lineWidth = 1.2;
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(34, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 44, position: [0, 0, 4.0] },
  });
  const pointer = createPointer(canvas);

  const environment = createGradientEnvironment({
    top: '#1c1830', middle: '#07080c', bottom: '#2e1a06', sun: '#ffe0b0',
  });
  stage.scene.environment = environment;

  const serpent = new THREE.Group();
  stage.scene.add(serpent);

  // ---- the body -----------------------------------------------------------
  const vertexCount = (SPINE_STEPS + 1) * (RING_STEPS + 1);
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = [];

  for (let step = 0; step < SPINE_STEPS; step++) {
    for (let ring = 0; ring < RING_STEPS; ring++) {
      const a = step * (RING_STEPS + 1) + ring;
      const b = a + RING_STEPS + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  for (let step = 0; step <= SPINE_STEPS; step++) {
    for (let ring = 0; ring <= RING_STEPS; ring++) {
      const i = step * (RING_STEPS + 1) + ring;
      uvs[i * 2 + 0] = step / SPINE_STEPS;
      uvs[i * 2 + 1] = ring / RING_STEPS;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.5);

  // Scratch vectors, reused every frame so the loop allocates nothing.
  const here = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const previousTangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const headPosition = new THREE.Vector3();
  const headTangent = new THREE.Vector3();

  /** Rebuild every vertex. Called once per frame — the snake is alive. */
  function shapeBody(time) {
    spineAt(0, time, params, here);
    spineAt(1 / SPINE_STEPS, time, params, ahead);
    previousTangent.subVectors(ahead, here).normalize();

    headPosition.copy(here);
    headTangent.copy(previousTangent);

    // Any vector not parallel to the tangent will do to start the frame off.
    normal.set(0, 0, 1).cross(previousTangent).normalize();
    if (normal.lengthSq() < 0.01) normal.set(1, 0, 0);
    binormal.crossVectors(previousTangent, normal);

    for (let step = 0; step <= SPINE_STEPS; step++) {
      const t = step / SPINE_STEPS;

      spineAt(t, time, params, here);
      spineAt(Math.min(1, t + 1 / SPINE_STEPS), time, params, ahead);
      tangent.subVectors(ahead, here).normalize();

      // Parallel transport: turn the frame by exactly the rotation that turns
      // the last tangent into this one, and no more. No twist creeps in.
      rotation.setFromUnitVectors(previousTangent, tangent);
      normal.applyQuaternion(rotation).normalize();
      binormal.crossVectors(tangent, normal);
      previousTangent.copy(tangent);

      const radius = radiusAt(t, params.thickness);

      for (let ring = 0; ring <= RING_STEPS; ring++) {
        const angle = (ring / RING_STEPS) * Math.PI * 2;
        const cos = Math.cos(angle) * radius;
        const sin = Math.sin(angle) * radius;
        const i = (step * (RING_STEPS + 1) + ring) * 3;

        positions[i + 0] = here.x + normal.x * cos + binormal.x * sin;
        positions[i + 1] = here.y + normal.y * cos + binormal.y * sin;
        positions[i + 2] = here.z + normal.z * cos + binormal.z * sin;
      }
    }

    geometry.attributes.position.needsUpdate = true;
  }

  const scaleTexture = createScaleTexture();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    map: scaleTexture,
    color: 0xd8b070,
    metalness: 0.48,
    roughness: 0.44,
    flatShading: true, // the GPU derives the normals, so a moving surface still lights right
    side: THREE.DoubleSide,
  });

  const body = new THREE.Mesh(geometry, bodyMaterial);
  serpent.add(body);

  // ---- the head -----------------------------------------------------------
  const head = new THREE.Group();
  serpent.add(head);

  const skullGeometry = new THREE.SphereGeometry(1, 20, 14);
  const skull = new THREE.Mesh(skullGeometry, bodyMaterial);
  skull.scale.set(params.thickness * 2.1, params.thickness * 1.75, params.thickness * 3.0);
  head.add(skull);

  const jaw = new THREE.Mesh(skullGeometry, bodyMaterial);
  jaw.scale.set(params.thickness * 1.9, params.thickness * 0.75, params.thickness * 2.7);
  jaw.position.set(0, -params.thickness * 1.05, params.thickness * 0.7);
  jaw.rotation.x = -0.30;
  head.add(jaw);

  const eyeGeometry = new THREE.SphereGeometry(params.thickness * 0.42, 12, 10);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.gold });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(side * params.thickness * 1.30, params.thickness * 0.85, params.thickness * 0.9);
    head.add(eye);
  }

  // ---- glow ---------------------------------------------------------------
  const glowTexture = createRadialGlowTexture({ color: CSS_PALETTE.gold, softness: 3.2 });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, opacity: 0.18,
  }));
  glow.scale.setScalar(2.4);
  glow.position.z = -1.8;
  stage.scene.add(glow);

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x22283a, 1.1));

  const key = new THREE.DirectionalLight(0xffe2b0, 2.6);
  key.position.set(2, 3, 4);
  stage.scene.add(key);

  const rim = new THREE.DirectionalLight(PALETTE.violet, 1.6);
  rim.position.set(-3, -1, -2);
  stage.scene.add(rim);

  // ---- keep it inside narrow screens -------------------------------------
  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 4.0 * Math.tan((44 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    serpent.scale.setScalar(Math.min(1, visibleWidth / 2.9));
  });

  // ---- animation ----------------------------------------------------------
  const lookTarget = new THREE.Vector3();

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    shapeBody(time);

    head.position.copy(headPosition);
    lookTarget.copy(headPosition).sub(headTangent); // face back along the body, at the tail
    head.lookAt(lookTarget);

    serpent.rotation.z += params.spin * dt;
    serpent.rotation.x = pointer.y * 0.5;
    serpent.rotation.y = pointer.x * 0.5;

    glow.material.opacity = 0.14 + Math.sin(time * 1.2) * 0.05;
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    glowTexture.dispose();
    scaleTexture.dispose();
    geometry.dispose();
    bodyMaterial.dispose();
    skullGeometry.dispose();
    eyeGeometry.dispose();
    eyeMaterial.dispose();
  });

  stage.setParam = createParamSetter(params, {
    thickness: (value) => {
      skull.scale.set(value * 2.1, value * 1.75, value * 3.0);
      jaw.scale.set(value * 1.9, value * 0.75, value * 2.7);
      jaw.position.set(0, -value * 1.05, value * 0.7);
    },
  });

  return stage.start();
}
