/**
 * Response cache: in-memory LRU (SPF semantics) with a Cache API persistent
 * tier (modern addition). New/history eligibility split per SPF:
 *  - a cached response is eligible only for *history* navigations, unless
 *    `cache-unified` is enabled or the response's cacheType says otherwise;
 *  - a *prefetched* response is eligible for one subsequent navigation,
 *    then downgrades to history-only.
 */

import { config } from './config';
import type { SingleResponse, SpfNavigationType } from './types';

/** The kind of cache entry; also the cacheType a server may hint. */
export type CacheType = 'new' | 'history' | 'prefetch';

interface CacheEntry {
  response: SingleResponse;
  key: string;
  url: string;
  type: CacheType;
  expires: number;
  lastAccess: number;
}

const CACHE_NAME = 'modern-spf';
const store = new Map<string, CacheEntry>();

/** The Cache API exists only in secure contexts — feature-detect by property. */
function cachesAvailable(): boolean {
  return 'caches' in globalThis;
}

function cacheKey(url: string, type: string): string {
  return `${type} ${url}`;
}

function now(): number {
  return Date.now();
}

function isCacheType(value: string | undefined): value is CacheType {
  return value === 'new' || value === 'history' || value === 'prefetch';
}

/**
 * The single cache-policy rule (SPF semantics): an entry of `type` may serve
 * a `navType` navigation when caching is unified, when it is a history
 * navigation (bfcache-like), or when the entry was prefetched (one shot).
 * Both the in-memory tier and the durable tier consult this rule.
 */
function eligible(type: CacheType, navType: SpfNavigationType): boolean {
  if (config.get('cache-unified')) return true;
  if (navType === 'history') return true; // history always eligible
  return type === 'prefetch'; // new navigation: prefetched responses only
}

/** Reads a cached response for a navigation, downgrading prefetch entries. */
export function get(url: string, navType: SpfNavigationType): SingleResponse | null {
  for (const type of ['prefetch', 'history', 'new'] as const) {
    const entry = store.get(cacheKey(url, type));
    if (!entry) continue;
    if (entry.expires < now()) {
      store.delete(cacheKey(url, type));
      continue;
    }
    if (!eligible(entry.type, navType)) continue;
    entry.lastAccess = now();
    if (entry.type === 'prefetch') {
      // One-shot: any use consumes the prefetch; it becomes history-eligible.
      store.delete(cacheKey(url, 'prefetch'));
      store.set(cacheKey(url, 'history'), { ...entry, type: 'history' });
    }
    return entry.response;
  }
  return null;
}

/**
 * Stores a response, honoring a server `cacheType` hint over the caller's
 * default type, then evicting expired/overflow entries (LRU).
 */
export function set(url: string, response: SingleResponse, type: CacheType = 'new'): string {
  const entryType = isCacheType(response.cacheType) ? response.cacheType : type;
  const key = cacheKey(url, entryType);
  const lifetime = config.get('cache-lifetime');
  store.set(key, {
    response,
    key,
    url,
    type: entryType,
    expires: now() + lifetime,
    lastAccess: now(),
  });
  gc();
  return key;
}

/**
 * Removes an entry by key — either a cache key or a server-provided
 * `response.cacheKey` — including its durable-tier copy.
 */
export function remove(key: string): void {
  const entry = store.get(key) ?? [...store.values()].find((e) => e.response.cacheKey === key);
  if (!entry) return;
  store.delete(entry.key);
  void persistent.delete(entry.url);
}

/** Clears all entries, including the durable tier. */
export function clear(): void {
  store.clear();
  void clearPersistent();
}

async function clearPersistent(): Promise<void> {
  if (!cachesAvailable()) return;
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  await Promise.all(keys.map((key) => cache.delete(key)));
}

/** Number of live entries (tests/telemetry). */
export function size(): number {
  return store.size;
}

/** Expired-entry removal on access + async LRU overflow eviction. */
function gc(): void {
  for (const [key, entry] of store) {
    if (entry.expires < now()) store.delete(key);
  }
  const max = config.get('cache-max');
  if (store.size <= max) return;
  const sorted = [...store.values()].sort((a, b) => a.lastAccess - b.lastAccess);
  const overflow = store.size - max;
  for (const entry of sorted.slice(0, overflow)) store.delete(entry.key);
}

/**
 * Persistent tier (Cache API): survives across sessions, so back/forward
 * navigations to previously visited pages can be served without the network.
 * Entries carry a timestamp and expire per `cache-lifetime`.
 */
interface PersistentEntry {
  cachedAt: number;
  response: SingleResponse;
}

export const persistent = {
  async put(url: string, response: SingleResponse): Promise<void> {
    if (!cachesAvailable()) return;
    const cache = await caches.open(CACHE_NAME);
    const entry: PersistentEntry = { cachedAt: Date.now(), response };
    await cache.put(
      url,
      new Response(JSON.stringify(entry), {
        headers: { 'content-type': 'application/x-spf+json' },
      }),
    );
  },
  async match(url: string): Promise<SingleResponse | null> {
    if (!cachesAvailable()) return null;
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(url);
    if (!res) return null;
    // SAFETY: only persistent.put writes this store, always a JSON PersistentEntry.
    const entry = (await res.json()) as PersistentEntry;
    if (Date.now() - entry.cachedAt > config.get('cache-lifetime')) {
      void cache.delete(url); // expired — drop it
      return null;
    }
    return entry.response;
  },
  async delete(url: string): Promise<boolean> {
    if (!cachesAvailable()) return false;
    const cache = await caches.open(CACHE_NAME);
    return cache.delete(url);
  },
};

/**
 * Durable-tier lookup honoring the cache policy: the persistent store only
 * serves history navigations unless `cache-unified` is enabled (a durable hit
 * would otherwise violate the "new navigations hit the server" guarantee).
 */
export async function durableGet(
  url: string,
  navType: SpfNavigationType,
): Promise<SingleResponse | null> {
  if (!eligible('history', navType)) return null;
  return persistent.match(url);
}

/** The public cache namespace (`spf.cache`). */
export const cache = {
  get,
  set,
  remove,
  clear,
  size,
  durableGet,
  persistent,
};
