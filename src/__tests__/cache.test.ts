import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clear, get, set } from '../cache';
import { config } from '../config';
import type { SingleResponse } from '../types';

const resp = (): SingleResponse => ({ body: { content: 'x' } });

beforeEach(() => {
  config.clear();
  clear();
});

afterEach(() => {
  clear();
});

describe('cache eligibility (SPF new/history split)', () => {
  it('a cached new response is not used for new navigations', () => {
    set('/a', resp(), 'new');
    expect(get('/a', 'new')).toBeNull();
  });

  it('a cached new response IS used for history navigations', () => {
    set('/a', resp(), 'new');
    expect(get('/a', 'history')).not.toBeNull();
  });

  it('a prefetched response is used once for a new navigation', () => {
    set('/a', resp(), 'prefetch');
    expect(get('/a', 'new')).not.toBeNull();
    // downgraded: still available for history, not for another new nav
    expect(get('/a', 'new')).toBeNull();
    expect(get('/a', 'history')).not.toBeNull();
  });

  it('cache-unified makes all responses eligible for new navigations', () => {
    config.init({ 'cache-unified': true });
    set('/a', resp(), 'new');
    expect(get('/a', 'new')).not.toBeNull();
  });
});

describe('cache lifetime and eviction', () => {
  it('expired entries are not returned', async () => {
    config.init({ 'cache-lifetime': 1 });
    set('/a', resp(), 'new');
    await new Promise((r) => setTimeout(r, 5)); // let the entry expire
    expect(get('/a', 'history')).toBeNull();
  });

  it('evicts beyond cache-max with LRU order', () => {
    config.init({ 'cache-max': 2 });
    set('/a', resp(), 'new');
    set('/b', resp(), 'new');
    set('/c', resp(), 'new');
    expect(get('/c', 'history')).not.toBeNull();
    // 'a' should have been evicted (oldest) — but 'b'/'c' survive
    expect(get('/a', 'history')).toBeNull();
  });
});
