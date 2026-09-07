/**
 * ASHEN EMBER
 *
 * A small fire in a ring of stones, and everything else dark. Embers go up,
 * ash comes down, and one flickering light does all the work of making the
 * stones look like stones.
 *
 * The flame is three overlapping quads with a noise shader on them, at
 * different sizes and out of phase. That is enough: a fire read from the front
 * is a silhouette that changes shape, and a silhouette that changes shape is
 * cheap.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/glsl.js ../lib/random.js
 *                   ../lib/device.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createRandom } from '../lib/random.js';
import { GLSL_NOISE, GLSL_FBM } from '../lib/glsl.js';
import { scale } from '../lib/device.js';
import { GOTHIC } from '../lib/palette.js';

export const defaults = {
  fire: 1,        // overall size of the flame
  embers: 0,      // 0 = pick from the device
  ash: 0,         // 0 = pick from the device
  updraught: 1.1, // how hard the embers are pushed up
};

const FLAME_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FLAME_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uSeed;
uniform vec3  uCore;
uniform vec3  uEdge;

${GLSL_NOISE}
${GLSL_FBM}

void main() {
  vec2 uv = vUv;

  // Narrower the higher you go.
  float taper = mix(1.0, 0.26, pow(uv.y, 0.85));
  float across = (uv.x - 0.5) / taper;

  // Noise scrolling downwards makes the flame appear to lick upwards.
  float turbulence = fbm(vec3(uv.x * 3.2, uv.y * 2.6 - uTime * 2.1, uSeed), 4);
  float lean = turbulence * 0.34 * uv.y;

  float body = 1.0 - smoothstep(0.08, 0.46, abs(across + lean));
  body *= smoothstep(1.05, 0.5, uv.y);   // fades out at the tip
  body *= smoothstep(0.0, 0.09, uv.y);   // pinches at the base

  float heat = pow(body, 2.4);
  vec3 color = mix(uEdge, uCore, heat);

  float alpha = body * (0.72 + 0.28 * turbulence);
  gl_FragColor = vec4(color * alpha * 1.7, alpha);
}
`;

const SPARK_VERTEX = /* glsl */ `
attribute float aLife;   // 1 when born, 0 when spent
attribute float aSize;
varying float vLife;

void main() {
  vLife = aLife;
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * aLife * (34.0 / -viewPosition.z);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const SPARK_FRAGMENT = /* glsl */ `
precision mediump float;
varying float vLife;

