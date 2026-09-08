/**
 * mount-manager.js — decides which module canvases are alive right now.
 *
 * THE PROBLEM
 *   A browser will only give you a handful of live WebGL contexts (roughly 8 to
 *   16, then it starts silently killing the oldest ones). A gallery page has
 *   more module canvases than that.
 *
 * THE FIX
 *   Mount a module when its canvas scrolls into view, dispose it when it has
 *   been out of view for a moment, and never keep more than `budget` alive.
 *
 *   const manager = createMountManager({ budget: 4, load: (id) => import(...) });
 *   manager.observe(element, 'borjgali-vortex');
 */
export function createMountManager({ budget = 4, load, rootMargin = '250px', graceMs = 1500 }) {
  /** element -> { id, visible, instance, lastSeen, unmountTimer, loading } */
  const slots = new Map();
  let clock = 0;
  let destroyed = false;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const slot = slots.get(entry.target);
        if (!slot) continue;
        slot.visible = entry.isIntersecting;
        slot.lastSeen = ++clock;

        if (slot.visible) {
          clearTimeout(slot.unmountTimer);
          slot.unmountTimer = 0;
        } else if (slot.instance && !slot.unmountTimer) {
          slot.unmountTimer = setTimeout(() => unmount(slot), graceMs);
        }
      }
      pump();
    },
    { rootMargin },
  );

  function liveSlots() {
    return [...slots.values()].filter((slot) => slot.instance || slot.loading);
  }

  /** Free up one slot if we are at budget. Returns true if there is room now. */
  function makeRoom() {
    const live = liveSlots();
    if (live.length < budget) return true;

    const evictable = live
      .filter((slot) => !slot.visible && slot.instance)
      .sort((a, b) => a.lastSeen - b.lastSeen);

    if (!evictable.length) return false;
    unmount(evictable[0]);
    return true;
  }

  /** Mount everything visible that is not mounted yet, as far as budget allows. */
  function pump() {
    if (destroyed) return;
    const waiting = [...slots.values()]
      .filter((slot) => slot.visible && !slot.instance && !slot.loading)
      .sort((a, b) => b.lastSeen - a.lastSeen);

    for (const slot of waiting) {
      if (!makeRoom()) break;
      mount(slot);
    }
  }

  async function mount(slot) {
    if (slot.instance || slot.loading) return;

    slot.loading = true;
    const generation = ++slot.generation;
    slot.element.dataset.state = 'loading';

    let instance = null;
    try {
      const create = await load(slot.id);
      if (destroyed || generation !== slot.generation) return;
      // The user may have scrolled away while the chunk was downloading.
      if (slot.visible) {
        instance = create(slot.canvas, slot.options);
        slot.instance = instance;
        // A pending WebGPU device still owns a disposable handle and a budget slot.
        if (instance?.ready) await instance.ready;
        if (destroyed || generation !== slot.generation) { instance?.dispose(); return; }
        if (!slot.visible) { unmount(slot); pump(); return; }
        for (const [key, value] of Object.entries(slot.options)) instance.setParam?.(key, value);
      }
    } catch (error) {
      if (destroyed || generation !== slot.generation) return;
      instance?.dispose();
      slot.instance = null;
      slot.element.dataset.state = 'error';
      console.error('[athanor] module "' + slot.id + '" failed to start:', error);
      slot.loading = false;
      return;
    }

    slot.loading = false;

    if (!instance) {
      slot.element.dataset.state = 'idle';
      pump();
      return;
    }

    slot.instance = instance;
    slot.element.dataset.state = 'live';

    // An extension point: pages that want to drive a live module (a slider, a
    // text box) listen for this and keep hold of the instance.
    //
    // This is deliberately the LAST thing mount() does, with the slot already
    // in a settled state. A listener is allowed to turn round and ask for a
    // rebuild — and if it did that while we were still mid-mount, the rebuild
    // and this call would fight over the same slot and leave two modules on
    // one canvas.
    slot.element.dispatchEvent(
      new CustomEvent('module:mounted', { detail: { id: slot.id, instance } }),
    );
  }

  function unmount(slot) {
    slot.generation++;
    slot.loading = false;
    clearTimeout(slot.unmountTimer);
    slot.unmountTimer = 0;
    if (slot.instance) {
      slot.element.dispatchEvent(new CustomEvent('module:unmounted', { detail: { id: slot.id } }));
      try {
        slot.instance.dispose();
      } catch (error) {
        console.error('[athanor] module "' + slot.id + '" failed to dispose:', error);
      }
      slot.instance = null;
    }

    // A canvas whose WebGL context has been force-lost can never be given
    // another one — getContext() just returns null from then on. So the old
    // element is thrown away and an identical empty one takes its place,
    // which is what makes a slot re-mountable when it scrolls back into view.
    // WebGPU may replace its canvas when switching to the 2D fallback.
    const current = slot.element.querySelector('canvas') ?? slot.canvas;
    const fresh = current.cloneNode(false);
    current.replaceWith(fresh);
    slot.canvas = fresh;

    slot.element.dataset.state = 'idle';
  }

  return {
    /**
     * Change a mounted module's options. Anything a module cannot adjust with
     * setParam needs building again from scratch, and that is what this does:
     * tear the slot down and let pump() put it straight back with the new
     * options. The canvas swap in unmount() is what makes that safe.
     */
    setOptions(element, options, { rebuild = true } = {}) {
      const slot = slots.get(element);
      if (!slot) return;

      // Always remember the new options, so a slot that gets disposed for
      // scrolling out of view comes back with the settings it had.
      slot.options = { ...slot.options, ...options };

      if (rebuild && (slot.instance || slot.loading)) unmount(slot);
      pump();
    },

    /** element must contain a <canvas>. */
    observe(element, id, options = {}) {
      const canvas = element.querySelector('canvas');
      if (!canvas) throw new Error('mount-manager: no <canvas> inside element for "' + id + '"');
      const slot = {
        element, canvas, id, options,
        visible: false, instance: null, loading: false,
        lastSeen: ++clock, unmountTimer: 0, generation: 0,
      };
      slots.set(element, slot);
      element.dataset.state = 'idle';
      observer.observe(element);
      return slot;
    },

    destroy() {
      destroyed = true;
      observer.disconnect();
      for (const slot of slots.values()) unmount(slot);
      slots.clear();
    },
  };
}
