/**
 * SIDEREAL ENGINE
 * A brass armillary instrument around a small, dark sun.
 * The orbits solve Kepler's equation; sizes and periods are an artistic scale,
 * not an ephemeris. One file, one canvas, no model or image downloads.
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { scale } from '../lib/device.js';
import { lightInstrument, frameInstrument, instrumentParams, instrumentOptions } from '../lib/instrument-studio.js';

export const defaults = { speed: 0.3, obliquity: 23.4, eccentricity: 0.2, orbitCount: 5 };
const limits = { speed: [0, 1.5], obliquity: [0, 60], eccentricity: [0, 0.55], orbitCount: [3, 7] };
const TAU = Math.PI * 2;

/** Newton's method for M = E - e sin(E), bounded to our elliptical regime. */
export function eccentricAnomaly(mean, eccentricity) {
  let anomaly = mean % TAU;
  const m = anomaly;
  for (let i = 0; i < 7; i++) {
    anomaly -= (anomaly - eccentricity * Math.sin(anomaly) - m) /
      (1 - eccentricity * Math.cos(anomaly));
  }
  return anomaly;
}

export default function create(canvas, options = {}) {
  const params = instrumentOptions(defaults, options, limits);
  params.orbitCount = Math.round(params.orbitCount);
  const stage = createStage(canvas, { clearColor: 0x05070b, maxPixelRatio: 1.75, camera: { fov: 39 } });
  const pointer = createPointer(canvas, { tilt: false });
  lightInstrument(stage);
  frameInstrument(stage, 2.75, [0, 0.5, 1]);

  const brass = new THREE.MeshStandardMaterial({ color: 0xc5a46c, metalness: 0.94, roughness: 0.27 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x171c24, metalness: 0.9, roughness: 0.24 });
  const engraving = new THREE.MeshBasicMaterial({ color: 0xc1ac82, toneMapped: false });
  const instrument = new THREE.Group();
  instrument.rotation.z = -0.12;
  stage.scene.add(instrument);

  function ring(radius, tube, parent, material = brass) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, scale(96, 160)), material);
    parent.add(mesh);
    return mesh;
  }

  // The fixed meridian has a double lip and inlaid degree marks.
  const meridian = new THREE.Group();
  instrument.add(meridian);
  ring(2.22, 0.04, meridian);
  ring(2.12, 0.015, meridian);
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), engraving, 120);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 120; i++) {
    const a = i / 120 * TAU;
    const major = i % 10 === 0;
    dummy.position.set(Math.cos(a) * 2.17, Math.sin(a) * 2.17, 0.012);
    dummy.rotation.z = a;
    dummy.scale.set(major ? 0.075 : 0.026, major ? 0.018 : 0.009, 0.008);
    dummy.updateMatrix();
    ticks.setMatrixAt(i, dummy.matrix);
  }
  ticks.instanceMatrix.needsUpdate = true;
  meridian.add(ticks);

  const equator = new THREE.Group();
  equator.rotation.x = Math.PI / 2;
  ring(2.25, 0.035, equator);
  ring(2.32, 0.012, equator);
  instrument.add(equator);

  const armillary = new THREE.Group();
  const cage = new THREE.Group();
  instrument.add(armillary);
  armillary.add(cage);
  ring(1.98, 0.023, cage).rotation.y = Math.PI / 2;
  const counterMeridian = ring(1.98, 0.023, cage);
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 4.55, 12), brass);
  cage.add(axis);
  for (const y of [-2.34, 2.34]) {
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), brass);
    finial.position.y = y;
    cage.add(finial);
  }

  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.32, 48, 32), new THREE.MeshPhysicalMaterial({
    color: 0x281411, metalness: 0.82, roughness: 0.15, clearcoat: 1,
    emissive: 0x451707, emissiveIntensity: 0.2,
  }));
  armillary.add(sun);
  ring(0.365, 0.012, armillary);

  const orbits = [];
  const planetGeometry = new THREE.SphereGeometry(1, 24, 16);
  const planetMaterials = [0xbbaa89, 0x66858e, 0xac6443].map(color => new THREE.MeshStandardMaterial({
    color, metalness: 0.78, roughness: 0.28,
  }));
  for (let i = 0; i < params.orbitCount; i++) {
    const radius = 0.59 + i * (1.22 / (params.orbitCount - 1));
    const orbit = new THREE.Group();
    orbit.rotation.x = Math.PI / 2 + (i % 2 ? -0.12 : 0.12);
    orbit.rotation.z = i * 0.51;
    const rail = ring(radius, 0.009, orbit);
    const planet = new THREE.Mesh(planetGeometry, planetMaterials[i % 3]);
    planet.scale.setScalar(0.055 + (i % 3) * 0.022);
    orbit.add(planet);
    armillary.add(orbit);
    orbits.push({ orbit, rail, planet, radius, phase: i * 2.4, eccentricityScale: (i + 1) / params.orbitCount });
  }

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.85, 0.16, 64), dark);
  pedestal.position.y = -2.52;
  instrument.add(pedestal);
  const foot = ring(0.73, 0.014, instrument);
  foot.rotation.x = Math.PI / 2;
  foot.position.y = -2.43;

  let clock = 1.8;
  stage.onFrame(({ dt }) => {
    pointer.update(dt);
    clock += dt * params.speed;
    instrument.rotation.y = pointer.x * 0.35 + 0.16;
    instrument.rotation.x = pointer.y * 0.16;
    armillary.rotation.z = THREE.MathUtils.degToRad(params.obliquity);
    cage.rotation.y = clock * 0.18;
    counterMeridian.rotation.y = -clock * 0.36;
    for (const item of orbits) {
      const e = params.eccentricity * item.eccentricityScale;
      const b = Math.sqrt(1 - e * e);
      // Keep the apocentre inside the cage as the eccentricity changes.
      const major = item.radius / (1 + e);
      item.rail.scale.set(major / item.radius, major / item.radius * b, 1);
      item.rail.position.x = -major * e;
      const mean = item.phase + clock / Math.pow(major, 1.5);
      const anomaly = eccentricAnomaly(mean, e);
      item.planet.position.set(major * (Math.cos(anomaly) - e), major * b * Math.sin(anomaly), 0);
    }
  });
  stage.onDispose(() => pointer.dispose());
  stage.setParam = instrumentParams(stage, params, limits);
  return stage.start();
}
