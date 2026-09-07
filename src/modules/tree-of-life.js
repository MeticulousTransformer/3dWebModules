/**
 * TREE OF LIFE
 *
 * The ten sephirot and the twenty-two paths between them, wired up as an
 * actual graph rather than drawn as a picture. Light travels the paths, and
 * every so often the lightning flash runs the descent — crown to kingdom,
 * in order, the way the diagram is meant to be read.
 *
 * The whole structure is two arrays: ten positions and twenty-two pairs.
 * Everything else is derived from them.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/params.js ../lib/textures.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createParamSetter } from '../lib/params.js';
import { createRadialGlowTexture } from '../lib/textures.js';
import { PALETTE, CSS_PALETTE } from '../lib/palette.js';

export const defaults = {
  pulses: 40,          // sparks travelling the paths
  pulseSpeed: 0.30,
  flashSeconds: 9,     // how often the lightning flash runs the descent
  tilt: 0.42,
};

/** The ten, in descent order. Colours follow the traditional queen scale. */
const SEPHIROT = [
  { name: 'keter',    x:  0.00, y:  1.00, color: 0xf2efe6, size: 0.085 },
  { name: 'chokhmah', x:  0.55, y:  0.70, color: 0x9aa8b8, size: 0.070 },
  { name: 'binah',    x: -0.55, y:  0.70, color: 0x5a4a7a, size: 0.070 },
  { name: 'chesed',   x:  0.55, y:  0.24, color: 0x3b7fff, size: 0.066 },
  { name: 'gevurah',  x: -0.55, y:  0.24, color: 0xff3b52, size: 0.066 },
  { name: 'tiferet',  x:  0.00, y: -0.02, color: 0xffb340, size: 0.082 },
  { name: 'netzach',  x:  0.55, y: -0.36, color: 0x7cff5c, size: 0.062 },
  { name: 'hod',      x: -0.55, y: -0.36, color: 0xff8a3d, size: 0.062 },
  { name: 'yesod',    x:  0.00, y: -0.66, color: 0xc65cff, size: 0.070 },
  { name: 'malkuth',  x:  0.00, y: -1.04, color: 0xb8a05a, size: 0.090 },
];

/** The twenty-two paths, as pairs of indices into SEPHIROT. */
const PATHS = [
  [0, 1], [0, 2], [0, 5],
  [1, 2], [1, 3], [1, 5],
  [2, 4], [2, 5],
  [3, 4], [3, 5], [3, 6],
  [4, 5], [4, 7],
  [5, 6], [5, 7], [5, 8],
  [6, 7], [6, 8], [6, 9],
  [7, 8], [7, 9],
  [8, 9],
];

