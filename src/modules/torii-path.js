/**
 * TORII PATH
 *
 * A thousand gates at Fushimi Inari, compressed into forty and looped. Each
 * gate is four boxes, all of them instances of the same box, and when one
 * passes the camera it is sent back to the far end as a new gate. The ground
 * is a seigaiha wave pattern drawn in a shader.
 *
 * A gate is a torii: two pillars, the curved lintel across the top (kasagi)
 * and the tie beam below it (nuki). Four parts, so four instances per gate.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/device.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { scale } from '../lib/device.js';
import { PALETTE } from '../lib/palette.js';

export const defaults = {
  gates: 0,        // 0 = pick from the device
  spacing: 1.5,    // world units between gates
  speed: 3.2,      // how fast they come at you
  sway: 0.35,      // how far the pointer moves the path
};

const GROUND_Y = -1.5;
const PARTS_PER_GATE = 4;

/**
 * The four parts of one torii, as scale + offset from the gate's own origin.
 * Written out longhand because that is the clearest way to describe a shape.
 */
const GATE_PARTS = [
  { scale: [0.15, 3.00, 0.15], offset: [-1.02, 1.50, 0.00] }, // left pillar
  { scale: [0.15, 3.00, 0.15], offset: [ 1.02, 1.50, 0.00] }, // right pillar
  { scale: [2.75, 0.17, 0.26], offset: [ 0.00, 2.94, 0.00] }, // kasagi, the top beam
  { scale: [2.30, 0.12, 0.20], offset: [ 0.00, 2.44, 0.00] }, // nuki, the tie beam
];

const GROUND_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GROUND_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform vec2  uCells;
uniform vec3  uColor;

/**
 * Seigaiha: overlapping arcs laid out like fish scales. Every other row is
 * shifted half a cell, which is what turns a grid of circles into waves.
 */
float seigaiha(vec2 p) {
  float row = floor(p.y);
  p.x += mod(row, 2.0) * 0.5;

  vec2 local = fract(p) - 0.5;
  float d = length(local) * 2.0;

  float rings = 0.5 + 0.5 * sin(d * 16.0 - uTime * 1.4);
  return (1.0 - smoothstep(0.70, 1.0, d)) * rings;
}

