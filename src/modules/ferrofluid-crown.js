/**
 * FERROFLUID CROWN
 * Black liquid pulled into a hexagonal crown by an imagined magnetic field.
 * This is a procedural surface inspired by ferrofluid, not a fluid solver.
 * The vertex shader evaluates the height and its slope so reflections follow
 * every peak; no mesh is rebuilt during animation.
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { scale } from '../lib/device.js';
import { lightInstrument, frameInstrument, instrumentParams, instrumentOptions } from '../lib/instrument-studio.js';

export const defaults = { field: 0.8, frequency: 8, speed: 0.22, metallic: 0.95 };
const limits = { field: [0, 1.5], frequency: [5, 12], speed: [0, 1], metallic: [0.5, 1] };

/** Concentric triangles give a true circular silhouette, without fragment discard. */
export function ferrofluidGeometry(rings = 64, sectors = 160) {
  const positions = [0, 0, 0];
  const normals = [0, 1, 0];
  const indices = [];
  for (let row = 1; row <= rings; row++) {
    const radius = row / rings * 1.88;
    for (let column = 0; column < sectors; column++) {
      const angle = column / sectors * Math.PI * 2;
      positions.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      normals.push(0, 1, 0);
      const current = 1 + (row - 1) * sectors + column;
      const next = 1 + (row - 1) * sectors + (column + 1) % sectors;
      if (row === 1) indices.push(0, next, current);
      else {
        const previous = current - sectors, previousNext = next - sectors;
        indices.push(previous, next, current, previous, previousNext, next);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  // The CPU never sees shader displacement. Account for the tallest allowed peaks.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.7, 0), 2.5);
  return geometry;
}

const fieldShader = /* glsl */ `
uniform float uClock;
uniform float uField;
uniform float uFrequency;
uniform vec2 uMagnet;

float surfaceHeight(vec2 p) {
  vec2 q = p - uMagnet;
  float k = uFrequency;
  // Three standing waves 60 degrees apart form the hexagonal peak lattice.
  float a = cos(q.x * k);
  float b = cos((q.x * 0.5 + q.y * 0.8660254) * k);
  float c = cos((q.x * -0.5 + q.y * 0.8660254) * k);
  float lattice = clamp((a + b + c + 3.0) / 6.0, 0.0, 1.0);
  float peaks = pow(lattice, 6.0);
  float edge = 1.0 - smoothstep(1.32, 1.87, length(p));
  float envelope = exp(-dot(q, q) * 0.3);
  float ripple = sin(length(q) * 9.0 - uClock * 2.0) * 0.018;
  return 0.04 + edge * (peaks * uField * envelope + ripple * min(uField, 1.0));
}
`;

export default function create(canvas, options = {}) {
  const params = instrumentOptions(defaults, options, limits);
  const stage = createStage(canvas, { clearColor: 0x07080b, maxPixelRatio: 1.5, camera: { fov: 38 } });
  const pointer = createPointer(canvas, { tilt: false, smoothing: 3 });
  lightInstrument(stage, { warmth: '#e9dcca', rim: 0x90b2d9 });
  frameInstrument(stage, 2.45, [0.2, 0.95, 1], [0, 0.2, 0]);

  const sculpture = new THREE.Group();
  sculpture.rotation.y = -0.3;
  stage.scene.add(sculpture);

  const uniforms = {
    uClock: { value: 0 }, uField: { value: params.field },
    uFrequency: { value: params.frequency }, uMagnet: { value: new THREE.Vector2() },
  };
  const liquidMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x303640, metalness: params.metallic, roughness: 0.18,
    clearcoat: 1, clearcoatRoughness: 0.09, envMapIntensity: 1.4,
  });
  liquidMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = fieldShader + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', /* glsl */ `
      float epsilon = 0.003;
      float dx = (surfaceHeight(position.xz + vec2(epsilon, 0.0)) - surfaceHeight(position.xz - vec2(epsilon, 0.0))) / (2.0 * epsilon);
      float dz = (surfaceHeight(position.xz + vec2(0.0, epsilon)) - surfaceHeight(position.xz - vec2(0.0, epsilon))) / (2.0 * epsilon);
      vec3 objectNormal = normalize(vec3(-dx, 1.0, -dz));
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3(tangent.xyz);
      #endif
    `);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', /* glsl */ `
      vec3 transformed = vec3(position.x, surfaceHeight(position.xz), position.z);
    `);
  };
  liquidMaterial.customProgramCacheKey = () => 'athanor-ferrofluid-crown-v1';
  const liquid = new THREE.Mesh(ferrofluidGeometry(scale(64, 96), scale(144, 224)), liquidMaterial);
  sculpture.add(liquid);

  const ceramic = new THREE.MeshStandardMaterial({ color: 0x11151b, metalness: 0.72, roughness: 0.3 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xad8b55, metalness: 0.96, roughness: 0.26 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.94, 1.78, 0.19, 96), ceramic);
  bowl.position.y = -0.09;
  sculpture.add(bowl);
  for (const [radius, y, tube] of [[1.94, 0.015, 0.033], [1.85, -0.18, 0.018]]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 192), brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y;
    sculpture.add(rim);
  }
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.35, 0.1, 64), ceramic);
  pedestal.position.y = -0.24;
  sculpture.add(pedestal);

  let clock = 0;
  stage.onFrame(({ dt }) => {
    pointer.update(dt);
    clock += dt * params.speed;
    uniforms.uClock.value = clock;
    uniforms.uField.value = params.field;
    uniforms.uFrequency.value = params.frequency;
    // Move the field source through the liquid; vertical gestures still scroll.
    uniforms.uMagnet.value.set(pointer.x * 0.48 + Math.sin(clock * 0.7) * 0.12, -pointer.y * 0.48 + Math.cos(clock * 0.55) * 0.12);
    liquidMaterial.metalness = params.metallic;
    sculpture.rotation.y = -0.3 + pointer.x * 0.16;
  });
  stage.onDispose(() => pointer.dispose());
  stage.setParam = instrumentParams(stage, params, limits);
  return stage.start();
}
