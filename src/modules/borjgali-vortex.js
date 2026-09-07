/**
 * BORJGALI VORTEX
 *
 * The borjgali (ბორჯღალი) is the old Georgian solar sign: seven arms turning
 * around a still centre, one for each visible celestial body. Here it is cast
 * in gold and repeated into depth, so the sun wheel becomes a tunnel.
 *
 * Standalone. Needs: three, ../lib/stage.js, ../lib/pointer.js, ../lib/textures.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createGradientEnvironment, createRadialGlowTexture } from '../lib/textures.js';
import { PALETTE } from '../lib/palette.js';

export const defaults = {
  arms: 7,        // seven, always seven
  layers: 4,      // copies receding into the dark
  spin: 0.42,     // radians per second, the front wheel
  tilt: 0.30,     // how far the pointer can lean the whole thing
};

/**
 * One arm, drawn in polar coordinates as a lens shape: pinched at the hub,
 * pinched at the tip, fat in the middle, and swept sideways so it looks like
 * it is being dragged around by the rotation.
 */
function createArmShape({ innerRadius = 0.22, outerRadius = 1, sweep = 1.5, fatness = 0.34, segments = 44 }) {
  const pointAt = (t, side) => {
    const radius = innerRadius + (outerRadius - innerRadius) * Math.pow(t, 0.78);
    const angle = sweep * t + side * Math.sin(Math.PI * t) * fatness;
    return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
  };

  const shape = new THREE.Shape();
  const start = pointAt(0, -1);
  shape.moveTo(start.x, start.y);
  for (let i = 1; i <= segments; i++) {
    const p = pointAt(i / segments, -1);
    shape.lineTo(p.x, p.y);
  }
  for (let i = segments; i >= 0; i--) {
    const p = pointAt(i / segments, 1);
    shape.lineTo(p.x, p.y);
  }
  shape.closePath();
  return shape;
}

/** A whole wheel: `arms` copies of the arm geometry, evenly spaced. */
function createWheel(geometry, material, arms) {
  const wheel = new THREE.Group();
  for (let i = 0; i < arms; i++) {
    const arm = new THREE.Mesh(geometry, material);
    arm.rotation.z = (i / arms) * Math.PI * 2;
    wheel.add(arm);
  }
  return wheel;
}

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 46, position: [0, 0, 4.0], far: 60 },
  });
  const pointer = createPointer(canvas);

  stage.scene.fog = new THREE.FogExp2(PALETTE.void, 0.09);
  const environment = createGradientEnvironment();
  stage.scene.environment = environment;

  // ---- the arm, once. Every wheel reuses this geometry. --------------------
  const armGeometry = new THREE.ExtrudeGeometry(createArmShape({}), {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 3,
  });
  armGeometry.translate(0, 0, -0.045);

  // Front wheel is gold, the ones behind cool towards wine red and violet.
  const layerColors = [PALETTE.gold, 0xff8a3d, PALETTE.vermilion, PALETTE.violet];

  const wheels = [];
  const materials = [];

  for (let layer = 0; layer < params.layers; layer++) {
    const depth = layer / Math.max(1, params.layers - 1);

    const material = new THREE.MeshStandardMaterial({
      color: layerColors[layer % layerColors.length],
      metalness: 0.92,
      roughness: 0.22 + depth * 0.2,
      emissive: layerColors[layer % layerColors.length],
      emissiveIntensity: 0.1 + depth * 0.25,
    });
    materials.push(material);

    const wheel = createWheel(armGeometry, material, params.arms);
    wheel.position.z = -layer * 1.35;
    wheel.scale.setScalar(1 - depth * 0.28);
    wheel.rotation.z = layer * 0.4;
    // Alternate direction so the layers shear against each other.
    wheel.userData.speed = params.spin * (layer % 2 === 0 ? 1 : -0.62) * (1 - depth * 0.35);

    wheels.push(wheel);
    stage.scene.add(wheel);
  }

  // ---- hub ----------------------------------------------------------------
  const hubGeometry = new THREE.SphereGeometry(0.17, 32, 24);
  const hubMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b0d12,
    metalness: 1,
    roughness: 0.12,
  });
  const hub = new THREE.Mesh(hubGeometry, hubMaterial);
  stage.scene.add(hub);

  const ringGeometry = new THREE.TorusGeometry(1.22, 0.012, 8, 160);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.5 });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  stage.scene.add(ring);

  // ---- glow behind the wheel ----------------------------------------------
  const glowTexture = createRadialGlowTexture({ color: '#ff9a2e', softness: 2.6 });
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.55,
  });
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.setScalar(6);
  glow.position.z = -1.2;
  stage.scene.add(glow);

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x2a3550, 1.1));

  const keyLight = new THREE.DirectionalLight(0xffd9a0, 2.6);
  keyLight.position.set(3, 4, 5);
  stage.scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(PALETTE.cyan, 1.3);
  rimLight.position.set(-4, -2, 2);
  stage.scene.add(rimLight);

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    for (const wheel of wheels) {
      wheel.rotation.z += wheel.userData.speed * dt;
      wheel.rotation.x = pointer.y * params.tilt;
      wheel.rotation.y = pointer.x * params.tilt;
    }

    ring.rotation.z -= params.spin * 0.25 * dt;
    ring.rotation.x = pointer.y * params.tilt;
    ring.rotation.y = pointer.x * params.tilt;

    hub.rotation.y += dt * 0.8;
    glow.material.opacity = 0.45 + Math.sin(time * 0.9) * 0.12;

    // A slow breath in and out, so it never looks like a looping gif.
    const breath = 1 + Math.sin(time * 0.55) * 0.03;
    stage.camera.position.z = 4.0 / breath;
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    glowTexture.dispose();
    armGeometry.dispose();
    for (const material of materials) material.dispose();
  });

  return stage.start();
}
