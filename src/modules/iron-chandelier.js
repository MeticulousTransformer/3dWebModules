/**
 * IRON CHANDELIER
 *
 * A great wrought-iron corona hanging on a chain, swinging on real pendulum
 * physics — theta double dot equals minus g over L times sine theta, damped,
 * on two axes. Nudge it with a finger and it takes a while to settle, the way
 * something that heavy would.
 *
 * Two dozen candles, but only three lights: the rest is faked with sprites,
 * because nobody counts light sources, they count flames.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/random.js
 *                   ../lib/textures.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createRandom } from '../lib/random.js';
import { createGradientEnvironment } from '../lib/textures.js';
import { GOTHIC } from '../lib/palette.js';

export const defaults = {
  swing: 1,        // how hard the draught keeps pushing it
  damping: 0.28,   // how fast the swing dies down
  chainLength: 2.6,
  candleGlow: 1.35,
};

const GRAVITY = 9.81;

/** Where the candles sit: two tiers, the wide one below. */
const TIERS = [
  { radius: 0.92, y: 0.00, candles: 14 },
  { radius: 0.54, y: 0.36, candles: 8 },
];

const FLAME_VERTEX = /* glsl */ `
attribute float aPhase;

uniform float uTime;
uniform float uSize;

varying float vFlicker;

void main() {
  // Two frequencies, out of step per candle. Nothing beats in unison.
  vFlicker = 0.70
           + 0.26 * sin(uTime * (6.0 + mod(aPhase, 5.0)) + aPhase * 6.3)
           + 0.14 * sin(uTime * 21.0 + aPhase * 11.7);

  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * vFlicker * (30.0 / -viewPosition.z);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const FLAME_FRAGMENT = /* glsl */ `