/** Da'at: the one that is not counted. Drawn faintly, because it is not there. */
const DAAT = { x: 0, y: 0.44 };

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };

  const stage = createStage(canvas, {
    clearColor: PALETTE.void,
    camera: { fov: 44, position: [0, 0, 3.05] },
  });
  const pointer = createPointer(canvas);

  const tree = new THREE.Group();
  stage.scene.add(tree);

  // Give the paths a gentle bow in z so turning the tree reveals real depth
  // instead of a flat card.
  const nodePositions = SEPHIROT.map((sephira, index) =>
    new THREE.Vector3(sephira.x, sephira.y, Math.sin(index * 1.7) * 0.10),
  );

  // ---- the paths ----------------------------------------------------------
  const pathPoints = [];
  for (const [from, to] of PATHS) {
    pathPoints.push(nodePositions[from], nodePositions[to]);
  }
  const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
  const pathMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.gold, transparent: true, opacity: 0.24,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  tree.add(new THREE.LineSegments(pathGeometry, pathMaterial));

  // ---- sparks running the paths ------------------------------------------
  const sparkPositions = new Float32Array(params.pulses * 3);
  const sparkColors = new Float32Array(params.pulses * 3);
  const sparks = [];
  const sparkColor = new THREE.Color();

  for (let i = 0; i < params.pulses; i++) {
    sparks.push({
      path: Math.floor(Math.random() * PATHS.length),
      t: Math.random(),
      speed: 0.6 + Math.random() * 0.9,
      backwards: Math.random() < 0.4,
    });
  }

  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
  sparkGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);

  const sparkPoints = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({
    size: 0.045, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  tree.add(sparkPoints);

  // ---- the ten ------------------------------------------------------------
  const glowTexture = createRadialGlowTexture({ color: '#ffffff', softness: 2.4 });
  const nodes = [];

  for (let i = 0; i < SEPHIROT.length; i++) {
    const sephira = SEPHIROT[i];

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(sephira.size, 24, 18),
      new THREE.MeshBasicMaterial({ color: sephira.color }),
    );
    core.position.copy(nodePositions[i]);
    tree.add(core);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(sephira.size * 1.9, 0.005, 6, 48),
      new THREE.MeshBasicMaterial({
        color: sephira.color, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    ring.position.copy(nodePositions[i]);
    tree.add(ring);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: sephira.color, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.scale.setScalar(sephira.size * 9);
    halo.position.copy(nodePositions[i]);
    tree.add(halo);

    nodes.push({ core, ring, halo, baseSize: sephira.size });
  }

  // Da'at, drawn as an absence: an outline with nothing inside it.
  const daat = new THREE.Mesh(
    new THREE.TorusGeometry(0.055, 0.004, 6, 40),
    new THREE.MeshBasicMaterial({
      color: PALETTE.bone, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  daat.position.set(DAAT.x, DAAT.y, 0);
  tree.add(daat);

  // ---- keep it inside narrow screens -------------------------------------
  stage.onResize(({ width, height }) => {
    const visibleHeight = 2 * 3.05 * Math.tan((44 * Math.PI) / 360);
    const visibleWidth = visibleHeight * (width / height);
    tree.scale.setScalar(Math.min(1, visibleWidth / 2.4));
  });

  // ---- animation ----------------------------------------------------------
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);

    // Sparks walk their path, then jump to another one.
    for (let i = 0; i < sparks.length; i++) {
      const spark = sparks[i];
      spark.t += spark.speed * params.pulseSpeed * dt;

      if (spark.t > 1) {
        spark.t = 0;
        spark.path = Math.floor(Math.random() * PATHS.length);
        spark.backwards = Math.random() < 0.4;
      }

      const [a, b] = PATHS[spark.path];
      from.copy(nodePositions[spark.backwards ? b : a]);
      to.copy(nodePositions[spark.backwards ? a : b]);
      from.lerp(to, spark.t);

      sparkPositions[i * 3 + 0] = from.x;
      sparkPositions[i * 3 + 1] = from.y;
      sparkPositions[i * 3 + 2] = from.z;

      // Brightest in the middle of a path, faint at either end.
      const brightness = Math.sin(spark.t * Math.PI);
      sparkColor.setHex(PALETTE.gold).multiplyScalar(0.3 + brightness * 0.9);
      sparkColors[i * 3 + 0] = sparkColor.r;
      sparkColors[i * 3 + 1] = sparkColor.g;
      sparkColors[i * 3 + 2] = sparkColor.b;
    }
    sparkGeometry.attributes.position.needsUpdate = true;
    sparkGeometry.attributes.color.needsUpdate = true;

    // The lightning flash: crown to kingdom, one sephira at a time.
    const flashPosition = ((time % params.flashSeconds) / params.flashSeconds) * (SEPHIROT.length + 2) - 1;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const struck = Math.max(0, 1 - Math.abs(flashPosition - i) * 1.4);
      const breathe = 0.5 + Math.sin(time * 1.3 + i * 0.6) * 0.12;

      node.core.scale.setScalar(1 + struck * 0.6);
      node.halo.material.opacity = 0.22 + breathe * 0.2 + struck * 0.75;
      node.halo.scale.setScalar(node.baseSize * (9 + struck * 8));
      node.ring.rotation.z += dt * (0.3 + struck * 3);
      node.ring.material.opacity = 0.35 + struck * 0.6;
    }

    daat.rotation.z -= dt * 0.4;

    tree.rotation.y = pointer.x * params.tilt + Math.sin(time * 0.17) * 0.12;
    tree.rotation.x = pointer.y * params.tilt * 0.6;
  });

  stage.onDispose(() => {
    pointer.dispose();
    glowTexture.dispose();
    pathGeometry.dispose();
    pathMaterial.dispose();
    sparkGeometry.dispose();
  });

  stage.setParam = createParamSetter(params);

  return stage.start();
}
