/**
 * fullscreen.js — a quad that always covers the whole canvas.
 *
 * The vertex shader ignores the camera entirely and writes clip-space
 * coordinates directly, so this works no matter what camera the stage has and
 * never needs resizing.
 *
 *   const sky = createFullscreenQuad(myFragmentShader, { uTime: { value: 0 } });
 *   stage.scene.add(sky.mesh);
 *   stage.onFrame(({ time }) => { sky.material.uniforms.uTime.value = time; });
 *   stage.onDispose(() => sky.dispose());
 */
import * as THREE from 'three';

const PASSTHROUGH_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export function createFullscreenQuad(fragmentShader, uniforms = {}, materialOptions = {}) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: PASSTHROUGH_VERTEX,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    ...materialOptions,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;   // it is always on screen by definition
  mesh.renderOrder = -1;        // draw it first, behind everything else

  return {
    mesh,
    material,
    geometry,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
