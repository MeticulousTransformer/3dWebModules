/**
 * LIGHT RIG
 *
 * Three-point lighting on a seamless, with the fixtures left in shot.
 *
 * Key does the modelling and throws the shadow. Fill sits opposite and only
 * decides how deep that shadow goes. Rim comes from behind and separates the
 * subject from the backdrop. That is the whole grammar, and it is easier to
 * see when you can watch the lamps move.
 *
 * Drag to walk the key light round the subject.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/filmlook.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createFilmLook } from '../lib/filmlook.js';
import { STUDIO, CSS_STUDIO } from '../lib/palette.js';

export const defaults = {
  keyAngle: 0.9,      // radians round the subject from front-centre
  keyHeight: 2.3,
  key: 1,             // intensity multipliers
  fill: 0.30,
  rim: 1.0,
  spin: 0.12,         // the subject on a turntable
};

/**
 * The subject: a thrown vessel, in section. Up the outside, over the lip and
 * back down the inside — which is what makes it hollow and gives the rim
 * light something to catch.
 */
const VESSEL = [
  [0.000, 0.000], [0.330, 0.000], [0.352, 0.030], [0.386, 0.120],
  [0.424, 0.300], [0.436, 0.480], [0.412, 0.660], [0.352, 0.830],
  [0.268, 0.970], [0.196, 1.080], [0.162, 1.180], [0.158, 1.290],
  [0.184, 1.372], [0.196, 1.400], [0.170, 1.408], [0.146, 1.372],
  [0.126, 1.280], [0.128, 1.170], [0.150, 1.070], [0.000, 0.980],
];

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: STUDIO.gate,
    camera: { fov: 34, position: [0, 1.15, 4.6], lookAt: [0, 0.72, 0], far: 40 },
  });
  const pointer = createPointer(canvas);

  // A studio without shadows is a studio without lighting.
  stage.renderer.shadowMap.enabled = true;
  // PCFSoft is deprecated in current three; PCF plus a shadow radius on the
  // light gives the same soft edge without the console warning.
  stage.renderer.shadowMap.type = THREE.PCFShadowMap;

  // ---- the seamless -------------------------------------------------------
  // A flat floor that bends up into a wall with no corner in it, which is the
  // entire point of a cyclorama.
  const coveGeometry = new THREE.PlaneGeometry(16, 13, 1, 60);
  coveGeometry.rotateX(-Math.PI / 2);

  const covePosition = coveGeometry.attributes.position;
  for (let i = 0; i < covePosition.count; i++) {
    const z = covePosition.getZ(i);
    const rise = Math.max(0, (-z - 1.2) / 4.4); // flat until it starts to lift
    const height = Math.pow(Math.min(1, rise), 1.9) * 5.5;
    covePosition.setY(i, height);
    // Pull it forward as it climbs, so the bend is a curve and not a crease.
    covePosition.setZ(i, z + height * 0.30);
  }
  coveGeometry.computeVertexNormals();

  const cove = new THREE.Mesh(
    coveGeometry,
    new THREE.MeshStandardMaterial({ color: 0x4e4c48, roughness: 0.97, metalness: 0.0 }),
  );
  cove.receiveShadow = true;
  stage.scene.add(cove);

  // ---- the subject --------------------------------------------------------
  const vesselGeometry = new THREE.LatheGeometry(
    VESSEL.map(([x, y]) => new THREE.Vector2(x, y)),
    72,
  );
  vesselGeometry.computeVertexNormals();

  const vessel = new THREE.Mesh(
    vesselGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x101216,
      roughness: 0.18,
      metalness: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  vessel.castShadow = true;
  vessel.receiveShadow = true;
  stage.scene.add(vessel);

  // ---- the fixtures -------------------------------------------------------
  /**
   * One lamp: the light itself, the glowing face of the softbox, and the dark
   * box around it. Grouped so moving the light moves the fixture with it.
   */
  function createLamp({ colour, size, intensity, shadows }) {
    const group = new THREE.Group();

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size * 0.78),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.92 }),
    );
    group.add(face);

    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 1.1, size * 0.88),
      new THREE.MeshBasicMaterial({ color: 0x2b2318 }),
    );
    frame.position.z = -0.03;
    group.add(frame);

    // A short throw, so the light falls off across the seamless and leaves a
    // gradient behind the subject instead of a flat white wall.
    const light = new THREE.SpotLight(colour, intensity, 11, 0.72, 0.95, 1.9);
    light.castShadow = shadows;
    if (shadows) {
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -0.0016;
      light.shadow.radius = 3;
    }
    group.add(light);

    stage.scene.add(group, light.target);
    return { group, light, face };
  }

  const key = createLamp({ colour: 0xffe6c4, size: 1.5, intensity: 46, shadows: true });
  const fill = createLamp({ colour: 0xdfe8f6, size: 2.1, intensity: 14, shadows: false });
  const rim = createLamp({ colour: 0xf0dcb4, size: 0.7, intensity: 34, shadows: false });

  for (const lamp of [key, fill, rim]) {
    lamp.light.target.position.set(0, 0.7, 0);
    lamp.light.target.updateMatrixWorld();
  }

  // Just enough ambient to keep the deepest shadow from going to pure black,
  // the way a real room bounces a little light back.
  stage.scene.add(new THREE.AmbientLight(0x16171c, 0.55));

  /** Put a lamp on a circle around the subject and point it inwards. */
  function placeLamp(lamp, angle, height, distance) {
    lamp.group.position.set(
      Math.sin(angle) * distance,
      height,
      Math.cos(angle) * distance,
    );
    lamp.light.position.set(0, 0, 0.05);
    lamp.group.lookAt(0, 0.72, 0);
  }

  // ---- grain --------------------------------------------------------------
  const look = createFilmLook({ grain: 0.05, vignette: 0.5 });
  stage.scene.add(look.mesh);

  // ---- animation ----------------------------------------------------------
  let keyAngle = params.keyAngle;

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    // Your finger is the key light's stand.
    const target = pointer.active
      ? params.keyAngle + pointer.x * 1.9
      : params.keyAngle + Math.sin(time * 0.16) * 0.55;
    keyAngle += (target - keyAngle) * Math.min(1, dt * 2.2);

    const keyHeight = params.keyHeight + (pointer.active ? pointer.y * 1.1 : Math.sin(time * 0.11) * 0.35);

    placeLamp(key, keyAngle, keyHeight, 3.5);
    placeLamp(fill, keyAngle - 2.1, 1.5, 4.0);
    placeLamp(rim, keyAngle + 2.7, 2.6, 3.2);

    key.light.intensity = 46 * params.key;
    fill.light.intensity = 46 * params.fill;
    rim.light.intensity = 38 * params.rim;

    key.face.material.opacity = 0.35 + 0.6 * Math.min(1, params.key);
    fill.face.material.opacity = 0.20 + 0.6 * Math.min(1, params.fill);
    rim.face.material.opacity = 0.25 + 0.6 * Math.min(1, params.rim);

    vessel.rotation.y += params.spin * dt;

    look.update(time);
  });

  stage.onDispose(() => {
    pointer.dispose();
    look.dispose();
    coveGeometry.dispose();
    cove.material.dispose();
    vesselGeometry.dispose();
    vessel.material.dispose();
    for (const lamp of [key, fill, rim]) {
      for (const child of lamp.group.children) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      }
    }
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
