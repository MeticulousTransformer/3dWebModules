/**
 * LORENZ RELIQUARY
 * A deterministic chaotic trajectory, held like a specimen in a brass frame.
 * RK4 integrates the Lorenz equations once; animation only moves light along
 * the stored curve. It is a mathematical visualization, not atmospheric data.
 */
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { scale } from '../lib/device.js';
import { lightInstrument, frameInstrument, instrumentParams, instrumentOptions } from '../lib/instrument-studio.js';

export const defaults = { speed: 0.7, rho: 28, sigma: 10, filament: 1.15 };
const limits = { speed: [0, 2], rho: [24, 40], sigma: [8, 14], filament: [0.5, 2.4] };

/** Raw physical coordinates, fixed integration step, no randomness or DOM. */
export function lorenzTrajectory({ rho = 28, sigma = 10, count = 9000, step = 0.006 } = {}) {
  const beta = 8 / 3;
  let x = 0.1, y = 0, z = 0;
  const points = new Float32Array(count * 3);
  // Discard the transient so the still frame already contains both lobes.
  for (let i = -1400; i < count; i++) {
    const ax = sigma * (y - x), ay = x * (rho - z) - y, az = x * y - beta * z;
    const hx = x + ax * step / 2, hy = y + ay * step / 2, hz = z + az * step / 2;
    const bx = sigma * (hy - hx), by = hx * (rho - hz) - hy, bz = hx * hy - beta * hz;
    const jx = x + bx * step / 2, jy = y + by * step / 2, jz = z + bz * step / 2;
    const cx = sigma * (jy - jx), cy = jx * (rho - jz) - jy, cz = jx * jy - beta * jz;
    const kx = x + cx * step, ky = y + cy * step, kz = z + cz * step;
    const dx = sigma * (ky - kx), dy = kx * (rho - kz) - ky, dz = kx * ky - beta * kz;
    x += step / 6 * (ax + 2 * bx + 2 * cx + dx);
    y += step / 6 * (ay + 2 * by + 2 * cy + dy);
    z += step / 6 * (az + 2 * bz + 2 * cz + dz);
    if (i >= 0) points.set([x, y, z], i * 3);
  }
  return points;
}

export default function create(canvas, options = {}) {
  const params = instrumentOptions(defaults, options, limits);
  const stage = createStage(canvas, { clearColor: 0x040709, maxPixelRatio: 1.75, camera: { fov: 40 } });
  const pointer = createPointer(canvas, { tilt: false });
  lightInstrument(stage, { warmth: '#dfdac5', rim: 0x709d9d });
  frameInstrument(stage, 2.55, [0, 0.08, 1]);

  const relic = new THREE.Group();
  stage.scene.add(relic);
  const raw = lorenzTrajectory({ rho: params.rho, sigma: params.sigma, count: scale(5200, 10000) });
  const count = raw.length / 3;
  const positions = new Float32Array(raw.length);
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (let i = 0; i < count; i++) bounds.expandByPoint(point.fromArray(raw, i * 3));
  const centre = bounds.getCenter(new THREE.Vector3());
  const extent = bounds.getSize(new THREE.Vector3());
  const factor = 3.45 / Math.max(extent.x, extent.y, extent.z);
  const colors = new Float32Array(raw.length);
  const teal = new THREE.Color(0x496f73);
  const gold = new THREE.Color(0xe0bd78);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (raw[i * 3] - centre.x) * factor;
    positions[i * 3 + 1] = (raw[i * 3 + 2] - centre.z) * factor;
    positions[i * 3 + 2] = (raw[i * 3 + 1] - centre.y) * factor * 0.52;
    const height = (raw[i * 3 + 2] - bounds.min.z) / extent.z;
    color.copy(teal).lerp(gold, height).toArray(colors, i * 3);
  }

  // Screen-space ribbons stay legible on Retina displays; native GL lines do not.
  const geometry = new LineGeometry();
  geometry.setPositions(positions);
  geometry.setColors(colors);
  const material = new LineMaterial({
    vertexColors: true, linewidth: params.filament,
    transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false,
  });
  const silk = new Line2(geometry, material);
  relic.add(silk);
  const resize = ({ width, height }) => material.resolution.set(width, height);
  stage.onResize(resize);
  resize(stage.size);

  // A sparse cage leaves the equation's silhouette visible.
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xa58f65, metalness: 0.9, roughness: 0.3 });
  const ringGeometry = new THREE.TorusGeometry(2.19, 0.017, 8, 160);
  const halo = new THREE.Mesh(ringGeometry, frameMaterial);
  halo.position.z = -0.7;
  relic.add(halo);
  const orbit = new THREE.Mesh(ringGeometry, frameMaterial);
  orbit.rotation.y = 1.15;
  relic.add(orbit);
  const marks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.017, 8, 6), frameMaterial, 48);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 2.27, Math.sin(a) * 2.27, -0.7);
    dummy.updateMatrix();
    marks.setMatrixAt(i, dummy.matrix);
  }
  marks.instanceMatrix.needsUpdate = true;
  relic.add(marks);

  const beadGeometry = new THREE.SphereGeometry(0.025, 12, 8);
  const beadMaterial = new THREE.MeshBasicMaterial({ color: 0xffe4ac, toneMapped: false });
  const beads = new THREE.InstancedMesh(beadGeometry, beadMaterial, 9);
  beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  beads.frustumCulled = false;
  relic.add(beads);

  let cursor = count * 0.3;
  stage.onFrame(({ dt }) => {
    pointer.update(dt);
    cursor = (cursor + dt * params.speed * 155) % (count - 1);
    relic.rotation.y = 0.12 + pointer.x * 0.42;
    relic.rotation.x = pointer.y * 0.25;
    material.linewidth = params.filament;
    for (let i = 0; i < 9; i++) {
      const index = (cursor + i * (count - 1) / 9) % (count - 1);
      const floor = Math.floor(index), f = index - floor;
      for (let axis = 0; axis < 3; axis++) {
        point.setComponent(axis, THREE.MathUtils.lerp(positions[floor * 3 + axis], positions[(floor + 1) * 3 + axis], f));
      }
      dummy.position.copy(point);
      dummy.updateMatrix();
      beads.setMatrixAt(i, dummy.matrix);
    }
    beads.instanceMatrix.needsUpdate = true;
  });
  stage.onDispose(() => pointer.dispose());
  stage.setParam = instrumentParams(stage, params, limits);
  return stage.start();
}