uniform vec3 uHot;
uniform vec3 uCold;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float falloff = 1.0 - smoothstep(0.1, 0.5, d);

  // Fresh sparks are almost white; they cool to red as they climb.
  vec3 color = mix(uCold, uHot, pow(vLife, 1.6));
  gl_FragColor = vec4(color, falloff * vLife * 0.95);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const emberCount = params.embers || scale(220, 460);
  const ashCount = params.ash || scale(120, 260);

  const stage = createStage(canvas, {
    clearColor: GOTHIC.pitch,
    camera: { fov: 42, position: [0, 0.55, 4.2], lookAt: [0, 0.35, 0], far: 40 },
  });
  const pointer = createPointer(canvas);
  stage.scene.fog = new THREE.FogExp2(0x08070a, 0.13);

  const random = createRandom(19);

  // ---- the flame ----------------------------------------------------------
  const flames = [];
  const FLAME_LAYERS = [
    { width: 1.35, height: 1.25, seed: 0.0, z: -0.12, core: 0xfff0c0, edge: 0xff5210 },
    { width: 1.00, height: 1.00, seed: 3.7, z: 0.00, core: 0xffffff, edge: 0xff9a28 },
    { width: 0.62, height: 0.70, seed: 8.1, z: 0.10, core: 0xffffff, edge: 0xffd070 },
  ];

  for (const layer of FLAME_LAYERS) {
    const geometry = new THREE.PlaneGeometry(layer.width, layer.height);
    geometry.translate(0, layer.height / 2, 0);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: layer.seed },
        uCore: { value: new THREE.Color(layer.core) },
        uEdge: { value: new THREE.Color(layer.edge) },
      },
      vertexShader: FLAME_VERTEX,
      fragmentShader: FLAME_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, -0.18, layer.z);
    stage.scene.add(mesh);
    flames.push({ mesh, material, geometry, baseHeight: layer.height });
  }

  // ---- embers going up ----------------------------------------------------
  const emberPositions = new Float32Array(emberCount * 3);
  const emberLife = new Float32Array(emberCount);
  const emberSize = new Float32Array(emberCount);
  const emberVelocity = new Float32Array(emberCount * 3);

  function seedEmber(index) {
    const angle = random() * Math.PI * 2;
    const radius = random() * 0.16;
    emberPositions[index * 3 + 0] = Math.cos(angle) * radius;
    emberPositions[index * 3 + 1] = -0.15 + random() * 0.2;
    emberPositions[index * 3 + 2] = Math.sin(angle) * radius;

    emberVelocity[index * 3 + 0] = (random() - 0.5) * 0.25;
    emberVelocity[index * 3 + 1] = random.between(0.5, 1.5);
    emberVelocity[index * 3 + 2] = (random() - 0.5) * 0.25;

    emberLife[index] = 1;
    emberSize[index] = random.between(0.6, 2.0);
  }
  for (let i = 0; i < emberCount; i++) {
    seedEmber(i);
    emberLife[i] = random(); // stagger them, so they do not all start together
  }

  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  emberGeometry.setAttribute('aLife', new THREE.BufferAttribute(emberLife, 1));
  emberGeometry.setAttribute('aSize', new THREE.BufferAttribute(emberSize, 1));
  emberGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 6);

  const embers = new THREE.Points(emberGeometry, new THREE.ShaderMaterial({
    uniforms: {
      uHot: { value: new THREE.Color(0xfff2d0) },
      uCold: { value: new THREE.Color(0x8a1c08) },
    },
    vertexShader: SPARK_VERTEX,
    fragmentShader: SPARK_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  stage.scene.add(embers);

  // ---- ash coming down ----------------------------------------------------
  const ashPositions = new Float32Array(ashCount * 3);
  const ashFall = new Float32Array(ashCount);
  for (let i = 0; i < ashCount; i++) {
    ashPositions[i * 3 + 0] = random.between(-3, 3);
    ashPositions[i * 3 + 1] = random.between(-1, 4);
    ashPositions[i * 3 + 2] = random.between(-2, 1.5);
    ashFall[i] = random.between(0.06, 0.22);
  }
  const ashGeometry = new THREE.BufferGeometry();
  ashGeometry.setAttribute('position', new THREE.BufferAttribute(ashPositions, 3));
  const ash = new THREE.Points(ashGeometry, new THREE.PointsMaterial({
    color: GOTHIC.ash, size: 0.017, transparent: true, opacity: 0.42,
    depthWrite: false, sizeAttenuation: true,
  }));
  stage.scene.add(ash);

  // ---- the ring of stones -------------------------------------------------
  const stoneGeometry = new THREE.IcosahedronGeometry(0.20, 0);
  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3a40, roughness: 0.95, metalness: 0.02, flatShading: true,
  });
  const stoneCount = 11;
  const stones = new THREE.InstancedMesh(stoneGeometry, stoneMaterial, stoneCount);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const stonePosition = new THREE.Vector3();
  const stoneScale = new THREE.Vector3();

  for (let i = 0; i < stoneCount; i++) {
    const angle = (i / stoneCount) * Math.PI * 2 + random() * 0.2;
    euler.set(random() * 3, random() * 3, random() * 3);
    quaternion.setFromEuler(euler);
    stonePosition.set(Math.cos(angle) * 0.62, -0.30 + random() * 0.06, Math.sin(angle) * 0.62);
    stoneScale.setScalar(random.between(0.7, 1.4));
    matrix.compose(stonePosition, quaternion, stoneScale);
    stones.setMatrixAt(i, matrix);
  }
  stones.instanceMatrix.needsUpdate = true;
  stage.scene.add(stones);

  // ---- the ground ---------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(7, 48),
    new THREE.MeshStandardMaterial({ color: 0x232026, roughness: 0.98, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.38;
  stage.scene.add(ground);

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x12141c, 1.2));

  const fireLight = new THREE.PointLight(0xff8a2a, 26, 9, 2);
  fireLight.position.set(0, 0.25, 0);
  stage.scene.add(fireLight);

  const moonlight = new THREE.DirectionalLight(GOTHIC.moon, 0.35);
  moonlight.position.set(-3, 6, 2);
  stage.scene.add(moonlight);

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    // The fire leans away from wherever the pointer is, like a draught.
    const draught = pointer.x * 0.25;

    for (let i = 0; i < flames.length; i++) {
      const flame = flames[i];
      flame.material.uniforms.uTime.value = time;
      flame.mesh.rotation.z = -draught * (0.6 + i * 0.2);
      flame.mesh.scale.set(
        params.fire * (1 + Math.sin(time * 5.3 + i) * 0.05),
        params.fire * (1 + Math.sin(time * 3.7 + i * 2) * 0.10),
        1,
      );
    }

    for (let i = 0; i < emberCount; i++) {
      emberLife[i] -= dt * 0.30;
      if (emberLife[i] <= 0) seedEmber(i);

      emberVelocity[i * 3 + 1] += params.updraught * dt * 0.6;
      emberVelocity[i * 3 + 0] += (Math.sin(time * 2 + i) * 0.4 + draught * 2) * dt;

      emberPositions[i * 3 + 0] += emberVelocity[i * 3 + 0] * dt;
      emberPositions[i * 3 + 1] += emberVelocity[i * 3 + 1] * dt;
      emberPositions[i * 3 + 2] += emberVelocity[i * 3 + 2] * dt;
    }
    emberGeometry.attributes.position.needsUpdate = true;
    emberGeometry.attributes.aLife.needsUpdate = true;

    for (let i = 0; i < ashCount; i++) {
      ashPositions[i * 3 + 1] -= ashFall[i] * dt;
      ashPositions[i * 3 + 0] += Math.sin(time * 0.6 + i) * dt * 0.05 + draught * dt * 0.4;
      if (ashPositions[i * 3 + 1] < -0.4) {
        ashPositions[i * 3 + 1] = 4.2;
        ashPositions[i * 3 + 0] = random.between(-3, 3);
      }
    }
    ashGeometry.attributes.position.needsUpdate = true;

    // Firelight never sits still.
    fireLight.intensity =
      (22 + Math.sin(time * 8.3) * 5 + Math.sin(time * 17.9) * 3 + Math.sin(time * 3.1) * 2) * params.fire;
    fireLight.position.x = Math.sin(time * 6.2) * 0.05 - draught * 0.2;

    stage.camera.position.x += (pointer.x * 0.8 - stage.camera.position.x) * Math.min(1, dt * 1.6);
    stage.camera.position.y = 0.55 + pointer.y * 0.4;
    stage.camera.lookAt(0, 0.35, 0);
  });

  stage.onDispose(() => {
    pointer.dispose();
    for (const flame of flames) {
      flame.geometry.dispose();
      flame.material.dispose();
    }
    emberGeometry.dispose();
    embers.material.dispose();
    ashGeometry.dispose();
    ash.material.dispose();
    stoneGeometry.dispose();
    stoneMaterial.dispose();
    ground.geometry.dispose();
    ground.material.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
