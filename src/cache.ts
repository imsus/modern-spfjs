/**
 * Response cache: in-memory LRU (SPF semantics) with a Cache API persistent
 * tier (modern addition). New/history eligibility split per SPF:
 *  - a cached response is eligible only for *history* navigations, unless
 *    `cache-unified` is enabled or the response's cacheType says otherwise;
 *  - a *prefetched* response is eligible for one subsequent new navigation,
 *    then downgrades to history-only.
 */

import { config } from './config';
import type { SingleResponse, SpfNavigationType } from './types';

interface CacheEntry {
  response: SingleResponse;
  key: string;
  type: 'new' | 'history' | 'prefetch';
  expires: number;
  lastAccess: number;
}

const CACHE_NAME = 'modern-spf';
const store = new Map<string, CacheEntry>();

function cacheKey(url: string, type: string): string {
  return `${type} ${url}`;
}

function now(): number {
  return Date.now();
}

function eligible(entry: CacheEntry, navType: SpfNavigationType): boolean {
  if (entry.expires < now()) return false;
  if (config.get('cache-unified')) return true;
  if (navType === 'history') return true; // history always eligible (bfcache-like)
  // new navigation: only prefetched responses are eligible (one shot)
  return entry.type === 'prefetch';
}

/** Reads a cached response for a navigation, downgrading prefetch entries. */
export function get(url: string, navType: SpfNavigationType): SingleResponse | null {
  for (const type of ['prefetch', 'history', 'new'] as const) {
    const entry = store.get(cacheKey(url, type));
    if (!entry) continue;
    if (!eligible(entry, navType)) {
      if (entry.expires < now()) store.delete(cacheKey(url, type));
      continue;
    }
    entry.lastAccess = now();
    if (navType === 'new' && entry.type === 'prefetch') {
      // One-shot: after use, the prefetched response becomes history-eligible.
      store.delete(cacheKey(url, 'prefetch'));
      store.set(cacheKey(url, 'history'), { ...entry, type: 'history' });
    }
    return entry.response;
  }
  return null;
}

/** Stores a response, evicting expired/overflow entries (LRU). */
export function set(
  url: string,
  response: SingleResponse,
  type: 'new' | 'history' | 'prefetch' = 'new',
): string {
  const key = cacheKey(url, type);
  const lifetime = config.get('cache-lifetime');
  store.set(key, {
    response,
    key,
    type,
    expires: now() + lifetime,
    lastAccess: now(),
  });
  gc();
  return key;
}

/** Removes one entry by key. */
export function remove(key: string): void {
  store.delete(key);
}

/** Clears all entries. */
export function clear(): void {
  store.clear();
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

/** Persistent tier (Cache API) — hybrid layer, wired up during deepening. */
export const persistent = {
  async put(url: string, response: SingleResponse): Promise<void> {
    if (typeof caches === 'undefined') return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      url,
      new Response(JSON.stringify(response), {
        headers: { 'content-type': 'application/x-spf+json' },
      }),
    );
  },
  async match(url: string): Promise<SingleResponse | null> {
    if (typeof caches === 'undefined') return null;
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(url);
    if (!res) return null;
    return (await res.json()) as SingleResponse;
  },
  async delete(url: string): Promise<boolean> {
    if (typeof caches === 'undefined') return false;
    const cache = await caches.open(CACHE_NAME);
    return cache.delete(url);
  },
};

/** The public cache namespace (`spf.cache`). */
export const cache = {
  get,
  set,
  remove,
  clear,
  size,
  persistent,
};
