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
   * Callers may specify `T` to describe the module they import; the module
   * namespace contract is theirs to assert at this boundary.
   */
  load<T = unknown>(specifier: string, name?: string): Promise<T> {
    const key = name ?? specifier;
    const existing = registry.get(key);
    if (existing) {
      // SAFETY: import() returns an untyped module namespace; T is the caller's
      // declared contract for the module being loaded.
      return existing as Promise<T>;
    }
    const promise = import(/* @vite-ignore */ specifier).catch((err) => {
      registry.delete(key);
      throw err;
    });
    registry.set(key, promise);
    // SAFETY: import() returns an untyped module namespace; T is the caller's
    // declared contract for the module being loaded.
    return promise as Promise<T>;
  },

  /** Requests a module without executing it, priming the browser cache. */
  prefetch(specifier: string): void {
    if (!('document' in globalThis)) return;
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
