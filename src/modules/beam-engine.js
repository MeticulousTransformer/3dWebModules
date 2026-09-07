/**
 * BEAM ENGINE
 *
 * A Watt beam engine, solved rather than animated.
 *
 * One number goes in — the crank angle — and everything else is worked out
 * from the linkage. The connecting rod has a fixed length and the beam end
 * travels on a fixed circle, so the beam's angle is wherever those two facts
 * intersect. That is a circle-circle intersection, and it is the whole
 * simulation. The piston then hangs off the far end of the beam by another
 * rod, which is a slider-crank, and it has a closed form too.
 *
 * Because it is solved, the piston's motion is not a sine wave. It dwells at
 * the top slightly longer than at the bottom, exactly as the real machine does,
 * and nobody had to key that in.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/textures.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createGradientEnvironment, createRadialGlowTexture } from '../lib/textures.js';
import { WORKS, CSS_WORKS } from '../lib/palette.js';

export const defaults = {
  speed: 1.1,        // crank revolutions, radians a second
  crankRadius: 0.55,
  steam: 1,
};

// The frame the linkage hangs on. Chosen so the beam never reaches a position
// the connecting rod cannot satisfy.
const BEAM_PIVOT = { x: 0, y: 2.2 };
const BEAM_HALF = 1.5;
const CRANK_CENTRE = { x: 1.9, y: -1.4 };
const CONNECTING_ROD = 3.9;
const PISTON_X = -1.45;
const PISTON_ROD = 1.2;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: WORKS.soot,
    camera: { fov: 40, position: [0, 0.1, 7.4], lookAt: [0, 0.1, 0] },
  });
  const pointer = createPointer(canvas);

  const environment = createGradientEnvironment({
    top: '#221b13', middle: '#0a0807', bottom: '#331d0b', sun: '#ffd9a0',
  });
  stage.scene.environment = environment;

  const engine = new THREE.Group();
  // The flywheel sits out to the right, so shift the lot left to centre it.
  engine.position.x = -0.45;
  stage.scene.add(engine);

  const iron = new THREE.MeshStandardMaterial({ color: 0x5a5148, metalness: 0.62, roughness: 0.66 });
  const brass = new THREE.MeshStandardMaterial({ color: WORKS.brass, metalness: 0.95, roughness: 0.28 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8d9098, metalness: 0.92, roughness: 0.34 });

  // ---- the house ----------------------------------------------------------
  const floor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 2.4), iron);
  floor.position.y = -2.6;
  engine.add(floor);

  for (const x of [-0.85, 0.85]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 4.6, 20), iron);
    column.position.set(x, -0.1, 0);
    engine.add(column);
  }

  const entablature = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, 0.5), iron);
  entablature.position.set(0, 2.2, 0);
  engine.add(entablature);

  // ---- the beam -----------------------------------------------------------
  // A lozenge: deep at the pivot where the load is, tapering to the ends.
  const beamShape = new THREE.Shape();
  beamShape.moveTo(-BEAM_HALF, 0);
  beamShape.lineTo(-BEAM_HALF * 0.55, 0.26);
  beamShape.lineTo(BEAM_HALF * 0.55, 0.26);
  beamShape.lineTo(BEAM_HALF, 0);
  beamShape.lineTo(BEAM_HALF * 0.55, -0.26);
  beamShape.lineTo(-BEAM_HALF * 0.55, -0.26);
  beamShape.closePath();

  for (const side of [-1, 1]) {
    const lighten = new THREE.Path();
    lighten.moveTo(side * 0.32, 0);
    lighten.lineTo(side * 0.75, 0.14);
    lighten.lineTo(side * 1.14, 0);
    lighten.lineTo(side * 0.75, -0.14);
    lighten.closePath();
    beamShape.holes.push(lighten);
  }

  const beamGeometry = new THREE.ExtrudeGeometry(beamShape, {
    depth: 0.22, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 1,
  });
  beamGeometry.translate(0, 0, -0.11);

  const beam = new THREE.Mesh(beamGeometry, iron);
  const beamPivot = new THREE.Group();
  beamPivot.position.set(BEAM_PIVOT.x, BEAM_PIVOT.y, 0.35);
  beamPivot.add(beam);
  engine.add(beamPivot);

  const trunnion = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.7, 20), brass);
  trunnion.rotation.x = Math.PI / 2;
  trunnion.position.copy(beamPivot.position);
  engine.add(trunnion);

  // ---- the flywheel and crank --------------------------------------------
  const flywheelGroup = new THREE.Group();
  flywheelGroup.position.set(CRANK_CENTRE.x, CRANK_CENTRE.y, 0);
  engine.add(flywheelGroup);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.15, 14, 64), iron);
  flywheelGroup.add(rim);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 20), brass);
  hub.rotation.x = Math.PI / 2;
  flywheelGroup.add(hub);

  const spokeGeometry = new THREE.BoxGeometry(1.12, 0.09, 0.09);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(spokeGeometry, iron);
    const angle = (i / 6) * Math.PI * 2;
    spoke.position.set(Math.cos(angle) * 0.62, Math.sin(angle) * 0.62, 0);
    spoke.rotation.z = angle;
    flywheelGroup.add(spoke);
  }

  const crankArm = new THREE.Mesh(new THREE.BoxGeometry(params.crankRadius + 0.2, 0.14, 0.12), steel);
  flywheelGroup.add(crankArm);

  const crankPin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 14), brass);
  crankPin.rotation.x = Math.PI / 2;
  flywheelGroup.add(crankPin);

  // ---- the rods -----------------------------------------------------------
  const connectingRod = new THREE.Mesh(new THREE.BoxGeometry(1, 0.11, 0.11), steel);
  engine.add(connectingRod);

  const pistonRod = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1, 0.09), steel);
  engine.add(pistonRod);

  // ---- the cylinder -------------------------------------------------------
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 1.7, 26, 1, true),
    brass,
  );
  cylinder.position.set(PISTON_X, -1.05, 0);
  engine.add(cylinder);

  for (const y of [-0.22, -1.88]) {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.10, 26), iron);
    flange.position.set(PISTON_X, y, 0);
    engine.add(flange);
  }

  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.18, 24), steel);
  engine.add(piston);

  // ---- steam --------------------------------------------------------------
  const puffTexture = createRadialGlowTexture({ color: CSS_WORKS.steam, softness: 1.9 });
  const puffs = [];
  for (let i = 0; i < 10; i++) {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({
      map: puffTexture, transparent: true, opacity: 0, depthWrite: false,
    }));
    puff.scale.setScalar(0.4);
    engine.add(puff);
    puffs.push({ sprite: puff, life: 0, drift: 0 });
  }
  let nextPuff = 0;

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x2e2418, 2.1));

  const key = new THREE.DirectionalLight(0xffd9a0, 3.8);
  key.position.set(3, 4, 6);
  stage.scene.add(key);

  const firebox = new THREE.PointLight(WORKS.ember, 30, 11, 2);
  firebox.position.set(-2.4, -2.2, 1.4);
  stage.scene.add(firebox);

  const rim2 = new THREE.DirectionalLight(0x9fb6d8, 1.1);
  rim2.position.set(-4, 2, -3);
  stage.scene.add(rim2);

  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 7.4 * Math.tan((40 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    engine.scale.setScalar(Math.min(1.1, visibleWidth / 7.0, visibleHeight / 6.4));
  });

  // ---- the linkage --------------------------------------------------------
  let crankAngle = 0;
  let beamAngle = 0;
  let lastStroke = 0;

  /** Where the two circles meet: the beam angle this crank angle demands. */
  function solveBeam(pinX, pinY) {
    const dx = BEAM_PIVOT.x - pinX;
    const dy = BEAM_PIVOT.y - pinY;
    const distance = Math.hypot(dx, dy);

    const k = (CONNECTING_ROD * CONNECTING_ROD - distance * distance - BEAM_HALF * BEAM_HALF)
      / (2 * BEAM_HALF);
    const ratio = Math.max(-1, Math.min(1, k / distance));

    const base = Math.atan2(dy, dx);
    const spread = Math.acos(ratio);

    // Two solutions; a real mechanism cannot jump between them, so keep the
    // one nearer where the beam already was.
    const a = base + spread;
    const b = base - spread;
    const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
    return Math.abs(wrap(a - beamAngle)) < Math.abs(wrap(b - beamAngle)) ? a : b;
  }

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    const drive = params.speed * (pointer.active ? 0.3 + (pointer.x * 0.5 + 0.5) * 2.2 : 1);
    crankAngle += drive * dt;

    // The crank pin, and the beam angle that follows from it.
    const pinX = CRANK_CENTRE.x + Math.cos(crankAngle) * params.crankRadius;
    const pinY = CRANK_CENTRE.y + Math.sin(crankAngle) * params.crankRadius;
    beamAngle = solveBeam(pinX, pinY);

    flywheelGroup.rotation.z = crankAngle;
    crankArm.position.set(
      Math.cos(crankAngle) * params.crankRadius * 0.5,
      Math.sin(crankAngle) * params.crankRadius * 0.5, 0,
    );
    crankArm.rotation.z = crankAngle - flywheelGroup.rotation.z;
    crankPin.position.set(
      Math.cos(crankAngle) * params.crankRadius,
      Math.sin(crankAngle) * params.crankRadius, 0.16,
    );

    beamPivot.rotation.z = beamAngle;

    // Both ends of the beam, in world terms.
    const rightX = BEAM_PIVOT.x + Math.cos(beamAngle) * BEAM_HALF;
    const rightY = BEAM_PIVOT.y + Math.sin(beamAngle) * BEAM_HALF;
    const leftX = BEAM_PIVOT.x - Math.cos(beamAngle) * BEAM_HALF;
    const leftY = BEAM_PIVOT.y - Math.sin(beamAngle) * BEAM_HALF;

    // Connecting rod: crank pin to the right end.
    const rodDx = rightX - pinX;
    const rodDy = rightY - pinY;
    connectingRod.position.set((rightX + pinX) / 2, (rightY + pinY) / 2, 0.16);
    connectingRod.scale.x = Math.hypot(rodDx, rodDy);
    connectingRod.rotation.z = Math.atan2(rodDy, rodDx);

    // Piston rod: the left end down to a piston that can only move vertically.
    const offset = PISTON_X - leftX;
    const drop = Math.sqrt(Math.max(0.01, PISTON_ROD * PISTON_ROD - offset * offset));
    const pistonY = leftY - drop;

    pistonRod.position.set((leftX + PISTON_X) / 2, (leftY + pistonY) / 2, 0.16);
    pistonRod.scale.y = Math.hypot(offset, drop);
    pistonRod.rotation.z = Math.atan2(PISTON_X - leftX, -(pistonY - leftY)) * -1;
    piston.position.set(PISTON_X, pistonY, 0);

    // A puff at each end of the stroke, when the valve would have changed over.
    const stroke = Math.sign(Math.cos(crankAngle));
    if (stroke !== lastStroke && params.steam > 0) {
      lastStroke = stroke;
      const puff = puffs[nextPuff];
      nextPuff = (nextPuff + 1) % puffs.length;
      puff.life = 1;
      puff.drift = (Math.random() - 0.5) * 0.5;
      puff.sprite.position.set(PISTON_X + 0.3, -0.15, 0.3);
    }

    for (const puff of puffs) {
      if (puff.life <= 0) continue;
      puff.life -= dt * 0.55;
      puff.sprite.position.y += dt * 0.75;
      puff.sprite.position.x += puff.drift * dt;
      puff.sprite.scale.setScalar(0.4 + (1 - puff.life) * 1.6);
      puff.sprite.material.opacity = Math.max(0, puff.life * 0.42 * params.steam);
    }

    firebox.intensity = 24 + Math.sin(time * 5.3) * 6 + Math.sin(time * 11.9) * 3;

    engine.rotation.y = pointer.x * 0.10;
    engine.rotation.x = pointer.y * 0.06;
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    puffTexture.dispose();
    beamGeometry.dispose();
    spokeGeometry.dispose();
    for (const mesh of [floor, entablature, trunnion, rim, hub, crankArm, crankPin,
                        connectingRod, pistonRod, cylinder, piston]) {
      mesh.geometry.dispose();
    }
    for (const puff of puffs) puff.sprite.material.dispose();
    iron.dispose();
    brass.dispose();
    steel.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
