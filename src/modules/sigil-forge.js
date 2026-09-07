/**
 * SIGIL FORGE
 *
 * Chaos magic's letter method, done properly. Take a sentence of intent, strip
 * the vowels, strip the repeats, and what is left is a short string of
 * consonants. Put each one at its own angle on a circle, join them in order,
 * and you have a sigil that belongs to that sentence and no other.
 *
 * It is deterministic: the same words always forge the same shape.
 *
 * Call setParam('phrase', 'YOUR INTENT HERE') to re-forge it.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/glyphs.js ../lib/textures.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createGlyphStrip } from '../lib/glyphs.js';
import { createRadialGlowTexture } from '../lib/textures.js';
import { PALETTE, CSS_PALETTE } from '../lib/palette.js';

export const defaults = {
  phrase: 'AS ABOVE SO BELOW',
  drawSeconds: 3.0,
  holdSeconds: 4.5,
  thickness: 0.026,
};

const TUBE_SEGMENTS = 320;
const TUBE_SIDES = 8;

/** Spare's method: letters, no vowels, no repeats. */
export function reduceToConsonants(phrase) {
  const letters = phrase.toUpperCase().replace(/[^A-Z]/g, '');
  const consonants = letters.replace(/[AEIOU]/g, '');
  const seen = [];
  for (const letter of consonants) {
    if (!seen.includes(letter)) seen.push(letter);
  }
  // A sigil needs at least a triangle to be a shape at all.
  while (seen.length < 3) seen.push('BCD'[seen.length]);
  return seen;
}

/** Each letter gets its own angle on the wheel and its own distance out. */
function pointsForLetters(letters) {
  return letters.map((letter, index) => {
    const code = letter.charCodeAt(0) - 65;                 // 0..25
    const angle = (code / 26) * Math.PI * 2 - Math.PI / 2;
    const radius = 0.42 + (((code * 7) % 5) / 4) * 0.58;    // deterministic, not random
    const depth = Math.sin(index * 1.7 + code * 0.31) * 0.20;
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, depth);
  });
}

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 44, position: [0, 0, 3.7] },
  });
  const pointer = createPointer(canvas);

  const forge = new THREE.Group();
  stage.scene.add(forge);

  const tubeMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.gold, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const nodeMaterial = new THREE.PointsMaterial({
    color: PALETTE.bone, size: 0.075, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.violet, transparent: true, opacity: 0.65,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  // These three are replaced whenever the phrase changes.
  let tube = null;
  let nodes = null;
  let ring = null;
  let strip = null;
  let totalIndices = 0;

  function clearForge() {
    for (const object of [tube, nodes, ring]) {
      if (!object) continue;
      forge.remove(object);
      object.geometry.dispose();
    }
    if (strip) strip.dispose();
    tube = nodes = ring = strip = null;
  }

  /** Build the whole sigil from a sentence. */
  function forgeSigil(phrase) {
    clearForge();

    const letters = reduceToConsonants(phrase);
    const points = pointsForLetters(letters);

    // A closed, gently smoothed loop through the letter points.
    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.55);
    const tubeGeometry = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, params.thickness, TUBE_SIDES, true);
    totalIndices = tubeGeometry.index.count;

    tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    forge.add(tube);

    const nodeGeometry = new THREE.BufferGeometry().setFromPoints(points);
    nodes = new THREE.Points(nodeGeometry, nodeMaterial);
    forge.add(nodes);

    // The letters that made it, written around the outside.
    strip = createGlyphStrip(letters, { width: 2048, height: 96, color: CSS_PALETTE.bone });
    // A barrel of letters standing around the sigil. Left upright on purpose:
    // turned flat it goes edge-on to the camera and disappears.
    const ringGeometry = new THREE.CylinderGeometry(1.32, 1.32, 0.42, 96, 1, true);
    ringMaterial.map = strip.texture;
    ringMaterial.needsUpdate = true;
    ring = new THREE.Mesh(ringGeometry, ringMaterial);
    forge.add(ring);
  }

  forgeSigil(params.phrase);

  // ---- glow ---------------------------------------------------------------
  const glowTexture = createRadialGlowTexture({ color: CSS_PALETTE.gold, softness: 3 });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4,
  }));
  glow.scale.setScalar(4);
  glow.position.z = -0.6;
  stage.scene.add(glow);

  // ---- animation ----------------------------------------------------------
  const cycleLength = params.drawSeconds + params.holdSeconds;
  let phaseOffset = 0; // reset on every re-forge, so a new sigil draws from zero

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    const local = (time - phaseOffset) % cycleLength;

    if (local < params.drawSeconds) {
      const t = local / params.drawSeconds;
      const eased = 1 - Math.pow(1 - t, 2.6);
      // Draw range works on the index buffer; round to whole triangles.
      const visible = Math.floor((totalIndices * eased) / 3) * 3;
      tube.geometry.setDrawRange(0, visible);
      nodeMaterial.opacity = eased * 0.9;
      ringMaterial.opacity = eased * 0.6;
    } else {
      tube.geometry.setDrawRange(0, totalIndices);
      const held = (local - params.drawSeconds) / params.holdSeconds;
      const pulse = 0.75 + Math.sin(held * Math.PI * 4) * 0.2;
      nodeMaterial.opacity = pulse;
      ringMaterial.opacity = 0.6;
    }

    forge.rotation.y = pointer.x * 0.5 + Math.sin(time * 0.19) * 0.16;
    forge.rotation.x = pointer.y * 0.35;
    forge.rotation.z = time * 0.05;

    glow.material.opacity = 0.3 + Math.sin(time * 1.7) * 0.12;
    tubeMaterial.opacity = 0.85 + Math.sin(time * 3.1) * 0.12;
  });

  stage.onDispose(() => {
    pointer.dispose();
    clearForge();
    tubeMaterial.dispose();
    nodeMaterial.dispose();
    ringMaterial.dispose();
    glowTexture.dispose();
  });

  /** The one knob this module exposes. */
  stage.setParam = (key, value) => {
    if (key !== 'phrase') return;
    params.phrase = value;
    forgeSigil(value);
    phaseOffset = stage.state.time; // start the drawing animation over
  };

  return stage.start();
}
