/**
 * ESCAPEMENT
 *
 * The part of a clock that makes it a clock.
 *
 * A weight wants to turn the escape wheel and would run it away in seconds.
 * The anchor stops it, and lets exactly one tooth past each time the pendulum
 * swings through. In return, the wheel gives the pendulum a small shove as it
 * escapes — which is the only reason a pendulum that would otherwise die away
 * keeps going for a hundred years.
 *
 * The pendulum here is integrated properly: theta double dot equals minus g
 * over L sine theta, damped. Nothing sets its period, and nothing schedules
 * the ticking. Both fall out of the length of the rod. Lengthen it and the
 * clock runs slow, for the same reason a real one does.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/textures.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createGradientEnvironment } from '../lib/textures.js';
import { WORKS } from '../lib/palette.js';

export const defaults = {
  rodLength: 1.05,   // the only thing that decides the rate
  amplitude: 0.20,   // the swing it settles at
  damping: 0.24,
  teeth: 30,
};

const GRAVITY = 9.81;
const WHEEL_RADIUS = 0.86;
const ANCHOR_PIVOT_Y = 1.32;   // above the wheel centre

/**
 * An escape wheel tooth: a long face that the pallet slides along, then a
 * sharp tip, then a steep back the pallet can lock against.
 */
function escapeWheelShape(teeth, outerRadius, innerRadius) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;

  for (let i = 0; i < teeth; i++) {
    const base = i * step;

    // The impulse face, curving out to the tip.
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const angle = base + step * 0.70 * t;
      const radius = innerRadius + (outerRadius - innerRadius) * Math.pow(t, 1.5);
      const point = [Math.cos(angle) * radius, Math.sin(angle) * radius];
      if (i === 0 && k === 0) shape.moveTo(point[0], point[1]);
      else shape.lineTo(point[0], point[1]);
    }

    // The locking face: a near-radial drop back to the rim.
    const backAngle = base + step * 0.76;
    shape.lineTo(Math.cos(backAngle) * innerRadius, Math.sin(backAngle) * innerRadius);

    // Along the rim to the next tooth.
    for (let k = 1; k <= 2; k++) {
      const angle = backAngle + (step * 0.24 * k) / 2;
      shape.lineTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
    }
  }

  shape.closePath();

  const bore = new THREE.Path();
  bore.absarc(0, 0, outerRadius * 0.10, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  // Four spokes, punched out of the web.
  for (let i = 0; i < 4; i++) {
    const centre = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const half = 0.55;
    const hole = new THREE.Path();
    const rIn = outerRadius * 0.18;
    const rOut = innerRadius * 0.80;
    for (let k = 0; k <= 8; k++) {
      const angle = centre - half + (2 * half * k) / 8;
      const point = [Math.cos(angle) * rOut, Math.sin(angle) * rOut];
      if (k === 0) hole.moveTo(point[0], point[1]);
      else hole.lineTo(point[0], point[1]);
    }
    for (let k = 8; k >= 0; k--) {
      const angle = centre - half + (2 * half * k) / 8;
      hole.lineTo(Math.cos(angle) * rIn, Math.sin(angle) * rIn);
    }
    hole.closePath();
    shape.holes.push(hole);
  }

  return shape;
}

