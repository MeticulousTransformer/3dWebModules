/**
 * FLYBALL GOVERNOR
 *
 * Watt's governor, which is the first machine that ever corrected itself, and
 * the reason control theory exists.
 *
 * Two balls hang from a spinning spindle. Spin faster and they fly outward;
 * the arms lift a sleeve; the sleeve closes a throttle; the engine gets less
 * steam and slows down. Slow down and the balls drop, the throttle opens, and
 * it speeds up again. Nothing in it knows what speed it is meant to hold — the
 * speed is just where those two effects cancel.
 *
 * Everything here runs that loop for real:
 *
 *   ball    alpha'' = w^2 sin a cos a - (g/L) sin a - c alpha'
 *   engine  w'      = (torque(throttle) - load) / inertia
 *   linkage throttle = how high the sleeve has ridden
 *
 * Drag left and right to change the load and watch it hunt and settle.
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
  armLength: 1.05,
  load: 0.55,       // what the engine is being asked to pull
  damping: 0.9,     // friction in the arm joints
  power: 3.2,       // how much torque wide-open steam is worth
  inertia: 2.6,     // the flywheel. bigger means slower to react, steadier.
};

const GRAVITY = 9.81;
const MIN_ANGLE = 0.16;   // the arms rest here
const MAX_ANGLE = 1.15;   // and stop here

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: WORKS.soot,
    camera: { fov: 38, position: [0, 0.15, 5.2], lookAt: [0, -0.1, 0] },
  });
  const pointer = createPointer(canvas);

  const environment = createGradientEnvironment({
    top: '#241d14', middle: '#0b0908', bottom: '#341e0c', sun: '#ffdca8',
  });
  stage.scene.environment = environment;

  const machine = new THREE.Group();
  // Pipe on the right, gauge on the left, spindle in the middle — but the
  // pipe reaches further, so nudge it back.
  machine.position.x = -0.32;
  stage.scene.add(machine);

  const brass = new THREE.MeshStandardMaterial({ color: WORKS.brass, metalness: 0.95, roughness: 0.26 });
  const polished = new THREE.MeshStandardMaterial({ color: 0xd8c060, metalness: 0.98, roughness: 0.14 });
  const iron = new THREE.MeshStandardMaterial({ color: WORKS.iron, metalness: 0.55, roughness: 0.8 });
  const copper = new THREE.MeshStandardMaterial({ color: WORKS.copper, metalness: 0.9, roughness: 0.36 });

  // ---- the stand ----------------------------------------------------------
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.10, 0.20, 40), iron);
  base.position.y = -1.85;
  machine.add(base);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.42, 28), brass);
  plinth.position.y = -1.55;
  machine.add(plinth);

  // The spindle. Everything above the plinth turns with it.
  const spinner = new THREE.Group();
  spinner.position.y = -1.34;
  machine.add(spinner);

  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 2.5, 20), polished);
  spindle.position.y = 1.25;
  spinner.add(spindle);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 24), brass);
  collar.position.y = 2.42;
  spinner.add(collar);

  // ---- the arms and their balls -------------------------------------------
  const PIVOT_Y = 2.34;   // where the arms hang from, in spinner space
  const arms = [];

  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.13, PIVOT_Y, 0);
    spinner.add(pivot);

    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, params.armLength, 12),
      polished,
    );
    arm.position.y = -params.armLength / 2;
    pivot.add(arm);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 28, 20), brass);
    ball.position.y = -params.armLength;
    pivot.add(ball);

    arms.push({ pivot, side, arm, ball });
  }

  // ---- the sleeve, and the links that lift it -----------------------------
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.22, 24), copper);
  spinner.add(sleeve);

  const linkGeometry = new THREE.CylinderGeometry(0.024, 0.024, 1, 10);
  const links = [];
  for (const side of [-1, 1]) {
    const link = new THREE.Mesh(linkGeometry, polished);
    spinner.add(link);
    links.push({ link, side });
  }

  // ---- the throttle it works ----------------------------------------------
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 2.4, 24, 1, true), copper);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(1.7, -0.6, 0);
  machine.add(pipe);

  const butterfly = new THREE.Mesh(new THREE.CircleGeometry(0.25, 28), brass);
  butterfly.position.set(1.7, -0.6, 0);
  butterfly.rotation.y = Math.PI / 2;
  machine.add(butterfly);

  const rocker = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.05, 0.05), polished);
  rocker.position.set(0.95, -0.6, 0);
  machine.add(rocker);

  // ---- a gauge, so the speed is readable ---------------------------------
  const gaugeFace = new THREE.Mesh(new THREE.CircleGeometry(0.34, 40), brass);
  gaugeFace.position.set(-1.75, -0.55, 0.1);
  machine.add(gaugeFace);

  const gaugeRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 44), copper);
  gaugeRing.position.copy(gaugeFace.position);
  machine.add(gaugeRing);

  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.018, 0.01), iron);
  const needlePivot = new THREE.Group();
  needlePivot.position.copy(gaugeFace.position).setZ(0.12);
  needlePivot.add(needle);
  needle.position.x = 0.12;
  machine.add(needlePivot);

  for (let i = 0; i <= 10; i++) {
    const angle = Math.PI * 1.25 - (i / 10) * Math.PI * 1.5;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), iron);
    tick.position.set(
      gaugeFace.position.x + Math.cos(angle) * 0.27,
      gaugeFace.position.y + Math.sin(angle) * 0.27,
      0.12,
    );
    tick.rotation.z = angle;
    machine.add(tick);
  }

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x2c2318, 2.0));

  const key = new THREE.DirectionalLight(0xffdca8, 3.0);
  key.position.set(3, 4, 5);
  stage.scene.add(key);

  const firebox = new THREE.PointLight(WORKS.ember, 22, 10, 2);
  firebox.position.set(-1.4, -2.0, 1.6);
  stage.scene.add(firebox);

  const rim = new THREE.DirectionalLight(0x9fb6d8, 1.1);
  rim.position.set(-4, 1, -3);
  stage.scene.add(rim);

  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 5.2 * Math.tan((38 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    machine.scale.setScalar(Math.min(1.25, visibleWidth / 4.0, visibleHeight / 3.7));
  });

  // ---- the loop that runs itself -----------------------------------------
  let ballAngle = 0.35;     // from vertical
  let ballSpeed = 0;
  let spin = 2.2;           // radians a second
  let spindleAngle = 0;

  function step(dt) {
    const L = params.armLength;

    // The ball: flung out by rotation, pulled down by gravity.
    const acceleration =
      spin * spin * Math.sin(ballAngle) * Math.cos(ballAngle)
      - (GRAVITY / L) * Math.sin(ballAngle)
      - params.damping * ballSpeed;

    ballSpeed += acceleration * dt;
    ballAngle += ballSpeed * dt;

    // The arms hit their stops.
    if (ballAngle < MIN_ANGLE) { ballAngle = MIN_ANGLE; ballSpeed = Math.max(0, ballSpeed); }
    if (ballAngle > MAX_ANGLE) { ballAngle = MAX_ANGLE; ballSpeed = Math.min(0, ballSpeed); }

    // The linkage: how far the sleeve has ridden up, 0 to 1.
    const throttleClosed = (ballAngle - MIN_ANGLE) / (MAX_ANGLE - MIN_ANGLE);

    // The engine: open throttle means torque, and the load takes it away.
    const torque = params.power * (1 - throttleClosed);
    spin += ((torque - params.load) / params.inertia) * dt;
    spin = Math.max(0, spin);

    spindleAngle += spin * dt;
    return throttleClosed;
  }

  // ---- animation ----------------------------------------------------------
  const scratch = new THREE.Vector3();

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);
    const clamped = Math.min(dt, 1 / 50);

    // Your finger is the load on the engine.
    if (pointer.active) params.load = 0.15 + (pointer.x * 0.5 + 0.5) * 1.7;

    const throttleClosed = step(clamped);

    spinner.rotation.y = spindleAngle;

    // The arms follow the one angle the physics produced.
    for (const { pivot, side } of arms) {
      pivot.rotation.z = side * ballAngle;
    }

    // The sleeve rides where the geometry puts it: the vertical drop of an
    // arm of this length at this angle.
    const sleeveY = PIVOT_Y - params.armLength * Math.cos(ballAngle) * 0.72;
    sleeve.position.y = sleeveY;

    // And the links join each arm's ball to the sleeve, so nothing floats.
    for (const { link, side } of links) {
      const ballX = side * (0.13 + Math.sin(ballAngle) * params.armLength);
      const ballY = PIVOT_Y - Math.cos(ballAngle) * params.armLength;
      const dx = side * 0.16 - ballX;
      const dy = sleeveY - ballY;
      const length = Math.hypot(dx, dy);

      link.position.set((ballX + side * 0.16) / 2, (ballY + sleeveY) / 2, 0);
      link.scale.y = length;
      link.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    }

    // Rocker and butterfly valve, driven off the sleeve.
    rocker.rotation.z = -0.35 + throttleClosed * 0.5;
    butterfly.rotation.z = throttleClosed * (Math.PI / 2) * 0.95;

    // The gauge reads the actual speed.
    const reading = Math.min(1, spin / 5);
    needlePivot.rotation.z = Math.PI * 1.25 - reading * Math.PI * 1.5;

    firebox.intensity = (16 + Math.sin(time * 6.1) * 4) * (1 - throttleClosed * 0.5);

    machine.rotation.y = pointer.x * 0.10;
    machine.rotation.x = -0.02 + pointer.y * 0.10;
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    linkGeometry.dispose();
    for (const mesh of [base, plinth, spindle, collar, sleeve, pipe, butterfly, rocker, gaugeFace, gaugeRing, needle]) {
      mesh.geometry.dispose();
    }
    for (const { arm, ball } of arms) { arm.geometry.dispose(); ball.geometry.dispose(); }
    brass.dispose();
    polished.dispose();
    iron.dispose();
    copper.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
