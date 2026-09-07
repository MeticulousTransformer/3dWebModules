/**
 * NEON LATTICE
 *
 * A city going past at speed. Two scrolling grid planes for ground and sky, and
 * a few hundred instanced slabs that recycle behind you when they fall off the
 * back — so the corridor is endless while the scene stays tiny.
 *
 * Each slab is vertex-coloured dark at the base and bright at the top, then
 * tinted per instance, which gives every tower its own neon without a single
 * light in the scene.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/textures.js ../lib/device.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createRadialGlowTexture } from '../lib/textures.js';
import { scale } from '../lib/device.js';
import { PALETTE, CSS_PALETTE } from '../lib/palette.js';

export const defaults = {
  towerCount: 0,     // 0 = pick from the device
  speed: 14,         // world units per second
  corridorWidth: 3.4,
  depth: 78,
};

const NEON_COLORS = [PALETTE.cyan, PALETTE.violet, PALETTE.vermilion, PALETTE.gold, PALETTE.acid];

const GRID_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GRID_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uSpeed;
uniform vec2  uCells;
uniform vec3  uColor;
uniform float uFade;

void main() {
  vec2 p = vUv * uCells;
  p.y -= uTime * uSpeed;

  // Distance to the nearest grid line, measured in pixels via derivatives.
  // This keeps far-away lines thin instead of aliasing into noise.
  vec2 grid = abs(fract(p) - 0.5) / fwidth(p);
  float line = 1.0 - smoothstep(0.0, 1.4, min(grid.x, grid.y));

  // Fade towards the horizon.
  float depth = pow(1.0 - abs(vUv.y * 2.0 - 1.0), uFade);

  gl_FragColor = vec4(uColor * line * depth, line * depth);
}
`;

/** A box that is dark at the bottom and bright at the top. */
function createGradientBox() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const height = position.getY(i) + 0.5;        // 0 at the base, 1 at the roof
    const brightness = Math.pow(height, 2.4) * 0.95 + 0.05;
    colors[i * 3 + 0] = brightness;
    colors[i * 3 + 1] = brightness;
    colors[i * 3 + 2] = brightness;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const towerCount = params.towerCount || scale(130, 240);

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 68, position: [0, 0.6, 6], lookAt: [0, 0.4, -10], far: 120 },
  });
  const pointer = createPointer(canvas);
  stage.scene.fog = new THREE.Fog(PALETTE.void, 7, params.depth * 0.80);

  // ---- ground and sky -----------------------------------------------------
  const gridUniforms = [];

  function createGridPlane(y, color, flip) {
    const uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: 0.9 },
      uCells: { value: new THREE.Vector2(28, 70) },
      uColor: { value: new THREE.Color(color) },
      uFade: { value: 1.6 },
    };
    gridUniforms.push(uniforms);

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: GRID_VERTEX,
      fragmentShader: GRID_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(64, params.depth * 2), material);
    mesh.rotation.x = flip ? Math.PI / 2 : -Math.PI / 2;
    mesh.position.set(0, y, -params.depth * 0.5);
    return mesh;
  }

  const ground = createGridPlane(-2.2, PALETTE.cyan, false);
  const sky = createGridPlane(7.5, PALETTE.violet, true);
  stage.scene.add(ground, sky);

  // ---- the towers ---------------------------------------------------------
  const boxGeometry = createGradientBox();
  const boxMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  const towers = new THREE.InstancedMesh(boxGeometry, boxMaterial, towerCount);
  towers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  stage.scene.add(towers);

  // Plain arrays of state, one entry per tower. Easy to read, easy to debug.
  const towerState = [];
  const matrix = new THREE.Matrix4();
  const scratchColor = new THREE.Color();

  function resetTower(index, z) {
    const side = Math.random() < 0.5 ? -1 : 1;
    towerState[index] = {
      x: side * (params.corridorWidth + Math.random() * 11),
      z,
      width: 0.45 + Math.random() * 1.1,
      depth: 0.45 + Math.random() * 1.1,
      height: 1.6 + Math.random() * Math.random() * 15,
    };
    scratchColor.setHex(NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)]);
    // Pull the tint right down: these are lit windows in the dark, not paint.
    scratchColor.multiplyScalar(0.30 + Math.random() * 0.35);
    towers.setColorAt(index, scratchColor);
  }

  for (let i = 0; i < towerCount; i++) {
    resetTower(i, -Math.random() * params.depth);
  }

  function writeTowerMatrices() {
    for (let i = 0; i < towerCount; i++) {
      const tower = towerState[i];
      matrix.makeScale(tower.width, tower.height, tower.depth);
      matrix.setPosition(tower.x, -2.2 + tower.height / 2, tower.z);
      towers.setMatrixAt(i, matrix);
    }
    towers.instanceMatrix.needsUpdate = true;
  }

  writeTowerMatrices();
  if (towers.instanceColor) towers.instanceColor.needsUpdate = true;

  // ---- horizon glow -------------------------------------------------------
  const glowTexture = createRadialGlowTexture({ color: CSS_PALETTE.violet, softness: 2.4 });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45,
  }));
  glow.scale.set(46, 20, 1);
  glow.position.set(0, 0.5, -params.depth * 0.85);
  stage.scene.add(glow);

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    const travel = params.speed * dt;
    for (let i = 0; i < towerCount; i++) {
      towerState[i].z += travel;
      // Past the camera? Send it back to the far end as a brand new building.
      if (towerState[i].z > 10) resetTower(i, towerState[i].z - params.depth);
    }
    writeTowerMatrices();
    if (towers.instanceColor) towers.instanceColor.needsUpdate = true;

    for (const uniforms of gridUniforms) uniforms.uTime.value = time;

    // Lean into the turn.
    stage.camera.position.x += (pointer.x * 2.2 - stage.camera.position.x) * Math.min(1, dt * 2.4);
    stage.camera.position.y = 0.6 + pointer.y * 1.1 + Math.sin(time * 1.7) * 0.05;
    stage.camera.rotation.z = -pointer.x * 0.10;
    stage.camera.lookAt(pointer.x * 3.5, 0.4 + pointer.y * 1.4, -14);
    stage.camera.rotation.z = -pointer.x * 0.10;
  });

  stage.onDispose(() => {
    pointer.dispose();
    boxGeometry.dispose();
    boxMaterial.dispose();
    glowTexture.dispose();
  });

  return stage.start();
}
