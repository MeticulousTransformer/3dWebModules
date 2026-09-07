/**
 * The catalogue.
 *
 * This is the only file that knows all the modules exist. Every module file
 * itself is completely unaware of this website — that is deliberate, and it is
 * what makes them liftable.
 *
 * Each module exports exactly one thing:
 *
 *   export default function create(canvas, options) -> stage
 *
 * where `stage` has .start() .stop() .dispose() and .setParam(key, value).
 *
 * The `controls` list on each entry is what the sliders on a module's page are
 * built from. `live: true` means setParam handles it smoothly while it runs;
 * without it, changing the value rebuilds the module from scratch. `value` is
 * only needed when the module's own default is 0, which is its way of saying
 * "decide this from the device at start-up".
 */

/**
 * Vite turns this into a map of lazy imports, one chunk per module, so the
 * gallery page only downloads the modules you actually scroll to.
 *
 * The two exclusions matter: without them this file and sources.js end up in
 * the map too, and sources.js carries every module's text — 120kb of dead
 * weight shipped to the browser for no reason.
 */
const loaders = import.meta.glob(['./*.js', '!./index.js', '!./sources.js']);

export const MODULES = [
  {
    id: 'borjgali-vortex',
    title: 'Borjgali Vortex',
    subtitle: 'ბორჯღალი',
    accent: 'gold',
    cost: 'light',
    tags: ['georgian', 'geometry', 'gold', 'extrude'],
    blurb:
      'The seven-armed Georgian sun sign, cast in metal and repeated into depth until the wheel becomes a tunnel. Arms are generated in polar coordinates and extruded, so the shape is maths, not a model file.',
    teaches: 'THREE.Shape + ExtrudeGeometry, procedural symbols, environment maps for metal',
    controls: [
      { key: 'spin', label: 'spin', min: -1.5, max: 1.5, step: 0.01, live: true },
      { key: 'tilt', label: 'tilt', min: 0, max: 1, step: 0.01, live: true },
      { key: 'arms', label: 'arms', min: 3, max: 13, step: 1 },
      { key: 'layers', label: 'layers', min: 1, max: 8, step: 1 },
    ],
  },
  {
    id: 'hermetic-seal',
    title: 'Hermetic Seal',
    subtitle: 'as above, so below',
    accent: 'gold',
    cost: 'light',
    tags: ['occult', 'hermeticism', 'glyphs', 'lines'],
    blurb:
      'Two horizontal discs of engraved geometry turning against each other with a column of light between them. Built as a machine with struts and rims rather than a flat emblem.',
    teaches: 'canvas-generated glyph textures on cylinders, additive line work, grouped rotation',
    controls: [
      { key: 'spin', label: 'spin', min: -3, max: 3, step: 0.05, live: true },
      { key: 'tilt', label: 'tilt', min: 0, max: 0.8, step: 0.01, live: true },
      { key: 'gap', label: 'gap', min: 0.3, max: 2.4, step: 0.05 },
    ],
  },
  {
    id: 'glyph-rain',
    title: 'Glyph Rain',
    subtitle: 'アソムタヴルリ',
    accent: 'acid',
    cost: 'light',
    tags: ['matrix', 'georgian', 'japanese', 'shader'],
    blurb:
      'Falling code in Asomtavruli, katakana and planetary signs. The entire effect is one fullscreen shader sampling a glyph atlas, which means one draw call and almost no cost on a phone.',
    teaches: 'glyph atlases, per-column hashing in GLSL, cheap fullscreen effects',
    controls: [
      { key: 'speed', label: 'speed', min: 0, max: 4, step: 0.05, live: true },
      { key: 'cellPixels', label: 'glyph size', min: 10, max: 40, step: 1, value: 17 },
    ],
  },
  {
    id: 'enso-void',
    title: 'Enso / Void',
    subtitle: '円相',
    accent: 'bone',
    cost: 'light',
    tags: ['buddhism', 'japanese', 'ink', 'ribbon'],
    blurb:
      'The zen circle, painted in one breath and left open. A triangle ribbon whose width follows a brush pressure curve, revealed, held, released, and drawn with a different hand each time.',
    teaches: 'hand-built ribbon geometry, brush pressure profiles, timeline cycles',
    controls: [
      { key: 'brushWidth', label: 'brush', min: 0.04, max: 0.5, step: 0.01 },
      { key: 'radius', label: 'radius', min: 0.5, max: 1.4, step: 0.01 },
      { key: 'drawSeconds', label: 'stroke time', min: 0.5, max: 9, step: 0.1, live: true },
      { key: 'holdSeconds', label: 'hold', min: 0, max: 10, step: 0.1, live: true },
    ],
  },
  {
    id: 'mycelium-net',
    title: 'Mycelium Net',
    subtitle: 'the wood wide web',
    accent: 'acid',
    cost: 'medium',
    tags: ['mushrooms', 'growth', 'network', 'buffers'],
    blurb:
      'A fungal network growing in the dark. Tips crawl a flow field, branch, die and are replaced, all inside one ring buffer, so it grows forever without allocating another byte.',
    teaches: 'ring buffers, per-vertex age attributes, growth systems that never stop',
    controls: [
      { key: 'branchChance', label: 'branching', min: 0, max: 0.12, step: 0.002, live: true },
      { key: 'stepLength', label: 'step', min: 0.01, max: 0.14, step: 0.005, live: true },
      { key: 'ticksPerSecond', label: 'growth rate', min: 4, max: 60, step: 1, live: true },
      { key: 'fadeSeconds', label: 'memory', min: 1, max: 20, step: 0.5, live: true },
    ],
  },
  {
    id: 'quintessence',
    title: 'Quintessence',
    subtitle: 'the fifth element',
    accent: 'violet',
    cost: 'medium',
    tags: ['alchemy', 'metal', 'noise', 'iridescence'],
    blurb:
      'A drop of living mercury: an icosahedron pushed around by two layers of simplex noise and shaded as iridescent metal. Flat shading lets the GPU work out the normals for free.',
    teaches: 'onBeforeCompile shader injection, MeshPhysicalMaterial iridescence, flat-shaded displacement',
    controls: [
      { key: 'amount', label: 'displacement', min: 0, max: 0.7, step: 0.01, live: true },
      { key: 'churn', label: 'churn', min: 0, max: 2, step: 0.02, live: true },
      { key: 'detail', label: 'facets', min: 1, max: 5, step: 1, value: 4 },
    ],
  },
  {
    id: 'psilocybin-field',
    title: 'Psilocybin Field',
    subtitle: 'domain warp',
    accent: 'violet',
    cost: 'heavy',
    tags: ['psychedelic', 'shader', 'fractal', 'kaleidoscope'],
    blurb:
      'Noise pushed through noise pushed through noise, folded in a kaleidoscope and coloured with a cosine palette. Octave count and pixel ratio both drop on phones.',
    teaches: 'domain warping, cosine palettes, kaleidoscopic folds, budgeting per-pixel cost',
    controls: [
      { key: 'sectors', label: 'mirrors', min: 1, max: 16, step: 1, live: true },
      { key: 'zoom', label: 'zoom', min: 0.6, max: 6, step: 0.1, live: true },
      { key: 'speed', label: 'speed', min: 0, max: 3, step: 0.05, live: true },
      { key: 'octaves', label: 'octaves', min: 1, max: 7, step: 1, value: 5, live: true },
    ],
  },
  {
    id: 'neon-lattice',
    title: 'Neon Lattice',
    subtitle: 'corridor',
    accent: 'cyan',
    cost: 'medium',
    tags: ['cyberpunk', 'instancing', 'grid', 'infinite'],
    blurb:
      'A city going past at speed. Two scrolling grid shaders and a few hundred instanced slabs that recycle behind you, so the corridor is endless while the scene stays tiny.',
    teaches: 'InstancedMesh recycling, per-instance colour, derivative-based grid anti-aliasing',
    controls: [
      { key: 'speed', label: 'speed', min: 0, max: 45, step: 0.5, live: true },
      { key: 'corridorWidth', label: 'corridor', min: 1, max: 10, step: 0.1 },
      { key: 'towerCount', label: 'towers', min: 20, max: 400, step: 10, value: 200 },
    ],
  },
  {
    id: 'basalt-idol',
    title: 'Basalt Idol',
    subtitle: 'ღმერთი',
    accent: 'gold',
    cost: 'light',
    tags: ['ancient gods', 'stone', 'scanner', 'primitives'],
    blurb:
      'A god cut from black stone with gold in its eyes, and a cyan scanner crawling up it. Assembled entirely from squashed primitives — no model file, no loader, no asset pipeline.',
    teaches: 'sculpting with primitives, ritual lighting, custom wireframe scan shaders',
    controls: [
      { key: 'scanSeconds', label: 'scan time', min: 0.6, max: 14, step: 0.2, live: true },
      { key: 'turn', label: 'sway', min: 0, max: 1.2, step: 0.02, live: true },
    ],
  },
  {
    id: 'gravity-well',
    title: 'Gravity Well',
    subtitle: 'n-body',
    accent: 'cyan',
    cost: 'medium',
    tags: ['physics', 'particles', 'orbits', 'real maths'],
    blurb:
      'Real physics, no fakery. Every particle is integrated against every attractor with softened Newtonian gravity and a symplectic Euler step. Your finger is the fourth mass.',
    teaches: 'symplectic integration, force softening, typed-array particle systems',
    controls: [
      { key: 'gravity', label: 'gravity', min: 0.2, max: 8, step: 0.1, live: true },
      { key: 'drag', label: 'drag', min: 0, max: 0.4, step: 0.005, live: true },
      { key: 'softening', label: 'softening', min: 0.05, max: 1.5, step: 0.01, live: true },
      { key: 'count', label: 'particles', min: 500, max: 14000, step: 500, value: 7000 },
    ],
  },
  {
    id: 'chladni-plate',
    title: 'Chladni Plate',
    subtitle: 'cymatics',
    accent: 'cyan',
    cost: 'medium',
    tags: ['physics', 'sound', 'emergence', 'sand'],
    blurb:
      'Sand on a vibrating plate. Nobody draws the pattern — grains hop in proportion to how hard the plate moves under them, so they strand on the lines that are standing still.',
    teaches: 'emergent pattern from a single equation, plate-space to world-space mapping',
    controls: [
      { key: 'holdSeconds', label: 'note length', min: 1, max: 14, step: 0.5, live: true },
      { key: 'morphSeconds', label: 'slide', min: 0.2, max: 6, step: 0.1, live: true },
      { key: 'jitter', label: 'jitter', min: 0.0005, max: 0.01, step: 0.0002, live: true },
      { key: 'count', label: 'grains', min: 2000, max: 30000, step: 1000, value: 18000 },
    ],
  },
  {
    id: 'sigil-forge',
    title: 'Sigil Forge',
    subtitle: 'chaos method',
    accent: 'gold',
    cost: 'light',
    tags: ['occult', 'generative', 'interactive', 'typography'],
    blurb:
      'Spare’s letter method, done properly: strip the vowels, strip the repeats, put what is left on a wheel and join it up. Deterministic — the same words always forge the same shape.',
    teaches: 'text to geometry, CatmullRom tubes, progressive draw ranges, live parameters',
    controls: [
      { key: 'phrase', label: 'intent', type: 'text', live: true },
      { key: 'thickness', label: 'line weight', min: 0.006, max: 0.09, step: 0.002 },
      { key: 'drawSeconds', label: 'draw time', min: 0.4, max: 8, step: 0.1, live: true },
    ],
  },

  // ---- second furnace load ------------------------------------------------

  {
    id: 'torii-path',
    title: 'Torii Path',
    subtitle: '千本鳥居',
    accent: 'vermilion',
    cost: 'medium',
    tags: ['japanese', 'shinto', 'instancing', 'infinite'],
    blurb:
      'A thousand gates at Fushimi Inari, compressed into forty and looped. Every gate is four instances of the same box, and the ground beneath is a seigaiha wave pattern drawn in a shader.',
    teaches: 'describing a structure as data, instancing multi-part objects, seigaiha in GLSL',
    controls: [
      { key: 'speed', label: 'speed', min: 0, max: 14, step: 0.2, live: true },
      { key: 'spacing', label: 'spacing', min: 0.6, max: 4, step: 0.1 },
      { key: 'sway', label: 'sway', min: 0, max: 1.2, step: 0.02, live: true },
      { key: 'gates', label: 'gates', min: 8, max: 80, step: 2, value: 44 },
    ],
  },
  {
    id: 'sand-mandala',
    title: 'Sand Mandala',
    subtitle: 'impermanence',
    accent: 'gold',
    cost: 'medium',
    tags: ['buddhism', 'ritual', 'generative', 'particles'],
    blurb:
      'Laid down grain by grain from the centre outwards, held for a while, then swept away and started again. Both the building and the dissolving happen entirely in the vertex shader.',
    teaches: 'sorting geometry into a draw order, vertex-shader culling, symmetry from a table',
    controls: [
      { key: 'buildSeconds', label: 'build', min: 2, max: 40, step: 0.5, live: true },
      { key: 'holdSeconds', label: 'hold', min: 0, max: 20, step: 0.5, live: true },
      { key: 'dissolveSeconds', label: 'dissolve', min: 0.5, max: 15, step: 0.5, live: true },
      { key: 'grains', label: 'grains', min: 2000, max: 40000, step: 1000, value: 18000 },
    ],
  },
  {
    id: 'tree-of-life',
    title: 'Tree of Life',
    subtitle: 'sephirot',
    accent: 'gold',
    cost: 'light',
    tags: ['kabbalah', 'occult', 'graph', 'light'],
    blurb:
      'The ten sephirot and the twenty-two paths, wired up as an actual graph. Light travels the paths, and every so often the lightning flash runs the descent from crown to kingdom in order.',
    teaches: 'structure as two arrays, walking a graph with particles, Da’at drawn as an absence',
    controls: [
      { key: 'pulseSpeed', label: 'flow', min: 0, max: 1.5, step: 0.02, live: true },
      { key: 'flashSeconds', label: 'flash every', min: 2, max: 30, step: 0.5, live: true },
      { key: 'tilt', label: 'tilt', min: 0, max: 1.2, step: 0.02, live: true },
      { key: 'pulses', label: 'sparks', min: 4, max: 200, step: 4 },
    ],
  },
  {
    id: 'grapevine-cross',
    title: 'Grapevine Cross',
    subtitle: 'ჯვარი ვაზისა',
    accent: 'gold',
    cost: 'light',
    tags: ['georgian', 'christian', 'tubes', 'ornament'],
    blurb:
      'The Georgian cross whose arms droop, because it was cut from a living grapevine and bound at the middle with hair. Arms, shaft and vine are all one function: a tube swept along a curve.',
    teaches: 'CatmullRom tubes as a modelling primitive, instanced clusters, shape-based leaves',
    controls: [
      { key: 'droop', label: 'droop', min: 0, max: 0.9, step: 0.02 },
      { key: 'turn', label: 'turn', min: -1.5, max: 1.5, step: 0.02, live: true },
      { key: 'grapes', label: 'grapes', min: 0, max: 160, step: 8 },
    ],
  },
  {
    id: 'reaction-diffusion',
    title: 'Reaction Diffusion',
    subtitle: 'gray–scott',
    accent: 'cyan',
    cost: 'heavy',
    tags: ['emergence', 'chemistry', 'gpgpu', 'turing'],
    blurb:
      'Two imaginary chemicals and three rules, from which come coral, fingerprints and cell division. The state lives in a texture and never returns to the CPU. Touch it to seed more.',
    teaches: 'ping-pong render targets, Laplacian stencils, running a simulation on the GPU',
    controls: [
      { key: 'drift', label: 'regime drift', min: 0, max: 6, step: 0.1, live: true },
      { key: 'zoom', label: 'zoom', min: 0.4, max: 3, step: 0.05, live: true },
      { key: 'stepsPerFrame', label: 'steps / frame', min: 1, max: 24, step: 1, value: 12 },
      { key: 'resolution', label: 'grid', min: 128, max: 640, step: 32, value: 420 },
    ],
  },
  {
    id: 'ouroboros',
    title: 'Ouroboros',
    subtitle: 'solve et coagula',
    accent: 'gold',
    cost: 'medium',
    tags: ['alchemy', 'serpent', 'geometry', 'tube'],
    blurb:
      'The serpent that eats its own tail, and keeps moving while it does. TubeGeometry cannot taper, so the body is built by hand — a frame carried along the spine by parallel transport.',
    teaches: 'parallel transport frames, tapering tubes, rebuilding geometry every frame',
    controls: [
      { key: 'undulation', label: 'undulation', min: 0, max: 0.6, step: 0.01, live: true },
      { key: 'waves', label: 'waves', min: 1, max: 9, step: 1, live: true },
      { key: 'glide', label: 'glide', min: -3, max: 3, step: 0.05, live: true },
      { key: 'thickness', label: 'girth', min: 0.03, max: 0.24, step: 0.005, live: true },
    ],
  },
];

