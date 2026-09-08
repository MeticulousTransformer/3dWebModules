import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { eccentricAnomaly } from '../src/modules/sidereal-engine.js';
import { lorenzTrajectory } from '../src/modules/lorenz-reliquary.js';
import { irisBladeGeometry, shapeIrisBlade } from '../src/modules/nocturne-iris.js';
import { ferrofluidGeometry } from '../src/modules/ferrofluid-crown.js';
import { frameInstrument, instrumentOptions, instrumentParams } from '../src/lib/instrument-studio.js';

test('Kepler solution satisfies the equation at every supported eccentricity and across repeated orbits', () => {
  for (const e of [0, 0.2, 0.55]) {
    for (let m = -40; m <= 40; m += 0.17) {
      const anomaly = eccentricAnomaly(m, e);
      assert.ok(Math.abs(anomaly - e * Math.sin(anomaly) - m % (Math.PI * 2)) < 1e-10);
    }
  }
});

test('Lorenz trajectories are deterministic, finite, and bounded across the control range', () => {
  assert.deepEqual(lorenzTrajectory({ count: 200 }), lorenzTrajectory({ count: 200 }));
  for (const rho of [24, 28, 40]) {
    for (const sigma of [8, 10, 14]) {
      const points = lorenzTrajectory({ rho, sigma, count: 10000 });
      assert.equal(points.length, 30000);
      assert.ok(points.every(value => Number.isFinite(value) && Math.abs(value) < 100));
    }
  }
  const points = lorenzTrajectory();
  const x = points.filter((_, index) => index % 3 === 0);
  assert.ok(Math.min(...x) < -10 && Math.max(...x) > 10, 'the default still frame contains both lobes');
});

test('iris leaves keep the aperture clear and never protrude beyond the barrel', () => {
  const geometry = irisBladeGeometry();
  const position = geometry.attributes.position;
  for (const leaves of [7, 10, 14]) {
    for (const opening of [0.12, 0.52, 0.95]) {
      shapeIrisBlade(geometry, opening, leaves);
      for (let i = 0; i < position.count; i++) {
        const radius = Math.hypot(position.getX(i), position.getY(i));
        assert.ok(radius >= 0.16 + opening * 0.98 - 1e-6);
        assert.ok(radius <= 1.870001);
        assert.equal(position.getZ(i), 0);
      }
    }
  }
  geometry.dispose();
});

test('ferrofluid disk is watertight internally, faces upward, and has one circular boundary', () => {
  const sectors = 48, rings = 16;
  const geometry = ferrofluidGeometry(rings, sectors);
  const position = geometry.attributes.position;
  const indices = geometry.index.array;
  const edges = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = Array.from(indices.slice(i, i + 3));
    assert.equal(new Set(triangle).size, 3);
    a.fromBufferAttribute(position, triangle[0]);
    b.fromBufferAttribute(position, triangle[1]).sub(a);
    c.fromBufferAttribute(position, triangle[2]).sub(a);
    assert.ok(b.cross(c).y > 0, 'all triangles face the camera above the dish');
    for (let j = 0; j < 3; j++) {
      const edge = [triangle[j], triangle[(j + 1) % 3]].sort((x, y) => x - y).join(':');
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }
  assert.equal([...edges.values()].filter(count => count === 1).length, sectors);
  assert.ok([...edges.values()].every(count => count === 1 || count === 2));
  for (let i = 0; i < position.count; i++) {
    assert.ok(Math.hypot(position.getX(i), position.getZ(i)) <= 1.880001);
  }
  geometry.dispose();
});

test('camera framing fits the declared sphere in both portrait and landscape canvases', () => {
  for (const aspect of [0.35, 0.6, 1, 1.78, 3]) {
    const camera = new THREE.PerspectiveCamera(39, aspect, 0.1, 100);
    const stage = { camera, size: { aspect }, onResize() {} };
    const centre = new THREE.Vector3(0, 0.2, 0);
    frameInstrument(stage, 2.75, [0.1, 0.5, 1], centre.toArray());
    camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const plane of frustum.planes) assert.ok(plane.distanceToPoint(centre) >= 2.75 - 1e-6);
  }
});

test('instrument options bound allocations and live controls repaint a reduced-motion frame', () => {
  const limits = { count: [3, 14], speed: [0, 2] };
  const params = instrumentOptions({ count: 10, speed: 0.5 }, { count: 1e9, speed: NaN }, limits);
  assert.deepEqual(params, { count: 14, speed: 0.5 });
  let renders = 0;
  const stage = { reducedMotion: true, state: { running: true }, renderOnce() { renders++; } };
  const setParam = instrumentParams(stage, params, limits);
  setParam('speed', -10);
  assert.equal(params.speed, 0);
  assert.equal(renders, 1);
  setParam('speed', Infinity);
  setParam('unknown', 2);
  assert.equal(renders, 1);
  stage.reducedMotion = false;
  setParam('speed', 1);
  assert.equal(renders, 1, 'the running frame loop will repaint ordinary motion');
});
