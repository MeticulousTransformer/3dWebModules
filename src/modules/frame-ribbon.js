/**
 * FRAME RIBBON
 *
 * A length of 35mm curving through the dark, with something exposed on every
 * frame.
 *
 * The strip is one ribbon of triangles and one shader. Sprocket holes, frame
 * lines, edge markings and the picture inside each frame are all worked out
 * from the two texture coordinates — one running along the strip, one across
 * it — so a hundred frames cost exactly as much as one.
 *
 * The pictures are tonal studies rather than scenes: a horizon, a source, a
 * mass in the foreground, and an exposure that is never quite right twice.
 * That is what a contact sheet actually looks like.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/glsl.js ../lib/filmlook.js
 *                   ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { GLSL_HASH } from '../lib/glsl.js';
import { createFilmLook } from '../lib/filmlook.js';
import { STUDIO } from '../lib/palette.js';

export const defaults = {
  frames: 26,      // how many frames the visible length of strip carries
  speed: 0.09,     // how fast it runs through
  curl: 1,         // how hard the strip twists
  exposure: 0.8,
};

const SAMPLES = 320;   // steps along the strip
const HALF_WIDTH = 0.44;

const VERTEX_SHADER = /* glsl */ `
attribute vec3 aNormal;

varying vec2  vUv;
varying float vShade;

uniform vec3 uLight;

void main() {
  vUv = uv;

  // A cheap lambert against one fixed direction, so the twist reads in 3D
  // even though nothing here is lit for real.
  vec3 worldNormal = normalize(mat3(modelMatrix) * aNormal);
  float facing = abs(dot(worldNormal, normalize(uLight)));
  vShade = 0.30 + 0.70 * pow(facing, 0.7);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2  vUv;
varying float vShade;

uniform float uTime;
uniform float uFrames;
uniform float uScroll;
uniform float uExposure;

${GLSL_HASH}

/** A rounded rectangle, for the sprocket holes. */
float roundedBox(vec2 p, vec2 halfSize, float radius) {
  vec2 d = abs(p) - halfSize + radius;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - radius;
}

/**
 * One exposed frame. The seed changes everything about it; local runs 0..1
 * across and up the picture area.
 */
vec3 exposeFrame(vec2 local, float seed) {
  float horizon = 0.34 + 0.26 * hash11(seed * 1.7);
  float sourceX = 0.15 + 0.70 * hash11(seed * 3.1 + 4.0);
  float sourceY = horizon + 0.06 + 0.26 * hash11(seed * 5.3 + 9.0);
  float haze = 0.35 + 0.5 * hash11(seed * 7.9 + 2.0);

  // Sky: darker up top, opening out towards the horizon.
  float sky = mix(0.52, 0.012, smoothstep(horizon, 1.0, local.y));

  // The source, and the glow it throws into the haze around it.
  vec2 toSource = (local - vec2(sourceX, sourceY)) * vec2(1.5, 1.0);
  float source = exp(-length(toSource) * 13.0);
  float glow = exp(-length(toSource) * 2.6) * haze;

  // Foreground: a low mass, different in every frame.
  float ridge = horizon * (0.42 + 0.34 * sin(local.x * (2.0 + hash11(seed * 11.0) * 5.0) + seed))
              - 0.04;
  float ground = 1.0 - smoothstep(ridge, ridge + 0.012, local.y);

  float luma = sky + source * 1.15 + glow * 0.5;
  luma = mix(luma, 0.004, ground);

  // Every frame is exposed slightly differently. That is the whole charm of
  // looking at a strip rather than a single frame.
  float stop = 0.42 + 0.72 * hash11(seed * 13.0 + 6.0);
  luma = 1.0 - exp(-luma * stop * uExposure * 2.4);

  // Warm in the highlights, cool in the shadows: a print, not a scan.
  // Their foreground colour in the highlights, near black in the shadows.
  vec3 color = mix(vec3(0.030, 0.030, 0.034), vec3(0.957, 0.945, 0.918), pow(luma, 0.9));
  return color;
}

void main() {
  // vUv.x runs the length of the strip, vUv.y across it.
  float along = vUv.x * uFrames + uScroll;
  float across = vUv.y;

  float frameIndex = floor(along);
  vec2 cell = vec2(fract(along), across);

  vec3 color = vec3(0.030, 0.028, 0.026); // the base, between everything

  // ---- sprocket holes, both edges ----
  float holePitch = fract(along * 4.0);
  vec2 holeUv = vec2(holePitch - 0.5, 0.0);
  float holeMask = 0.0;
  for (int side = 0; side < 2; side++) {
    float centre = side == 0 ? 0.072 : 0.928;
    vec2 p = vec2(holeUv.x, (across - centre) * 4.2);
    holeMask += 1.0 - smoothstep(-0.01, 0.01, roundedBox(p, vec2(0.20, 0.19), 0.07));
  }

  // ---- the picture ----
  float top = 0.855;
  float bottom = 0.145;
  float inFrame = step(bottom, across) * step(across, top);

  vec2 local = vec2(cell.x, (across - bottom) / (top - bottom));
  // Frame line: a black bar between one frame and the next.
  float gutter = smoothstep(0.0, 0.016, cell.x) * smoothstep(1.0, 0.984, cell.x);

  vec3 picture = exposeFrame(local, frameIndex) * gutter;
  color = mix(color, picture, inFrame);

  // ---- edge markings, in the strip between the picture and the holes ----
  float markBand = step(0.10, across) * step(across, 0.135);
  float dashes = step(0.55, fract(along * 7.0));
  color += vec3(0.72, 0.59, 0.36) * markBand * dashes;

  // ---- emulsion ----
  float grain = hash21(vec2(along * 220.0, across * 180.0) + fract(uTime) * 53.0) - 0.5;
  color += grain * 0.045;

  // A scratch or two, running the length of the strip.
  float scratch = step(0.9975, hash11(floor(across * 260.0)));
  color += vec3(0.16) * scratch * step(0.2, across) * step(across, 0.8);

  // The holes are punched right through to whatever is behind.
  color = mix(color, vec3(0.02, 0.02, 0.025), clamp(holeMask, 0.0, 1.0));

  gl_FragColor = vec4(color * vShade, 1.0);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: STUDIO.gate,
    camera: { fov: 42, position: [0, 0, 4.6], far: 40 },
  });
  const pointer = createPointer(canvas);
  stage.scene.fog = new THREE.FogExp2(0x08080a, 0.09);

  // ---- the path the strip takes ------------------------------------------
  const spine = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-5.4, -1.5, -3.0),
    new THREE.Vector3(-2.8, 0.7, -1.0),
    new THREE.Vector3(-0.6, -0.5, 0.6),
    new THREE.Vector3(1.4, 0.9, -0.4),
    new THREE.Vector3(3.4, -0.6, -1.8),
    new THREE.Vector3(5.6, 1.2, -3.6),
  ], false, 'catmullrom', 0.4);

  const positions = new Float32Array((SAMPLES + 1) * 2 * 3);
  const normals = new Float32Array((SAMPLES + 1) * 2 * 3);
  const uvs = new Float32Array((SAMPLES + 1) * 2 * 2);
  const indices = [];

  for (let i = 0; i < SAMPLES; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const up = new THREE.Vector3();
  const right = new THREE.Vector3();
  const normal = new THREE.Vector3();

  /**
   * Lay the ribbon out along the spine. The strip is twisted about its own
   * length so it turns edge-on and back, which is what film does when it is
   * not being held flat.
   */
  function buildRibbon(curl) {
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      spine.getPointAt(t, point);
      spine.getTangentAt(t, tangent);

      // Twist the up vector along the strip.
      const twist = Math.sin(t * Math.PI * 3.1) * 1.15 * curl;
      up.set(Math.sin(twist), Math.cos(twist), 0).normalize();

      right.crossVectors(tangent, up).normalize();
      normal.crossVectors(right, tangent).normalize();

      const o = i * 6;
      positions[o + 0] = point.x - right.x * HALF_WIDTH;
      positions[o + 1] = point.y - right.y * HALF_WIDTH;
      positions[o + 2] = point.z - right.z * HALF_WIDTH;
      positions[o + 3] = point.x + right.x * HALF_WIDTH;
      positions[o + 4] = point.y + right.y * HALF_WIDTH;
      positions[o + 5] = point.z + right.z * HALF_WIDTH;

      for (const vertex of [0, 3]) {
        normals[o + vertex + 0] = normal.x;
        normals[o + vertex + 1] = normal.y;
        normals[o + vertex + 2] = normal.z;
      }

      uvs[i * 4 + 0] = t; uvs[i * 4 + 1] = 0;
      uvs[i * 4 + 2] = t; uvs[i * 4 + 3] = 1;
    }
  }

  buildRibbon(params.curl);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const uniforms = {
    uTime: { value: 0 },
    uFrames: { value: params.frames },
    uScroll: { value: 0 },
    uExposure: { value: params.exposure },
    uLight: { value: new THREE.Vector3(0.5, 0.8, 1.0) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.DoubleSide,
  });

  const strip = new THREE.Mesh(geometry, material);
  const reel = new THREE.Group();
  reel.add(strip);
  stage.scene.add(reel);

  // ---- grain over the top -------------------------------------------------
  const look = createFilmLook({ grain: 0.04, vignette: 0.58 });
  stage.scene.add(look.mesh);

  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 4.6 * Math.tan((42 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    reel.scale.setScalar(Math.min(1, visibleWidth / 8.4));
  });

  // ---- animation ----------------------------------------------------------
  let currentCurl = params.curl;

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    uniforms.uTime.value = time;
    uniforms.uFrames.value = params.frames;
    uniforms.uExposure.value = params.exposure;
    uniforms.uScroll.value -= params.speed * params.frames * dt;

    // Rebuild only when the twist has actually changed.
    if (Math.abs(currentCurl - params.curl) > 0.001) {
      currentCurl = params.curl;
      buildRibbon(currentCurl);
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aNormal.needsUpdate = true;
    }

    reel.rotation.y = pointer.x * 0.42 + Math.sin(time * 0.13) * 0.10;
    reel.rotation.x = pointer.y * 0.28 + Math.sin(time * 0.09) * 0.05;

    look.update(time);
  });

  stage.onDispose(() => {
    pointer.dispose();
    look.dispose();
    geometry.dispose();
    material.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
