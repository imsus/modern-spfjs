/**
 * Promise-aware event dispatch.
 *
 * Handlers registered via `spf.event.on` are awaited in order; returning
 * `false` cancels the event. A real `CustomEvent` is then dispatched on
 * `document` (so `document.addEventListener('spfrequest', …)` works like
 * classic SPF); external listeners cancelling via `preventDefault()` also
 * cancel the event.
 */

import type { SpfEventDetail, SpfEventName, SpfEventHandler } from './types';

const registry = new Map<SpfEventName, Set<SpfEventHandler>>();

/** Dispatches synchronously (used for click-time events). */
function dispatchSync(name: SpfEventName, detail: SpfEventDetail): boolean {
  if (!('document' in globalThis)) return true; // non-DOM context
  const evt = new CustomEvent<SpfEventDetail>(name, {
    cancelable: true,
    detail,
  });
  return document.dispatchEvent(evt);
}

export const event = {
  /** Registers a handler. May be async; returning `false` cancels. */
  on(name: SpfEventName, fn: SpfEventHandler): () => void {
    let set = registry.get(name);
    if (!set) {
      set = new Set();
      registry.set(name, set);
    }
    set.add(fn);
    return () => this.off(name, fn);
  },

  /** Unregisters a handler. */
  off(name: SpfEventName, fn: SpfEventHandler): void {
    registry.get(name)?.delete(fn);
  },

  /** Removes all handlers (mainly for tests and dispose). */
  clear(): void {
    registry.clear();
  },

  /**
   * Dispatches an SPF event: awaited registry handlers run first (a `false`
   * return cancels), then a cancelable CustomEvent on `document`. Resolves
   * `false` if the event was cancelled.
   */
  async emit(name: SpfEventName, detail: SpfEventDetail): Promise<boolean> {
    const handlers = registry.get(name);
    if (handlers) {
      // Snapshot: handlers may unregister themselves during iteration.
      // eslint-disable-next-line unicorn/no-useless-spread
      for (const fn of [...handlers]) {
        const result = await fn(detail);
        if (result === false) return false;
      }
    }
    return dispatchSync(name, detail);
  },

  /** Synchronous dispatch (spfclick etc.); resolves via CustomEvent only. */
  emitSync: dispatchSync,
};
