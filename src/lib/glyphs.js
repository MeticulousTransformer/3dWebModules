/**
 * glyphs.js — turns characters into textures.
 *
 * Two shapes of output, because that is all any module here needs:
 *   createGlyphAtlas(...)  a grid of glyphs, for shaders that pick one per cell
 *   createGlyphStrip(...)  a long horizontal row, for wrapping around a cylinder
 *
 * Fonts lie about what they can draw, so unrenderable characters are filtered
 * out first — otherwise you get a wall of tofu boxes on whatever machine is
 * missing Georgian.
 */
import * as THREE from 'three';

export const GLYPH_SETS = {
  /** Ancient Georgian capitals. Beautiful, and not on every machine. */
  asomtavruli: [...'ႠႡႢႣႤႥႦႧႨႩႪႫႬႭႮႯႰႱႲႳႴႵႶႷႸႹႺႻႼႽႾႿჀ'],
  /** Modern Georgian. Everywhere Georgian exists at all. */
  mkhedruli: [...'აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ'],
  /** Japanese katakana, the classic falling-code alphabet. */
  katakana: [...'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'],
  /** Planets and elements, the alchemist's shorthand. */
  alchemical: [...'☉☽☿♀♂♃♄♅♆⚗⚖⊕⊗⊙△▽◇○●※†‡∴∵'],
  /** Greek, because every grimoire has some. */
  greek: [...'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ'],
  /** Just the digits and a few sigils, for terminal texture. */
  machine: [...'0123456789<>[]{}/\\|=+-*#%$@&'],
};

/** Everything, in one list. Handy default for the rain. */
export const ALL_GLYPHS = [
  ...GLYPH_SETS.asomtavruli,
  ...GLYPH_SETS.katakana,
  ...GLYPH_SETS.alchemical,
  ...GLYPH_SETS.greek,
  ...GLYPH_SETS.machine,
];

const FALLBACK_FONT = '"Noto Sans Georgian", "Noto Sans JP", "Segoe UI Symbol", Sylfaen, sans-serif';

/**
 * Drop characters this browser cannot actually draw.
 * A missing glyph is rendered with the font's "notdef" box, which is always
 * exactly as wide as the notdef box for U+FFFF — so that is the tell.
 */
export function filterRenderableGlyphs(glyphs, font) {
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const notdefWidth = probe.measureText('￿').width;
  return glyphs.filter((glyph) => {
    const width = probe.measureText(glyph).width;
    return width > 0 && Math.abs(width - notdefWidth) > 0.01;
  });
}

/**
 * A square grid of glyphs on a transparent-black texture.
 * Ink is written to the red channel, so shaders read `texture2D(atlas, uv).r`.
 *
 * @returns { texture, columns, rows, count, dispose }
 */
export function createGlyphAtlas(glyphs, options = {}) {
  const {
    cellSize = 64,
    columns = 8,
    fontFamily = FALLBACK_FONT,
    fontScale = 0.72,
  } = options;

  const font = `${Math.round(cellSize * fontScale)}px ${fontFamily}`;
  const usable = filterRenderableGlyphs(glyphs, font);
  const list = usable.length ? usable : [...'01'];

  const rows = Math.max(1, Math.ceil(list.length / columns));
  const canvas = document.createElement('canvas');
  canvas.width = columns * cellSize;
  canvas.height = rows * cellSize;

  const context = canvas.getContext('2d');
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = font;
  context.fillStyle = '#fff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  list.forEach((glyph, index) => {
    const x = (index % columns) * cellSize + cellSize / 2;
    const y = Math.floor(index / columns) * cellSize + cellSize / 2;
    context.fillText(glyph, x, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  return {
    texture,
    columns,
    rows,
    count: list.length,
    dispose: () => texture.dispose(),
  };
}

/**
 * One long strip of glyphs, evenly spaced, made to wrap once around a cylinder.
 * @returns { texture, dispose }
 */
export function createGlyphStrip(glyphs, options = {}) {
  const {
    width = 2048,
    height = 128,
    fontFamily = FALLBACK_FONT,
    fontScale = 0.62,
    color = '#ffb340',
  } = options;

  const font = `${Math.round(height * fontScale)}px ${fontFamily}`;
  const usable = filterRenderableGlyphs(glyphs, font);
  const list = usable.length ? usable : [...'ABCDEFGH'];

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  context.font = font;
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const step = width / list.length;
  list.forEach((glyph, index) => {
    context.fillText(glyph, step * (index + 0.5), height / 2);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  return { texture, dispose: () => texture.dispose() };
}
