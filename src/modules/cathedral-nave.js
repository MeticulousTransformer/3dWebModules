/**
 * CATHEDRAL NAVE
 *
 * An endless gothic nave. Bays of piers, transverse arches and crossing ribs
 * come toward you out of the fog and are sent back to the far end when they
 * pass, so the church has no length.
 *
 * The arch is drawn the way a mason sets one out: two arcs of the same radius,
 * each centred on the opposite springing point. Radius equals the full span
 * and you get the equilateral arch of High Gothic — the apex lands at
 * springline plus half-span times root three, and you never have to guess.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/lightshaft.js
 *                   ../lib/device.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createLightShaft } from '../lib/lightshaft.js';
import { scale } from '../lib/device.js';
import { GOTHIC } from '../lib/palette.js';

export const defaults = {
  bays: 0,          // 0 = pick from the device
  bayDepth: 3.4,
  walk: 1.6,        // how fast the nave comes towards you
  naveWidth: 3.0,   // half the span, pier centre to pier centre
  lookUp: 0.30,
};

const FLOOR_Y = -2.2;
const SPRING_Y = 3.4;     // where the arches start their curve
const WINDOW_Y = 4.6;

/**
 * The outline of an equilateral pointed arch band, as a THREE.Shape.
 * Springs at (±halfSpan, springLine); apex at halfSpan * sqrt(3) above it.
 */
function pointedArchBand(halfSpan, springLine, thickness, samples = 22) {
  const radius = halfSpan * 2;
  const outer = [];
  const inner = [];

  // Left half: an arc centred on the RIGHT springing point.
  for (let i = 0; i <= samples; i++) {
    const angle = Math.PI + ((2 * Math.PI) / 3 - Math.PI) * (i / samples);
    outer.push([halfSpan + (radius + thickness) * Math.cos(angle), springLine + (radius + thickness) * Math.sin(angle)]);
    inner.push([halfSpan + radius * Math.cos(angle), springLine + radius * Math.sin(angle)]);
  }
  // Right half: an arc centred on the LEFT springing point.
  for (let i = 0; i <= samples; i++) {
    const angle = (Math.PI / 3) * (1 - i / samples);
    outer.push([-halfSpan + (radius + thickness) * Math.cos(angle), springLine + (radius + thickness) * Math.sin(angle)]);
    inner.push([-halfSpan + radius * Math.cos(angle), springLine + radius * Math.sin(angle)]);
  }

  const shape = new THREE.Shape();
  shape.moveTo(outer[0][0], outer[0][1]);
  for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i][0], outer[i][1]);
  for (let i = inner.length - 1; i >= 0; i--) shape.lineTo(inner[i][0], inner[i][1]);
  shape.closePath();
  return shape;
}

/** The same arch, filled in — a window. */
function pointedArchPane(halfSpan, springLine, samples = 16) {
  const radius = halfSpan * 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfSpan, springLine);

  for (let i = 0; i <= samples; i++) {
    const angle = Math.PI + ((2 * Math.PI) / 3 - Math.PI) * (i / samples);
    shape.lineTo(halfSpan + radius * Math.cos(angle), springLine + radius * Math.sin(angle));
  }
  for (let i = 0; i <= samples; i++) {
    const angle = (Math.PI / 3) * (1 - i / samples);
    shape.lineTo(-halfSpan + radius * Math.cos(angle), springLine + radius * Math.sin(angle));
  }

  shape.closePath();
  return shape;
}

