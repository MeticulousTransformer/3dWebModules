/**
 * stage.js — the baseplate that every 3D module clicks onto.
 *
 * WHAT IT DOES
 *   - makes a WebGL renderer sized to your <canvas> (with a sane pixel ratio for phones)
 *   - hands you a scene + camera
 *   - runs a requestAnimationFrame loop, but ONLY while the canvas is on screen
 *     and the tab is visible (phone battery matters)
 *   - tears everything down properly on dispose(), including the GL context
 *
 * WHAT IT DOES NOT DO
 *   Anything specific to any one module. Modules build their own meshes and
 *   register an onFrame callback. That separation is the whole trick.
 *
 * TO USE THIS IN ANOTHER PROJECT
 *   Copy this file + pointer.js + the module file you want. `npm i three`. Done.
 *   Nothing here knows about Astro, this website, or any build tool.
 *
 * @example
 *   const stage = createStage(canvas, { camera: { position: [0, 0, 6] } });
 *   stage.scene.add(new THREE.Mesh(geo, mat));
 *   stage.onFrame(({ dt }) => { mesh.rotation.y += dt; });
 *   stage.onDispose(() => { geo.dispose(); mat.dispose(); });
 *   stage.start();
 */
import * as THREE from 'three';

/** Frames longer than this are treated as this long, so a paused tab doesn't jump. */
const MAX_DELTA = 1 / 20;

export function createStage(canvas, options = {}) {
  const {
    alpha = false,
    antialias = true,
    maxPixelRatio = 2,
    clearColor = 0x05060a,
    clearAlpha = 1,
    camera: cameraOptions = {},
    autoRender = true,
  } = options;

  // ---- renderer -----------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha,
    antialias,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(clearColor, clearAlpha);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ---- scene + camera -----------------------------------------------------
  const scene = new THREE.Scene();

  const {
    fov = 50,
    near = 0.1,
    far = 100,
    position = [0, 0, 5],
    lookAt = [0, 0, 0],
  } = cameraOptions;

  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  camera.position.set(...position);
  camera.lookAt(...lookAt);

  // ---- callback lists -----------------------------------------------------
  // Plain arrays. Each register function returns an "unsubscribe" function.
  const frameCallbacks = [];
  const resizeCallbacks = [];
  const disposeCallbacks = [];

  const addTo = (list) => (fn) => {
    list.push(fn);
    return () => {
      const i = list.indexOf(fn);
      if (i !== -1) list.splice(i, 1);
    };
  };

  // ---- live state ---------------------------------------------------------
  const size = { width: 1, height: 1, aspect: 1, pixelRatio: 1 };
  const state = {
    running: false,   // start() was called and dispose() was not
    onScreen: true,   // canvas intersects the viewport
    tabVisible: true, // document is not hidden
    time: 0,          // seconds of animation actually played
    frame: 0,
  };

  const reducedMotion =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  let rafId = 0;
  let lastTimestamp = 0;
  let disposed = false;

  // ---- sizing -------------------------------------------------------------
  function applySize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);

    if (width === size.width && height === size.height && pixelRatio === size.pixelRatio) return;

    size.width = width;
    size.height = height;
    size.aspect = width / height;
    size.pixelRatio = pixelRatio;

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = size.aspect;
    camera.updateProjectionMatrix();

    for (const fn of resizeCallbacks) fn(size);
    if (!state.running || reducedMotion) renderOnce();
  }

  const resizeObserver = new ResizeObserver(applySize);
  resizeObserver.observe(canvas);

  // ---- pause when off screen / tab hidden ---------------------------------
  const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      state.onScreen = entry.isIntersecting;
      syncLoop();
    },
    { rootMargin: '150px' },
  );
  intersectionObserver.observe(canvas);

  function onVisibilityChange() {
    state.tabVisible = document.visibilityState === 'visible';
    syncLoop();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  // ---- the loop -----------------------------------------------------------
  function shouldRun() {
    return state.running && state.onScreen && state.tabVisible && !reducedMotion && !disposed;
  }

  function syncLoop() {
    if (shouldRun()) {
      if (!rafId) {
        lastTimestamp = 0;
        rafId = requestAnimationFrame(tick);
      }
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function tick(timestamp) {
    rafId = requestAnimationFrame(tick);

    const dt = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 1000, MAX_DELTA) : 0;
    lastTimestamp = timestamp;
    state.time += dt;
    state.frame += 1;

    const context = {
      time: state.time,
      dt,
      frame: state.frame,
      width: size.width,
      height: size.height,
      scene,
      camera,
      renderer,
    };
    for (const fn of frameCallbacks) fn(context);
    if (autoRender) renderer.render(scene, camera);
  }

  /** Draw a single frame without starting the loop (used for reduced motion). */
  function renderOnce() {
    if (disposed) return;
    const context = {
      time: state.time,
      dt: 0,
      frame: state.frame,
      width: size.width,
      height: size.height,
      scene,
      camera,
      renderer,
    };
    for (const fn of frameCallbacks) fn(context);
    if (autoRender) renderer.render(scene, camera);
  }

  // ---- teardown -----------------------------------------------------------
  function dispose() {
    if (disposed) return;
    disposed = true;
    state.running = false;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;

    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);

    for (const fn of disposeCallbacks) fn();
    frameCallbacks.length = 0;
    resizeCallbacks.length = 0;
    disposeCallbacks.length = 0;

    disposeSceneContents(scene);
    scene.clear();

    renderer.dispose();
    // Free the GL context immediately. Browsers only allow a handful at once,
    // and a gallery page mounts and unmounts a lot of these.
    renderer.forceContextLoss();
  }

  const stage = {
    renderer,
    scene,
    camera,
    size,
    state,
    reducedMotion,

    onFrame: addTo(frameCallbacks),
    onResize: addTo(resizeCallbacks),
    onDispose: addTo(disposeCallbacks),

    start() {
      if (disposed) return stage;
      state.running = true;
      applySize();
      if (reducedMotion) renderOnce();
      else syncLoop();
      return stage;
    },
    stop() {
      state.running = false;
      syncLoop();
      return stage;
    },
    renderOnce,
    dispose,
  };

  applySize();
  return stage;
}

/**
 * Walk a scene and release every geometry, material and texture it owns.
 * Three.js does not do this for you; skipping it leaks GPU memory.
 */
export function disposeSceneContents(root) {
  root.traverse((object) => {
    if (object.geometry) object.geometry.dispose();

    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];

    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && value.isTexture) value.dispose();
      }
      if (material.uniforms) {
        for (const uniform of Object.values(material.uniforms)) {
          if (uniform && uniform.value && uniform.value.isTexture) uniform.value.dispose();
        }
      }
      material.dispose();
    }
  });
}