export const MODULE_IDS = MODULES.map((module) => module.id);

/**
 * Tags are for reading, families are for filtering. Thirty chips is not a
 * filter, it is a wall — so the tags are grouped into seven buckets and those
 * are what the gallery offers.
 */
export const FAMILIES = [
  { id: 'all', label: 'everything', tags: [] },
  { id: 'georgian', label: 'georgian', tags: ['georgian'] },
  { id: 'japanese', label: 'japanese', tags: ['japanese', 'shinto', 'buddhism'] },
  { id: 'occult', label: 'occult', tags: ['occult', 'hermeticism', 'kabbalah', 'alchemy', 'ancient gods', 'ritual', 'christian'] },
  { id: 'physics', label: 'physics', tags: ['physics', 'chemistry', 'emergence', 'growth', 'turing', 'sound', 'orbits'] },
  { id: 'shaders', label: 'shaders', tags: ['shader', 'gpgpu', 'fractal', 'kaleidoscope'] },
  { id: 'tech', label: 'tech', tags: ['matrix', 'cyberpunk', 'instancing', 'infinite', 'grid'] },
];

/** Which family chips a module answers to. Always includes 'all'. */
export function familiesFor(module) {
  const matched = FAMILIES.filter(
    (family) => family.tags.length > 0 && family.tags.some((tag) => module.tags.includes(tag)),
  );
  return ['all', ...matched.map((family) => family.id)];
}

/** How many modules each chip would show, worked out once at build time. */
export function familyCounts() {
  return Object.fromEntries(
    FAMILIES.map((family) => [
      family.id,
      MODULES.filter((module) => familiesFor(module).includes(family.id)).length,
    ]),
  );
}

/** Every tag in use, in order of how many modules carry it. */
export const ALL_TAGS = [...new Set(MODULES.flatMap((module) => module.tags))].sort();

export function getModule(id) {
  return MODULES.find((module) => module.id === id);
}

/** Download and return a module's `create(canvas, options)` function. */
export async function loadModule(id) {
  const loader = loaders[`./${id}.js`];
  if (!loader) throw new Error(`Unknown module: ${id}`);
  const imported = await loader();
  return imported.default;
}
