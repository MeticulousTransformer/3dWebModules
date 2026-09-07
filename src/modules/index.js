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
 * where `stage` has .start() .stop() .dispose(), and sometimes .setParam(k, v).
 */

/**
 * Vite turns this into a map of lazy imports, one chunk per module, so the
 * gallery page only downloads the modules you actually scroll to.
 */
const loaders = import.meta.glob('./*.js');

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
  },
];

export const MODULE_IDS = MODULES.map((module) => module.id);

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
