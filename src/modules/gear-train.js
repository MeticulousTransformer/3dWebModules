/**
 * GEAR TRAIN
 *
 * Six gears that genuinely mesh.
 *
 * The teeth are involutes, not decoration — see ../lib/gears.js for why that
 * curve and no other. Each gear's angle is derived from the one before it by
 * the meshing formula, so a tooth always arrives where the last gear has left
 * a gap, and the whole train runs at the ratios its tooth counts demand: a
 * thirteen-tooth pinion driving a forty-tooth wheel turns it three times
 * slower, and in the opposite direction, because that is what the arithmetic
 * says.
 *
 * Nothing here is animated by hand. One angle goes in at the top.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/gears.js ../lib/textures.js
 *                   ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createGearProfile, meshAngle, addSpokeHoles } from '../lib/gears.js';
import { createGradientEnvironment } from '../lib/textures.js';
import { WORKS } from '../lib/palette.js';

export const defaults = {
  speed: 0.55,   // radians a second, at the first gear
  module: 0.09,  // the gear unit: pitch diameter over tooth count
  depth: 0.13,   // how thick the wheels are cut
};

/**
 * The train. `lean` is the direction from the previous gear to this one, so
 * the layout is described the way you would lay it out on a bench: this many
 * teeth, that way from the last one.
 */
