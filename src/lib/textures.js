/**
 * textures.js — small procedural textures, drawn with canvas2d.
 *
 * No image files anywhere in this project. Everything is generated at runtime,
 * which means a module you copy elsewhere has no assets to copy with it.
 */
import * as THREE from 'three';

/** A soft round glow. Put it on an additive plane behind something bright. */
export function createRadialGlowTexture(options = {}) {
  const { color = '#ffffff', size = 256, softness = 2.2 } = options;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);

  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    gradient.addColorStop(t, withAlpha(color, Math.pow(1 - t, softness)));
  }

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

/**
 * An equirectangular gradient used as scene.environment.
 * Metal materials look black without one — this is the cheapest way to make
 * gold read as gold.
 */
export function createGradientEnvironment(options = {}) {
  const {
    top = '#1a2440',
    middle = '#0a0d14',
    bottom = '#2a1608',
    sun = '#ffd9a0',
    width = 512,
    height = 256,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.55, middle);
  gradient.addColorStop(1, bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  // One bright spot, so metals get a specular highlight to catch.
  const spot = context.createRadialGradient(width * 0.3, height * 0.28, 0, width * 0.3, height * 0.28, height * 0.45);
  spot.addColorStop(0, sun);
  spot.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = spot;
  context.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** '#rrggbb' + 0..1 alpha -> 'rgba(r,g,b,a)'. */
function withAlpha(hex, alpha) {
  const value = parseInt(hex.replace('#', ''), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}
