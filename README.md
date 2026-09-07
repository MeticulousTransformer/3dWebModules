# ATHANOR · ათანორი

A furnace for 3D web modules.

Thirty-six three.js pieces — alchemy, Georgian and Japanese sign, physics,
chemistry, neon, a wing of gothic stone, a studio bench of optics and a
brassworks of real mechanisms — each written as **one file you can pick up and
drop somewhere else**. The website around them is an Astro static site that exists
mainly to show them running, let you tune them, and hand you the source.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static files in dist/
```

---

## The one idea

Every module is a plain function. It takes a canvas, it returns a handle:

```js
import create from './src/modules/borjgali-vortex.js';

const wheel = create(document.querySelector('canvas'), { arms: 7, spin: 0.5 });

wheel.setParam('spin', 1.2);   // change it while it runs
wheel.dispose();               // and hand the GPU memory back
```

`start()`, `stop()`, `dispose()` and `setParam(key, value)` are the entire API.

No module imports anything from this website. Not the layout, not the config,
not a store, not a context. They import `three` and two or three small helpers
from `src/lib/`, and nothing else. That is the whole design, and everything
else in this repo follows from it.

### Taking one with you

1. Copy the module file, e.g. `src/modules/chladni-plate.js`
2. Copy the helpers it imports — its page on the site lists them exactly, and
   so do the import lines at the top of the file. It is usually
   `src/lib/stage.js` and `src/lib/pointer.js`.
3. `npm i three`

That is it. There are no assets to bring: every texture in this project is
drawn with canvas2d at runtime, so there is no `public/` folder to keep in sync
and nothing to 404.

### You do not have to guess the numbers

Every module's page has sliders for its own parameters, generated from the
catalogue. Drag them, watch it change, then press **copy config** — what comes
back is the exact call that makes what you are looking at:

```js
create(canvas, {"undulation":0.31,"waves":5,"glide":-0.85})
```

The settings also go into the URL, so a tuned module is a link you can send
someone. Parameters marked *live* go straight to `setParam` and change under
your hand; the rest rebuild the module, which takes a blink.

---

## Reading the code

```
src/
  lib/                the shared baseplate — small, boring, heavily commented
    stage.js          renderer + camera + the animation loop + teardown
    pointer.js        mouse, finger and phone tilt, normalised to -1..1
    mount-manager.js  which canvases on a page are allowed to be alive
    fullscreen.js     a quad that always covers the canvas, for shader-only work
    pingpong.js       two render targets that take turns — simulations on the GPU
    lightshaft.js     the beam through a high window, faked with one quad
    filmlook.js       grain, gate weave and a vignette, laid over the top
    gears.js          involute tooth profiles, and the phase that makes them mesh
    random.js         seeded randomness, so a rebuild gives back what you had
    glyphs.js         characters -> textures (atlas or strip)
    textures.js       procedural glows and environment maps
    glsl.js           shader snippets more than one module needs
    params.js         the setParam convention, in five lines
    device.js         one honest guess at how much this machine can take
    palette.js        the nine colours, for three.js

  modules/            the actual work. one file each.
    index.js          the catalogue — the only file that knows they all exist
    sources.js        build-time only: module source as text, and their defaults

  components/         Astro pieces, including the generated control panel
  layouts/            the page shell
  pages/              / and /m/[id]
  styles/             tokens.css (every value) and base.css (the reset)
  site.config.js      name, links, the words on the front page
