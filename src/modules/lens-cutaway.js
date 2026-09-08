/**
 * LENS CUTAWAY
 *
 * A three-element lens in section, with light actually traced through it.
 *
 * Every ray is intersected with each spherical surface and bent by Snell's
 * law. Nothing about the picture is drawn by hand: where the rays cross is
 * where this glass focuses, and if you move an element the crossing moves
 * because the maths says so.
 *
 * Each ray is traced three times at three refractive indices, because glass
 * bends blue harder than red. The three focal points do not coincide, and the
 * gap between them is chromatic aberration — the thing every lens designer
 * spends their career fighting.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/filmlook.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createFilmLook } from '../lib/filmlook.js';
import { STUDIO } from '../lib/palette.js';

export const defaults = {
  rays: 13,
  spread: 1,        // how far the fan of incoming rays opens
  dispersion: 2,    // exaggerate the colour split, 0 turns it off
  focusTravel: 0.16,
  tilt: 0.5,        // how far the incoming light can swing off axis
};

const START_X = -2.75;
const SENSOR_X = 2.55;

/**
 * The design. Each element is two spherical surfaces and the glass between.
 * A positive radius curves away from the light, a negative one towards it.
 * `semi` is the semi-diameter: past that the mount cuts the ray off.
 */
const ELEMENTS = [
  { front: { x: -1.42, R:  1.65 }, back: { x: -1.16, R: -6.20 }, n: 1.620, semi: 0.62 },
  { front: { x: -0.62, R: -2.15 }, back: { x: -0.46, R:  2.15 }, n: 1.605, semi: 0.47 },
  { front: { x:  0.42, R:  1.52 }, back: { x:  0.68, R: -3.90 }, n: 1.618, semi: 0.57 },
];

const IRIS_X = 0.03;

/** Where a ray meets a spherical surface, or null if it misses it. */
function intersectSurface(origin, direction, surface) {
  const centreX = surface.x + surface.R;
  const ox = origin.x - centreX;
  const oy = origin.y;

  const b = 2 * (ox * direction.x + oy * direction.y);
  const c = ox * ox + oy * oy - surface.R * surface.R;
  const discriminant = b * b - 4 * c; // direction is a unit vector, so a = 1
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  // A surface curving away from the light is hit on its near side, one curving
  // towards it on its far side. That is the whole rule.
  const t = surface.R > 0 ? (-b - root) / 2 : (-b + root) / 2;
  if (t <= 1e-6) return null;

  const point = { x: origin.x + direction.x * t, y: origin.y + direction.y * t };

  let nx = (point.x - centreX) / surface.R;
  let ny = point.y / surface.R;
  // The normal has to face into the oncoming ray for the refraction below.
  if (nx * direction.x + ny * direction.y > 0) {
    nx = -nx;
    ny = -ny;
  }

  return { point, normal: { x: nx, y: ny } };
}

