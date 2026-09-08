/**
 * DIFFERENCE ENGINE
 *
 * Babbage's machine, and it is really computing.
 *
 * The method of differences: to tabulate a polynomial you never have to
 * multiply anything. Take the differences between consecutive values, then the
 * differences of those, and so on. For a cubic the third differences are
 * constant — so if you know the first value and its first three differences,
 * you can get every value after it with nothing but addition.
 *
 * Four columns hold those numbers. Once a cycle, each column adds the one to
 * its left into itself, working from the answer outward so every addition uses
 * the values from before the cycle began. Start it at 0, 1, 6, 6 and the right
 * hand column counts 0, 1, 8, 27, 64, 125 — the cubes — without a single
 * multiplication anywhere in the machine.
 *
 * The wheels are read the way an odometer is: one digit in a window, rolling
 * to the next, carrying when it passes nine.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/textures.js ../lib/palette.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createGradientEnvironment } from '../lib/textures.js';
import { WORKS } from '../lib/palette.js';

export const defaults = {
  cycleSeconds: 3.0,
  digits: 5,
  columns: 4,
};

/** Where the machine starts: f(0), and the first three differences of x cubed. */
const SEED = [0, 1, 6, 6];
const LIMIT = 100000;

const COLUMN_SPACING = 0.92;
const DIGIT_SPACING = 0.42;

