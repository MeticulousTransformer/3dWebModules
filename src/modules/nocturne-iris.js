/**
 * NOCTURNE IRIS
 * A cinema lens recast as a ceremonial instrument: overlapping steel leaves,
 * machined brass, and a coated optical element inside the aperture.
 * Blade motion is a designed radial mechanism, not a lens engineering model.
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { scale } from '../lib/device.js';
import { lightInstrument, frameInstrument, instrumentParams, instrumentOptions } from '../lib/instrument-studio.js';

export const defaults = { aperture: 0.52, breath: 0.12, speed: 0.3, blades: 10 };
const limits = { aperture: [0.12, 0.95], breath: [0, 0.22], speed: [0, 1.2], blades: [7, 14] };
const TAU = Math.PI * 2;

/** Parameterized leaves stay inside the barrel across the entire aperture range. */
export function irisBladeGeometry() {
  const geometry = new THREE.PlaneGeometry(1, 1, 28, 8);
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.9);
  return geometry;
}

export function shapeIrisBlade(geometry, opening, bladeCount) {
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const inner = 0.16 + opening * 0.98;
  for (let i = 0; i < positions.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    const radius = THREE.MathUtils.lerp(inner, 1.87, u);
    const angle = v * TAU / bladeCount * 1.16 + Math.pow(1 - u, 1.6) * 0.7;
    positions.setXYZ(i, Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }
  positions.needsUpdate = true;
}

export default function create(canvas, options = {}) {
  const params = instrumentOptions(defaults, options, limits);
  params.blades = Math.round(params.blades);
  const stage = createStage(canvas, { clearColor: 0x060709, maxPixelRatio: 1.75, camera: { fov: 38 } });
  const pointer = createPointer(canvas, { tilt: false });
  lightInstrument(stage, { warmth: '#eee2c9', rim: 0x9aaacb });
  frameInstrument(stage, 2.65, [0.04, 0.1, 1]);

  const lens = new THREE.Group();
  stage.scene.add(lens);
  const brass = new THREE.MeshStandardMaterial({ color: 0xb89b67, metalness: 1, roughness: 0.28 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x252a30, metalness: 0.95, roughness: 0.32 });
  const grooves = new THREE.MeshStandardMaterial({ color: 0x070a0f, metalness: 0.8, roughness: 0.35 });

  function torus(radius, thickness, z, material = brass) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 12, scale(100, 180)), material);
    ring.position.z = z;
    lens.add(ring);
    return ring;
  }

  // A solid annulus hides the blade roots and gives the mechanism a real edge.
  const bezelShape = new THREE.Shape();
  bezelShape.absarc(0, 0, 2.28, 0, TAU, false);
  const opening = new THREE.Path();
  opening.absarc(0, 0, 1.68, 0, TAU, true);
  bezelShape.holes.push(opening);
  const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(bezelShape, {
    depth: 0.2, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025,
    bevelSegments: 2, curveSegments: 96,
  }), iron);
  bezel.position.z = 0.19;
  lens.add(bezel);
  torus(1.69, 0.025, 0.44);
  torus(2.25, 0.018, 0.44);
  torus(2.34, 0.06, 0.16, grooves);
  torus(2.36, 0.022, 0.26);
  torus(2.31, 0.08, -0.22, iron);

  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), brass, 144);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 144; i++) {
    const a = i / 144 * TAU;
    const major = i % 12 === 0;
    dummy.position.set(Math.cos(a) * 2.09, Math.sin(a) * 2.09, 0.426);
    dummy.rotation.z = a;
    dummy.scale.set(major ? 0.18 : 0.065, major ? 0.014 : 0.008, 0.005);
    dummy.updateMatrix();
    ticks.setMatrixAt(i, dummy.matrix);
  }
  ticks.instanceMatrix.needsUpdate = true;
  lens.add(ticks);

  const bladeGeometry = irisBladeGeometry();
  shapeIrisBlade(bladeGeometry, params.aperture, params.blades);
  for (let i = 0; i < params.blades; i++) {
    const leaf = new THREE.Mesh(bladeGeometry, new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.6, 0.07, 0.16 + i % 3 * 0.025),
      metalness: 0.96, roughness: 0.23 + (i % 2) * 0.08, side: THREE.DoubleSide,
    }));
    leaf.rotation.z = i / params.blades * TAU;
    // Separate planes avoid z-fighting where adjacent leaves overlap.
    leaf.position.z = -0.02 + i * 0.014;
    lens.add(leaf);
  }

  const glass = new THREE.Mesh(new THREE.SphereGeometry(1.59, 64, 40), new THREE.MeshPhysicalMaterial({
    color: 0x172534, metalness: 0.75, roughness: 0.085,
    clearcoat: 1, clearcoatRoughness: 0.04,
    iridescence: 0.9, iridescenceIOR: 1.5, iridescenceThicknessRange: [180, 510],
  }));
  glass.scale.z = 0.15;
  glass.position.z = -0.48;
  lens.add(glass);
  torus(1.47, 0.015, -0.39, new THREE.MeshBasicMaterial({ color: 0x6e798c }));

  let clock = 0;
  stage.onFrame(({ dt }) => {
    pointer.update(dt);
    clock += dt * params.speed;
    const opening = THREE.MathUtils.clamp(params.aperture + Math.sin(clock * TAU * 0.35) * params.breath, 0.12, 0.95);
    shapeIrisBlade(bladeGeometry, opening, params.blades);
    lens.rotation.x = 0.12 + pointer.y * 0.3;
    lens.rotation.y = -0.16 + pointer.x * 0.4;
    lens.rotation.z = Math.sin(clock * 0.24) * 0.06;
  });
  stage.onDispose(() => pointer.dispose());
  stage.setParam = instrumentParams(stage, params, limits);
  return stage.start();
}
