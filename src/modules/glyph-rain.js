/**
 * GLYPH RAIN
 *
 * Falling code, but the alphabet is Asomtavruli, katakana and planetary signs
 * instead of half-mirrored kana. One draw call: the whole thing is a single
 * fullscreen shader reading a glyph atlas, so it costs almost nothing on a phone.
 *
 * Standalone. Needs: three, ../lib/stage.js ../lib/pointer.js
 *                   ../lib/fullscreen.js ../lib/glyphs.js ../lib/glsl.js
 */
import * as THREE from 'three';
import { createStage } from '../lib/stage.js';
import { createPointer } from '../lib/pointer.js';
import { createFullscreenQuad } from '../lib/fullscreen.js';
import { createGlyphAtlas, ALL_GLYPHS } from '../lib/glyphs.js';
import { GLSL_HASH } from '../lib/glsl.js';
import { PALETTE } from '../lib/palette.js';
import { scale } from '../lib/device.js';

export const defaults = {
  cellPixels: 0,        // 0 = pick automatically from the device
  speed: 1,
  headColor: 0xdcffe4,  // the bright leading character
  bodyColor: PALETTE.acid,
  rareColor: PALETTE.gold, // roughly one column in eight burns gold
};

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uSpeed;
uniform vec2  uGrid;        // how many glyph cells across and down
uniform vec2  uAtlasGrid;   // how many glyphs across and down in the atlas
uniform float uGlyphCount;
uniform sampler2D uAtlas;
uniform vec3  uHead;
uniform vec3  uBody;
uniform vec3  uRare;
uniform vec2  uPointer;

${GLSL_HASH}

void main() {
  vec2 cell   = floor(vUv * uGrid);
  vec2 cellUv = fract(vUv * uGrid);
  float column = cell.x;

  // Each column falls at its own pace and starts at its own moment.
  float speed  = 0.16 + hash11(column * 1.37) * 0.42;
  float offset = hash11(column * 7.13);

  // rel = how long ago the falling head passed this cell, wrapped to 0..1.
  float rel   = fract(vUv.y + uTime * speed * uSpeed + offset);
  float taper = 2.4 + hash11(column * 5.5) * 6.5;
  float trail = pow(1.0 - rel, taper);
  float head  = smoothstep(0.972, 1.0, 1.0 - rel);

  // The glyph in a cell re-rolls a few times a second, so the code "types".
  float flick = floor(uTime * (1.4 + hash11(column * 3.1) * 5.0) + hash21(cell) * 13.0);
  float index = floor(hash21(cell + vec2(flick, flick * 0.37)) * uGlyphCount);

  vec2 atlasCell = vec2(mod(index, uAtlasGrid.x), floor(index / uAtlasGrid.x));
  vec2 atlasUv = vec2(
    (atlasCell.x + cellUv.x) / uAtlasGrid.x,
    (uAtlasGrid.y - atlasCell.y - 1.0 + cellUv.y) / uAtlasGrid.y
  );
  float ink = texture2D(uAtlas, atlasUv).r;

  // A few columns are gold rather than green.
  float rare = step(0.87, hash11(column * 11.7));
  vec3 body  = mix(uBody, uRare, rare);

  vec3 color = body * trail * 1.55 + uHead * head * 2.1;
  color *= ink;

  // Columns near the pointer burn brighter — the canvas reacts to a finger.
  float distanceToPointer = abs((vUv.x * 2.0 - 1.0) - uPointer.x);
  color *= 1.0 + 0.9 * exp(-distanceToPointer * distanceToPointer * 14.0);

  // Vignette, and a faint horizontal scan.
  vec2 v = vUv * 2.0 - 1.0;
  color *= 1.0 - 0.30 * dot(v, v);
  color *= 0.92 + 0.08 * sin(vUv.y * uGrid.y * 3.14159 + uTime * 2.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

export default function create(canvas, options = {}) {
  const params = { ...defaults, ...options };
  const cellPixels = params.cellPixels || scale(15, 19);

  const stage = createStage(canvas, { clearColor: PALETTE.void, antialias: false });
  const pointer = createPointer(canvas);

  const atlas = createGlyphAtlas(ALL_GLYPHS, { cellSize: 64, columns: 10 });

  const uniforms = {
    uTime: { value: 0 },
    uSpeed: { value: params.speed },
    uGrid: { value: new THREE.Vector2(32, 32) },
    uAtlasGrid: { value: new THREE.Vector2(atlas.columns, atlas.rows) },
    uGlyphCount: { value: atlas.count },
    uAtlas: { value: atlas.texture },
    uHead: { value: new THREE.Color(params.headColor) },
    uBody: { value: new THREE.Color(params.bodyColor) },
    uRare: { value: new THREE.Color(params.rareColor) },
    uPointer: { value: new THREE.Vector2(0, 0) },
  };

  const quad = createFullscreenQuad(FRAGMENT_SHADER, uniforms);
  stage.scene.add(quad.mesh);

  // Keep the glyph cells square whatever shape the canvas is.
  stage.onResize(({ width, height }) => {
    uniforms.uGrid.value.set(
      Math.max(6, Math.round(width / cellPixels)),
      Math.max(6, Math.round(height / cellPixels)),
    );
  });

  stage.onFrame(({ time, dt }) => {
    pointer.update(dt);
    uniforms.uTime.value = time;
    uniforms.uPointer.value.set(pointer.x, pointer.y);
  });

  stage.onDispose(() => {
    pointer.dispose();
    atlas.dispose();
    quad.dispose();
  });

  return stage.start();
}