/** Digits 0 to 9, stacked, ready to be scrolled past a window. */
function createDigitStrip() {
  const cell = 128;
  const canvas = document.createElement('canvas');
  canvas.width = cell;
  canvas.height = cell * 10;

  const context = canvas.getContext('2d');
  context.fillStyle = '#100c08';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.font = `600 ${Math.round(cell * 0.72)}px ui-monospace, "JetBrains Mono", Menlo, monospace`;
  context.fillStyle = '#f0e0bc';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  for (let digit = 0; digit < 10; digit++) {
    context.fillText(String(digit), cell / 2, cell * digit + cell / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 0.1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const columnCount = Math.max(2, Math.round(params.columns));
  const digitCount = Math.max(3, Math.round(params.digits));

  const stage = createStage(canvas, {
    clearColor: WORKS.soot,
    camera: { fov: 38, position: [0, 0.15, 5.6], lookAt: [0, 0, 0] },
  });
  const pointer = createPointer(canvas);

  const environment = createGradientEnvironment({
    top: '#241d14', middle: '#0b0908', bottom: '#301e0e', sun: '#ffdca8',
  });
  stage.scene.environment = environment;

  const machine = new THREE.Group();
  stage.scene.add(machine);

  const brass = new THREE.MeshStandardMaterial({ color: WORKS.brass, metalness: 0.95, roughness: 0.27 });
  const iron = new THREE.MeshStandardMaterial({ color: WORKS.iron, metalness: 0.55, roughness: 0.8 });

  const halfWidth = ((columnCount - 1) * COLUMN_SPACING) / 2;
  const halfHeight = ((digitCount - 1) * DIGIT_SPACING) / 2;

  // ---- the frame ----------------------------------------------------------
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidth * 2 + 1.5, halfHeight * 2 + 1.5, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x171310, metalness: 0.4, roughness: 0.85 }),
  );
  backing.position.z = -0.22;
  machine.add(backing);

  for (let i = 0; i <= columnCount; i++) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, halfHeight * 2 + 1.1, 14),
      brass,
    );
    post.position.set(-halfWidth - COLUMN_SPACING / 2 + i * COLUMN_SPACING, 0, 0.06);
    machine.add(post);
  }

  for (const y of [-halfHeight - 0.5, halfHeight + 0.5]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(halfWidth * 2 + 1.3, 0.13, 0.16),
      brass,
    );
    rail.position.set(0, y, 0.06);
    machine.add(rail);
  }

  // ---- the wheels ---------------------------------------------------------
  const stripTexture = createDigitStrip();
  const digitGeometry = new THREE.PlaneGeometry(0.30, 0.36);
  const slotGeometry = new THREE.BoxGeometry(0.38, 0.40, 0.10);
  const bezelGeometry = new THREE.TorusGeometry(0.20, 0.022, 8, 26);

  const wheels = [];   // [column][digit]

  for (let column = 0; column < columnCount; column++) {
    const x = -halfWidth + column * COLUMN_SPACING;
    const row = [];

    for (let digit = 0; digit < digitCount; digit++) {
      const y = -halfHeight + digit * DIGIT_SPACING;

      const slot = new THREE.Mesh(slotGeometry, new THREE.MeshStandardMaterial({
        color: 0x0d0a08, metalness: 0.3, roughness: 0.9,
      }));
      slot.position.set(x, y, -0.02);
      machine.add(slot);

      // Each window needs its own texture, because the scroll position lives
      // on the texture rather than on the mesh.
      const texture = stripTexture.clone();
      texture.needsUpdate = true;

      const face = new THREE.Mesh(digitGeometry, new THREE.MeshBasicMaterial({
        map: texture, toneMapped: false,
      }));
      face.position.set(x, y, 0.035);
      machine.add(face);

      const bezel = new THREE.Mesh(bezelGeometry, brass);
      bezel.position.set(x, y, 0.05);
      machine.add(bezel);

      row.push({ texture, material: face.material, value: 0, target: 0 });
    }
    wheels.push(row);
  }

  // ---- the crank ----------------------------------------------------------
  const crankPivot = new THREE.Group();
  crankPivot.position.set(halfWidth + 0.95, -halfHeight - 0.15, 0.2);
  machine.add(crankPivot);

  const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.07), brass);
  crankArm.position.x = 0.25;
  crankPivot.add(crankArm);

  const crankHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 14), iron);
  crankHandle.rotation.x = Math.PI / 2;
  crankHandle.position.set(0.5, 0, 0.12);
  crankPivot.add(crankHandle);

  const crankBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.10, 18), brass);
  crankBoss.rotation.x = Math.PI / 2;
  crankPivot.add(crankBoss);

  // ---- a lamp over each column, lit while it is being added into ---------
  const columnLamps = [];
  for (let column = 0; column < columnCount; column++) {
    const lamp = new THREE.PointLight(WORKS.ember, 0, 2.2, 2);
    lamp.position.set(-halfWidth + column * COLUMN_SPACING, halfHeight + 0.34, 0.55);
    machine.add(lamp);
    columnLamps.push(lamp);
  }

  // ---- light --------------------------------------------------------------
  stage.scene.add(new THREE.AmbientLight(0x241d15, 1.6));

  const key = new THREE.DirectionalLight(0xffdca8, 2.6);
  key.position.set(2.5, 3.5, 5);
  stage.scene.add(key);

  const rim = new THREE.DirectionalLight(0x9fb6d8, 1.0);
  rim.position.set(-4, 1, -2);
  stage.scene.add(rim);

  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 5.6 * Math.tan((38 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    machine.scale.setScalar(Math.min(
      1.4,
      visibleWidth / (halfWidth * 2 + 2.8),
      visibleHeight / (halfHeight * 2 + 1.9),
    ));
  });

  // ---- the arithmetic -----------------------------------------------------
  const values = SEED.slice(0, columnCount);
  while (values.length < columnCount) values.push(0);

  /** Point every wheel in a column at the digits of its number. */
  function setColumn(column) {
    for (let digit = 0; digit < digitCount; digit++) {
      const wheel = wheels[column][digit];
      const shown = Math.floor(values[column] / Math.pow(10, digit)) % 10;

      // Wheels only ever turn forwards, so nine to zero rolls on rather than
      // spinning back.
      const standing = ((wheel.target % 10) + 10) % 10;
      let delta = shown - standing;
      if (delta < -0.0001) delta += 10;
      wheel.target += delta;
    }
  }

  for (let column = 0; column < columnCount; column++) setColumn(column);

  // Each addition happens at its own moment inside the cycle, so the work
  // ripples across the machine instead of all landing at once.
  const stages = [];
  for (let column = 0; column < columnCount - 1; column++) {
    stages.push({ column, at: 0.12 + column * (0.72 / Math.max(1, columnCount - 1)), done: false });
  }

  let cycle = -1;

  // ---- animation ----------------------------------------------------------
  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    const seconds = params.cycleSeconds * (pointer.active ? 2.2 - (pointer.x * 0.5 + 0.5) * 1.9 : 1);
    const current = Math.floor(time / seconds);
    const local = (time % seconds) / seconds;

    if (current !== cycle) {
      cycle = current;
      for (const entry of stages) entry.done = false;
    }

    for (const entry of stages) {
      if (entry.done || local < entry.at) continue;
      entry.done = true;

      values[entry.column] += values[entry.column + 1];

      // When the answer runs off the end of the wheels, start the table again.
      if (values[0] >= LIMIT) {
        for (let i = 0; i < columnCount; i++) values[i] = SEED[i] ?? 0;
        for (let i = 0; i < columnCount; i++) setColumn(i);
        break;
      }
      setColumn(entry.column);
    }

    // The wheels roll towards their targets. Nothing snaps.
    for (let column = 0; column < columnCount; column++) {
      for (let digit = 0; digit < digitCount; digit++) {
        const wheel = wheels[column][digit];
        wheel.value += (wheel.target - wheel.value) * Math.min(1, dt * 9);
        wheel.texture.offset.y = 0.9 - wheel.value * 0.1;
      }
    }

    // A lamp brightens over whichever column has just been worked.
    for (let column = 0; column < columnCount; column++) {
      const entry = stages.find((s) => s.column === column);
      const since = entry ? local - entry.at : 1;
      const lit = entry && since >= 0 && since < 0.16 ? 1 - since / 0.16 : 0;
      columnLamps[column].intensity = lit * 5;
    }

    crankPivot.rotation.z = -local * Math.PI * 2;

    machine.rotation.y = pointer.x * 0.16;
    machine.rotation.x = pointer.y * 0.10;
  });

  stage.onDispose(() => {
    pointer.dispose();
    environment.dispose();
    stripTexture.dispose();
    digitGeometry.dispose();
    slotGeometry.dispose();
    bezelGeometry.dispose();
    for (const row of wheels) {
      for (const wheel of row) {
        wheel.texture.dispose();
        wheel.material.dispose();
      }
    }
    backing.geometry.dispose();
    backing.material.dispose();
    brass.dispose();
    iron.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
