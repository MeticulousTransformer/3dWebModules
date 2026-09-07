/**
 * palette.js — the colours of the whole thing, in one place.
 *
 * Numbers (0x…) are for three.js. The matching CSS custom properties live in
 * src/styles/tokens.css and are kept in sync by hand — there are only a dozen.
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

/** Same values as CSS strings, for canvas2d work and inline styles. */
export const CSS_PALETTE = Object.fromEntries(
  Object.entries(PALETTE).map(([name, value]) => [name, '#' + value.toString(16).padStart(6, '0')]),
);