/** Snell's law, in the vector form. eta is n1 / n2. */
function refract(direction, normal, eta) {
  const cosIncident = -(direction.x * normal.x + direction.y * normal.y);
  const k = 1 - eta * eta * (1 - cosIncident * cosIncident);
  if (k < 0) return null; // total internal reflection

  const scale = eta * cosIncident - Math.sqrt(k);
  const x = eta * direction.x + scale * normal.x;
  const y = eta * direction.y + scale * normal.y;
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: STUDIO.gate,
    camera: { fov: 40, position: [0, 0, 4.3] },
  });
  const pointer = createPointer(canvas);

  const rig = new THREE.Group();
  stage.scene.add(rig);

  // The surface list the tracer walks, built from the elements. `n` is the
  // index of what the ray is entering, so a back surface enters air.
  function buildSurfaces(focusShift) {
    const surfaces = [];
    ELEMENTS.forEach((element, index) => {
      const shift = index === 2 ? focusShift : 0;
      surfaces.push({ x: element.front.x + shift, R: element.front.R, n: element.n, semi: element.semi });
      surfaces.push({ x: element.back.x + shift, R: element.back.R, n: 1.0, semi: element.semi });
    });
    return surfaces;
  }

  /** One ray, from the left, through every surface, on to the sensor. */
  function traceRay(height, angle, indexOffset, surfaces) {
    const path = [START_X, height];
    let point = { x: START_X, y: height };
    let direction = { x: Math.cos(angle), y: Math.sin(angle) };
    let currentIndex = 1.0;

    for (const surface of surfaces) {
      const hit = intersectSurface(point, direction, surface);
      if (!hit) return path;
      if (Math.abs(hit.point.y) > surface.semi) return path; // clipped by the mount
      if (Math.abs(hit.point.y) < 0.999 && Math.abs(hit.point.x) > 4) return path;

      // Only the glass gets the dispersion offset; air is air for every colour.
      const nextIndex = surface.n > 1.0 ? surface.n + indexOffset : 1.0;
      const bent = refract(direction, hit.normal, currentIndex / nextIndex);
      if (!bent) return path;

      path.push(hit.point.x, hit.point.y);
      point = hit.point;
      direction = bent;
      currentIndex = nextIndex;
    }

    const t = (SENSOR_X - point.x) / direction.x;
    path.push(point.x + direction.x * t, point.y + direction.y * t);
    return path;
  }

  // ---- the glass ----------------------------------------------------------
  // Each element is filled between its two surfaces, sampled the same way the
  // tracer sees them, so the picture and the physics never disagree.
  const glassMaterial = new THREE.MeshBasicMaterial({
    color: 0x7d8f7a, transparent: true, opacity: 0.26, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glassEdgeMaterial = new THREE.LineBasicMaterial({
    color: 0xb9975b, transparent: true, opacity: 0.72,
  });

  function surfacePoints(surface, semi, samples = 26) {
    const points = [];
    const centreX = surface.x + surface.R;
    for (let i = 0; i <= samples; i++) {
      const y = -semi + (2 * semi * i) / samples;
      // x on the circle at this height, on the vertex's side of the centre.
      const inside = Math.max(0, surface.R * surface.R - y * y);
      const dx = Math.sqrt(inside);
      points.push([centreX - Math.sign(surface.R) * dx, y]);
    }
    return points;
  }

  const glassMeshes = [];
  for (const element of ELEMENTS) {
    const front = surfacePoints(element.front, element.semi);
    const back = surfacePoints(element.back, element.semi);

    const shape = new THREE.Shape();
    shape.moveTo(front[0][0], front[0][1]);
    for (const [x, y] of front.slice(1)) shape.lineTo(x, y);
    for (let i = back.length - 1; i >= 0; i--) shape.lineTo(back[i][0], back[i][1]);
    shape.closePath();

    const body = new THREE.Mesh(new THREE.ShapeGeometry(shape), glassMaterial);
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(shape.getPoints(40).map((p) => new THREE.Vector3(p.x, p.y, 0.01))),
      glassEdgeMaterial,
    );
    const group = new THREE.Group();
    group.add(body, outline);
    rig.add(group);
    glassMeshes.push(group);
  }

  // ---- barrel, mount and iris --------------------------------------------
  const barrelMaterial = new THREE.MeshBasicMaterial({ color: 0x16171b });
  for (const side of [-1, 1]) {
    const barrel = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.30), barrelMaterial);
    barrel.position.set(-0.35, side * 0.85, -0.02);
    rig.add(barrel);
  }

  const irisMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2d33 });
  const irisLeaves = [];
  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.5), irisMaterial);
    leaf.position.set(IRIS_X, side * 0.45, 0.02);
    rig.add(leaf);
    irisLeaves.push({ leaf, side });
  }

  // A brass band on the barrel, the way a good lens is marked.
  for (const side of [-1, 1]) {
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.30),
      new THREE.MeshBasicMaterial({ color: 0x6d5931 }),
    );
    band.position.set(-1.05, side * 0.85, -0.01);
    rig.add(band);
  }

  const sensor = new THREE.Mesh(
    new THREE.PlaneGeometry(0.035, 1.1),
    new THREE.MeshBasicMaterial({ color: 0x4a453c }),
  );
  sensor.position.set(SENSOR_X, 0, 0);
  rig.add(sensor);

  const axis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(START_X, 0, -0.03), new THREE.Vector3(SENSOR_X + 0.2, 0, -0.03),
    ]),
    new THREE.LineBasicMaterial({ color: 0x22262c }),
  );
  rig.add(axis);

  // ---- the rays -----------------------------------------------------------
  // Three colours, each with its own index offset. Blue bends hardest.
  const WAVELENGTHS = [
    { offset: -0.009, color: [1.0, 0.32, 0.26] },
    { offset: 0.000, color: [0.55, 1.0, 0.52] },
    { offset: 0.012, color: [0.36, 0.55, 1.0] },
  ];

  // Generously sized: a ray that is clipped early simply uses fewer segments.
  const MAX_SEGMENTS = params.rays * WAVELENGTHS.length * 10;
  const rayPositions = new Float32Array(MAX_SEGMENTS * 2 * 3);
  const rayColors = new Float32Array(MAX_SEGMENTS * 2 * 3);

  const rayGeometry = new THREE.BufferGeometry();
  rayGeometry.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3));
  rayGeometry.setAttribute('color', new THREE.BufferAttribute(rayColors, 3));
  rayGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);

  const rays = new THREE.LineSegments(rayGeometry, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  rig.add(rays);

  /** Trace the whole fan and pour it into the line buffer. */
  function drawRays(angle, focusShift, dispersion) {
    const surfaces = buildSurfaces(focusShift);
    let segment = 0;

    for (const wavelength of WAVELENGTHS) {
      const [r, g, b] = wavelength.color;
      const offset = wavelength.offset * dispersion;

      for (let i = 0; i < params.rays; i++) {
        const spread = 0.60 * params.spread;
        const height = params.rays === 1 ? 0 : -spread + (2 * spread * i) / (params.rays - 1);
        const path = traceRay(height, angle, offset, surfaces);

        for (let j = 0; j + 3 < path.length; j += 2) {
          if (segment >= MAX_SEGMENTS) break;
          const at = segment * 6;
          rayPositions[at + 0] = path[j];
          rayPositions[at + 1] = path[j + 1];
          rayPositions[at + 2] = 0.03;
          rayPositions[at + 3] = path[j + 2];
          rayPositions[at + 4] = path[j + 3];
          rayPositions[at + 5] = 0.03;

          for (const vertex of [0, 3]) {
            rayColors[at + vertex + 0] = r;
            rayColors[at + vertex + 1] = g;
            rayColors[at + vertex + 2] = b;
          }
          segment += 1;
        }
      }
    }

    rayGeometry.setDrawRange(0, segment * 2);
    rayGeometry.attributes.position.needsUpdate = true;
    rayGeometry.attributes.color.needsUpdate = true;
  }

  // ---- grain --------------------------------------------------------------
  const look = createFilmLook({ grain: 0.045, vignette: 0.55 });
  stage.scene.add(look.mesh);

  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 4.3 * Math.tan((40 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    rig.scale.setScalar(Math.min(1, visibleWidth / 6.4));
  });

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    // The light swings off axis; the rear element pulls focus.
    const angle = (pointer.active ? pointer.y * 0.5 : Math.sin(time * 0.23) * 0.35) * params.tilt * 0.16;
    const focusShift = (pointer.active ? pointer.x : Math.sin(time * 0.17)) * params.focusTravel;

    glassMeshes[2].position.x = focusShift;
    drawRays(angle, focusShift, params.dispersion);

    // Stop down and open up, and watch the fan narrow.
    const stop = 0.5 + Math.sin(time * 0.31) * 0.42;
    for (const { leaf, side } of irisLeaves) {
      leaf.scale.y = 1 - stop * 0.55;
      leaf.position.y = side * (0.45 + (1 - leaf.scale.y) * 0.25);
    }

    look.update(time);
  });

  stage.onDispose(() => {
    pointer.dispose();
    look.dispose();
    rayGeometry.dispose();
    rays.material.dispose();
    glassMaterial.dispose();
    glassEdgeMaterial.dispose();
    barrelMaterial.dispose();
    irisMaterial.dispose();
    sensor.geometry.dispose();
    sensor.material.dispose();
    axis.geometry.dispose();
    axis.material.dispose();
    for (const group of glassMeshes) {
      for (const child of group.children) child.geometry.dispose();
    }
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