void main() {
  vec2 p = vUv * uCells;
  p.y -= uTime * 0.35;

  float pattern = seigaiha(p);
  float depth = pow(1.0 - abs(vUv.y * 2.0 - 1.0), 1.8);

  gl_FragColor = vec4(uColor * pattern * depth, pattern * depth * 0.75);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const gates = params.gates || scale(26, 44);

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 62, position: [0, 0.35, 3.4], lookAt: [0, 0.6, -10], far: 120 },
  });
  const pointer = createPointer(canvas);

  const depth = gates * params.spacing;
  stage.scene.fog = new THREE.Fog(0x120508, 4, depth * 0.85);

  // ---- the gates ----------------------------------------------------------
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const gateMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.vermilion,
    roughness: 0.62,
    metalness: 0.05,
  });

  const posts = new THREE.InstancedMesh(boxGeometry, gateMaterial, gates * PARTS_PER_GATE);
  posts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  stage.scene.add(posts);

  // One z per gate. Everything else is derived from GATE_PARTS.
  const gateZ = new Float32Array(gates);
  const gateTint = new Float32Array(gates);
  for (let i = 0; i < gates; i++) {
    gateZ[i] = -i * params.spacing;
    gateTint[i] = 0.7 + Math.random() * 0.5;
  }

  const matrix = new THREE.Matrix4();
  const tint = new THREE.Color();

  function writeGates() {
    for (let gate = 0; gate < gates; gate++) {
      for (let part = 0; part < PARTS_PER_GATE; part++) {
        const { scale: s, offset } = GATE_PARTS[part];
        matrix.makeScale(s[0], s[1], s[2]);
        matrix.setPosition(offset[0], GROUND_Y + offset[1], gateZ[gate] + offset[2]);
        posts.setMatrixAt(gate * PARTS_PER_GATE + part, matrix);
      }
    }
    posts.instanceMatrix.needsUpdate = true;
  }

  for (let gate = 0; gate < gates; gate++) {
    tint.setHex(PALETTE.vermilion).multiplyScalar(gateTint[gate]);
    for (let part = 0; part < PARTS_PER_GATE; part++) {
      posts.setColorAt(gate * PARTS_PER_GATE + part, tint);
    }
  }
  writeGates();
  if (posts.instanceColor) posts.instanceColor.needsUpdate = true;

  // ---- the ground ---------------------------------------------------------
  const groundUniforms = {
    uTime: { value: 0 },
    uCells: { value: new THREE.Vector2(14, 46) },
    uColor: { value: new THREE.Color(PALETTE.cyan) },
  };
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, depth * 2),
    new THREE.ShaderMaterial({
      uniforms: groundUniforms,
      vertexShader: GROUND_VERTEX,
      fragmentShader: GROUND_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, GROUND_Y, -depth * 0.5);
  stage.scene.add(ground);

  // ---- petals in the air --------------------------------------------------
  const petalCount = scale(120, 260);
  const petalPositions = new Float32Array(petalCount * 3);
  const petalDrift = [];
  for (let i = 0; i < petalCount; i++) {
    petalPositions[i * 3 + 0] = (Math.random() - 0.5) * 9;
    petalPositions[i * 3 + 1] = Math.random() * 5 - 1;
    petalPositions[i * 3 + 2] = -Math.random() * depth;
    petalDrift.push({ fall: 0.25 + Math.random() * 0.4, swirl: Math.random() * Math.PI * 2 });
  }
  const petalGeometry = new THREE.BufferGeometry();
  petalGeometry.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));
  const petals = new THREE.Points(petalGeometry, new THREE.PointsMaterial({
    color: 0xffc9d4, size: 0.05, transparent: true, opacity: 0.75,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  stage.scene.add(petals);

  // ---- light: dusk under a red tunnel ------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x2a1220, 1.4));

  const lantern = new THREE.PointLight(0xffb060, 26, 9, 2);
  lantern.position.set(0, 1.2, 1.6);
  stage.scene.add(lantern);

  const sky = new THREE.DirectionalLight(0x6688cc, 1.1);
  sky.position.set(-2, 5, -3);
  stage.scene.add(sky);

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    const travel = params.speed * dt;
    for (let gate = 0; gate < gates; gate++) {
      gateZ[gate] += travel;
      if (gateZ[gate] > 4.5) gateZ[gate] -= depth;
    }
    writeGates();

    groundUniforms.uTime.value = time;

    for (let i = 0; i < petalCount; i++) {
      petalPositions[i * 3 + 1] -= petalDrift[i].fall * dt;
      petalPositions[i * 3 + 0] += Math.sin(time * 0.8 + petalDrift[i].swirl) * dt * 0.3;
      petalPositions[i * 3 + 2] += travel;

      if (petalPositions[i * 3 + 1] < GROUND_Y) petalPositions[i * 3 + 1] = 4.5;
      if (petalPositions[i * 3 + 2] > 4.5) petalPositions[i * 3 + 2] -= depth;
    }
    petalGeometry.attributes.position.needsUpdate = true;

    stage.camera.position.x += (pointer.x * params.sway * 2.4 - stage.camera.position.x) * Math.min(1, dt * 2.2);
    stage.camera.position.y = 0.35 + pointer.y * 0.5 + Math.sin(time * 1.4) * 0.03;
    stage.camera.lookAt(pointer.x * params.sway, 0.7 + pointer.y * 0.8, -12);

    lantern.intensity = 24 + Math.sin(time * 2.6) * 5;
  });

  stage.onDispose(() => {
    pointer.dispose();
    boxGeometry.dispose();
    gateMaterial.dispose();
    ground.geometry.dispose();
    ground.material.dispose();
    petalGeometry.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