/** One crossing rib: a tube from a near pier top, over the middle, to the far one. */
function ribGeometry(halfSpan, depth, apexHeight, direction) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-halfSpan * direction, SPRING_Y, 0),
    new THREE.Vector3(-halfSpan * 0.55 * direction, SPRING_Y + apexHeight * 0.62, depth * 0.25),
    new THREE.Vector3(0, SPRING_Y + apexHeight, depth * 0.5),
    new THREE.Vector3(halfSpan * 0.55 * direction, SPRING_Y + apexHeight * 0.62, depth * 0.75),
    new THREE.Vector3(halfSpan * direction, SPRING_Y, depth),
  ]);
  return new THREE.TubeGeometry(curve, 30, 0.075, 6, false);
}

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const bays = params.bays || scale(11, 18);
  const half = params.naveWidth;
  const depth = bays * params.bayDepth;

  const stage = createStage(canvas, {
    clearColor: GOTHIC.pitch,
    camera: { fov: 64, position: [0, 0, 4], lookAt: [0, 2, -12], far: 120 },
  });
  const pointer = createPointer(canvas);
  stage.scene.fog = new THREE.Fog(0x11131c, 6, depth * 0.80);

  // ---- one stone, used by everything --------------------------------------
  const stone = new THREE.MeshStandardMaterial({
    color: 0x64646e,
    roughness: 0.88,
    metalness: 0.04,
    flatShading: true,
  });

  // ---- the pieces of a bay ------------------------------------------------
  const pierGeometry = new THREE.CylinderGeometry(0.30, 0.36, SPRING_Y - FLOOR_Y, 9, 1);
  pierGeometry.translate(0, (SPRING_Y - FLOOR_Y) / 2 + FLOOR_Y, 0);

  const archGeometry = new THREE.ExtrudeGeometry(
    pointedArchBand(half, SPRING_Y, 0.42),
    { depth: 0.55, bevelEnabled: false, curveSegments: 2 },
  );
  archGeometry.translate(0, 0, -0.275);

  const windowGeometry = new THREE.ShapeGeometry(pointedArchPane(0.52, WINDOW_Y), 2);

  const ribLeft = ribGeometry(half, params.bayDepth, 2.5, 1);
  const ribRight = ribGeometry(half, params.bayDepth, 2.5, -1);

  const glassMaterial = new THREE.MeshBasicMaterial({
    color: 0xdcecff, transparent: true, opacity: 0.98, side: THREE.DoubleSide, fog: false,
  });

  const piers = new THREE.InstancedMesh(pierGeometry, stone, bays * 2);
  const arches = new THREE.InstancedMesh(archGeometry, stone, bays);
  const windows = new THREE.InstancedMesh(windowGeometry, glassMaterial, bays * 2);
  const ribsA = new THREE.InstancedMesh(ribLeft, stone, bays);
  const ribsB = new THREE.InstancedMesh(ribRight, stone, bays);

  for (const mesh of [piers, arches, windows, ribsA, ribsB]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    stage.scene.add(mesh);
  }

  // ---- where each bay currently is ---------------------------------------
  const bayZ = new Float32Array(bays);
  for (let i = 0; i < bays; i++) bayZ[i] = -i * params.bayDepth;

  const matrix = new THREE.Matrix4();

  function writeBays() {
    for (let bay = 0; bay < bays; bay++) {
      const z = bayZ[bay];

      matrix.makeScale(1, 1, 1);
      matrix.setPosition(-half, 0, z);
      piers.setMatrixAt(bay * 2, matrix);
      matrix.setPosition(half, 0, z);
      piers.setMatrixAt(bay * 2 + 1, matrix);

      matrix.setPosition(0, 0, z);
      arches.setMatrixAt(bay, matrix);
      ribsA.setMatrixAt(bay, matrix);
      ribsB.setMatrixAt(bay, matrix);

      matrix.setPosition(-half - 0.55, 0, z);
      windows.setMatrixAt(bay * 2, matrix);
      matrix.setPosition(half + 0.55, 0, z);
      windows.setMatrixAt(bay * 2 + 1, matrix);
    }

    for (const mesh of [piers, arches, windows, ribsA, ribsB]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  writeBays();

  // ---- the floor ----------------------------------------------------------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(26, depth * 2),
    new THREE.MeshStandardMaterial({ color: 0x24242c, roughness: 0.86, metalness: 0.10 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, FLOOR_Y, -depth * 0.4);
  stage.scene.add(floor);

  // ---- light coming in sideways from the high windows --------------------
  // Only the nearest few bays get a shaft; past that the fog eats them anyway.
  const shafts = [];
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const shaft = createLightShaft({
        width: 1.8, length: 12, color: 0xb9cfe8, intensity: 0.60, spread: 2.4,
      });
      shaft.mesh.position.set(side * (half + 0.5), WINDOW_Y + 1.2, -2 - i * params.bayDepth * 1.6);
      shaft.mesh.rotation.z = side * 0.62;   // slanting down into the nave
      shaft.mesh.rotation.y = side * 0.25;
      stage.scene.add(shaft.mesh);
      shafts.push(shaft);
    }
  }

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x2a3348, 2.3));

  const clerestory = new THREE.DirectionalLight(0xb9cfe8, 3.4);
  clerestory.position.set(-4, 8, 2);
  stage.scene.add(clerestory);

  const opposite = new THREE.DirectionalLight(0x8fa8c8, 2.0);
  opposite.position.set(5, 7, -3);
  stage.scene.add(opposite);

  const candle = new THREE.PointLight(GOTHIC.amber, 14, 12, 2);
  candle.position.set(0, 0.2, 2);
  stage.scene.add(candle);

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    const travel = params.walk * dt;
    for (let bay = 0; bay < bays; bay++) {
      bayZ[bay] += travel;
      if (bayZ[bay] > 8) bayZ[bay] -= depth;
    }
    writeBays();

    for (const shaft of shafts) shaft.material.uniforms.uTime.value = time;

    candle.intensity = 12 + Math.sin(time * 7.1) * 2.5 + Math.sin(time * 13.3) * 1.2;

    stage.camera.position.x += (pointer.x * 1.6 - stage.camera.position.x) * Math.min(1, dt * 2);
    stage.camera.position.y = Math.sin(time * 0.8) * 0.04;
    stage.camera.lookAt(pointer.x * 1.2, 2 + pointer.y * 4 + params.lookUp * 3, -14);
  });

  stage.onDispose(() => {
    pointer.dispose();
    for (const shaft of shafts) shaft.dispose();
    pierGeometry.dispose();
    archGeometry.dispose();
    windowGeometry.dispose();
    ribLeft.dispose();
    ribRight.dispose();
    floor.geometry.dispose();
    floor.material.dispose();
    stone.dispose();
    glassMaterial.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
