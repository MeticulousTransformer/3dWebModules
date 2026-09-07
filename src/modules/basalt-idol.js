/**
 * BASALT IDOL
 *
 * A god's head cut from black stone, gold in its eyes, with a cyan scanner
 * crawling up it — the machine trying to read something older than it is.
 *
 * The head is built from primitives on purpose: no model file, no loader, no
 * asset pipeline. Squash a sphere, add a ridge, inlay two eyes.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/glyphs.js ../lib/textures.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createGlyphStrip, GLYPH_SETS } from '../lib/glyphs.js';
import { createGradientEnvironment } from '../lib/textures.js';
import { PALETTE, CSS_PALETTE } from '../lib/palette.js';
import { createParamSetter } from '../lib/params.js';

export const defaults = {
  scanSeconds: 4.5,
  turn: 0.12,
};

const SCAN_VERTEX = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SCAN_FRAGMENT = /* glsl */ `
precision mediump float;
varying vec3 vLocal;

uniform vec3  uColor;
uniform float uScanY;

void main() {
  // A narrow band of light at height uScanY, falling off fast either side.
  float distance = (vLocal.y - uScanY) * 6.0;
  float band = exp(-distance * distance);
  if (band < 0.02) discard;
  gl_FragColor = vec4(uColor, band * 0.85);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 40, position: [0, 0.1, 5.0] },
  });
  const pointer = createPointer(canvas);
  stage.scene.fog = new THREE.FogExp2(PALETTE.void, 0.13);

  const environment = createGradientEnvironment({
    top: '#101828', middle: '#06080c', bottom: '#180c04', sun: '#ffcf8a',
  });
  stage.scene.environment = environment;

  const idol = new THREE.Group();
  stage.scene.add(idol);

  // ---- the stone ----------------------------------------------------------
  const basalt = new THREE.MeshStandardMaterial({
    color: 0x14161c,
    roughness: 0.78,
    metalness: 0.22,
    flatShading: true,
  });

  const headGeometry = new THREE.SphereGeometry(1, 40, 30);
  headGeometry.scale(0.66, 1.18, 0.60);
  const head = new THREE.Mesh(headGeometry, basalt);
  idol.add(head);

  // The nose: a long thin wedge laid down the front of the face.
  const noseShape = new THREE.Shape();
  noseShape.moveTo(0, 0.62);
  noseShape.lineTo(0.10, -0.42);
  noseShape.lineTo(-0.10, -0.42);
  noseShape.closePath();
  const noseGeometry = new THREE.ExtrudeGeometry(noseShape, {
    depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1,
  });
  const nose = new THREE.Mesh(noseGeometry, basalt);
  nose.position.set(0, -0.05, 0.52);
  idol.add(nose);

  // ---- gold ---------------------------------------------------------------
  const gold = new THREE.MeshStandardMaterial({
    color: PALETTE.gold,
    metalness: 1,
    roughness: 0.24,
    emissive: PALETTE.gold,
    emissiveIntensity: 0.5,
  });

  const eyeGeometry = new THREE.SphereGeometry(0.15, 24, 16);
  eyeGeometry.scale(1, 0.5, 0.55);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, gold);
    eye.position.set(side * 0.27, 0.22, 0.50);
    eye.rotation.z = side * 0.12;
    idol.add(eye);
  }

  const browGeometry = new THREE.TorusGeometry(0.30, 0.022, 6, 40, Math.PI);
  for (const side of [-1, 1]) {
    const brow = new THREE.Mesh(browGeometry, gold);
    brow.position.set(side * 0.27, 0.30, 0.50);
    brow.scale.set(1, 0.55, 1);
    idol.add(brow);
  }

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.022, 0.03), gold);
  mouth.position.set(0, -0.52, 0.50);
  idol.add(mouth);

  const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.024, 8, 80), gold);
  circlet.rotation.x = Math.PI / 2;
  circlet.position.y = 0.82;
  circlet.scale.set(1, 0.90, 1);
  idol.add(circlet);

  // ---- the scanner --------------------------------------------------------
  const scanUniforms = {
    uColor: { value: new THREE.Color(PALETTE.cyan) },
    uScanY: { value: 0 },
  };
  const scanMaterial = new THREE.ShaderMaterial({
    uniforms: scanUniforms,
    vertexShader: SCAN_VERTEX,
    fragmentShader: SCAN_FRAGMENT,
    wireframe: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const scanner = new THREE.Mesh(headGeometry, scanMaterial);
  scanner.scale.setScalar(1.015);
  idol.add(scanner);

  // ---- the inscription turning around the head ---------------------------
  const strip = createGlyphStrip([...GLYPH_SETS.asomtavruli], {
    width: 4096, height: 128, color: CSS_PALETTE.bone,
  });
  const bandGeometry = new THREE.CylinderGeometry(1.35, 1.35, 0.30, 96, 1, true);
  const bandMaterial = new THREE.MeshBasicMaterial({
    map: strip.texture, color: PALETTE.gold, transparent: true, opacity: 0.7,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const band = new THREE.Mesh(bandGeometry, bandMaterial);
  band.position.y = -0.15;
  stage.scene.add(band);

  // ---- light: warm from below, cold from behind. Ritual lighting. ---------
  stage.scene.add(new THREE.AmbientLight(0x141c2a, 1.0));

  const uplight = new THREE.PointLight(0xff9a3c, 46, 14, 2);
  uplight.position.set(0, -1.9, 1.5);
  stage.scene.add(uplight);

  const rim = new THREE.DirectionalLight(PALETTE.cyan, 2.8);
  rim.position.set(-3, 2, -3);
  stage.scene.add(rim);

  const fill = new THREE.DirectionalLight(0xfff0d8, 0.45);
  fill.position.set(2, 2, 4);
  stage.scene.add(fill);

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    idol.rotation.y = Math.sin(time * params.turn) * 0.45 + pointer.x * 0.6;
    idol.rotation.x = pointer.y * 0.22;

    band.rotation.y -= dt * 0.14;
    band.rotation.x = pointer.y * 0.22;

    // The scan crawls from chin to crown, then jumps back and starts again.
    const t = (time % params.scanSeconds) / params.scanSeconds;
    scanUniforms.uScanY.value = -1.3 + t * 2.7;

    gold.emissiveIntensity = 0.42 + Math.sin(time * 2.3) * 0.16;
    uplight.intensity = 42 + Math.sin(time * 3.1) * 9;
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    strip.dispose();
    headGeometry.dispose();
    noseGeometry.dispose();
    eyeGeometry.dispose();
    browGeometry.dispose();
    bandGeometry.dispose();
    basalt.dispose();
    gold.dispose();
    scanMaterial.dispose();
    bandMaterial.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
