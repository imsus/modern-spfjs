/**
 * ESM-native script manager (ADR 0002, ADR 0003): managed resources are ES
 * modules loaded via import(), resolved through the page's import map for
 * bare specifiers. A module cannot be unmounted once loaded; "unload" drops
 * the registry entry so the next load re-resolves the specifier.
 */

const registry = new Map<string, Promise<unknown>>();

export const script = {
  /**
   * Loads a module once (deduped by name or specifier) and returns its
   * namespace. Bare specifiers resolve through the page's import map.
   */
  load(specifier: string, name?: string): Promise<unknown> {
    const key = name ?? specifier;
    const existing = registry.get(key);
    if (existing) return existing;
    const promise = import(/* @vite-ignore */ specifier).catch((err: unknown) => {
      registry.delete(key);
      throw err;
    });
    registry.set(key, promise);
    return promise;
  },

  /** Requests a module without executing it, priming the browser cache. */
  prefetch(specifier: string): void {
    if (typeof document === 'undefined') return;
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = specifier;
    document.head.appendChild(link);
  },

  /** Drops the registry entry; the next load re-resolves the specifier. */
  unload(name: string): void {
    registry.delete(name);
  },

  /** Whether a name is currently registered. */
  isLoaded(name: string): boolean {
    return registry.has(name);
  },
};
