/**
 * Native WebGPU lifecycle. Factories stay synchronous; .ready settles after GPU
 * initialization. The gallery can dispose the handle while that work is pending.
 * No adapter or a lost device switches to the explicitly labelled 2D preview.
 */
import { createPointer } from './pointer.js';

export function gpuOptions(defaults, options, limits) {
  const result = { ...defaults };
  for (const [key, [min, max]] of Object.entries(limits)) {
    if (Number.isFinite(options[key])) result[key] = Math.max(min, Math.min(max, options[key]));
  }
  return result;
}

export async function gpuShader(device, code, label) {
  const module = device.createShaderModule({ code, label });
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter(message => message.type === 'error');
  if (errors.length) throw new Error(errors.map(message => `${label}:${message.lineNum}: ${message.message}`).join('\n'));
  return module;
}

export function createGPUStage(initialCanvas, { setup, fallback, maxPixelRatio = 1.5 }) {
  let canvas = initialCanvas;
  let pointer = createPointer(canvas, { tilt: false });
  let frame = null, release = null, disposed = false, contextClaimed = false;
  let raf = 0, lastTime = 0, fallingBack = false;
  const resources = new Set();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { running: false, visible: true, tabVisible: document.visibilityState === 'visible', time: 0 };
  const size = { width: 1, height: 1, aspect: 1, pixelRatio: 1 };

  const stage = {
    state, size, device: null, context: null, format: null, backend: 'loading',
    get canvas() { return canvas; },
    get reducedMotion() { return motion.matches; },
    own(resource) {
      if (disposed) resource.destroy();
      else resources.add(resource);
      return resource;
    },
    start() { if (!disposed) { state.running = true; sync(); } return stage; },
    stop() { state.running = false; sync(); return stage; },
    renderOnce() { draw(0); },
    setParam() {},
    dispose,
  };

  function report(backend, message) {
    stage.backend = backend;
    canvas.dispatchEvent(new CustomEvent('module:backend', { bubbles: true, detail: { backend, message } }));
  }

  function resize() {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    const max = Math.min(stage.device?.limits.maxTextureDimension2D ?? 4096, 4096);
    const width = Math.min(max, Math.max(1, Math.round(rect.width * ratio)));
    const height = Math.min(max, Math.max(1, Math.round(rect.height * ratio)));
    if (width === size.width && height === size.height) return;
    Object.assign(size, { width, height, aspect: width / height, pixelRatio: ratio });
    canvas.width = width;
    canvas.height = height;
    draw(0);
  }
  const resizeObserver = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    state.visible = entry.isIntersecting;
    sync();
  }, { rootMargin: '120px' });
  resizeObserver.observe(canvas);
  intersectionObserver.observe(canvas);

  function shouldRun() {
    return !disposed && frame && state.running && state.visible && state.tabVisible && !motion.matches;
  }
  function sync() {
    if (shouldRun() && !raf) { lastTime = 0; raf = requestAnimationFrame(tick); }
    else if (!shouldRun() && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  function draw(dt) {
    if (disposed || !frame) return;
    pointer.update(dt);
    try { frame({ ...size, dt, time: state.time, pointer }); }
    catch (error) {
      if (stage.backend === 'webgpu') activateFallback('2D preview · GPU rendering interrupted');
      else { frame = null; sync(); report('error', 'Preview unavailable'); console.error('[athanor]', error); }
    }
  }
  function tick(timestamp) {
    raf = 0;
    if (!shouldRun()) return;
    const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 1 / 30) : 0;
    lastTime = timestamp;
    state.time += dt;
    draw(dt);
    if (shouldRun() && !raf) raf = requestAnimationFrame(tick);
  }
  function visibility() { state.tabVisible = document.visibilityState === 'visible'; sync(); }
  function motionChanged() { sync(); draw(0); }
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', motionChanged);

  function releaseGPU() {
    release?.();
    release = null;
    for (const resource of resources) resource.destroy();
    resources.clear();
    stage.context?.unconfigure();
    stage.context = null;
    stage.device?.destroy();
    stage.device = null;
  }
  function activateFallback(message) {
    if (disposed || fallingBack) return;
    fallingBack = true;
    frame = null;
    sync();
    releaseGPU();
    // Canvas context types are exclusive. Replace the element after claiming GPU.
    if (contextClaimed) {
      pointer.dispose();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      const fresh = canvas.cloneNode(false);
      canvas.replaceWith(fresh);
      canvas = fresh;
      pointer = createPointer(canvas, { tilt: false });
      resizeObserver.observe(canvas);
      intersectionObserver.observe(canvas);
    }
    const result = fallback(canvas);
    frame = result.frame;
    release = result.dispose;
    report('canvas2d', message);
    resize();
    draw(0);
    sync();
  }

  async function initialize() {
    try {
      if (!globalThis.isSecureContext || !navigator.gpu) {
        activateFallback('2D preview · WebGPU unavailable in this browser');
        return stage;
      }
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (disposed) return stage;
      if (!adapter) throw new Error('No compatible WebGPU adapter');
      const device = await adapter.requestDevice();
      if (disposed) { device.destroy(); return stage; }
      stage.device = device;
      stage.format = navigator.gpu.getPreferredCanvasFormat();
      device.lost.then(() => {
        if (!disposed && stage.backend === 'webgpu') activateFallback('2D preview · GPU connection lost');
      });
      device.addEventListener('uncapturederror', () => {
        if (!disposed && stage.backend === 'webgpu') activateFallback('2D preview · GPU rendering interrupted');
      });
      device.pushErrorScope('validation');
      let result;
      try { result = await setup(stage); }
      finally {
        const error = await device.popErrorScope();
        if (error) throw new Error(error.message);
      }
      if (disposed) { result.dispose?.(); return stage; }
      stage.context = canvas.getContext('webgpu');
      if (!stage.context) throw new Error('WebGPU canvas unavailable');
      contextClaimed = true;
      stage.context.configure({ device, format: stage.format, alphaMode: 'opaque' });
      frame = result.frame;
      release = result.dispose;
      report('webgpu', 'WebGPU · GPU compute active');
      resize();
      draw(0);
      sync();
    } catch (error) {
      if (!disposed) {
        console.warn('[athanor] WebGPU initialization failed:', error);
        activateFallback('2D preview · WebGPU could not start');
      }
    }
    return stage;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    state.running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', visibility);
    motion.removeEventListener('change', motionChanged);
    pointer.dispose();
    frame = null;
    releaseGPU();
  }

  resize();
  stage.ready = initialize();
  return stage;
}
