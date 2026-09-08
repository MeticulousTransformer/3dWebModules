/**
 * ORRERY
 *
 * A brass planetary machine. The arms turn at the real relative rates: Mercury
 * goes round about four times a year, Jupiter takes very nearly twelve, Saturn
 * takes twenty-nine and a half. That is the only thing an orrery has to get
 * right, and it is the reason they were built out of gear trains — you cannot
 * approximate 29.46 with a belt.
 *
 * The distances are not to scale. They never are. Neptune to scale would put
 * it in the next room.
 *
 * The gears under the plate are real involutes from ../lib/gears.js, meshed
 * with the same formula the gear train uses.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/gears.js ../lib/glyphs.js
 *                   ../lib/textures.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createGearProfile, meshAngle } from '../lib/gears.js';
import { createGlyphStrip } from '../lib/glyphs.js';
import { createGradientEnvironment, createRadialGlowTexture } from '../lib/textures.js';
import { WORKS, CSS_WORKS } from '../lib/palette.js';

export const defaults = {
  yearsPerSecond: 0.34,  // how fast the handle is being turned
  tilt: 0.42,
  showRings: true,
};

/** Orbital periods in years, as measured. Radii are for legibility only. */
const PLANETS = [
  { name: 'mercury', period: 0.2408, radius: 0.62, size: 0.055, colour: 0x9a938c },
  { name: 'venus', period: 0.6152, radius: 0.86, size: 0.082, colour: 0xd8c89a },
  { name: 'earth', period: 1.0000, radius: 1.12, size: 0.088, colour: 0x4a7fa8, moon: true },
  { name: 'mars', period: 1.8808, radius: 1.40, size: 0.068, colour: 0xa8542e },
  { name: 'jupiter', period: 11.862, radius: 1.78, size: 0.170, colour: 0xc2a074 },
  { name: 'saturn', period: 29.457, radius: 2.16, size: 0.145, colour: 0xd6c290, ring: true },
];

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: WORKS.soot,
    camera: { fov: 38, position: [0, 3.6, 4.6], lookAt: [0, -0.05, 0] },
  });
  const pointer = createPointer(canvas);

  const environment = createGradientEnvironment({
    top: '#1e1a14', middle: '#0a0908', bottom: '#2e1c0c', sun: '#ffe0b0',
  });
  stage.scene.environment = environment;

  const instrument = new THREE.Group();
  stage.scene.add(instrument);

  const brass = new THREE.MeshStandardMaterial({ color: 0x8f7220, metalness: 0.92, roughness: 0.38 });
  const polished = new THREE.MeshStandardMaterial({ color: 0xdcc470, metalness: 0.98, roughness: 0.15 });
  const iron = new THREE.MeshStandardMaterial({ color: WORKS.iron, metalness: 0.5, roughness: 0.82 });

  // ---- the plate it all stands on ----------------------------------------
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.09, 72), brass);
  plate.position.y = -0.42;
  instrument.add(plate);

  const plateRim = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.05, 10, 90), polished);
  plateRim.rotation.x = Math.PI / 2;
  plateRim.position.y = -0.42;
  instrument.add(plateRim);

  // A zodiac band round the edge — every orrery has one.
  const zodiac = createGlyphStrip([...'♈♉♊♋♌♍♎♏♐♑♒♓'], {
    width: 2048, height: 96, color: CSS_WORKS.steam,
  });
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(2.42, 2.42, 0.20, 96, 1, true),
    new THREE.MeshBasicMaterial({
      map: zodiac.texture, color: 0xe8d9a8, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  band.position.y = -0.30;
  instrument.add(band);

  // Degree ticks on the plate.
  const tickGeometry = new THREE.BoxGeometry(0.10, 0.012, 0.016);
  const ticks = new THREE.InstancedMesh(tickGeometry, polished, 72);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const place = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    quaternion.setFromAxisAngle(axis, -angle);
    place.set(Math.cos(angle) * 2.28, -0.37, Math.sin(angle) * 2.28);
    matrix.compose(place, quaternion, one);
    ticks.setMatrixAt(i, matrix);
  }
  ticks.instanceMatrix.needsUpdate = true;
  instrument.add(ticks);

  // ---- the sun ------------------------------------------------------------
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 36, 26),
    new THREE.MeshStandardMaterial({
      color: 0xffcf72, metalness: 0.9, roughness: 0.22,
      emissive: 0xff9a2a, emissiveIntensity: 0.7,
    }),
  );
  instrument.add(sun);

  const glowTexture = createRadialGlowTexture({ color: '#ffb45a', softness: 2.4 });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, opacity: 0.5,
  }));
  glow.scale.setScalar(1.9);
  instrument.add(glow);

  const sunLight = new THREE.PointLight(0xffcf8a, 22, 9, 2);
  instrument.add(sunLight);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 0.42, 20), polished);
  column.position.y = -0.24;
  instrument.add(column);

  // ---- the planets --------------------------------------------------------
  const bodies = [];
  const ringGeometry = new THREE.TorusGeometry(1, 0.0035, 6, 128);
  const armGeometry = new THREE.BoxGeometry(1, 0.022, 0.022);

  for (const planet of PLANETS) {
    // The orbit engraved on the plate.
    const orbit = new THREE.Mesh(ringGeometry, polished);
    orbit.scale.setScalar(planet.radius);
    orbit.rotation.x = Math.PI / 2;
    orbit.position.y = -0.36;
    instrument.add(orbit);

    const carrier = new THREE.Group();
    instrument.add(carrier);

    const arm = new THREE.Mesh(armGeometry, brass);
    arm.scale.x = planet.radius;
    arm.position.set(planet.radius / 2, -0.10, 0);
    carrier.add(arm);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.24, 8), brass);
    stem.position.set(planet.radius, 0.02, 0);
    carrier.add(stem);

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(planet.size, 26, 18),
      new THREE.MeshStandardMaterial({ color: planet.colour, metalness: 0.75, roughness: 0.38 }),
    );
    body.position.set(planet.radius, 0.14, 0);
    carrier.add(body);

    if (planet.ring) {
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(planet.size * 1.4, planet.size * 2.3, 44),
        new THREE.MeshBasicMaterial({
          color: 0xe0cf9c, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
        }),
      );
      halo.rotation.x = Math.PI / 2 - 0.32;
      halo.position.copy(body.position);
      carrier.add(halo);
    }

    let moon = null;
    if (planet.moon) {
      moon = new THREE.Group();
      moon.position.copy(body.position);
      const rock = new THREE.Mesh(
        new THREE.SphereGeometry(planet.size * 0.30, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xb8b2a6, metalness: 0.7, roughness: 0.5 }),
      );
      rock.position.x = planet.size * 2.6;
      moon.add(rock);
      carrier.add(moon);
    }

    bodies.push({ planet, carrier, body, moon });
  }

  // ---- the gears that would actually drive it ----------------------------
  // Under the plate, where a real one hides them.
  const gearModule = 0.055;
  const GEARS = [
    { teeth: 30, lean: null },
    { teeth: 14, lean: -0.5 },
    { teeth: 26, lean: 0.35 },
  ];

  const gearMeshes = [];
  const gearGeometries = [];
  let gx = 0;
  let gy = 0;

  GEARS.forEach((entry, index) => {
    const profile = createGearProfile({
      teeth: entry.teeth, module: gearModule, boreRadius: gearModule,
    });
    const geometry = new THREE.ExtrudeGeometry(profile.shape, {
      depth: 0.05, bevelEnabled: false, curveSegments: 1,
    });
    gearGeometries.push(geometry);

    let lean = 0;
    if (index > 0) {
      lean = entry.lean;
      const previous = gearMeshes[index - 1];
      const spacing = previous.profile.pitchRadius + profile.pitchRadius;
      gx = previous.mesh.position.x + Math.cos(lean) * spacing;
      gy = previous.mesh.position.z + Math.sin(lean) * spacing;
    }

    const mesh = new THREE.Mesh(geometry, index % 2 ? iron : brass);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(gx, -0.60, gy);
    instrument.add(mesh);

    gearMeshes.push({ mesh, profile, lean, teeth: entry.teeth });
  });

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x241d15, 1.4));

  const key = new THREE.DirectionalLight(0xffdca8, 2.0);
  key.position.set(3, 5, 4);
  stage.scene.add(key);

  const rim = new THREE.DirectionalLight(0x9fb6d8, 1.0);
  rim.position.set(-4, 2, -3);
  stage.scene.add(rim);

  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 4.6 * Math.tan((38 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    instrument.scale.setScalar(Math.min(1, visibleWidth / 5.6, visibleHeight / 4.4));
  });

  // ---- animation ----------------------------------------------------------
  let years = 0;

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    const handle = params.yearsPerSecond * (pointer.active ? 0.2 + (pointer.x * 0.5 + 0.5) * 3 : 1);
    years += handle * dt;

    // One year of model time is one turn of the Earth's arm. Everything else
    // follows from its own period, which is the whole point of the machine.
    for (const { planet, carrier, moon } of bodies) {
      carrier.rotation.y = -(years / planet.period) * Math.PI * 2;
      if (moon) moon.rotation.y = -(years / 0.0748) * Math.PI * 2; // the lunar month
    }

    gearMeshes[0].mesh.rotation.y = years * 4.2;
    for (let i = 1; i < gearMeshes.length; i++) {
      gearMeshes[i].mesh.rotation.y = meshAngle(
        gearMeshes[i - 1].mesh.rotation.y,
        gearMeshes[i - 1].teeth,
        gearMeshes[i].teeth,
        gearMeshes[i].lean,
      );
    }

    sun.rotation.y += dt * 0.15;
    glow.material.opacity = 0.44 + Math.sin(time * 1.1) * 0.08;

    instrument.rotation.y = time * 0.045 + pointer.x * 0.6;
    stage.camera.position.y = 3.6 + pointer.y * 1.4;
    stage.camera.lookAt(0, -0.05, 0);

    band.visible = params.showRings;
    plateRim.visible = params.showRings;
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    zodiac.dispose();
    glowTexture.dispose();
    ringGeometry.dispose();
    armGeometry.dispose();
    tickGeometry.dispose();
    for (const geometry of gearGeometries) geometry.dispose();
    for (const { body } of bodies) { body.geometry.dispose(); body.material.dispose(); }
    for (const mesh of [plate, plateRim, band, sun, column]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    brass.dispose();
    polished.dispose();
    iron.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
