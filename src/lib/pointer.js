/**
 * pointer.js — one normalised input signal for mouse, finger and phone tilt.
 *
 * Every module wants the same thing: "where is the user pointing, from -1 to 1".
 * This gives you exactly that and nothing else.
 *
 *   const pointer = createPointer(canvas);
 *   stage.onFrame(({ dt }) => { pointer.update(dt); mesh.rotation.y = pointer.x; });
 *   stage.onDispose(() => pointer.dispose());
 *
 * .x / .y   smoothed, -1..1, (0,0) is the middle of the element
 * .rawX/.rawY  unsmoothed, same range
 * .down     true while a mouse button or finger is held
 * .active   true while the pointer is actually over the element
 *
 * When the pointer leaves, the values ease back to the centre, so idle modules
 * settle into a calm resting pose instead of freezing mid-gesture.
 */
export function createPointer(element, options = {}) {
  const {
    smoothing = 5,     // higher = snappier. This is an exponential ease per second.
    tilt = true,       // let phone gyroscope drive the pointer when there is no finger
    tiltStrength = 1,
  } = options;

  const pointer = {
    x: 0,
    y: 0,
    rawX: 0,
    rawY: 0,
    down: false,
    active: false,
    tiltEnabled: false,
    update,
    dispose,
    requestTilt,
  };

  let tiltX = 0;
  let tiltY = 0;

  function setFromEvent(event) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.rawX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.rawY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    pointer.active = true;
  }

  const onMove = (event) => setFromEvent(event);
  const onDown = (event) => { pointer.down = true; setFromEvent(event); };
  const onUp = () => { pointer.down = false; };
  const onLeave = () => { pointer.active = false; pointer.down = false; };

  element.addEventListener('pointermove', onMove, { passive: true });
  element.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  element.addEventListener('pointerleave', onLeave, { passive: true });

  // ---- phone tilt ---------------------------------------------------------
  function onOrientation(event) {
    if (event.gamma == null || event.beta == null) return;
    // gamma: left/right tilt (-90..90). beta: front/back tilt (-180..180).
    tiltX = clamp(event.gamma / 45, -1, 1) * tiltStrength;
    tiltY = clamp((event.beta - 45) / 45, -1, 1) * tiltStrength;
    pointer.tiltEnabled = true;
  }

  /** iOS needs this called from inside a real tap. Everywhere else it just works. */
  function requestTilt() {
    const DeviceOrientation = window.DeviceOrientationEvent;
    if (!DeviceOrientation) return Promise.resolve(false);

    if (typeof DeviceOrientation.requestPermission === 'function') {
      return DeviceOrientation.requestPermission()
        .then((result) => {
          if (result !== 'granted') return false;
          window.addEventListener('deviceorientation', onOrientation, { passive: true });
          return true;
        })
        .catch(() => false);
    }

    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    return Promise.resolve(true);
  }

  if (tilt && window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
    requestTilt();
  }

  // ---- per-frame ----------------------------------------------------------
  function update(dt = 1 / 60) {
    // No finger and no mouse on the element? Fall back to tilt, then to centre.
    const targetX = pointer.active ? pointer.rawX : tiltX;
    const targetY = pointer.active ? pointer.rawY : tiltY;

    // Frame-rate independent exponential ease.
    const k = 1 - Math.exp(-smoothing * dt);
    pointer.x += (targetX - pointer.x) * k;
    pointer.y += (targetY - pointer.y) * k;
  }

  function dispose() {
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    element.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('deviceorientation', onOrientation);
  }

  return pointer;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