const TRAIN = [
  { teeth: 34, lean: null, spokes: 6, brass: true },
  { teeth: 13, lean: -0.30, spokes: 0, brass: false },
  { teeth: 27, lean: 0.66, spokes: 5, brass: true },
  { teeth: 11, lean: -0.10, spokes: 0, brass: false },
  { teeth: 41, lean: 0.92, spokes: 7, brass: true },
  { teeth: 16, lean: -0.62, spokes: 0, brass: false },
];

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: WORKS.soot,
    camera: { fov: 38, position: [0, 0, 5.4] },
  });
  const pointer = createPointer(canvas);

  const environment = createGradientEnvironment({
    top: '#2a2418', middle: '#0d0b09', bottom: '#3a2410', sun: '#ffd9a0',
  });
  stage.scene.environment = environment;

  const works = new THREE.Group();
  stage.scene.add(works);

  // The wheels live in their own group so centring the train does not drag
  // the backplate off with it.
  const train = new THREE.Group();
  works.add(train);

  // ---- materials ----------------------------------------------------------
  const brass = new THREE.MeshStandardMaterial({
    color: WORKS.brass, metalness: 0.94, roughness: 0.31,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x8d9098, metalness: 0.92, roughness: 0.38,
  });
  const iron = new THREE.MeshStandardMaterial({
    color: WORKS.iron, metalness: 0.55, roughness: 0.78,
  });

  // ---- cut the wheels -----------------------------------------------------
  const gears = [];
  const disposables = [];
  let x = 0;
  let y = 0;

  TRAIN.forEach((entry, index) => {
    const profile = createGearProfile({
      teeth: entry.teeth,
      module: params.module,
      boreRadius: params.module * 1.6,
    });

    if (entry.spokes > 0) {
      addSpokeHoles(profile.shape, {
        count: entry.spokes,
        innerRadius: params.module * 2.6,
        outerRadius: profile.rootRadius - params.module * 0.9,
        width: 0.30,
      });
    }

    const geometry = new THREE.ExtrudeGeometry(profile.shape, {
      depth: params.depth,
      bevelEnabled: true,
      bevelThickness: params.module * 0.16,
      bevelSize: params.module * 0.16,
      bevelSegments: 1,
      curveSegments: 1,
    });
    geometry.translate(0, 0, -params.depth / 2);
    disposables.push(geometry);

    // Spaced by the sum of the pitch radii. That is the only distance at which
    // involute teeth roll on each other instead of grinding.
    let lean = 0;
    if (index > 0) {
      lean = entry.lean;
      const previous = gears[index - 1];
      const spacing = previous.profile.pitchRadius + profile.pitchRadius;
      x = previous.mesh.position.x + Math.cos(lean) * spacing;
      y = previous.mesh.position.y + Math.sin(lean) * spacing;
    }

    const mesh = new THREE.Mesh(geometry, entry.brass ? brass : steel);
    mesh.position.set(x, y, index * 0.0001); // a hair apart, to stop z-fighting
    train.add(mesh);

    // The shaft it turns on, and a collar to hold it.
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(params.module * 1.5, params.module * 1.5, params.depth * 2.4, 18),
      iron,
    );
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(x, y, 0);
    train.add(shaft);
    disposables.push(shaft.geometry);

    gears.push({ mesh, profile, lean, teeth: entry.teeth });
  });

  // ---- the backplate ------------------------------------------------------
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 14),
    new THREE.MeshStandardMaterial({ color: 0x14110e, metalness: 0.3, roughness: 0.9 }),
  );
  plate.position.z = -0.6;
  works.add(plate);

  // Rivets, in rows, because everything in this century was riveted.
  const rivetGeometry = new THREE.SphereGeometry(params.module * 0.5, 10, 8);
  const rivets = new THREE.InstancedMesh(rivetGeometry, iron, 96);
  const matrix = new THREE.Matrix4();
  let rivet = 0;
  for (let row = -3; row <= 3 && rivet < 96; row++) {
    for (let column = -7; column <= 7 && rivet < 96; column++) {
      if (Math.abs(row) < 2 && Math.abs(column) < 5) continue; // keep clear of the works
      matrix.makeScale(1, 1, 1);
      matrix.setPosition(column * 0.62, row * 0.62, -0.56);
      rivets.setMatrixAt(rivet++, matrix);
    }
  }
  rivets.count = rivet;
  rivets.instanceMatrix.needsUpdate = true;
  works.add(rivets);

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x241d16, 1.5));

  const key = new THREE.DirectionalLight(0xffd9a0, 3.0);
  key.position.set(3, 4, 6);
  stage.scene.add(key);

  const fire = new THREE.PointLight(WORKS.ember, 26, 12, 2);
  fire.position.set(-2.4, -1.6, 2.2);
  stage.scene.add(fire);

  const rim = new THREE.DirectionalLight(0x9fb6d8, 1.1);
  rim.position.set(-4, 2, -3);
  stage.scene.add(rim);

  // ---- fit the whole train in frame --------------------------------------
  const bounds = new THREE.Box3();
  for (const gear of gears) {
    bounds.expandByPoint(new THREE.Vector3(
      gear.mesh.position.x - gear.profile.tipRadius,
      gear.mesh.position.y - gear.profile.tipRadius, 0,
    ));
    bounds.expandByPoint(new THREE.Vector3(
      gear.mesh.position.x + gear.profile.tipRadius,
      gear.mesh.position.y + gear.profile.tipRadius, 0,
    ));
  }
  const centre = bounds.getCenter(new THREE.Vector3());
  const span = bounds.getSize(new THREE.Vector3());
  train.position.set(-centre.x, -centre.y, 0);

  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 5.4 * Math.tan((38 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    works.scale.setScalar(Math.min(
      visibleWidth / (span.x * 1.12),
      visibleHeight / (span.y * 1.12),
      1.6,
    ));
  });

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    // A finger on the first wheel drives the whole train.
    const drive = params.speed * (pointer.active ? 1 + pointer.x * 2.4 : 1);
    gears[0].mesh.rotation.z += drive * dt;

    // Everything after it is derived, never animated.
    for (let i = 1; i < gears.length; i++) {
      gears[i].mesh.rotation.z = meshAngle(
        gears[i - 1].mesh.rotation.z,
        gears[i - 1].teeth,
        gears[i].teeth,
        gears[i].lean,
      );
    }

    fire.intensity = 22 + Math.sin(time * 5.7) * 5 + Math.sin(time * 13.1) * 2.5;
    works.rotation.x = pointer.y * 0.12;
    works.rotation.y = pointer.x * 0.12;
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    for (const geometry of disposables) geometry.dispose();
    rivetGeometry.dispose();
    plate.geometry.dispose();
    plate.material.dispose();
    brass.dispose();
    steel.dispose();
    iron.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
