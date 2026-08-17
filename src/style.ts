/**
 * Style manager: constructable stylesheets (adoptedStyleSheets) with a
 * `<link>` fallback for cases where adoption can't apply (cross-origin/CSP).
 */

type StyleHandle = CSSStyleSheet | HTMLLinkElement;

const registry = new Map<string, StyleHandle>();

export const style = {
  /**
   * Loads a stylesheet once (deduped by name or URL) and applies it.
   * Returns the adopted stylesheet, or the fallback `<link>` element.
   */
  async load(url: string, name?: string): Promise<StyleHandle> {
    const key = name ?? url;
    const existing = registry.get(key);
    if (existing) return existing;
    try {
      const css = await (await fetch(url)).text();
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      if (!document.adoptedStyleSheets.includes(sheet)) {
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      }
      registry.set(key, sheet);
      return sheet;
    } catch {
      // Cross-origin/CSP: fall back to a classic <link>.
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
      registry.set(key, link);
      return link;
    }
  },

  /** Requests a stylesheet without applying it, priming the browser cache. */
  prefetch(url: string): void {
    if (!('document' in globalThis)) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = url;
    document.head.appendChild(link);
  },

  /** Removes a managed stylesheet from the page. */
  unload(name: string): void {
    const handle = registry.get(name);
    if (!handle) return;
    if (handle instanceof CSSStyleSheet) {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== handle);
    } else {
      handle.remove();
    }
    registry.delete(name);
  },

  /** Whether a name is currently registered. */
  isLoaded(name: string): boolean {
    return registry.has(name);
  },
};
