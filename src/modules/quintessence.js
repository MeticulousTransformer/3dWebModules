/**
 * QUINTESSENCE
 *
 * The fifth element as a drop of living mercury: an icosahedron pushed around
 * by two layers of simplex noise, shaded as iridescent metal.
 *
 * The trick worth stealing: flat shading makes three.js work out the surface
 * normal from screen-space derivatives, so a displaced surface lights correctly
 * without recomputing a single normal on the CPU.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/textures.js ../lib/glsl.js ../lib/device.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createGradientEnvironment, createRadialGlowTexture } from '../lib/textures.js';
import { GLSL_NOISE } from '../lib/glsl.js';
import { scale } from '../lib/device.js';
import { PALETTE, CSS_PALETTE } from '../lib/palette.js';
import { createParamSetter } from '../lib/params.js';

export const defaults = {
  detail: 0,        // 0 = pick from the device
  amount: 0.27,     // how far the noise pushes the surface
  churn: 0.35,      // how fast the noise moves through it
  motes: 220,       // orbiting sparks
};

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 42, position: [0, 0, 4.4] },
  });
  const pointer = createPointer(canvas);

  const environment = createGradientEnvironment({
    top: '#241a3a', middle: '#080a10', bottom: '#3a2008', sun: '#fff0d0',
  });
  stage.scene.environment = environment;

  // ---- the drop -----------------------------------------------------------
  const geometry = new THREE.IcosahedronGeometry(1.25, params.detail || scale(3, 4));

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xdfe6ef,
    metalness: 1,
    roughness: 0.13,
    iridescence: 1,
    iridescenceIOR: 1.9,
    iridescenceThicknessRange: [120, 720],
    flatShading: true,
    envMapIntensity: 2.4,
  });

  // Shared with the injected shader below, so the uniforms update every frame.
  const shaderUniforms = {
    uTime: { value: 0 },
    uAmount: { value: params.amount },
    uChurn: { value: params.churn },
  };

  // Push the vertices around before three.js does anything else with them.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shaderUniforms.uTime;
    shader.uniforms.uAmount = shaderUniforms.uAmount;
    shader.uniforms.uChurn = shaderUniforms.uChurn;

    shader.vertexShader =
      'uniform float uTime;\nuniform float uAmount;\nuniform float uChurn;\n' +
      GLSL_NOISE +
      shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      vec3 direction = normalize(position);
      float slow = snoise(direction * 1.5 + vec3(0.0, 0.0, uTime * uChurn));
      float fast = snoise(direction * 3.9 - vec3(uTime * uChurn * 0.7, 0.0, 0.0));
      transformed += normal * (slow * uAmount + fast * uAmount * 0.34);
      `,
    );
  };

  const drop = new THREE.Mesh(geometry, material);
  stage.scene.add(drop);

  // ---- the spark at the centre, seen through the metal's silhouette -------
  const glowTexture = createRadialGlowTexture({ color: CSS_PALETTE.gold, softness: 2.8 });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35,
  }));
  glow.scale.setScalar(5.5);
  glow.position.z = -1.6;
  stage.scene.add(glow);

  // ---- motes orbiting the drop -------------------------------------------
  const motePositions = new Float32Array(params.motes * 3);
  const moteOrbits = [];
  for (let i = 0; i < params.motes; i++) {
    moteOrbits.push({
      radius: 1.7 + Math.random() * 1.5,
      speed: (0.15 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1),
      phase: Math.random() * Math.PI * 2,
      tilt: (Math.random() - 0.5) * Math.PI,
      wobble: Math.random() * 0.6,
    });
  }

  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(moteGeometry, new THREE.PointsMaterial({
    color: PALETTE.gold, size: 0.028, transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  stage.scene.add(motes);

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x2a3040, 0.7));
  const key = new THREE.DirectionalLight(0xfff0d0, 2.8);
  key.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight(PALETTE.violet, 1.6);
  rim.position.set(-3, -1, -2);
  stage.scene.add(key, rim);

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    shaderUniforms.uTime.value = time;

    drop.rotation.y += dt * 0.18;
    drop.rotation.x = pointer.y * 0.45;
    drop.rotation.z = pointer.x * 0.25;

    // A squeeze when you touch it.
    const squeeze = 1 + (pointer.down ? 0.12 : 0) + Math.sin(time * 0.8) * 0.02;
    drop.scale.setScalar(squeeze);

    for (let i = 0; i < params.motes; i++) {
      const orbit = moteOrbits[i];
      const angle = orbit.phase + time * orbit.speed;
      const radius = orbit.radius + Math.sin(time * 0.7 + orbit.phase) * orbit.wobble;
      motePositions[i * 3 + 0] = Math.cos(angle) * radius;
      motePositions[i * 3 + 1] = Math.sin(angle) * radius * Math.sin(orbit.tilt);
      motePositions[i * 3 + 2] = Math.sin(angle) * radius * Math.cos(orbit.tilt);
    }
    moteGeometry.attributes.position.needsUpdate = true;
    motes.rotation.y = time * 0.05;

    glow.material.opacity = 0.28 + Math.sin(time * 1.1) * 0.1;
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    glowTexture.dispose();
    geometry.dispose();
    material.dispose();
    moteGeometry.dispose();
  });

  stage.setParam = createParamSetter(params, {
    amount: (value) => { shaderUniforms.uAmount.value = value; },
    churn: (value) => { shaderUniforms.uChurn.value = value; },
  });

  return stage.start();
}
