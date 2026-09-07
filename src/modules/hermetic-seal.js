/**
 * HERMETIC SEAL
 *
 * Two horizontal discs of engraved geometry, one above and one below, turning
 * against each other with a column of light between them. As above, so below —
 * built as an actual machine rather than a picture of one.
 *
 * Everything is drawn in the XZ plane (flat, like a table) so the camera can
 * look down on it from a low angle.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/glyphs.js ../lib/textures.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createGlyphStrip, GLYPH_SETS } from '../lib/glyphs.js';
import { createRadialGlowTexture } from '../lib/textures.js';
import { PALETTE, CSS_PALETTE } from '../lib/palette.js';
import { createParamSetter } from '../lib/params.js';

export const defaults = {
  spin: 1,      // multiplies every rotation speed
  tilt: 0.28,   // how far the pointer can lean the machine
  gap: 1.05,    // vertical distance from the centre to each disc
};

/** A flat ring lying in the XZ plane. */
function flatRing(radius, thickness, color, opacity) {
  const geometry = new THREE.TorusGeometry(radius, thickness, 6, 128);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

/** A regular polygon outline lying in the XZ plane. */
function flatPolygon(sides, radius, color, opacity, phase = 0) {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const angle = phase + (i / sides) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.LineLoop(geometry, material);
}

/** A standing rim of glyphs around the edge of a disc. */
function glyphRim(radius, height, texture, color, opacity) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true);
  const material = new THREE.MeshBasicMaterial({
    map: texture, color, transparent: true, opacity,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

/**
 * One disc. Returns the group plus the list of things that spin, so the caller
 * can turn them at their own rates without digging through the hierarchy.
 */
function buildSeal({ outerStrip, innerStrip, brightness }) {
  const group = new THREE.Group();
  const spinners = [];
  const spin = (object, speed) => { group.add(object); spinners.push({ object, speed }); return object; };

  spin(glyphRim(1.95, 0.34, outerStrip, PALETTE.gold, 0.95 * brightness), 0.10);
  spin(glyphRim(1.34, 0.24, innerStrip, PALETTE.cyan, 0.85 * brightness), -0.19);

  spin(flatRing(2.06, 0.006, PALETTE.gold, 0.55 * brightness), 0);
  spin(flatRing(1.80, 0.004, PALETTE.gold, 0.35 * brightness), 0);
  spin(flatRing(1.20, 0.005, PALETTE.cyan, 0.45 * brightness), 0);
  spin(flatRing(0.52, 0.004, PALETTE.violet, 0.60 * brightness), 0);

  // The hexagram: two triangles turning in opposite directions.
  spin(flatPolygon(3, 1.14, PALETTE.gold, 0.75 * brightness, 0), -0.31);
  spin(flatPolygon(3, 1.14, PALETTE.gold, 0.75 * brightness, Math.PI / 3), 0.31);
  spin(flatPolygon(4, 0.92, PALETTE.cyan, 0.55 * brightness, Math.PI / 4), 0.14);
  spin(flatPolygon(12, 1.62, PALETTE.violet, 0.30 * brightness), -0.07);

  return { group, spinners };
}

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 44, position: [0, 2.35, 5.5], lookAt: [0, 0, 0], far: 60 },
  });
  const pointer = createPointer(canvas);
  stage.scene.fog = new THREE.FogExp2(PALETTE.void, 0.10);

  const outerStrip = createGlyphStrip([...GLYPH_SETS.asomtavruli, ...GLYPH_SETS.greek], {
    width: 4096, height: 128, color: CSS_PALETTE.bone,
  });
  const innerStrip = createGlyphStrip([...GLYPH_SETS.alchemical, ...GLYPH_SETS.mkhedruli], {
    width: 2048, height: 96, color: CSS_PALETTE.bone,
  });

  const above = buildSeal({ outerStrip: outerStrip.texture, innerStrip: innerStrip.texture, brightness: 1 });
  const below = buildSeal({ outerStrip: outerStrip.texture, innerStrip: innerStrip.texture, brightness: 0.34 });

  above.group.position.y = params.gap;
  below.group.position.y = -params.gap;
  below.group.scale.y = -1; // the reflection, not a copy

  // The machine as one object, so the pointer leans everything together.
  const machine = new THREE.Group();
  machine.add(above.group, below.group);
  stage.scene.add(machine);

  // ---- the column of light between the two discs --------------------------
  const columnGeometry = new THREE.CylinderGeometry(0.045, 0.045, params.gap * 2, 12, 1, true);
  const columnMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.bone, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const column = new THREE.Mesh(columnGeometry, columnMaterial);
  machine.add(column);

  // Six struts joining the rims, so the two discs read as one mechanism.
  const strutPoints = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const x = Math.cos(angle) * 1.95;
    const z = Math.sin(angle) * 1.95;
    strutPoints.push(new THREE.Vector3(x, params.gap, z), new THREE.Vector3(x, -params.gap, z));
  }
  const strutGeometry = new THREE.BufferGeometry().setFromPoints(strutPoints);
  const strutMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.gold, transparent: true, opacity: 0.18,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const struts = new THREE.LineSegments(strutGeometry, strutMaterial);
  machine.add(struts);

  // ---- the heart ----------------------------------------------------------
  const coreGeometry = new THREE.IcosahedronGeometry(0.30, 1);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.gold, wireframe: true, transparent: true, opacity: 0.9,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  machine.add(core);

  const glowTexture = createRadialGlowTexture({ color: CSS_PALETTE.gold, softness: 3 });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5,
  }));
  glow.scale.setScalar(3.2);
  machine.add(glow);

  // ---- animation ----------------------------------------------------------
  const allSpinners = [...above.spinners, ...below.spinners];

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    for (const spinner of allSpinners) {
      spinner.object.rotation.y += spinner.speed * params.spin * dt;
    }

    machine.rotation.y = pointer.x * params.tilt + time * 0.03;
    machine.rotation.x = pointer.y * params.tilt * 0.5;

    core.rotation.x += dt * 0.45;
    core.rotation.y += dt * 0.30;

    const pulse = 0.5 + Math.sin(time * 1.3) * 0.12;
    glow.material.opacity = pulse * 0.7;
    columnMaterial.opacity = 0.16 + Math.sin(time * 2.1) * 0.07;
  });

  stage.onDispose(() => {
    pointer.dispose();
    outerStrip.dispose();
    innerStrip.dispose();
    glowTexture.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
