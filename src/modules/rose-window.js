/**
 * ROSE WINDOW
 *
 * A cathedral rose window, generated from a table of rings. The glass is one
 * geometry — every panel of every ring packed into a single buffer — and one
 * shader lights it, so the sun can swing round behind the window and brighten
 * the panels in a wave without touching a single material.
 *
 * That is the whole trick worth stealing: when you have hundreds of flat
 * pieces that differ only in colour and position, do not make hundreds of
 * meshes. Make one, and put the difference in an attribute.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/textures.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createRadialGlowTexture } from '../lib/textures.js';
import { GOTHIC, CSS_GOTHIC } from '../lib/palette.js';

export const defaults = {
  turn: 0.012,     // rose windows do not really turn. this one turns slowly.
  sunSpeed: 0.22,  // how fast the light swings round behind the glass
  glow: 1,         // overall brightness of the glass
  motes: 220,
};

/**
 * The window, ring by ring, from the middle outwards.
 * `gap` is the fraction of each panel given over to the stone between them.
 */
const RINGS = [
  { inner: 0.00, outer: 0.095, panels: 1,  gap: 0.00, bands: 1 },
  { inner: 0.12, outer: 0.29,  panels: 8,  gap: 0.20, bands: 2 },
  { inner: 0.32, outer: 0.56,  panels: 12, gap: 0.17, bands: 3 },
  { inner: 0.59, outer: 0.81,  panels: 24, gap: 0.16, bands: 2 },
  { inner: 0.84, outer: 0.97,  panels: 36, gap: 0.22, bands: 1 },
];

/**
 * Pot metal: glass coloured in the melt, not painted. Deep, because it is only
 * ever seen with light behind it — anything pale reads as plastic.
 */
const GLASS = [0x14356e, 0x6e0d1c, 0xa8761c, 0x17402f, 0x36205c, 0x7a746a, 0x0f2a52, 0x8a1420];

const VERTEX_SHADER = /* glsl */ `
attribute vec3  aColor;
attribute float aAngle;   // where this panel sits on the wheel
attribute float aRadius;  // 0 at the middle, 1 at the rim

uniform float uSun;       // where the light is, in radians
uniform float uGlow;

varying vec3  vColor;
varying float vLight;

void main() {
  // Panels facing the light burn; the ones opposite go almost to silhouette.
  float alignment = cos(aAngle - uSun);
  vLight = 0.58 + 0.85 * smoothstep(-0.7, 1.0, alignment);

  // The middle of a window is always brighter than its rim.
  vLight *= mix(1.25, 0.78, aRadius);
  vLight *= uGlow;

  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision mediump float;
varying vec3  vColor;
varying float vLight;

void main() {
  vec3 color = vColor * vLight;
  // Lift the very brightest towards white, the way lit glass blows out.
  color += vec3(pow(vLight, 4.0)) * 0.35;
  gl_FragColor = vec4(color, 1.0);
}
`;

