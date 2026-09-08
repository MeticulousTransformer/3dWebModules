/**
 * APERTURE IRIS
 *
 * A camera iris, built the way one actually works rather than drawn to look
 * like one.
 *
 * Every blade is a plain disc. The opening is simply the part of the housing
 * that no disc covers — so if the disc centres sit on a circle of radius d and
 * each disc has radius R, the opening has radius d - R and you get the
 * straight-ish sides and rounded corners of a real iris for free. Closing down
 * is one number: slide the discs inward.
 *
 * Nothing is rebuilt as it stops down. The blades are rigid; only where they
 * sit changes, which is also true of the real thing.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/textures.js ../lib/filmlook.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createRadialGlowTexture } from '../lib/textures.js';
import { createFilmLook } from '../lib/filmlook.js';
import { STUDIO, CSS_STUDIO } from '../lib/palette.js';

export const defaults = {
  blades: 8,
  dwell: 1.6,     // seconds held at each stop
  travel: 0.8,    // seconds moving between stops
  starburst: 1,   // strength of the diffraction star when stopped down
};

/** Full stops. The opening's radius is proportional to 1 / f. */
const F_STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];

const HOUSING = 1.10;   // the hole the blades sit in
const BLADE_RADIUS = 1.55;
const MAX_OPENING = 0.86;

const BLADE_VERTEX = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BLADE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vLocal;

uniform float uRadius;
uniform vec3  uBody;
uniform vec3  uEdge;
uniform float uShade;

