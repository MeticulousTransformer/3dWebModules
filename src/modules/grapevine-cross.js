/**
 * GRAPEVINE CROSS
 *
 * The Georgian cross — ჯვარი ვაზისა — whose arms droop, because it was cut
 * from a living grapevine and bound at the middle with hair. Everything here
 * is a tube swept along a curve: the arms, the vine winding up the shaft, even
 * the binding. Grapes are one instanced sphere, leaves are one flat shape.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/textures.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createGradientEnvironment, createRadialGlowTexture } from '../lib/textures.js';
import { PALETTE, CSS_PALETTE } from '../lib/palette.js';

export const defaults = {
  droop: 0.34,    // how far the arm tips fall below the crossbar
  turn: 0.22,     // idle rotation, radians per second
  grapes: 64,
  halo: true,
};

const CROSSBAR_Y = 0.52;

/** A tube swept along a list of points. */
function vineTube(points, radius, material, segments = 64) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 8, false);
  return new THREE.Mesh(geometry, material);
}

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 42, position: [0, 0, 3.5] },
  });
  const pointer = createPointer(canvas);
  stage.scene.fog = new THREE.FogExp2(PALETTE.void, 0.10);

  const environment = createGradientEnvironment({
    top: '#1b1426', middle: '#07080c', bottom: '#2a1206', sun: '#ffd9a0',
  });
  stage.scene.environment = environment;

  const cross = new THREE.Group();
  stage.scene.add(cross);

  // ---- materials ----------------------------------------------------------
  const wood = new THREE.MeshStandardMaterial({
    color: 0x7a5836, roughness: 0.66, metalness: 0.18, flatShading: false,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: PALETTE.gold, metalness: 1, roughness: 0.26,
    emissive: PALETTE.gold, emissiveIntensity: 0.28,
  });
  const grapeMaterial = new THREE.MeshStandardMaterial({
    color: 0xa81f46, roughness: 0.24, metalness: 0.30,
    emissive: 0x5a0c26, emissiveIntensity: 0.9,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x3f7a34, roughness: 0.65, metalness: 0.05, side: THREE.DoubleSide,
  });

  // ---- the shaft ----------------------------------------------------------
  // Not perfectly straight: it was a vine before it was a cross.
  const shaft = vineTube([
    new THREE.Vector3(0, -1.20, 0),
    new THREE.Vector3(0.03, -0.60, 0.02),
    new THREE.Vector3(-0.02, 0.00, -0.01),
    new THREE.Vector3(0.02, 0.60, 0.02),
    new THREE.Vector3(0, 1.05, 0),
  ], 0.078, wood, 80);
  cross.add(shaft);

  // ---- the drooping arms --------------------------------------------------
  // Out along the crossbar, then down. That fall is the whole signature of
  // this cross, so it is the one number worth exposing as a parameter.
  for (const side of [-1, 1]) {
    const arm = vineTube([
      new THREE.Vector3(0, CROSSBAR_Y, 0),
      new THREE.Vector3(side * 0.30, CROSSBAR_Y + 0.02, 0.01),
      new THREE.Vector3(side * 0.58, CROSSBAR_Y - params.droop * 0.35, 0),
      new THREE.Vector3(side * 0.82, CROSSBAR_Y - params.droop, -0.01),
    ], 0.064, wood, 56);
    cross.add(arm);
  }

  // ---- the binding, where the two pieces meet -----------------------------
  for (let i = -1; i <= 1; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 8, 32), gold);
    band.rotation.y = Math.PI / 2;
    band.rotation.x = 0.2 * i;
    band.position.set(0, CROSSBAR_Y + i * 0.055, 0);
    cross.add(band);
  }

  // ---- the vine winding up the shaft --------------------------------------
  const spiralPoints = [];
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    const angle = t * Math.PI * 6;
    const radius = 0.10 + Math.sin(t * Math.PI) * 0.05;
    spiralPoints.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      -1.15 + t * 2.15,
      Math.sin(angle) * radius,
    ));
  }
  const vine = vineTube(spiralPoints, 0.024, wood, 180);
  cross.add(vine);

  // ---- grapes -------------------------------------------------------------
  // Four bunches, each a little cone of berries hanging off the vine.
  const grapeGeometry = new THREE.SphereGeometry(0.040, 12, 10);
  const grapes = new THREE.InstancedMesh(grapeGeometry, grapeMaterial, params.grapes);
  const matrix = new THREE.Matrix4();

  const BUNCHES = [
    { x: 0.64, y: CROSSBAR_Y - params.droop - 0.10, z: 0 },
    { x: -0.64, y: CROSSBAR_Y - params.droop - 0.10, z: 0 },
    { x: 0.11, y: -0.30, z: 0.10 },
    { x: -0.11, y: -0.78, z: -0.09 },
  ];

  for (let i = 0; i < params.grapes; i++) {
    const bunch = BUNCHES[i % BUNCHES.length];
    const depth = Math.floor(i / BUNCHES.length) / (params.grapes / BUNCHES.length);
    const spread = 0.075 * (1 - depth * 0.75);
    const angle = i * 2.4;

    matrix.makeScale(1, 1, 1);
    matrix.setPosition(
      bunch.x + Math.cos(angle) * spread,
      bunch.y - depth * 0.24,
      bunch.z + Math.sin(angle) * spread,
    );
    grapes.setMatrixAt(i, matrix);
  }
  grapes.instanceMatrix.needsUpdate = true;
  cross.add(grapes);

  // ---- leaves -------------------------------------------------------------
  // One heart-ish outline, reused and turned every which way.
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.10, 0.06, 0.14, 0.18, 0, 0.26);
  leafShape.bezierCurveTo(-0.14, 0.18, -0.10, 0.06, 0, 0);
  const leafGeometry = new THREE.ShapeGeometry(leafShape, 12);

  const leaves = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 9;
    const angle = t * Math.PI * 6 + 0.6;
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.set(
      Math.cos(angle) * 0.16,
      -1.05 + t * 2.05,
      Math.sin(angle) * 0.16,
    );
    leaf.rotation.set(Math.random() * 0.7 - 0.35, angle, Math.random() * 1.2 - 0.6);
    leaf.scale.setScalar(0.55 + Math.random() * 0.4);
    cross.add(leaf);
    leaves.push(leaf);
  }

  // ---- halo ---------------------------------------------------------------
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.006, 6, 128), gold);
  haloRing.position.y = CROSSBAR_Y - 0.1;
  haloRing.visible = params.halo;
  cross.add(haloRing);

  const glowTexture = createRadialGlowTexture({ color: CSS_PALETTE.gold, softness: 3.2 });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, opacity: 0.3,
  }));
  glow.scale.setScalar(4.6);
  glow.position.set(0, CROSSBAR_Y - 0.1, -0.9);
  stage.scene.add(glow);

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x2a3450, 1.7));

  const candle = new THREE.PointLight(0xffb060, 18, 8, 2);
  candle.position.set(0.6, -1.4, 1.5);
  stage.scene.add(candle);

  const key = new THREE.DirectionalLight(0xffe6c0, 3.4);
  key.position.set(2, 3, 4);
  stage.scene.add(key);

  const rim = new THREE.DirectionalLight(PALETTE.violet, 1.5);
  rim.position.set(-3, 1, -3);
  stage.scene.add(rim);

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    cross.rotation.y += params.turn * dt;
    cross.rotation.x = pointer.y * 0.28;
    cross.rotation.z = Math.sin(time * 0.4) * 0.02 + pointer.x * 0.12;

    haloRing.rotation.z = time * 0.1;
    haloRing.visible = params.halo;

    for (let i = 0; i < leaves.length; i++) {
      leaves[i].rotation.z += Math.sin(time * 1.1 + i) * dt * 0.25;
    }

    gold.emissiveIntensity = 0.24 + Math.sin(time * 1.7) * 0.12;
    candle.intensity = 16 + Math.sin(time * 5.3) * 4 + Math.sin(time * 11.7) * 2;
    glow.material.opacity = 0.26 + Math.sin(time * 0.9) * 0.08;
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    glowTexture.dispose();
    grapeGeometry.dispose();
    leafGeometry.dispose();
    wood.dispose();
    gold.dispose();
    grapeMaterial.dispose();
    leafMaterial.dispose();
  });

  stage.setParam = createParamSetter(params, {
    halo: (value) => { haloRing.visible = Boolean(value); },
  });

  return stage.start();
}