/** Radial streaks in front of the glass — the glare of light coming at you. */
const GLARE_FRAGMENT = /* glsl */ `
precision mediump float;
varying vec2 vUv;

uniform float uTime;
uniform float uSun;
uniform vec3  uColor;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float radius = length(p);
  if (radius > 1.0) discard;

  float angle = atan(p.y, p.x);

  // A few sharp spokes plus many soft ones, all turning with the sun.
  float spokes =
      0.55 * pow(abs(sin(angle * 9.0  + uSun * 1.4)), 8.0)
    + 0.30 * pow(abs(sin(angle * 22.0 - uSun * 0.7)), 5.0)
    + 0.18 * pow(abs(sin(angle * 47.0 + uTime * 0.15)), 3.0);

  float falloff = pow(1.0 - radius, 2.4) * smoothstep(0.02, 0.30, radius);
  float alpha = spokes * falloff;

  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

const GLARE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: GOTHIC.pitch,
    camera: { fov: 42, position: [0, 0, 3.1] },
  });
  const pointer = createPointer(canvas);

  const window3d = new THREE.Group();
  stage.scene.add(window3d);

  // ---- the glass, all of it, in one buffer -------------------------------
  const positions = [];
  const colors = [];
  const angles = [];
  const radii = [];
  const color = new THREE.Color();

  /** One annular sector, as two triangles per step around it. */
  function addPanel(inner, outer, startAngle, sweep, steps, hex, centreAngle, normalisedRadius) {
    color.setHex(hex);
    for (let i = 0; i < steps; i++) {
      const a0 = startAngle + (i / steps) * sweep;
      const a1 = startAngle + ((i + 1) / steps) * sweep;

      const corners = [
        [Math.cos(a0) * inner, Math.sin(a0) * inner],
        [Math.cos(a0) * outer, Math.sin(a0) * outer],
        [Math.cos(a1) * outer, Math.sin(a1) * outer],
        [Math.cos(a1) * inner, Math.sin(a1) * inner],
      ];

      for (const index of [0, 1, 2, 0, 2, 3]) {
        positions.push(corners[index][0], corners[index][1], 0);
        colors.push(color.r, color.g, color.b);
        angles.push(centreAngle);
        radii.push(normalisedRadius);
      }
    }
  }

  RINGS.forEach((ring, ringIndex) => {
    const step = (Math.PI * 2) / ring.panels;
    const bandDepth = (ring.outer - ring.inner) / ring.bands;

    for (let panel = 0; panel < ring.panels; panel++) {
      const start = panel * step + (step * ring.gap) / 2;
      const sweep = step * (1 - ring.gap);
      const centre = start + sweep / 2;
      const steps = Math.max(2, Math.round(sweep * 14));

      // Each panel is leaded into two or three pieces across its depth. That
      // is the difference between a window and a pie chart.
      for (let band = 0; band < ring.bands; band++) {
        const inner = ring.inner + band * bandDepth + 0.007;
        const outer = ring.inner + (band + 1) * bandDepth - 0.007;

        // Walk the colours so the pattern reads as designed, not scattered.
        const hex = GLASS[(ringIndex * 3 + panel * (ringIndex + 1) + band * 5) % GLASS.length];
        addPanel(inner, outer, start, sweep, steps, hex, centre, ring.outer);
      }
    }
  });

  const glassGeometry = new THREE.BufferGeometry();
  glassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  glassGeometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
  glassGeometry.setAttribute('aAngle', new THREE.Float32BufferAttribute(angles, 1));
  glassGeometry.setAttribute('aRadius', new THREE.Float32BufferAttribute(radii, 1));

  const glassUniforms = {
    uSun: { value: 0 },
    uGlow: { value: params.glow },
  };

  const glass = new THREE.Mesh(
    glassGeometry,
    new THREE.ShaderMaterial({
      uniforms: glassUniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    }),
  );
  window3d.add(glass);

  // ---- the stone: bands between the rings, bars between the panels -------
  const stoneMaterial = new THREE.MeshBasicMaterial({ color: 0x090a0e });

  for (const ring of RINGS) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(ring.outer + 0.012, 0.030, 6, 120), stoneMaterial);
    band.position.z = 0.01;
    window3d.add(band);
  }

  const barGeometry = new THREE.BoxGeometry(1, 1, 0.03);
  const barCount = RINGS.reduce((total, ring) => total + (ring.panels > 1 ? ring.panels : 0), 0);
  const bars = new THREE.InstancedMesh(barGeometry, stoneMaterial, barCount);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scaleVector = new THREE.Vector3();
  const positionVector = new THREE.Vector3();

  let barIndex = 0;
  for (const ring of RINGS) {
    if (ring.panels <= 1) continue;
    const step = (Math.PI * 2) / ring.panels;
    const midRadius = (ring.inner + ring.outer) / 2;
    const barLength = ring.outer - ring.inner + 0.03;

    for (let panel = 0; panel < ring.panels; panel++) {
      const angle = panel * step;
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
      scaleVector.set(barLength, 0.040, 1);
      positionVector.set(Math.cos(angle) * midRadius, Math.sin(angle) * midRadius, 0.012);
      matrix.compose(positionVector, quaternion, scaleVector);
      bars.setMatrixAt(barIndex++, matrix);
    }
  }
  bars.instanceMatrix.needsUpdate = true;
  window3d.add(bars);

  // The outer frame, thick, holding the whole thing in the wall.
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1.035, 0.085, 8, 140), stoneMaterial);
  frame.position.z = 0.015;
  window3d.add(frame);

  // ---- glare in front ----------------------------------------------------
  const glareUniforms = {
    uTime: { value: 0 },
    uSun: { value: 0 },
    uColor: { value: new THREE.Color(0xffd9a8) },
  };
  const glare = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.ShaderMaterial({
      uniforms: glareUniforms,
      vertexShader: GLARE_VERTEX,
      fragmentShader: GLARE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glare.position.z = 0.4;
  stage.scene.add(glare);

  // ---- a wash of light behind, spilling past the frame -------------------
  const glowTexture = createRadialGlowTexture({ color: CSS_GOTHIC.glass, softness: 2.2 });
  const wash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, opacity: 0.30,
  }));
  wash.scale.setScalar(4.2);
  wash.position.z = -0.6;
  stage.scene.add(wash);

  // ---- dust ---------------------------------------------------------------
  const motePositions = new Float32Array(params.motes * 3);
  const moteDrift = [];
  for (let i = 0; i < params.motes; i++) {
    motePositions[i * 3 + 0] = (Math.random() - 0.5) * 3.6;
    motePositions[i * 3 + 1] = (Math.random() - 0.5) * 3.2;
    motePositions[i * 3 + 2] = 0.2 + Math.random() * 1.4;
    moteDrift.push({ fall: 0.02 + Math.random() * 0.06, sway: Math.random() * Math.PI * 2 });
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(moteGeometry, new THREE.PointsMaterial({
    color: GOTHIC.bone, size: 0.012, transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  stage.scene.add(motes);

  // ---- keep the whole window on narrow screens ---------------------------
  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 3.1 * Math.tan((42 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    const fit = Math.min(1, visibleWidth / 2.45);
    window3d.scale.setScalar(fit);
    glare.scale.setScalar(fit);
  });

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    const sun = time * params.sunSpeed + pointer.x * 2.2;
    glassUniforms.uSun.value = sun;
    glassUniforms.uGlow.value = params.glow * (0.93 + Math.sin(time * 0.4) * 0.07);
    glareUniforms.uSun.value = sun;
    glareUniforms.uTime.value = time;

    window3d.rotation.z += params.turn * dt;
    window3d.rotation.x = pointer.y * 0.18;
    window3d.rotation.y = pointer.x * 0.18;

    for (let i = 0; i < params.motes; i++) {
      motePositions[i * 3 + 1] -= moteDrift[i].fall * dt;
      motePositions[i * 3 + 0] += Math.sin(time * 0.5 + moteDrift[i].sway) * dt * 0.02;
      if (motePositions[i * 3 + 1] < -1.7) motePositions[i * 3 + 1] = 1.7;
    }
    moteGeometry.attributes.position.needsUpdate = true;

    wash.material.opacity = 0.24 + Math.sin(time * 0.7) * 0.07;
  });

  stage.onDispose(() => {
    pointer.dispose();
    glowTexture.dispose();
    glassGeometry.dispose();
    glass.material.dispose();
    stoneMaterial.dispose();
    barGeometry.dispose();
    glare.geometry.dispose();
    glare.material.dispose();
    moteGeometry.dispose();
  });

  stage.setParam = createParamSetter(params, {
    glow: (value) => { glassUniforms.uGlow.value = value; },
  });

  return stage.start();
}
