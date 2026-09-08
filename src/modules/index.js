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
    id: 'aether-loom',
    title: 'Aether Loom',
    subtitle: 'light under tension',
    renderer: 'webgpu',
    accent: 'gold',
    cost: 'medium',
    tags: ['webgpu', 'compute', 'particles', 'alchemy'],
    blurb:
      'Sixty-five thousand points of light weave a braided sculpture in brass and blue. Move across it to bend the field. A native WebGPU compute pass updates persistent positions and velocities, then renders directly from the same GPU buffer. Browsers without WebGPU show a labelled 2D study.',
    teaches: 'WGSL compute kernels, storage buffers, GPU-resident state, instanced particle rendering',
    controls: [
      { key: 'speed', label: 'flow speed', min: 0, max: 2, step: 0.01, live: true },
      { key: 'twist', label: 'braid depth', min: 0.3, max: 1.8, step: 0.01, live: true },
      { key: 'size', label: 'light size', min: 0.7, max: 3.5, step: 0.1, live: true },
      { key: 'count', label: 'particles', min: 8192, max: 131072, step: 8192 },
    ],
  },
  {
    id: 'obsidian-resonator',
    title: 'Obsidian Resonator',
    subtitle: 'an instrument for invisible waves',
    renderer: 'webgpu',
    accent: 'moon',
    cost: 'medium',
    tags: ['webgpu', 'compute', 'physics', 'waves'],
    blurb:
      'A black reflective membrane inside an engraved brass rim. Move the excitation point, tune its frequency, and watch waves cross the surface. Two GPU buffers exchange height and velocity at fixed simulation steps. The wave equation is real; the metallic finish and scales are artistic. A labelled 2D study appears when WebGPU is unavailable.',
    teaches: 'WGSL compute, ping-pong storage buffers, a stable finite-difference wave solver, normals reconstructed from simulation state',
    controls: [
      { key: 'drive', label: 'excitation', min: 0, max: 1.5, step: 0.01, live: true },
      { key: 'damping', label: 'wave retention', min: 0.96, max: 0.998, step: 0.001, live: true },
      { key: 'frequency', label: 'frequency', min: 0.3, max: 2.5, step: 0.01, live: true },
      { key: 'speed', label: 'simulation speed', min: 0, max: 2, step: 0.01, live: true },
    ],
  },
  // ---- instruments: astronomy, chaos, cinema, magnetism -------------------
  {
    id: 'sidereal-engine',
    title: 'Sidereal Engine',
    subtitle: 'a clock without a country',
    accent: 'gold',
    cost: 'medium',
    tags: ['astronomy', 'orbits', 'alchemy', 'geometry'],
    blurb:
      'A brass armillary instrument around a dark sun. Elliptical paths, inlaid degree marks and counter-turning meridians recall the machinery of an old observatory. The orbits solve Kepler’s equation; their sizes and periods are an artistic scale, not a map of the solar system.',
    teaches: 'Kepler’s equation, instanced engraving, polished metal, framing a 3D object on narrow screens',
    controls: [
      { key: 'speed', label: 'orbital speed', min: 0, max: 1.5, step: 0.01, live: true },
      { key: 'obliquity', label: 'axial tilt', min: 0, max: 60, step: 0.1, live: true },
      { key: 'eccentricity', label: 'eccentricity', min: 0, max: 0.55, step: 0.01, live: true },
      { key: 'orbitCount', label: 'orbits', min: 3, max: 7, step: 1 },
    ],
  },
  {
    id: 'lorenz-reliquary',
    title: 'Lorenz Reliquary',
    subtitle: 'a small change in the beginning',
    accent: 'moon',
    cost: 'medium',
    tags: ['physics', 'chaos', 'mathematics', 'gothic'],
    blurb:
      'Two wings of brass and blue-green filament, suspended inside a spare metal frame. This is a trajectory through the Lorenz equations, integrated with RK4. Nine points of light trace its history. Change the equation’s parameters to reshape the attractor.',
    teaches: 'fourth-order Runge–Kutta integration, deterministic chaos, screen-space line geometry, precomputed trajectories',
    controls: [
      { key: 'speed', label: 'trace speed', min: 0, max: 2, step: 0.01, live: true },
      { key: 'filament', label: 'filament width', min: 0.5, max: 2.4, step: 0.05, live: true },
      { key: 'rho', label: 'rho · ρ', min: 24, max: 40, step: 0.5 },
      { key: 'sigma', label: 'sigma · σ', min: 8, max: 14, step: 0.5 },
    ],
  },
  {
    id: 'nocturne-iris',
    title: 'Nocturne Iris',
    subtitle: 'the instrument that lets light in',
    accent: 'bone',
    cost: 'medium',
    tags: ['cinema', 'optics', 'mechanism', 'instancing'],
    blurb:
      'A cinema lens recast as a ceremonial object. Overlapping steel leaves open above a coated optical element, surrounded by machined brass and an engraved barrel. Set the opening, slow its breathing, and move around the reflections. The leaf motion is a designed mechanism, not a lens engineering model.',
    teaches: 'overlapping polar surfaces, physical-material optical coatings, instanced machining details',
    controls: [
      { key: 'aperture', label: 'aperture', min: 0.12, max: 0.95, step: 0.01, live: true },
      { key: 'breath', label: 'breathing depth', min: 0, max: 0.22, step: 0.01, live: true },
      { key: 'speed', label: 'breathing speed', min: 0, max: 1.2, step: 0.01, live: true },
      { key: 'blades', label: 'leaves', min: 7, max: 14, step: 1 },
    ],
  },
  {
    id: 'ferrofluid-crown',
    title: 'Ferrofluid Crown',
    subtitle: 'matter listening to a field',
    accent: 'moon',
    cost: 'medium',
    tags: ['physics', 'magnetism', 'shader', 'metal'],
    blurb:
      'Black liquid rises into a hexagonal field of polished peaks inside a brass-rimmed vessel. Move the pointer to draw the field through the surface, or flatten it by reducing its strength. A procedural interpretation of ferrofluid, with surface slopes that keep every reflection attached to the shape.',
    teaches: 'hexagonal wave interference, GPU vertex displacement, finite-difference normals, circular mesh topology',
    controls: [
      { key: 'field', label: 'field strength', min: 0, max: 1.5, step: 0.01, live: true },
      { key: 'frequency', label: 'peak density', min: 5, max: 12, step: 0.1, live: true },
      { key: 'speed', label: 'field drift', min: 0, max: 1, step: 0.01, live: true },
      { key: 'metallic', label: 'metallic response', min: 0.5, max: 1, step: 0.01, live: true },
    ],
  },
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

  // ---- third furnace load: gothic -----------------------------------------

  {
    id: 'cathedral-nave',
    title: 'Cathedral Nave',
    subtitle: 'no length',
    accent: 'moon',
    cost: 'medium',
    tags: ['gothic', 'cathedral', 'architecture', 'instancing'],
    blurb:
      'Bays of piers, transverse arches and crossing ribs come out of the fog and are sent back to the far end when they pass, so the church never ends. Light falls in sideways from the clerestory.',
    teaches: 'setting out an equilateral arch the way a mason does, instanced architecture, fake volumetric shafts',
    controls: [
      { key: 'walk', label: 'walk', min: 0, max: 8, step: 0.1, live: true },
      { key: 'lookUp', label: 'look up', min: -0.4, max: 1.2, step: 0.02, live: true },
      { key: 'naveWidth', label: 'span', min: 1.6, max: 5, step: 0.1 },
      { key: 'bayDepth', label: 'bay depth', min: 1.6, max: 7, step: 0.1 },
    ],
  },
  {
    id: 'rose-window',
    title: 'Rose Window',
    subtitle: 'pot metal',
    accent: 'blood',
    cost: 'light',
    tags: ['gothic', 'cathedral', 'glass', 'symmetry'],
    blurb:
      'A cathedral rose generated from a table of rings. All the glass is one geometry with the colour in an attribute, so the sun can swing round behind it and light the panels in a wave without touching a material.',
    teaches: 'packing hundreds of flat pieces into one buffer, per-panel attributes, angular glare',
    controls: [
      { key: 'sunSpeed', label: 'sun', min: -1.5, max: 1.5, step: 0.02, live: true },
      { key: 'glow', label: 'glow', min: 0.2, max: 2.4, step: 0.05, live: true },
      { key: 'turn', label: 'turn', min: -0.3, max: 0.3, step: 0.004, live: true },
    ],
  },
  {
    id: 'blood-moon',
    title: 'Blood Moon',
    subtitle: 'the long night',
    accent: 'blood',
    cost: 'medium',
    tags: ['gothic', 'moon', 'parallax', 'skyline'],
    blurb:
      'A city of spires against a moon too large to be reassuring. The skyline is generated — up a wall, over a roof or up to a point, next building — and three copies at three distances drift at three speeds.',
    teaches: 'a flat disc faking a sphere in the fragment shader, generated skylines, parallax depth',
    controls: [
      { key: 'drift', label: 'drift', min: 0, max: 5, step: 0.05, live: true },
      { key: 'haze', label: 'haze', min: 0, max: 1.6, step: 0.02, live: true },
      { key: 'moonSize', label: 'moon', min: 1, max: 7, step: 0.1 },
      { key: 'seed', label: 'city seed', min: 1, max: 60, step: 1 },
    ],
  },
  {
    id: 'ashen-ember',
    title: 'Ashen Ember',
    subtitle: 'the only warm thing',
    accent: 'amber',
    cost: 'medium',
    tags: ['gothic', 'fire', 'particles', 'light'],
    blurb:
      'A small fire in a ring of stones and nothing else. Embers go up, ash comes down, and one light that never sits still does all the work of making stone look like stone.',
    teaches: 'flame as three noise quads out of phase, spark lifecycles, firelight flicker that reads as fire',
    controls: [
      { key: 'fire', label: 'fire', min: 0.2, max: 2.4, step: 0.05, live: true },
      { key: 'updraught', label: 'updraught', min: 0, max: 4, step: 0.05, live: true },
      { key: 'embers', label: 'embers', min: 40, max: 1200, step: 20, value: 460 },
    ],
  },
  {
    id: 'iron-chandelier',
    title: 'Iron Chandelier',
    subtitle: 'twenty-two flames',
    accent: 'amber',
    cost: 'light',
    tags: ['gothic', 'iron', 'physics', 'candles'],
    blurb:
      'A wrought-iron corona on a chain, swinging on real pendulum physics on two axes. Push it with a finger and it takes a while to settle, the way something that heavy would.',
    teaches: 'the pendulum equation, three real lights standing in for twenty-two, per-instance flicker',
    controls: [
      { key: 'swing', label: 'draught', min: 0, max: 5, step: 0.05, live: true },
      { key: 'damping', label: 'damping', min: 0.02, max: 1.5, step: 0.02, live: true },
      { key: 'candleGlow', label: 'candles', min: 0.2, max: 2.5, step: 0.05, live: true },
      { key: 'chainLength', label: 'chain', min: 1, max: 5, step: 0.1 },
    ],
  },
  {
    id: 'the-tolling',
    title: 'The Tolling',
    subtitle: 'nobody schedules it',
    accent: 'ash',
    cost: 'light',
    tags: ['gothic', 'physics', 'bronze', 'sound'],
    blurb:
      'A bronze bell and a clapper on two pendulums of different lengths. They drift out of phase, the clapper catches up, and it strikes. Nothing schedules the rhythm — it falls out of the two lengths.',
    teaches: 'lathe profiles, coupled pendulums, collision as a phase condition, pooled shockwaves',
    controls: [
      { key: 'push', label: 'ringer', min: 0, max: 4, step: 0.05, live: true },
      { key: 'damping', label: 'damping', min: 0.02, max: 1, step: 0.02, live: true },
      { key: 'strikeAngle', label: 'reach', min: 0.08, max: 0.7, step: 0.01, live: true },
      { key: 'clapperLength', label: 'clapper', min: 0.25, max: 1.0, step: 0.01 },
    ],
  },

  // ---- fourth furnace load: the studio ------------------------------------
  // Made with smartproduction.ge in mind: black frame, monochrome, the footage
  // supplies the colour. So these are optical and mechanical rather than
  // fantastical — a lens, an iris, a light, a strip of film.

  {
    id: 'aperture-iris',
    title: 'Aperture Iris',
    subtitle: 'f/1.4 — f/16',
    accent: 'brass',
    cost: 'light',
    tags: ['studio', 'optics', 'mechanism', 'film'],
    blurb:
      'A camera iris built the way one works. Every blade is a plain disc, and the opening is just the part no disc covers — so the flat sides and rounded corners come out on their own, and stopping down is one number.',
    teaches: 'geometry that falls out of the mechanism, rigid parts instead of rebuilt ones, diffraction stars',
    controls: [
      { key: 'starburst', label: 'starburst', min: 0, max: 3, step: 0.05, live: true },
      { key: 'dwell', label: 'hold at stop', min: 0.2, max: 6, step: 0.1, live: true },
      { key: 'blades', label: 'blades', min: 5, max: 16, step: 1 },
    ],
  },
  {
    id: 'bokeh-field',
    title: 'Bokeh Field',
    subtitle: 'behind the subject',
    accent: 'tung',
    cost: 'medium',
    tags: ['studio', 'optics', 'depth of field', 'film'],
    blurb:
      'Out-of-focus highlights, with the three things that make them believable: the shape is the aperture, a highlight spread over more area is dimmer, and away from the middle of the frame the barrel clips them into cat’s eyes.',
    teaches: 'circle of confusion, energy-conserving defocus, optical vignetting, lateral colour fringing',
    controls: [
      { key: 'aperture', label: 'aperture', min: 0.2, max: 2.2, step: 0.05, live: true },
      { key: 'blades', label: 'blades', min: 4, max: 14, step: 1, live: true },
      { key: 'catsEye', label: 'cat’s eye', min: 0, max: 2, step: 0.05, live: true },
      { key: 'rim', label: 'rim', min: 0, max: 2, step: 0.05, live: true },
    ],
  },
  {
    id: 'lens-cutaway',
    title: 'Lens Cutaway',
    subtitle: 'snell, three times',
    accent: 'brass',
    cost: 'medium',
    tags: ['studio', 'optics', 'physics', 'real maths'],
    blurb:
      'Three elements in section, with light actually traced through them. Every ray is intersected with each surface and bent by Snell’s law — so where they cross is where this glass focuses, not where it was drawn to.',
    teaches: 'ray–sphere intersection, vector refraction, chromatic aberration by tracing three indices',
    controls: [
      { key: 'spread', label: 'fan', min: 0.2, max: 1.6, step: 0.05, live: true },
      { key: 'dispersion', label: 'dispersion', min: 0, max: 4, step: 0.1, live: true },
      { key: 'tilt', label: 'field angle', min: 0, max: 2, step: 0.05, live: true },
      { key: 'rays', label: 'rays', min: 3, max: 29, step: 2 },
    ],
  },
  {
    id: 'anamorphic-flare',
    title: 'Anamorphic Flare',
    subtitle: 'internal reflections',
    accent: 'flare',
    cost: 'heavy',
    tags: ['studio', 'optics', 'film', 'shader'],
    blurb:
      'The long blue streak, the ghosts strung along the line from the light through the middle of the frame, and the warm bleed around the source. The ghosts march through the centre because that is where light bouncing inside a lens comes back out.',
    teaches: 'why flare chains point at the centre, iris-shaped ghosts, halation, lens grime',
    controls: [
      { key: 'streak', label: 'streak', min: 0, max: 3, step: 0.05, live: true },
      { key: 'ghosts', label: 'ghosts', min: 0, max: 3, step: 0.05, live: true },
      { key: 'halation', label: 'halation', min: 0, max: 3, step: 0.05, live: true },
      { key: 'dirt', label: 'lens dirt', min: 0, max: 1, step: 0.02, live: true },
    ],
  },
  {
    id: 'light-rig',
    title: 'Light Rig',
    subtitle: 'key, fill, rim',
    accent: 'paper',
    cost: 'medium',
    tags: ['studio', 'lighting', 'shadows', 'product'],
    blurb:
      'Three-point lighting on a seamless, with the fixtures left in shot. Key does the modelling and throws the shadow, fill decides how deep it goes, rim separates the subject from the backdrop. Drag to walk the key round.',
    teaches: 'shadow maps, a cyclorama built by bending a plane, reading a lighting setup by moving it',
    controls: [
      { key: 'key', label: 'key', min: 0, max: 2.5, step: 0.05, live: true },
      { key: 'fill', label: 'fill', min: 0, max: 1.5, step: 0.02, live: true },
      { key: 'rim', label: 'rim', min: 0, max: 3, step: 0.05, live: true },
      { key: 'keyHeight', label: 'key height', min: 0.4, max: 5, step: 0.1, live: true },
    ],
  },
  {
    id: 'frame-ribbon',
    title: 'Frame Ribbon',
    subtitle: '35mm',
    accent: 'brass',
    cost: 'medium',
    tags: ['studio', 'film', 'ribbon', 'contact sheet'],
    blurb:
      'A length of film curving through the dark with something exposed on every frame. Sprocket holes, frame lines, edge markings and the picture inside each frame all come out of two texture coordinates, so a hundred frames cost what one does.',
    teaches: 'everything from uv, procedural tonal studies, ribbons twisted along their own length',
    controls: [
      { key: 'speed', label: 'transport', min: -0.6, max: 0.6, step: 0.01, live: true },
      { key: 'frames', label: 'frames', min: 6, max: 60, step: 1, live: true },
      { key: 'curl', label: 'twist', min: 0, max: 2.4, step: 0.05, live: true },
      { key: 'exposure', label: 'exposure', min: 0.3, max: 2.5, step: 0.05, live: true },
    ],
  },

  // ---- fifth furnace load: the brassworks ---------------------------------

  {
    id: 'gear-train',
    title: 'Gear Train',
    subtitle: 'involute, 20 degrees',
    accent: 'polished',
    cost: 'light',
    tags: ['steampunk', 'mechanism', 'brass', 'real maths'],
    blurb:
      'Six gears that genuinely mesh. The teeth are involutes — the only curve that transmits motion at a constant ratio — and every gear’s angle is derived from the one before it, so the train runs at the ratios its tooth counts demand.',
    teaches: 'involute tooth profiles, the exact meshing-phase formula, deriving motion instead of animating it',
    controls: [
      { key: 'speed', label: 'drive', min: -3, max: 3, step: 0.05, live: true },
      { key: 'module', label: 'gear module', min: 0.05, max: 0.16, step: 0.005 },
      { key: 'depth', label: 'face width', min: 0.04, max: 0.4, step: 0.01 },
    ],
  },

  {
    id: 'escapement',
    title: 'Escapement',
    subtitle: 'tick',
    accent: 'polished',
    cost: 'light',
    tags: ['steampunk', 'mechanism', 'physics', 'horology'],
    blurb:
      'The part of a clock that makes it a clock. The anchor lets exactly one tooth past per swing, and the wheel shoves the pendulum back in return — which is the only reason a pendulum that would otherwise die keeps going for a century.',
    teaches: 'pendulum integration, escapement impulse, period falling out of rod length',
    controls: [
      { key: 'rodLength', label: 'rod length', min: 0.5, max: 2.4, step: 0.05, live: true },
      { key: 'damping', label: 'friction', min: 0.02, max: 1.2, step: 0.02, live: true },
      { key: 'teeth', label: 'wheel teeth', min: 12, max: 48, step: 2 },
    ],
  },
  {
    id: 'beam-engine',
    title: 'Beam Engine',
    subtitle: 'solved, not animated',
    accent: 'copper',
    cost: 'medium',
    tags: ['steampunk', 'mechanism', 'physics', 'steam'],
    blurb:
      'One number goes in — the crank angle — and the linkage works out the rest. The connecting rod has a fixed length and the beam end travels a fixed circle, so the beam sits wherever those two facts intersect.',
    teaches: 'circle–circle intersection as a linkage solver, branch continuity, slider-crank',
    controls: [
      { key: 'speed', label: 'speed', min: 0, max: 4, step: 0.05, live: true },
      { key: 'steam', label: 'steam', min: 0, max: 2, step: 0.05, live: true },
      { key: 'crankRadius', label: 'crank throw', min: 0.25, max: 0.8, step: 0.01, live: true },
    ],
  },
  {
    id: 'flyball-governor',
    title: 'Flyball Governor',
    subtitle: 'it corrects itself',
    accent: 'polished',
    cost: 'light',
    tags: ['steampunk', 'mechanism', 'physics', 'control'],
    blurb:
      'The first machine that ever corrected itself. Spin faster, the balls fly out, the sleeve lifts, the throttle closes, it slows. Nothing in it knows what speed it should hold — the speed is just where the two effects cancel. Drag to change the load.',
    teaches: 'a closed feedback loop with real dynamics, hunting and settling, linkage geometry',
    controls: [
      { key: 'load', label: 'load', min: 0, max: 2.6, step: 0.05, live: true },
      { key: 'power', label: 'steam', min: 0.5, max: 6, step: 0.1, live: true },
      { key: 'inertia', label: 'flywheel', min: 0.4, max: 8, step: 0.1, live: true },
      { key: 'damping', label: 'joint friction', min: 0.1, max: 3, step: 0.05, live: true },
    ],
  },
  {
    id: 'difference-engine',
    title: 'Difference Engine',
    subtitle: '0, 1, 8, 27, 64',
    accent: 'ember',
    cost: 'light',
    tags: ['steampunk', 'computation', 'babbage', 'mechanism'],
    blurb:
      'Babbage’s machine, really computing. Third differences of a cubic are constant, so every value after the first can be had with nothing but addition. Seed it 0, 1, 6, 6 and the answer column counts the cubes — no multiplication anywhere in it.',
    teaches: 'the method of differences, odometer wheels from one scrolling texture, staggered carry',
    controls: [
      { key: 'cycleSeconds', label: 'cycle', min: 0.6, max: 8, step: 0.1, live: true },
      { key: 'digits', label: 'digits', min: 3, max: 8, step: 1 },
      { key: 'columns', label: 'columns', min: 2, max: 6, step: 1 },
    ],
  },
  {
    id: 'orrery',
    title: 'Orrery',
    subtitle: 'the real periods',
    accent: 'brass',
    cost: 'medium',
    tags: ['steampunk', 'brass', 'astronomy', 'mechanism'],
    blurb:
      'A brass planetary machine turning at the true relative rates — Mercury round four times a year, Jupiter very nearly twelve, Saturn twenty-nine and a half. The distances are not to scale. They never are.',
    teaches: 'periods as the only thing that must be right, reusing the gear library, armillary detail',
    controls: [
      { key: 'yearsPerSecond', label: 'handle', min: 0.02, max: 3, step: 0.02, live: true },
      { key: 'tilt', label: 'tilt', min: 0, max: 1.2, step: 0.02, live: true },
      { key: 'showRings', label: 'ring & zodiac', min: 0, max: 1, step: 1, live: true },
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
  { id: 'webgpu', label: 'webgpu', tags: ['webgpu'] },
  { id: 'georgian', label: 'georgian', tags: ['georgian'] },
  { id: 'japanese', label: 'japanese', tags: ['japanese', 'shinto', 'buddhism'] },
  { id: 'occult', label: 'occult', tags: ['occult', 'hermeticism', 'kabbalah', 'alchemy', 'ancient gods', 'ritual', 'christian'] },
  { id: 'physics', label: 'physics', tags: ['physics', 'chemistry', 'emergence', 'growth', 'turing', 'sound', 'orbits'] },
  { id: 'shaders', label: 'shaders', tags: ['shader', 'gpgpu', 'fractal', 'kaleidoscope'] },
  { id: 'gothic', label: 'gothic', tags: ['gothic', 'cathedral', 'fire', 'iron', 'moon', 'bronze'] },
  { id: 'studio', label: 'studio', tags: ['studio', 'optics', 'lighting', 'film'] },
  { id: 'works', label: 'brassworks', tags: ['steampunk', 'mechanism', 'brass', 'computation'] },
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
