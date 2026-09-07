/**
 * THE TOLLING
 *
 * A great bronze bell on a yoke, with a clapper hanging inside it on its own
 * shorter pendulum. Both swing under the same equation; because their lengths
 * differ they drift out of phase, and every so often the clapper catches up
 * with the wall of the bell and strikes it.
 *
 * Nothing schedules the tolling. It falls out of the two lengths, which is why
 * the rhythm is almost regular and never quite.
 *
 * The bell itself is a lathe: a profile curve spun about the vertical, down
 * the outside and back up the inside so it is hollow and you can see up into it.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/random.js
 *                   ../lib/textures.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createRandom } from '../lib/random.js';
import { createGradientEnvironment } from '../lib/textures.js';
import { GOTHIC } from '../lib/palette.js';

export const defaults = {
  bellLength: 1.05,     // pendulum length of the bell
  clapperLength: 0.62,  // and of the clapper. the difference is the rhythm.
  damping: 0.16,
  push: 1,              // how hard the bell keeps being rung
  strikeAngle: 0.30,    // how far the clapper must lead before it lands
};

const GRAVITY = 9.81;
const RING_POOL = 7;

/**
 * The silhouette of a bell, as a table.
 *
 * No formula gets this right. A bell holds its shoulder almost straight for
 * the top half, turns through a waist, and then flares hard into the sound bow
 * at the lip. Every power curve I tried gave a horn. Measured control points
 * and straight interpolation between them gave a bell, so that is what this is.
 *
 * Fractions of the mouth radius, from crown (t=0) to lip (t=1).
 */
const BELL_WALL = [
  [0.00, 0.300], [0.12, 0.308], [0.26, 0.325], [0.40, 0.360],
  [0.52, 0.412], [0.63, 0.480], [0.73, 0.566], [0.82, 0.672],
  [0.89, 0.780], [0.95, 0.900], [1.00, 1.000],
];

/** Read the table at t, straight-line between the two points either side. */
function bellWallAt(t) {
  for (let i = 1; i < BELL_WALL.length; i++) {
    const [t1, r1] = BELL_WALL[i];
    if (t > t1) continue;
    const [t0, r0] = BELL_WALL[i - 1];
    return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0);
  }
  return 1;
}

/**
 * The outline, from crown to lip down the outside and back up the inside.
 * `mouth` is the RADIUS at the lip, so a bell that looks right wants
 * mouth to be about half its height — a bell is as wide as it is tall.
 */
