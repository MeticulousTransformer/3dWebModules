/**
 * lightshaft.js — the beam you get when light comes through a high window
 * into dusty air.
 *
 * It is a quad, not a volume. Real volumetric light costs a raymarch per
 * pixel; from the front, at these angles, in this much fog, nobody can tell.
 * Bright at the source, fading down its length, soft at both edges, with a
 * slow drift of motes through it.
 *
 *   const shaft = createLightShaft({ width: 1.2, length: 6, color: 0x9fb6d8 });
 *   shaft.mesh.position.set(-3, 5, -8);
 *   shaft.mesh.lookAt(0, 0, -8);
 *   stage.scene.add(shaft.mesh);
 *   stage.onFrame(({ time }) => { shaft.material.uniforms.uTime.value = time; });
 *
 * The quad's own +Y runs from the source downwards, so position it at the
 * window and rotate it to point where the light is going.
 */
import * as THREE from 'three';

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision mediump float;
varying vec2 vUv;

uniform vec3  uColor;
uniform float uTime;
uniform float uIntensity;
uniform float uSpread;   // how much wider the beam gets away from the source

void main() {
  // vUv.y is 1 at the source, 0 at the far end.
  float along = pow(vUv.y, 1.7);

  // Widen as it travels, so the edges splay out like a real shaft.
  float halfWidth = mix(1.0, 1.0 / max(0.2, uSpread), vUv.y);
  float across = 1.0 - clamp(abs(vUv.x * 2.0 - 1.0) / halfWidth, 0.0, 1.0);
  across = pow(across, 2.4);

  // Dust drifting through the beam.
  float motes = 0.86 + 0.14 * sin(vUv.y * 34.0 - uTime * 0.6 + vUv.x * 9.0);

  float alpha = along * across * motes * uIntensity;
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

export function createLightShaft(options = {}) {
  const {
    width = 1,
    length = 5,
    color = 0x9fb6d8,
    intensity = 0.5,
    spread = 1.6,
  } = options;

  // Built so the top edge is the source and it hangs down its own -Y.
  const geometry = new THREE.PlaneGeometry(width, length, 1, 12);
  geometry.translate(0, -length / 2, 0);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uSpread: { value: spread },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2; // after the solid world, so it lies over the top

  return {
    mesh,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