/** The anchor: a bowed bar with a pallet at each end. */
function anchorShape(span, reach, thickness) {
  const points = [];
  const arc = (radius, from, to, steps) => {
    for (let k = 0; k <= steps; k++) {
      const angle = from + ((to - from) * k) / steps;
      points.push([Math.sin(angle) * radius, -Math.cos(angle) * radius]);
    }
  };

  arc(reach + thickness, -span, span, 12);   // the outer edge of the bow
  arc(reach - thickness, span, -span, 12);   // and back along the inner edge

  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => (index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  return shape;
}

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: WORKS.soot,
    camera: { fov: 40, position: [0, 0, 5.6] },
  });
  const pointer = createPointer(canvas);

  const environment = createGradientEnvironment({
    top: '#241d14', middle: '#0b0908', bottom: '#301c0c', sun: '#ffdca8',
  });
  stage.scene.environment = environment;

  const movement = new THREE.Group();
  // The works hang below their pivot, so lift the whole group to put the
  // mechanism rather than the empty air in the middle of the frame.
  movement.position.y = -0.12;
  stage.scene.add(movement);

  // ---- materials ----------------------------------------------------------
  const brass = new THREE.MeshStandardMaterial({ color: WORKS.brass, metalness: 0.95, roughness: 0.28 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xbcc2ca, metalness: 0.9, roughness: 0.26 });
  const iron = new THREE.MeshStandardMaterial({ color: WORKS.iron, metalness: 0.5, roughness: 0.82 });

  // ---- the backplate ------------------------------------------------------
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshStandardMaterial({ color: 0x0c0908, metalness: 0.25, roughness: 0.95 }),
  );
  plate.position.z = -0.5;
  movement.add(plate);

  // ---- the escape wheel ---------------------------------------------------
  const wheelGeometry = new THREE.ExtrudeGeometry(
    escapeWheelShape(params.teeth, WHEEL_RADIUS, WHEEL_RADIUS * 0.86),
    { depth: 0.045, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 1 },
  );
  wheelGeometry.translate(0, 0, -0.022);
  const wheel = new THREE.Mesh(wheelGeometry, brass);
  movement.add(wheel);

  const arbor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 18), steel);
  arbor.rotation.x = Math.PI / 2;
  movement.add(arbor);

  // ---- the anchor ---------------------------------------------------------
  // Its pallets have to sit on the wheel's rim, so the reach is the distance
  // from the anchor's pivot down to that rim.
  const reach = ANCHOR_PIVOT_Y - WHEEL_RADIUS * 0.93;
  const anchorGeometry = new THREE.ExtrudeGeometry(
    anchorShape(0.42, reach, 0.075),
    { depth: 0.07, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 1, curveSegments: 1 },
  );
  anchorGeometry.translate(0, 0, 0.05);

  const anchor = new THREE.Mesh(anchorGeometry, steel);
  const anchorPivot = new THREE.Group();
  anchorPivot.position.y = ANCHOR_PIVOT_Y;
  anchorPivot.add(anchor);
  movement.add(anchorPivot);

  // Jewelled pallets, one at each end of the bow.
  const palletGeometry = new THREE.BoxGeometry(0.10, 0.12, 0.12);
  const palletMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4384c, metalness: 0.2, roughness: 0.12,
  });
  for (const side of [-1, 1]) {
    const pallet = new THREE.Mesh(palletGeometry, palletMaterial);
    pallet.position.set(Math.sin(side * 0.42) * reach, -Math.cos(side * 0.42) * reach, 0.05);
    pallet.rotation.z = side * 0.42;
    anchorPivot.add(pallet);
  }

  const anchorArbor = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 16), brass);
  anchorArbor.rotation.x = Math.PI / 2;
  anchorArbor.position.y = ANCHOR_PIVOT_Y;
  movement.add(anchorArbor);

  // ---- the pendulum -------------------------------------------------------
  const pendulum = new THREE.Group();
  pendulum.position.y = ANCHOR_PIVOT_Y;
  movement.add(pendulum);

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.030, 0.030, params.rodLength * 2.2, 12),
    steel,
  );
  rod.position.y = -params.rodLength * 1.1;
  pendulum.add(rod);

  const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.07, 40), brass);
  bob.rotation.x = Math.PI / 2;
  bob.position.y = -params.rodLength * 2.05;
  pendulum.add(bob);

  const bobRing = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.022, 8, 48), steel);
  bobRing.position.y = -params.rodLength * 2.05;
  bobRing.position.z = 0.02;
  pendulum.add(bobRing);

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x231b14, 1.5));

  const key = new THREE.DirectionalLight(0xffdca8, 3.1);
  key.position.set(2.5, 3.5, 5);
  stage.scene.add(key);

  const lamp = new THREE.PointLight(WORKS.ember, 16, 9, 2);
  lamp.position.set(-1.8, 1.6, 2);
  stage.scene.add(lamp);

  const rim = new THREE.DirectionalLight(0x9fb6d8, 1.0);
  rim.position.set(-3, -1, -2);
  stage.scene.add(rim);

  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 5.6 * Math.tan((40 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    // Frame the movement, not the pendulum. A clock escapement is mostly
    // pendulum by length, and all of the interest is in the top foot of it —
    // so fit the wheel and the anchor, and let the rod run out of shot.
    movement.scale.setScalar(Math.min(1.7, visibleWidth / 2.6, visibleHeight / 2.5));
  });

  // ---- the physics --------------------------------------------------------
  let angle = params.amplitude;
  let speed = 0;

  // Which pallet is holding the wheel, and where the wheel is being held.
  let lockedSide = 1;
  let wheelAngle = 0;
  let wheelTarget = 0;
  let ticks = 0;

  const toothStep = (Math.PI * 2) / params.teeth;

  function step(dt) {
    // A pendulum, and nothing more.
    const acceleration = -(GRAVITY / params.rodLength) * Math.sin(angle) - params.damping * speed;
    speed += acceleration * dt;
    angle += speed * dt;

    // The anchor is rigid with the pendulum, geared down.
    const anchorAngle = angle * 0.30;

    // Release: when the anchor has swung far enough the pallet clears the
    // tooth it was holding, one tooth escapes, and the other pallet catches
    // the next one.
    const release = 0.055;
    if (lockedSide === 1 && anchorAngle > release) {
      lockedSide = -1;
      wheelTarget -= toothStep;
      ticks += 1;
      speed += 0.16 * Math.sign(speed || 1); // the impulse that keeps it alive
    } else if (lockedSide === -1 && anchorAngle < -release) {
      lockedSide = 1;
      wheelTarget -= toothStep;
      ticks += 1;
      speed += 0.16 * Math.sign(speed || 1);
    }

    // The wheel drops onto the next tooth fast, then sits dead still.
    wheelAngle += (wheelTarget - wheelAngle) * Math.min(1, dt * 34);

    return anchorAngle;
  }

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);
    const clamped = Math.min(dt, 1 / 60);

    // Two half-steps: releasing is a threshold test, and thresholds are
    // happier with a small timestep than a big one.
    step(clamped / 2);
    const anchorAngle = step(clamped / 2);

    pendulum.rotation.z = angle;
    anchorPivot.rotation.z = anchorAngle;
    wheel.rotation.z = wheelAngle;
    arbor.rotation.y = wheelAngle;

    lamp.intensity = 13 + Math.sin(time * 4.3) * 2.5;

    movement.rotation.y = pointer.x * 0.16;
    movement.rotation.x = pointer.y * 0.10;
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    wheelGeometry.dispose();
    anchorGeometry.dispose();
    palletGeometry.dispose();
    palletMaterial.dispose();
    plate.geometry.dispose();
    plate.material.dispose();
    for (const mesh of [arbor, anchorArbor, rod, bob, bobRing]) mesh.geometry.dispose();
    brass.dispose();
    steel.dispose();
    iron.dispose();
  });

  stage.setParam = createParamSetter(params, {
    rodLength: (value) => {
      rod.position.y = -value * 1.1;
      rod.scale.y = value / defaults.rodLength;
      bob.position.y = -value * 2.05;
      bobRing.position.y = -value * 2.05;
    },
  });

  return stage.start();
}