function bellProfile({ height, mouth, thickness, samples = 40 }) {
  const points = [];
  const wall = (t) => mouth * bellWallAt(t);

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    points.push(new THREE.Vector2(wall(t), height * (1 - t)));
  }

  for (let i = samples; i >= 0; i--) {
    const t = i / samples;
    // The wall thickens towards the lip — that is where a bell is struck.
    const radius = wall(t) - thickness * (0.5 + 1.6 * Math.pow(t, 2.4));
    points.push(new THREE.Vector2(Math.max(0.04, radius), height * (1 - t) + thickness * 0.5));
  }

  return points;
}

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const random = createRandom(53);

  const stage = createStage(canvas, {
    clearColor: GOTHIC.pitch,
    camera: { fov: 44, position: [0, 0.1, 4.4], lookAt: [0, -0.1, 0], far: 40 },
  });
  const pointer = createPointer(canvas);
  stage.scene.fog = new THREE.FogExp2(0x07070c, 0.11);

  const environment = createGradientEnvironment({
    top: '#161824', middle: '#06060a', bottom: '#2a1a08', sun: '#ffd9a0',
  });
  stage.scene.environment = environment;

  // ---- the frame it hangs in ----------------------------------------------
  const iron = new THREE.MeshStandardMaterial({
    color: 0x3a3438, roughness: 0.58, metalness: 0.78,
  });

  const yoke = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.19), iron);
  yoke.position.y = 1.15;
  stage.scene.add(yoke);

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.18), iron);
    post.position.set(side * 1.0, 0.0, 0);
    stage.scene.add(post);
  }

  // ---- the bell -----------------------------------------------------------
  // Its pivot is the yoke; the bell hangs below it.
  const bellPivot = new THREE.Group();
  bellPivot.position.y = 1.15;
  stage.scene.add(bellPivot);

  const bronze = new THREE.MeshStandardMaterial({
    color: 0xb08442,
    roughness: 0.32,
    metalness: 0.95,
    side: THREE.DoubleSide,
    flatShading: false,
  });

  const bellHeight = 1.12;
  const bellGeometry = new THREE.LatheGeometry(
    bellProfile({ height: bellHeight, mouth: 0.54, thickness: 0.055 }),
    56,
  );
  const bell = new THREE.Mesh(bellGeometry, bronze);
  bell.position.y = -params.bellLength;
  bellPivot.add(bell);

  // The canons: the loops the bell hangs by.
  for (const side of [-1, 1]) {
    const canon = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.026, 6, 20), bronze);
    canon.position.set(side * 0.07, -params.bellLength + bellHeight + 0.05, 0);
    canon.rotation.y = Math.PI / 2;
    bellPivot.add(canon);
  }

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.14, 14), bronze);
  crown.position.y = -params.bellLength + bellHeight + 0.02;
  bellPivot.add(crown);

  // ---- the clapper --------------------------------------------------------
  const clapperPivot = new THREE.Group();
  clapperPivot.position.y = 1.15 - params.bellLength + bellHeight - 0.06;
  stage.scene.add(clapperPivot);

  const clapperRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, params.clapperLength, 8),
    iron,
  );
  clapperRod.position.y = -params.clapperLength / 2;
  clapperPivot.add(clapperRod);

  const clapperBall = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), iron);
  clapperBall.position.y = -params.clapperLength;
  clapperPivot.add(clapperBall);

  // ---- shockwaves ---------------------------------------------------------
  // A small pool, reused. Nothing is ever allocated once the module is running.
  const ringGeometry = new THREE.TorusGeometry(1, 0.014, 6, 96);
  ringGeometry.rotateX(-Math.PI / 2);

  const rings = [];
  for (let i = 0; i < RING_POOL; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xd9b877, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(ringGeometry, material);
    mesh.visible = false;
    stage.scene.add(mesh);
    rings.push({ mesh, material, age: 0, live: false });
  }

  let nextRing = 0;

  // ---- dust shaken loose --------------------------------------------------
  const dustCount = 260;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustFall = new Float32Array(dustCount);
  const dustAlive = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3 + 1] = -10; // parked out of sight until a strike
    dustFall[i] = random.between(0.25, 0.8);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    color: GOTHIC.ash, size: 0.018, transparent: true, opacity: 0.5, depthWrite: false,
  }));
  stage.scene.add(dust);

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x1e2434, 1.9));

  const key = new THREE.DirectionalLight(0xffd9a0, 3.2);
  key.position.set(3, 4, 4);
  stage.scene.add(key);

  const rim = new THREE.DirectionalLight(GOTHIC.moon, 1.5);
  rim.position.set(-4, 2, -3);
  stage.scene.add(rim);

  const strikeLight = new THREE.PointLight(0xffce8a, 0, 8, 2);
  strikeLight.position.set(0, -0.4, 0);
  stage.scene.add(strikeLight);

  // ---- two pendulums ------------------------------------------------------
  let bellAngle = 0.22;
  let bellSpeed = 0;
  let clapperAngle = 0;
  let clapperSpeed = 0;
  let sinceStrike = 1;

  function strike(force) {
    // Reflect the clapper off the bell wall, losing a little each time.
    clapperSpeed = -clapperSpeed * 0.42;

    const ring = rings[nextRing];
    nextRing = (nextRing + 1) % RING_POOL;
    ring.age = 0;
    ring.live = true;
    ring.mesh.visible = true;

    strikeLight.intensity = 22 * Math.min(1, force);
    sinceStrike = 0;

    // Shake dust off the yoke.
    for (let i = 0; i < dustCount; i++) {
      if (dustAlive[i] > 0.05) continue;
      if (random() > 0.35) continue;
      dustPositions[i * 3 + 0] = random.between(-1.1, 1.1);
      dustPositions[i * 3 + 1] = random.between(1.0, 1.3);
      dustPositions[i * 3 + 2] = random.between(-0.15, 0.15);
      dustAlive[i] = 1;
    }
  }

  function step(dt, time) {
    // The bell, kept going by a ringer who never gets tired.
    const drive = Math.sin(time * 0.6) * 0.05 * params.push
      + (pointer.active ? pointer.x * 0.08 : 0);

    bellSpeed += (-(GRAVITY / params.bellLength) * Math.sin(bellAngle)
      - params.damping * bellSpeed + drive) * dt;
    bellAngle += bellSpeed * dt;

    // The clapper swings on its own, shorter, so it falls behind and catches up.
    clapperSpeed += (-(GRAVITY / params.clapperLength) * Math.sin(clapperAngle)
      - 0.06 * clapperSpeed) * dt;
    clapperAngle += clapperSpeed * dt;

    // It hits when it has swung far enough past the bell to reach the wall.
    const lead = clapperAngle - bellAngle;
    if (Math.abs(lead) > params.strikeAngle && sinceStrike > 0.22) {
      clapperAngle = bellAngle + Math.sign(lead) * params.strikeAngle;
      strike(Math.abs(clapperSpeed - bellSpeed) * 0.5);
    }
  }

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);
    const clamped = Math.min(dt, 1 / 40);

    step(clamped, time);
    sinceStrike += clamped;

    bellPivot.rotation.z = bellAngle;
    clapperPivot.rotation.z = clapperAngle;

    for (const ring of rings) {
      if (!ring.live) continue;
      ring.age += clamped;
      const t = ring.age / 2.6;
      if (t >= 1) {
        ring.live = false;
        ring.mesh.visible = false;
        continue;
      }
      const size = 0.5 + t * 4.5;
      ring.mesh.scale.set(size, 1, size);
      ring.mesh.position.y = -0.9 + t * 0.9;
      ring.material.opacity = (1 - t) * (1 - t) * 0.55;
    }

    for (let i = 0; i < dustCount; i++) {
      if (dustAlive[i] <= 0) continue;
      dustAlive[i] -= clamped * 0.35;
      dustPositions[i * 3 + 1] -= dustFall[i] * clamped;
      if (dustAlive[i] <= 0) dustPositions[i * 3 + 1] = -10;
    }
    dustGeometry.attributes.position.needsUpdate = true;

    strikeLight.intensity *= Math.pow(0.02, clamped); // decays fast, like a flash

    stage.camera.position.x += (pointer.x * 1.0 - stage.camera.position.x) * Math.min(1, dt * 1.8);
    stage.camera.position.y = 0.1 + pointer.y * 0.7;
    stage.camera.lookAt(0, -0.1, 0);
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    bellGeometry.dispose();
    ringGeometry.dispose();
    for (const ring of rings) ring.material.dispose();
    dustGeometry.dispose();
    dust.material.dispose();
    bronze.dispose();
    iron.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
