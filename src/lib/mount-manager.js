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
    const waiting = [...slots.values()]
      .filter((slot) => slot.visible && !slot.instance && !slot.loading)
      .sort((a, b) => b.lastSeen - a.lastSeen);

    for (const slot of waiting) {
      if (!makeRoom()) break;
      mount(slot);
    }
  }

  async function mount(slot) {
    slot.loading = true;
    slot.element.dataset.state = 'loading';
    try {
      const create = await load(slot.id);
      // The user may have scrolled away while the chunk was downloading.
      if (!slot.visible) {
        slot.loading = false;
        slot.element.dataset.state = 'idle';
        pump();
        return;
      }
      slot.instance = create(slot.canvas, slot.options);
      slot.element.dataset.state = 'live';
      // An extension point: pages that want to drive a live module (a text
      // input, a slider) listen for this and keep hold of the instance.
      slot.element.dispatchEvent(
        new CustomEvent('module:mounted', { detail: { id: slot.id, instance: slot.instance } }),
      );
    } catch (error) {
      slot.element.dataset.state = 'error';
      console.error('[athanor] module "' + slot.id + '" failed to start:', error);
    } finally {
      slot.loading = false;
    }
  }

  function unmount(slot) {
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
    const fresh = slot.canvas.cloneNode(false);
    slot.canvas.replaceWith(fresh);
    slot.canvas = fresh;

    slot.element.dataset.state = 'idle';
  }

  return {
    /** element must contain a <canvas>. */
    observe(element, id, options = {}) {
      const canvas = element.querySelector('canvas');
      if (!canvas) throw new Error('mount-manager: no <canvas> inside element for "' + id + '"');
      const slot = {
        element, canvas, id, options,
        visible: false, instance: null, loading: false,
        lastSeen: ++clock, unmountTimer: 0,
      };
      slots.set(element, slot);
      element.dataset.state = 'idle';
      observer.observe(element);
      return slot;
    },

    destroy() {
      observer.disconnect();
      for (const slot of slots.values()) unmount(slot);
      slots.clear();
    },
  };
}
