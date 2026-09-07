/**
 * BLOOD MOON
 *
 * An enormous red moon behind a city of spires. The skyline is generated —
 * walk left to right, throw up a wall, put a roof or a spire on it, move on —
 * and three copies of it at different distances drift at different speeds,
 * which is the whole of parallax.
 *
 * The moon is a flat disc pretending to be a sphere: the fragment shader
 * rebuilds the surface normal from the pixel's distance to the centre, so it
 * gets craters, limb darkening and a terminator for the price of a quad.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/glsl.js ../lib/random.js
 *                   ../lib/textures.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createRandom } from '../lib/random.js';
import { createRadialGlowTexture } from '../lib/textures.js';
import { GLSL_NOISE, GLSL_FBM } from '../lib/glsl.js';
import { GOTHIC, CSS_GOTHIC } from '../lib/palette.js';
import { scale } from '../lib/device.js';

export const defaults = {
  moonSize: 3.4,
  drift: 1,        // how fast the city slides past
  haze: 0.38,      // fog between the layers
  seed: 7,
};

const MOON_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const MOON_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform vec3  uColor;
uniform vec3  uSeaColor;

${GLSL_NOISE}
${GLSL_FBM}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float radius = length(p);
  if (radius > 1.0) discard;

  // Rebuild the sphere the disc is standing in for.
  vec3 normal = vec3(p, sqrt(max(0.0, 1.0 - radius * radius)));

  // Craters and maria, sampled on the surface of that sphere.
  float craters = fbm(normal * 3.4, 5);
  float maria = smoothstep(0.05, 0.45, fbm(normal * 1.6 + 11.0, 3));

  float shade = 0.72 + craters * 0.34;
  shade *= mix(0.42, 1.0, pow(normal.z, 0.55)); // limb darkening

  vec3 color = mix(uColor, uSeaColor, maria * 0.65) * shade;

  // A hairline of brighter rim where the atmosphere catches it.
  color += uColor * 0.5 * smoothstep(0.93, 1.0, radius);

  // Soften the very edge so it does not read as a cut-out.
  float alpha = 1.0 - smoothstep(0.985, 1.0, radius);
  gl_FragColor = vec4(color, alpha);
}
`;

const HAZE_VERTEX = MOON_VERTEX;

const HAZE_FRAGMENT = /* glsl */ `
precision mediump float;
varying vec2 vUv;

uniform float uTime;
uniform float uSpeed;
uniform vec3  uColor;
uniform float uStrength;

${GLSL_NOISE}
${GLSL_FBM}

void main() {
  vec3 p = vec3(vUv.x * 4.0 - uTime * uSpeed * 0.04, vUv.y * 2.0, uTime * 0.02);
  float bank = fbm(p, 4) * 0.5 + 0.5;

  // Thickest low down, thinning as it rises.
  float height = pow(1.0 - vUv.y, 1.8);
  float alpha = bank * height * uStrength;

  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

/**
 * A skyline as one closed outline: up a wall, over a roof or up to a spire,
 * down again, next building. Returns the shape and where the towers ended up,
 * so windows can be put in them afterwards.
 */
function buildSkyline({ width, height, random }) {
  const shape = new THREE.Shape();
  const towers = [];

  const half = width / 2;
  const floor = -height * 1.6;

  shape.moveTo(-half, floor);

  let x = -half;
  while (x < half) {
    const towerWidth = random.between(0.8, 2.8);
    const towerHeight = height * random.between(0.34, 1.0);

    shape.lineTo(x, towerHeight);                       // up the near wall

    if (random.chance(0.28)) {
      const spire = towerWidth * random.between(0.5, 1.1);
      shape.lineTo(x + towerWidth * 0.5, towerHeight + spire); // to the point
      shape.lineTo(x + towerWidth, towerHeight);               // and down
    } else {
      shape.lineTo(x + towerWidth, towerHeight);        // flat roof
    }

    towers.push({ x, width: towerWidth, height: towerHeight });
    x += towerWidth;
  }

  shape.lineTo(half, floor);
  shape.closePath();

  return { shape, towers };
}

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: GOTHIC.pitch,
    camera: { fov: 46, position: [0, 0.6, 6], far: 90 },
  });
  const pointer = createPointer(canvas);

  // ---- stars --------------------------------------------------------------
  const starCount = scale(200, 420);
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3 + 0] = (Math.random() - 0.5) * 46;
    starPositions[i * 3 + 1] = Math.random() * 18 - 1;
    starPositions[i * 3 + 2] = -26;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({
    color: 0xc8d4e8, size: 0.045, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  stage.scene.add(stars);

  // ---- the moon -----------------------------------------------------------
  const moonUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0xd6403a) },
    uSeaColor: { value: new THREE.Color(0x6b1420) },
  };
  const moon = new THREE.Mesh(
    new THREE.PlaneGeometry(params.moonSize, params.moonSize),
    new THREE.ShaderMaterial({
      uniforms: moonUniforms,
      vertexShader: MOON_VERTEX,
      fragmentShader: MOON_FRAGMENT,
      transparent: true,
    }),
  );
  moon.position.set(-0.9, 2.6, -22);
  moon.scale.setScalar(3.0);
  stage.scene.add(moon);

  const haloTexture = createRadialGlowTexture({ color: '#d6403a', softness: 2.0 });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTexture, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, opacity: 0.45,
  }));
  halo.scale.setScalar(26);
  halo.position.copy(moon.position).setZ(-23);
  stage.scene.add(halo);

  // ---- the city, three deep ----------------------------------------------
  const LAYERS = [
    { z: -17, height: 5.4, shade: 0x14101a, speed: 0.10, y: -3.6, windows: 0 },
    { z: -11, height: 4.6, shade: 0x0a0710, speed: 0.22, y: -3.1, windows: 22 },
    { z: -5.5, height: 3.8, shade: 0x030208, speed: 0.45, y: -2.7, windows: 40 },
  ];

  const city = [];
  const windowGeometry = new THREE.PlaneGeometry(0.075, 0.115);

  LAYERS.forEach((layer, index) => {
    const random = createRandom(params.seed + index * 977);
    const { shape, towers } = buildSkyline({ width: 46, height: layer.height, random });

    const material = new THREE.MeshBasicMaterial({ color: layer.shade });
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 1), material);
    mesh.position.set(0, layer.y, layer.z);

    const group = new THREE.Group();
    group.add(mesh);

    // A second copy alongside, so the city can slide forever.
    const clone = mesh.clone();
    clone.position.x = 46;
    group.add(clone);

    // Lit windows, only in the layers close enough to have them.
    if (layer.windows > 0) {
      const lights = new THREE.InstancedMesh(
        windowGeometry,
        new THREE.MeshBasicMaterial({ color: GOTHIC.amber, transparent: true, opacity: 0.85 }),
        layer.windows,
      );
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < layer.windows; i++) {
        const tower = towers[Math.floor(random() * towers.length)];
        matrix.makeScale(1, 1, 1);
        matrix.setPosition(
          tower.x + random.between(0.15, tower.width - 0.15),
          layer.y + random.between(tower.height * 0.35, tower.height * 0.88),
          layer.z + 0.02,
        );
        lights.setMatrixAt(i, matrix);
      }
      lights.instanceMatrix.needsUpdate = true;
      group.add(lights);
    }

    stage.scene.add(group);
    city.push({ group, speed: layer.speed });
  });

  // ---- haze between the layers -------------------------------------------
  const hazeLayers = [];
  for (const [z, strength, speed] of [[-15, 0.9, 0.6], [-9, 0.7, 1.0], [-4, 0.45, 1.5]]) {
    const uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uColor: { value: new THREE.Color(0x51283a) },
      uStrength: { value: strength * params.haze },
    };
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 9),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: HAZE_VERTEX,
        fragmentShader: HAZE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.position.set(0, -1.6, z);
    stage.scene.add(mesh);
    hazeLayers.push({ uniforms, base: strength });
  }

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    moonUniforms.uTime.value = time;

    for (const layer of city) {
      layer.group.position.x -= layer.speed * params.drift * dt;
      if (layer.group.position.x < -46) layer.group.position.x += 46;
    }

    for (const layer of hazeLayers) {
      layer.uniforms.uTime.value = time;
      layer.uniforms.uStrength.value = layer.base * params.haze;
    }

    halo.material.opacity = 0.40 + Math.sin(time * 0.5) * 0.08;

    // A slow lean, so the city has depth when you move.
    stage.camera.position.x = pointer.x * 1.4;
    stage.camera.position.y = 0.6 + pointer.y * 0.6;
    stage.camera.lookAt(pointer.x * 0.4, 0.8, -20);
  });

  stage.onDispose(() => {
    pointer.dispose();
    haloTexture.dispose();
    starGeometry.dispose();
    moon.geometry.dispose();
    moon.material.dispose();
    windowGeometry.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