```

`src/lib/stage.js` is the file to read first. It is 280 lines and it is the
thing every module sits on.

### Why the code looks like this

- **Flat functions and plain arrays.** No classes, no inheritance, no registry
  of registries. If you can read one module you can read all of them.
- **Comments say why, not what.** The line underneath already says what.
- **One place per value.** Colours live in `tokens.css` and `palette.js`, sizes
  live in `tokens.css`, the module list lives in `modules/index.js`, and a
  module's default settings live in the module — the sliders read them from
  there rather than keeping a second copy that drifts.
- **Nothing clever.** Where there was a choice between short and obvious, the
  code is obvious.

---

## Mobile first, honestly

This is not a claim, it is a handful of specific decisions:

- **The loop only runs when it can be seen.** `stage.js` watches an
  `IntersectionObserver` and `visibilitychange`. Off screen or in a background
  tab, zero frames are drawn.
- **WebGL contexts are budgeted.** A browser only gives you eight to sixteen
  live contexts before it starts silently killing the oldest. The gallery has
  thirty-eight canvases, so `mount-manager.js` mounts modules as they scroll in and
  disposes them when they leave — three alive at a time on a phone, six on a
  desktop. Verified, not assumed.
- **Filtering falls out of that for free.** Hiding a card takes it out of the
  viewport, so its module disposes itself and hands the context to whatever is
  still on screen. No special case anywhere.
- **Pixel ratio is capped**, and the expensive shader modules cap it lower again.
- **Particle counts and geometry detail come from `device.js`**, so a phone gets
  2,600 particles where a desktop gets 7,000.
- **`prefers-reduced-motion` renders one still frame** instead of animating.
- **`touch-action: pan-y`** on every canvas, so a finger can still scroll the
  page past a module that wants pointer events.
- Astro ships **no JavaScript at all** until a canvas needs it, and three.js is
  split into its own chunk so it is downloaded once and cached for every module.

### Five things learned the hard way

`stage.dispose()` cancels the frame loop, disconnects both observers, removes
its listeners, walks the scene releasing every geometry, material and texture,
and then calls `forceContextLoss()` to hand the GL context straight back.

**A canvas whose context has been force-lost can never get another one.**
`getContext()` returns null from then on. That is why `mount-manager.js` throws
the old `<canvas>` element away and puts a fresh one in its place on unmount.

**Mounting has to be re-entrancy safe.** The `module:mounted` event is the last
thing `mount()` does, with the slot already settled, because a listener is
allowed to turn round and ask for a rebuild — and if it did that mid-mount, the
rebuild and the mount would fight over the same slot and leave two modules on
one canvas. That is exactly what a link with parameters in it does on load.

**`[hidden]` loses to any author rule that sets `display`.** The browser's own
`[hidden] { display: none }` is a UA style, so `.card { display: flex }` beats
it and `element.hidden = true` does nothing you can see. The gallery filter
looked like it worked for a while, because the property was being set correctly
and the property was all the test looked at. `base.css` now carries an explicit
`[hidden] { display: none !important }`, and the test counts what actually has
a layout box.

**`Color.setScalar` writes r = g = b**, which silently throws away a tint. To
dim something without greying it, `.copy(base).multiplyScalar(k)`.

**A resize that changed nothing used to dispatch nothing**, so a canvas that
already had its final size when the stage was built never fired `onResize` at
all — and any module scaling itself to fit stayed at scale 1. That hid for a
long time, because most fits are `Math.min(1, …)` and 1 is what you get anyway.
It only showed up on the first module that needed to *shrink*. `start()` now
forces one dispatch.

---

## Adding a module

1. Write `src/modules/your-thing.js`. Copy the shape of an existing one — they
   all look the same on purpose:

   ```js
   export const defaults = { /* every knob, with a comment */ };

   export default function create(canvas, options = {}) {
     const params = { ...defaults, ...options };
     const stage = createStage(canvas, { camera: { position: [0, 0, 5] } });

     // build your scene here

     stage.onFrame(({ time, dt }) => { /* move it */ });
     stage.onDispose(() => { /* release anything stage cannot find */ });

     stage.setParam = createParamSetter(params);
     return stage.start();
   }
   ```

2. Add an entry to the `MODULES` array in `src/modules/index.js`, including a
   `controls` list of the parameters worth a slider.

That is both steps. The gallery card, the detail page, the file list, the
sliders and the syntax-highlighted source panel are all generated from those
two things.

---

## The modules

| module | what it is | cost |
|---|---|---|
| Borjgali Vortex | the seven-armed Georgian sun sign, extruded in gold and repeated into depth | light |
| Hermetic Seal | two engraved discs turning against each other, as above so below | light |
| Glyph Rain | falling code in Asomtavruli, katakana and planetary signs — one draw call | light |
| Enso / Void | the zen circle, painted in one breath, drawn differently every time | light |
| Mycelium Net | a fungal network growing forever inside a fixed ring buffer | medium |
| Quintessence | a drop of living mercury, noise-displaced and iridescent | medium |
| Psilocybin Field | domain-warped noise through a kaleidoscope | heavy |
| Neon Lattice | an endless city corridor built from recycled instances | medium |
| Basalt Idol | a god's head cut from primitives, with a scanner crawling up it | light |
| Gravity Well | real n-body gravity, symplectic integration, your finger is a mass | medium |
| Chladni Plate | sand on a vibrating plate, settling on the nodal lines | medium |
| Sigil Forge | chaos magic's letter method — type a sentence, get its sigil | light |
| Torii Path | a thousand gates at Fushimi Inari, looped, over a seigaiha sea | medium |
| Sand Mandala | laid down grain by grain, held, swept away, begun again | medium |
| Tree of Life | the ten sephirot and twenty-two paths, as an actual graph | light |
| Grapevine Cross | the Georgian cross whose arms droop, bound at the middle | light |
| Reaction Diffusion | Turing's two chemicals, run on the GPU. touch it to seed more | heavy |
| Ouroboros | a tapering serpent built by carrying a frame along its own spine | medium |
| Cathedral Nave | an endless gothic nave, arches set out the way a mason sets them | medium |
| Rose Window | a cathedral rose, all its glass in one buffer, lit in a wave | light |
| Blood Moon | a generated skyline in three parallax layers under a red moon | medium |
| Ashen Ember | a fire in a ring of stones, and nothing else | medium |
| Iron Chandelier | a wrought corona on a chain, real pendulum physics on two axes | light |
| The Tolling | a bell and a clapper on two pendulums; the rhythm is the difference | light |
| Aperture Iris | every blade a plain disc; the opening is what none of them cover | light |
| Bokeh Field | defocus that conserves energy, with cat's-eye clipping at the edges | medium |
| Lens Cutaway | three elements with light actually traced through by Snell's law | medium |
| Anamorphic Flare | the streak, and ghosts marching through the centre of frame | heavy |
| Light Rig | key, fill and rim on a seamless, with the fixtures left in shot | medium |
| Frame Ribbon | 35mm curving through the dark, every frame drawn from two uvs | medium |
| Gear Train | six gears with involute teeth that genuinely mesh | light |
| Escapement | a pendulum and an anchor; the tick is not scheduled anywhere | light |
| Beam Engine | a linkage solved by circle intersection, not keyframed | medium |
| Flyball Governor | a closed feedback loop that hunts and settles | light |
| Difference Engine | Babbage's columns, counting the cubes by addition alone | light |
| Orrery | brass planets at their true relative periods | medium |

---

## The studio set

The last six were made to sit on a particular site — smartproduction.ge, a
video and photo studio in Tbilisi. Their stylesheet is five custom properties:

```
--background #0b0b0c   --foreground #f4f1ea   --muted #a8a39a
--accent     #b9975b   --border     #1f1f23
```

Those exact values are the `STUDIO` group in `src/lib/palette.js`, so a module
dropped onto that site is already the right colour. Brass accent, warm off-white,
near-black ground. And because a production company's site should let the
footage supply the colour, these six are optical and mechanical rather than
fantastical: a lens, an iris, a light, a strip of film.

---

## Notes

- Fonts are Cinzel and JetBrains Mono, loaded from Google Fonts. If you would
  rather self-host them, it is one `<link>` in `src/layouts/Base.astro`.
- The simplex noise in `src/lib/glsl.js` is Ashima Arts' standard
  implementation, MIT licensed, unmodified.
- Everything else here is yours. Take it.
#   3 d W e b M o d u l e s 
 
 