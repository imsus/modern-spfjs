/**
 * Configuration: defaults inherited from SPF (concept-compatible), plus the
 * modern additions. Keys follow the SPF dash-style naming for familiarity.
 */

export interface SpfConfig {
  /** URL identifier; `__type__` is replaced by navigate/prefetch/load. */
  'url-identifier': string;
  /** Class that marks a link/form as SPF-enabled. */
  'link-class': string;
  /** Class that opts a link out of SPF handling. */
  'nolink-class': string;
  /** Maximum time (ms) a cache entry is valid. */
  'cache-lifetime': number;
  /** Maximum number of cache entries (LRU). */
  'cache-max': number;
  /** Whether cached responses are eligible for all navigations. */
  'cache-unified': boolean;
  /** Request timeout in ms; 0 = none. */
  'request-timeout': number;
  /** Global request headers. */
  'request-headers': Record<string, string> | null;
  /** Reason parameter appended on fallback reloads. */
  'reload-identifier': string | null;
  /** Max navigations per session (SPF behavior). */
  'navigate-limit': number;
  /** Session lifetime in ms for the navigation limit. */
  'navigate-lifetime': number;
  /** Class added to animated elements during view transitions. */
  'animation-class': string;
  /** View transition duration in ms (informational). */
  'animation-duration': number;
  /** When set, identifies SPF requests via X-SPF-Request header instead of URL. */
  'advanced-header-identifier': string | null;
  /** Prefetch on mousedown (SPF experiment). */
  'experimental-prefetch-mousedown': boolean;
  /** Prefetch spf-links as they enter the viewport. */
  'prefetch-viewport': boolean;
  /** Allow speculation-rules prerender (Chrome/Edge). */
  prerender: boolean;
  /** Speculation rules strategy: 'prefetch' | 'prerender' | 'none'. */
  speculation: 'prefetch' | 'prerender' | 'none';
}

export const DEFAULT_CONFIG: SpfConfig = {
  'url-identifier': '?spf=__type__',
  'link-class': 'spf-link',
  'nolink-class': 'spf-nolink',
  'cache-lifetime': 10 * 60 * 1000,
  'cache-max': 50,
  'cache-unified': false,
  'request-timeout': 0,
  'request-headers': null,
  'reload-identifier': null,
  'navigate-limit': 20,
  'navigate-lifetime': 24 * 60 * 60 * 1000,
  'animation-class': 'spf-animate',
  'animation-duration': 425,
  'advanced-header-identifier': null,
  'experimental-prefetch-mousedown': false,
  'prefetch-viewport': true,
  prerender: false,
  speculation: 'prefetch',
};

const values: SpfConfig = { ...DEFAULT_CONFIG };

export const config = {
  /** Applies an optional config object over the defaults. */
  init(optConfig?: Partial<SpfConfig>): void {
    Object.assign(values, DEFAULT_CONFIG, optConfig);
  },
  /** Gets a configuration value. */
  get<K extends keyof SpfConfig>(key: K): SpfConfig[K] {
    return values[key];
  },
  /** Sets a configuration value. */
  set<K extends keyof SpfConfig>(key: K, value: SpfConfig[K]): SpfConfig[K] {
    values[key] = value;
    return value;
  },
  /** Resets to defaults. */
  clear(): void {
    Object.assign(values, DEFAULT_CONFIG);
  },
};