precision mediump float;
varying float vFlicker;
uniform vec3 uAmber;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;

  float core = 1.0 - smoothstep(0.0, 0.30, d);
  float halo = 1.0 - smoothstep(0.0, 1.0, d);

  vec3 color = mix(uAmber, vec3(1.0), core);
  float alpha = (core * 0.95 + halo * 0.32) * vFlicker;
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const random = createRandom(31);

  const stage = createStage(canvas, {
    clearColor: GOTHIC.pitch,
    camera: { fov: 44, position: [0, 0.1, 3.5], lookAt: [0, 0.0, 0], far: 40 },
  });
  const pointer = createPointer(canvas);
  stage.scene.fog = new THREE.FogExp2(0x07070c, 0.10);

  const environment = createGradientEnvironment({
    top: '#12141c', middle: '#050508', bottom: '#241206', sun: '#ffbb70',
  });
  stage.scene.environment = environment;

  // The pivot: everything hangs off this and this is what actually rotates.
  const pivot = new THREE.Group();
  pivot.position.y = 2.4;
  stage.scene.add(pivot);

  const iron = new THREE.MeshStandardMaterial({
    color: 0x35302f, roughness: 0.55, metalness: 0.82, flatShading: false,
  });

  // ---- chain --------------------------------------------------------------
  const linkGeometry = new THREE.TorusGeometry(0.048, 0.014, 6, 14);
  const linkCount = Math.round(params.chainLength / 0.072);
  const chain = new THREE.InstancedMesh(linkGeometry, iron, linkCount);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);

  for (let i = 0; i < linkCount; i++) {
    // Every other link turned a quarter, the way a chain actually goes.
    euler.set(Math.PI / 2, (i % 2) * (Math.PI / 2), 0);
    quaternion.setFromEuler(euler);
    position.set(0, -i * 0.072, 0);
    matrix.compose(position, quaternion, one);
    chain.setMatrixAt(i, matrix);
  }
  chain.instanceMatrix.needsUpdate = true;
  pivot.add(chain);

  // ---- the corona ---------------------------------------------------------
  const body = new THREE.Group();
  body.position.y = -params.chainLength;
  pivot.add(body);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.95, 10), iron);
  shaft.position.y = 0.16;
  body.add(shaft);

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 10), iron);
  finial.position.y = -0.42;
  finial.rotation.x = Math.PI;
  body.add(finial);

  // Rings, spokes and candles, tier by tier.
  const candlePoints = [];
  const spokeGeometry = new THREE.BoxGeometry(1, 0.022, 0.022);
  const totalSpokes = TIERS.reduce((sum, tier) => sum + tier.candles, 0);
  const spokes = new THREE.InstancedMesh(spokeGeometry, iron, totalSpokes);

  const candleGeometry = new THREE.CylinderGeometry(0.032, 0.036, 0.16, 8);
  const waxMaterial = new THREE.MeshStandardMaterial({ color: 0xe8ddc4, roughness: 0.82, metalness: 0 });
  const candles = new THREE.InstancedMesh(candleGeometry, waxMaterial, totalSpokes);

  let spokeIndex = 0;
  for (const tier of TIERS) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(tier.radius, 0.026, 8, 90), iron);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = tier.y;
    body.add(ring);

    for (let i = 0; i < tier.candles; i++) {
      const angle = (i / tier.candles) * Math.PI * 2;
      const x = Math.cos(angle) * tier.radius;
      const z = Math.sin(angle) * tier.radius;

      euler.set(0, -angle, 0);
      quaternion.setFromEuler(euler);
      position.set(x / 2, tier.y, z / 2);
      matrix.compose(position, quaternion, new THREE.Vector3(tier.radius, 1, 1));
      spokes.setMatrixAt(spokeIndex, matrix);

      euler.set(0, 0, 0);
      quaternion.setFromEuler(euler);
      position.set(x, tier.y + 0.10, z);
      matrix.compose(position, quaternion, one);
      candles.setMatrixAt(spokeIndex, matrix);

      candlePoints.push(x, tier.y + 0.22, z);
      spokeIndex += 1;
    }
  }
  spokes.instanceMatrix.needsUpdate = true;
  candles.instanceMatrix.needsUpdate = true;
  body.add(spokes, candles);

  // ---- the flames ---------------------------------------------------------
  const phases = new Float32Array(candlePoints.length / 3);
  for (let i = 0; i < phases.length; i++) phases[i] = random() * 20;

  const flameGeometry = new THREE.BufferGeometry();
  flameGeometry.setAttribute('position', new THREE.Float32BufferAttribute(candlePoints, 3));
  flameGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const flameUniforms = {
    uTime: { value: 0 },
    uSize: { value: 1.5 * params.candleGlow },
    uAmber: { value: new THREE.Color(GOTHIC.amber) },
  };

  const flames = new THREE.Points(flameGeometry, new THREE.ShaderMaterial({
    uniforms: flameUniforms,
    vertexShader: FLAME_VERTEX,
    fragmentShader: FLAME_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  body.add(flames);

  // ---- light: three, standing in for twenty-two --------------------------
  stage.scene.add(new THREE.AmbientLight(0x1a1620, 1.1));

  const candleLights = [];
  for (let i = 0; i < 3; i++) {
    const light = new THREE.PointLight(0xffa64d, 9, 7, 2);
    const angle = (i / 3) * Math.PI * 2;
    light.position.set(Math.cos(angle) * 0.6, 0.1, Math.sin(angle) * 0.6);
    body.add(light);
    candleLights.push({ light, phase: random() * 10 });
  }

  const cold = new THREE.DirectionalLight(GOTHIC.moon, 0.5);
  cold.position.set(-3, 5, 3);
  stage.scene.add(cold);

  // ---- the pendulum -------------------------------------------------------
  // One angle and one angular velocity per axis. That is the whole simulation.
  let angleX = 0.10;
  let angleZ = 0.06;
  let speedX = 0;
  let speedZ = 0;

  function swingStep(dt, time) {
    const length = params.chainLength;

    // A draught that never quite dies, plus whatever the pointer is doing.
    const draughtX = Math.sin(time * 0.37) * 0.010 * params.swing;
    const draughtZ = Math.sin(time * 0.29 + 1.7) * 0.010 * params.swing;
    const pushX = pointer.active ? pointer.x * 0.05 : 0;
    const pushZ = pointer.active ? -pointer.y * 0.05 : 0;

    speedX += (-(GRAVITY / length) * Math.sin(angleX) - params.damping * speedX) * dt + (draughtX + pushX) * dt;
    speedZ += (-(GRAVITY / length) * Math.sin(angleZ) - params.damping * speedZ) * dt + (draughtZ + pushZ) * dt;

    angleX += speedX * dt;
    angleZ += speedZ * dt;
  }

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    // Clamp the step: a stalled tab must not launch the chandelier.
    swingStep(Math.min(dt, 1 / 40), time);

    pivot.rotation.x = angleZ;
    pivot.rotation.z = -angleX;

    // A slow turn on its own chain, which every hanging thing does.
    body.rotation.y += dt * 0.06;

    flameUniforms.uTime.value = time;
    flameUniforms.uSize.value = 1.5 * params.candleGlow;

    for (const entry of candleLights) {
      entry.light.intensity =
        (7.5 + Math.sin(time * 9 + entry.phase) * 1.8 + Math.sin(time * 19 + entry.phase * 3) * 0.9)
        * params.candleGlow;
    }
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    linkGeometry.dispose();
    spokeGeometry.dispose();
    candleGeometry.dispose();
    flameGeometry.dispose();
    flames.material.dispose();
    shaft.geometry.dispose();
    finial.geometry.dispose();
    iron.dispose();
    waxMaterial.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