void main() {
  float r = length(vLocal) / uRadius;

  // The machined edge of the leaf, which is the only thing that separates one
  // blade from the one under it.
  float rim = smoothstep(0.978, 0.998, r);

  // A gradient across the leaf, so it reads as something slightly domed.
  float sweep = 0.62 + 0.38 * (vLocal.y / uRadius * 0.5 + 0.5);

  // Brushed steel: fine streaks running round the blade.
  float angle = atan(vLocal.y, vLocal.x);
  float brush = 0.97 + 0.03 * sin(angle * 220.0);

  vec3 color = mix(uBody * sweep * brush * uShade, uEdge, rim);
  gl_FragColor = vec4(color, 1.0);
}
`;

/** The diffraction star a stopped-down lens puts on a point of light. */
const STAR_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float uSpikes;
uniform float uStrength;
uniform vec3  uColor;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float radius = length(p);
  if (radius > 1.0) discard;

  float angle = atan(p.y, p.x);

  // A blade count of N gives N spikes if N is even and 2N if it is odd.
  float spikes = pow(abs(cos(angle * uSpikes * 0.5)), 60.0);
  float falloff = pow(1.0 - radius, 3.0);

  float alpha = spikes * falloff * uStrength;
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

const STAR_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: STUDIO.gate,
    camera: { fov: 40, position: [0, 0, 3.9] },
  });
  const pointer = createPointer(canvas);

  const iris = new THREE.Group();
  stage.scene.add(iris);

  // ---- what is behind the hole -------------------------------------------
  const lightTexture = createRadialGlowTexture({ color: CSS_STUDIO.paper, softness: 1.5 });
  const backlight = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lightTexture, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, opacity: 0.9,
  }));
  backlight.scale.setScalar(2.6);
  backlight.position.z = -0.4;
  iris.add(backlight);

  const DISC_COLOUR = new THREE.Color(0xf4f1ea);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(HOUSING, 96),
    new THREE.MeshBasicMaterial({ color: DISC_COLOUR.clone() }),
  );
  disc.position.z = -0.3;
  iris.add(disc);

  // ---- the blades ---------------------------------------------------------
  const bladeGeometry = new THREE.CircleGeometry(BLADE_RADIUS, 128);
  const blades = [];

  for (let i = 0; i < params.blades; i++) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uRadius: { value: BLADE_RADIUS },
        uBody: { value: new THREE.Color(0x191b1f) },
        uEdge: { value: new THREE.Color(0xb9975b) },
        // Alternate the shade very slightly so overlapping leaves separate.
        uShade: { value: i % 2 === 0 ? 1.0 : 0.88 },
      },
      vertexShader: BLADE_VERTEX,
      fragmentShader: BLADE_FRAGMENT,
    });

    const blade = new THREE.Mesh(bladeGeometry, material);
    blade.rotation.z = (i / params.blades) * Math.PI * 2;
    // Stack them like a real iris, each leaf a hair in front of the last.
    blade.position.z = i * 0.0016;
    iris.add(blade);
    blades.push(blade);
  }

  /** Slide every blade so the opening has this radius. */
  function setOpening(radius) {
    const distance = BLADE_RADIUS + radius;
    for (let i = 0; i < blades.length; i++) {
      const angle = (i / blades.length) * Math.PI * 2;
      blades[i].position.x = Math.cos(angle) * distance;
      blades[i].position.y = Math.sin(angle) * distance;
    }
  }
  setOpening(MAX_OPENING);

  // ---- the housing, hiding everything past the bore ----------------------
  const housing = new THREE.Mesh(
    new THREE.RingGeometry(HOUSING, 6, 96, 1),
    new THREE.MeshBasicMaterial({ color: 0x0c0d10 }),
  );
  housing.position.z = 0.05;
  iris.add(housing);

  // A machined lip around the bore, to catch the light.
  const lip = new THREE.Mesh(
    new THREE.RingGeometry(HOUSING, HOUSING + 0.018, 96, 1),
    new THREE.MeshBasicMaterial({ color: 0x8a7448 }),
  );
  lip.position.z = 0.055;
  iris.add(lip);

  // Knurling: short ticks around the outside, the way a real barrel is cut.
  const tickGeometry = new THREE.PlaneGeometry(0.012, 0.10);
  const tickMaterial = new THREE.MeshBasicMaterial({ color: 0x4a3f2a });
  const ticks = new THREE.InstancedMesh(tickGeometry, tickMaterial, 72);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 0, 1);
  const tickPosition = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);

  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    quaternion.setFromAxisAngle(axis, angle);
    tickPosition.set(Math.cos(angle) * 1.42, Math.sin(angle) * 1.42, 0.06);
    matrix.compose(tickPosition, quaternion, one);
    ticks.setMatrixAt(i, matrix);
  }
  ticks.instanceMatrix.needsUpdate = true;
  iris.add(ticks);

  // ---- the starburst ------------------------------------------------------
  const starUniforms = {
    uSpikes: { value: params.blades % 2 === 0 ? params.blades : params.blades * 2 },
    uStrength: { value: 0 },
    uColor: { value: new THREE.Color(0xf6e2bd) },
  };
  const star = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 5.6),
    new THREE.ShaderMaterial({
      uniforms: starUniforms,
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  star.position.z = 0.2;
  star.renderOrder = 10;
  stage.scene.add(star);

  // ---- grain over the lot -------------------------------------------------
  const look = createFilmLook({ grain: 0.05, vignette: 0.5 });
  stage.scene.add(look.mesh);

  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 3.9 * Math.tan((40 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    const fit = Math.min(1, visibleWidth / 3.1);
    iris.scale.setScalar(fit);
    star.scale.setScalar(fit);
  });

  // ---- animation ----------------------------------------------------------
  const cycle = params.dwell + params.travel;

  /** Ease that sits still and then moves, like a detented ring. */
  function ease(t) {
    return t * t * (3 - 2 * t);
  }

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    let stop;
    if (pointer.active) {
      // Your finger is the aperture ring.
      const position = (pointer.x * 0.5 + 0.5) * (F_STOPS.length - 1);
      stop = F_STOPS[0] * Math.pow(F_STOPS[F_STOPS.length - 1] / F_STOPS[0],
        1 - position / (F_STOPS.length - 1));
    } else {
      // Walk the stops, holding at each.
      const index = Math.floor(time / cycle) % F_STOPS.length;
      const next = (index + 1) % F_STOPS.length;
      const local = (time % cycle) / cycle;
      const blend = local < params.dwell / cycle
        ? 0
        : ease((local - params.dwell / cycle) / (params.travel / cycle));
      stop = F_STOPS[index] + (F_STOPS[next] - F_STOPS[index]) * blend;
    }

    // Opening radius goes as 1/f, which is what an f-number means.
    const opening = MAX_OPENING * (F_STOPS[0] / stop);
    setOpening(opening);

    // Stopped down, the disc behind dims and the star sharpens — both of which
    // is what actually happens.
    const openness = opening / MAX_OPENING;
    // setScalar would write r = g = b and throw the warmth away, so dim the
    // colour rather than replacing it.
    disc.material.color.copy(DISC_COLOUR).multiplyScalar(0.5 + openness * 0.5);
    backlight.material.opacity = 0.35 + openness * 0.6;
    backlight.scale.setScalar(1.6 + openness * 1.6);

    starUniforms.uStrength.value = params.starburst * Math.pow(1 - openness, 1.7) * 0.9;

    iris.rotation.z = Math.sin(time * 0.10) * 0.05 + pointer.y * 0.06;

    look.update(time);
  });

  stage.onDispose(() => {
    pointer.dispose();
    look.dispose();
    lightTexture.dispose();
    bladeGeometry.dispose();
    for (const blade of blades) blade.material.dispose();
    disc.geometry.dispose();
    disc.material.dispose();
    housing.geometry.dispose();
    housing.material.dispose();
    lip.geometry.dispose();
    lip.material.dispose();
    tickGeometry.dispose();
    tickMaterial.dispose();
    star.geometry.dispose();
    star.material.dispose();
  });

  stage.setParam = createParamSetter(params, {
    starburst: (value) => { starUniforms.uStrength.value = value; },
  });

  return stage.start();
}
