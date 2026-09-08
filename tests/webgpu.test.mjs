import test from 'node:test';
import assert from 'node:assert/strict';
import { seedParticles } from '../src/modules/aether-loom.js';
import { seedWaveGrid } from '../src/modules/obsidian-resonator.js';
import { gpuCamera } from '../src/lib/webgpu-camera.js';
import { createGPUStage, gpuOptions } from '../src/lib/webgpu-stage.js';

test('GPU seeds are deterministic, finite and have the expected storage layout', () => {
  const particles = seedParticles(8192);
  assert.equal(particles.byteLength, 8192 * 32);
  assert.deepEqual(particles, seedParticles(8192));
  assert.ok(particles.every(Number.isFinite));
  for (let i = 0; i < 8192; i++) {
    assert.ok(Math.hypot(...particles.slice(i * 8, i * 8 + 3)) < 2);
    assert.deepEqual(Array.from(particles.slice(i * 8 + 4, i * 8 + 7)), [0, 0, 0]);
  }
  const wave = seedWaveGrid(128);
  assert.equal(wave.byteLength, 128 * 128 * 8);
  assert.ok(wave.every(value => Number.isFinite(value) && Math.abs(value) <= 0.018));
  for (let x = 0; x < 128; x++) assert.equal(wave[x * 2], 0);
});

test('GPU camera centres the origin and uses zero-to-one depth', () => {
  for (const aspect of [0.35, 1, 2.4]) {
    const { matrix: m } = gpuCamera(aspect, 0, 0, 5);
    assert.ok(m.every(Number.isFinite));
    assert.equal(m[12], 0); assert.equal(m[13], 0);
    const distance = 5 / Math.min(1, aspect);
    const depth = z => (m[10] * z + m[14]) / (m[11] * z + m[15]);
    assert.ok(Math.abs(depth(distance - 0.1)) < 0.00002);
    assert.ok(Math.abs(depth(distance - 100) - 1) < 0.00002);
  }
  assert.deepEqual(gpuOptions({ count: 10 }, { count: Infinity }, { count: [1, 20] }), { count: 10 });
});

function environment(t, gpu) {
  const previous = new Map();
  const target = () => new EventTarget();
  const win = target(); win.devicePixelRatio = 1;
  const doc = target(); doc.visibilityState = 'visible';
  const media = target(); media.matches = false;
  let rafId = 0;
  const frames = new Map();
  class Observer { observe() {} disconnect() {} }
  const globals = { window: win, document: doc, navigator: { gpu }, isSecureContext: true,
    matchMedia: () => media, ResizeObserver: Observer, IntersectionObserver: Observer,
    requestAnimationFrame: callback => { frames.set(++rafId, callback); return rafId; },
    cancelAnimationFrame: id => frames.delete(id),
    CustomEvent: class extends Event { constructor(type, options) { super(type, options); this.detail = options.detail; } },
  };
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  t.after(() => { for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  } });
  const canvas = target(); canvas.getBoundingClientRect = () => ({ width: 400, height: 300 });
  return { canvas, frames, step(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); } };
}

test('fallback animation advances time and stops cleanly on disposal', async t => {
  const env = environment(t, undefined); const times = [];
  const stage = createGPUStage(env.canvas, { setup() { assert.fail('no GPU'); }, fallback() { return { frame: f => times.push(f.dt) }; } });
  await stage.ready; stage.start(); env.step(100); env.step(116); env.step(132);
  assert.equal(stage.backend, 'canvas2d');
  assert.ok(times.filter(dt => dt > 0).length >= 2, 'RAF retains timestamps across frames');
  stage.dispose(); assert.equal(env.frames.size, 0);
});

test('disposal while requesting a GPU device destroys the late device', async t => {
  let resolveDevice; let destroyed = 0; let setups = 0;
  const pending = new Promise(resolve => { resolveDevice = resolve; });
  const env = environment(t, { requestAdapter: async () => ({ requestDevice: () => pending }) });
  const stage = createGPUStage(env.canvas, { setup() { setups++; }, fallback() { assert.fail('disposed stage must not fall back'); } });
  await Promise.resolve(); stage.dispose(); resolveDevice({ destroy() { destroyed++; } });
  await stage.ready;
  assert.equal(destroyed, 1); assert.equal(setups, 0); assert.equal(env.frames.size, 0);
});
