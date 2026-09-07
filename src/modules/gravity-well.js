/**
 * GRAVITY WELL
 *
 * Real physics, no fakery: every particle is integrated against every attractor
 * with softened Newtonian gravity and a symplectic Euler step, which is the
 * cheapest integrator that keeps orbits stable instead of spiralling apart.
 *
 * Your finger is the fourth attractor.
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
  count: 0,          // 0 = pick from the device
  gravity: 2.4,
  softening: 0.30,   // stops the force going to infinity at zero distance
  drag: 0.05,        // a whisper of friction, so nothing escapes forever
  bounds: 7,
  slowColor: PALETTE.violet,
  fastColor: PALETTE.cyan,
};

const VERTEX_SHADER = /* glsl */ `
attribute float aSpeed;
uniform float uSize;
varying float vSpeed;

void main() {
  vSpeed = aSpeed;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * (8.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision mediump float;
uniform vec3 uSlow;
uniform vec3 uFast;
varying float vSpeed;

void main() {
  // Round the square point sprite into a soft dot.
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float falloff = 1.0 - smoothstep(0.15, 0.5, d);

  vec3 color = mix(uSlow, uFast, clamp(vSpeed, 0.0, 1.0));
  gl_FragColor = vec4(color, falloff * (0.45 + vSpeed * 0.55));
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const count = params.count || scale(2600, 7000);

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 50, position: [0, 2.6, 7.2], lookAt: [0, 0, 0], far: 80 },
  });
  const pointer = createPointer(canvas);

  // ---- particle state, in flat typed arrays -------------------------------
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  /** Drop a particle onto a random orbit around the centre. */
  function seed(index) {
    const radius = 1.2 + Math.random() * 3.4;
    const angle = Math.random() * Math.PI * 2;
    const height = (Math.random() - 0.5) * 0.7;

    positions[index * 3 + 0] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = height;
    positions[index * 3 + 2] = Math.sin(angle) * radius;

    // Tangential velocity, roughly circular-orbit speed. This is what makes
    // the cloud settle into a disc instead of collapsing to a dot.
    const orbital = Math.sqrt(params.gravity * 2.2 / radius);
    velocities[index * 3 + 0] = -Math.sin(angle) * orbital;
    velocities[index * 3 + 1] = (Math.random() - 0.5) * 0.15;
    velocities[index * 3 + 2] = Math.cos(angle) * orbital;
  }

  for (let i = 0; i < count; i++) seed(i);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), params.bounds * 2);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: 2.9 },
      uSlow: { value: new THREE.Color(params.slowColor) },
      uFast: { value: new THREE.Color(params.fastColor) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const cloud = new THREE.Points(geometry, material);
  stage.scene.add(cloud);

  // ---- the attractors -----------------------------------------------------
  // Three on fixed Lissajous paths, plus one that follows the pointer.
  const attractors = [
    { x: 0, y: 0, z: 0, mass: 2.6, orbit: null },
    { x: 0, y: 0, z: 0, mass: 1.1, orbit: { radius: 2.4, speedA: 0.31, speedB: 0.47, phase: 0 } },
    { x: 0, y: 0, z: 0, mass: 1.1, orbit: { radius: 2.9, speedA: -0.23, speedB: 0.37, phase: 2.1 } },
    { x: 0, y: 0, z: 0, mass: 0, orbit: null }, // the pointer, mass added on touch
  ];
  const pointerAttractor = attractors[3];

  const markerGeometry = new THREE.SphereGeometry(0.06, 12, 10);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.bone, transparent: true, opacity: 0.6 });
  const markers = attractors.slice(0, 3).map(() => {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    stage.scene.add(marker);
    return marker;
  });

  // ---- the step -----------------------------------------------------------
  function step(dt) {
    const gravity = params.gravity;
    const softening = params.softening;
    const dragFactor = 1 - params.drag * dt;
    const escapeDistance = params.bounds * params.bounds * 2.6;

    for (let i = 0; i < count; i++) {
      const px = positions[i * 3 + 0];
      const py = positions[i * 3 + 1];
      const pz = positions[i * 3 + 2];

      let ax = 0, ay = 0, az = 0;

      for (const attractor of attractors) {
        if (attractor.mass <= 0) continue;
        const dx = attractor.x - px;
        const dy = attractor.y - py;
        const dz = attractor.z - pz;

        // Softened inverse-square: mass / (r^2 + eps)^1.5, times the direction.
        const distanceSquared = dx * dx + dy * dy + dz * dz + softening;
        const pull = attractor.mass / (distanceSquared * Math.sqrt(distanceSquared));

        ax += dx * pull;
        ay += dy * pull;
        az += dz * pull;
      }

      // Symplectic Euler: velocity first, then position with the new velocity.
      let vx = (velocities[i * 3 + 0] + ax * gravity * dt) * dragFactor;
      let vy = (velocities[i * 3 + 1] + ay * gravity * dt) * dragFactor;
      let vz = (velocities[i * 3 + 2] + az * gravity * dt) * dragFactor;

      velocities[i * 3 + 0] = vx;
      velocities[i * 3 + 1] = vy;
      velocities[i * 3 + 2] = vz;

      positions[i * 3 + 0] = px + vx * dt;
      positions[i * 3 + 1] = py + vy * dt;
      positions[i * 3 + 2] = pz + vz * dt;

      speeds[i] = Math.min(1, Math.sqrt(vx * vx + vy * vy + vz * vz) / 4.5);

      // Anything thrown clear of the system comes back as a new particle.
      const distance = positions[i * 3] ** 2 + positions[i * 3 + 1] ** 2 + positions[i * 3 + 2] ** 2;
      if (distance > escapeDistance) seed(i);
    }
  }

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    for (let i = 0; i < 3; i++) {
      const attractor = attractors[i];
      if (attractor.orbit) {
        const { radius, speedA, speedB, phase } = attractor.orbit;
        attractor.x = Math.sin(time * speedA + phase) * radius;
        attractor.y = Math.sin(time * speedB * 1.3 + phase) * radius * 0.35;
        attractor.z = Math.cos(time * speedB + phase) * radius;
      }
      markers[i].position.set(attractor.x, attractor.y, attractor.z);
    }

    // Touch the canvas and you become a mass.
    pointerAttractor.x = pointer.x * 4.5;
    pointerAttractor.y = pointer.y * 2.6;
    pointerAttractor.z = 0;
    pointerAttractor.mass = pointer.down ? 4.5 : pointer.active ? 1.2 : 0;

    // Clamp the timestep: a long stall must not blow the integrator up.
    step(Math.min(dt, 1 / 40));

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aSpeed.needsUpdate = true;

    cloud.rotation.y = time * 0.03;
  });

  stage.onDispose(() => {
    pointer.dispose();
    geometry.dispose();
    material.dispose();
    markerGeometry.dispose();
    markerMaterial.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
