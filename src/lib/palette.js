/**
 * palette.js — the colours of the whole thing, in one place.
 *
 * Two groups. PALETTE is the neon set the first modules were built on. GOTHIC
 * is colder and dirtier — everything in it is lit by fire, moonlight or
 * stained glass, and nothing in it glows on its own.
 *
 * Numbers (0x…) are for three.js. The matching CSS custom properties live in
 * src/styles/tokens.css and are kept in sync by hand — there are only a few.
 */
export const PALETTE = {
  void:      0x05060a, // deepest background
  ink:       0x0a0d14, // panel background
  smoke:     0x161b26, // borders, dividers

  cyan:      0x37f7ff, // tech / matrix / signal
  acid:      0x7cff5c, // terminal green, mycelium
  violet:    0xc65cff, // psychedelic
  gold:      0xffb340, // alchemy, hermetic, Georgian gilt
  vermilion: 0xff3b52, // torii red, Georgian wine
  bone:      0xe8e4d9, // text, chalk lines
};

/** The gothic set: stone, iron, candle, moon. */
export const GOTHIC = {
  pitch: 0x04040a, // darker than void — nothing behind this
  slate: 0x14161d, // wet stone in shadow
  ash:   0x6e6a63, // dust, old mortar
  bone:  0xd8d2c4, // weathered stone in light
  blood: 0xa01828, // the moon, the glass, the rust that was not rust
  rust:  0x8a4a24, // iron that has been outside a long time
  amber: 0xff9c3a, // candle, ember, the only warm thing
  moon:  0x9fb6d8, // cold light through a high window
  glass: 0x2a5a9e, // stained glass blue
};

/**
 * The studio set: what a camera sees. Nearly monochrome on purpose — on a
 * production company's site the footage supplies the colour and everything
 * around it gets out of the way.
 */
export const STUDIO = {
  // These five are lifted straight from the smartproduction.ge stylesheet, so
  // a module dropped into that site is already the right colour.
  gate:   0x0b0b0c, // --background
  border: 0x1f1f23, // --border
  muted:  0xa8a39a, // --muted
  brass:  0xb9975b, // --accent
  paper:  0xf4f1ea, // --foreground

  steel:  0x2a2c30, // lens barrel, stand, clamp
  chrome: 0x9a9288, // a machined edge catching light, warm rather than cold
  tung:   0xffb26b, // tungsten, 3200K
  day:    0xbfd4ff, // daylight, 5600K
  flare:  0x6fa8ff, // what an anamorphic does to a highlight
};

/** The brassworks: oil, iron, and everything that was ever polished. */
export const WORKS = {
  soot:   0x0d0b09, // the back of the engine house
  oil:    0x1a1512, // where it has all run down to
  iron:   0x3a3430, // castings, columns, frames
  patina: 0x4e7a6a, // copper that has been outside
  copper: 0xb06a3b, // pipework
  brass:  0xc9a227, // anything anyone thought worth polishing
  steam:  0xd8d2c6,
  ember:  0xff7a2a, // firebox, gauge lamp
};

/** Same values as CSS strings, for canvas2d work and inline styles. */
export const CSS_PALETTE = Object.fromEntries(
  Object.entries(PALETTE).map(([name, value]) => [name, toCss(value)]),
);

export const CSS_GOTHIC = Object.fromEntries(
  Object.entries(GOTHIC).map(([name, value]) => [name, toCss(value)]),
);

export const CSS_STUDIO = Object.fromEntries(
  Object.entries(STUDIO).map(([name, value]) => [name, toCss(value)]),
);

export const CSS_WORKS = Object.fromEntries(
  Object.entries(WORKS).map(([name, value]) => [name, toCss(value)]),
);

function toCss(value) {
  return '#' + value.toString(16).padStart(6, '0');
}
