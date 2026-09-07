/**
 * pingpong.js — two render targets that take turns being the answer.
 *
 * This is how you run a simulation on the GPU. Frame N reads texture A and
 * writes texture B; frame N+1 reads B and writes A. The state never leaves
 * the graphics card, so a 512x512 grid can be stepped a dozen times per frame
 * without the CPU noticing.
 *
 *   const sim = createPingPong(renderer, {
 *     size: 512,
 *     fragmentShader: GRAY_SCOTT,
 *     uniforms: { uFeed: { value: 0.037 } },
 *     seed: (context, width, height) => { ...draw the starting state... },
 *   });
 *
 *   sim.step();        // one simulation tick
 *   sim.texture        // the current state, to show on screen
 *   sim.dispose();
 *
 * The shader gets `uState` (last frame), `uTexel` (one pixel in uv units) and
 * whatever else you passed in `uniforms`.
 */
import * as THREE from 'three';

const PASSTHROUGH_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COPY_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSource;
void main() { gl_FragColor = texture2D(uSource, vUv); }
`;

export function createPingPong(renderer, options = {}) {
  const {
    size = 512,
    width = size,
    height = size,
    fragmentShader,
    uniforms = {},
    seed,
  } = options;

  // Half float keeps enough precision for chemistry to stay stable. Nearest
  // filtering matters too: a simulation must read the exact neighbouring cell,
  // not a blurred average of four.
  const targetOptions = {
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  };

  let read = new THREE.WebGLRenderTarget(width, height, targetOptions);
  let write = new THREE.WebGLRenderTarget(width, height, targetOptions);

  const scene = new THREE.Scene();
  const camera = new THREE.Camera(); // clip space; the vertex shader ignores it
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);

  const simulationUniforms = {
    uState: { value: read.texture },
    uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
    ...uniforms,
  };

  const simulationMaterial = new THREE.ShaderMaterial({
    uniforms: simulationUniforms,
    vertexShader: PASSTHROUGH_VERTEX,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });

  // ---- the starting state -------------------------------------------------
  let seedTexture = null;
  const copyMaterial = new THREE.ShaderMaterial({
    uniforms: { uSource: { value: null } },
    vertexShader: PASSTHROUGH_VERTEX,
    fragmentShader: COPY_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });

  function reset() {
    if (!seed) return;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    seed(canvas.getContext('2d'), width, height);

    if (seedTexture) seedTexture.dispose();
    seedTexture = new THREE.CanvasTexture(canvas);
    seedTexture.minFilter = THREE.NearestFilter;
    seedTexture.magFilter = THREE.NearestFilter;

    copyMaterial.uniforms.uSource.value = seedTexture;
    quad.material = copyMaterial;

    const previousTarget = renderer.getRenderTarget();
    for (const target of [read, write]) {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
    }
    renderer.setRenderTarget(previousTarget);
  }

  reset();

  // ---- one tick -----------------------------------------------------------
  function step() {
    quad.material = simulationMaterial;
    simulationUniforms.uState.value = read.texture;

    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(write);
    renderer.render(scene, camera);
    renderer.setRenderTarget(previousTarget);

    // Swap. The thing just written becomes the thing next read.
    const swap = read;
    read = write;
    write = swap;
  }

  return {
    step,
    reset,
    uniforms: simulationUniforms,
    get texture() {
      return read.texture;
    },
    dispose() {
      read.dispose();
      write.dispose();
      quad.geometry.dispose();
      simulationMaterial.dispose();
      copyMaterial.dispose();
      if (seedTexture) seedTexture.dispose();
    },
  };
}
