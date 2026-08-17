// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cache } from '../cache';
import { config } from '../config';
import { event } from '../events';
import * as nav from '../nav';

interface MockNavigateEvent extends Event {
  destination: { url: string; getState: () => unknown };
  navigationType: 'push' | 'traverse';
  intercept: (opts: { handler: () => Promise<void> }) => void;
  scroll: ReturnType<typeof vi.fn>;
  run: () => Promise<void>;
  intercepted: boolean;
}

function makeNavigationMock() {
  const listeners = new Set<(e: MockNavigateEvent) => void>();
  let lastEvent: MockNavigateEvent | null = null;
  const dispatch = (url: string, navigationType: 'push' | 'traverse', state: unknown) => {
    const evt = new Event('navigate', { cancelable: true }) as unknown as MockNavigateEvent;
    let handler: (() => Promise<void>) | null = null;
    evt.destination = { url, getState: () => state };
    evt.navigationType = navigationType;
    evt.intercepted = false;
    evt.intercept = (opts) => {
      evt.intercepted = true;
      handler = opts.handler;
    };
    evt.scroll = vi.fn();
    evt.run = async () => {
      if (handler) await handler();
    };
    lastEvent = evt;
    for (const fn of listeners) fn(evt);
  };
  return {
    navigate(url: string, opts?: { state?: unknown }) {
      dispatch(url, 'push', opts?.state);
    },
    dispatchTraverse(url: string, state?: unknown) {
      dispatch(url, 'traverse', state);
    },
    addEventListener(_t: string, fn: (e: MockNavigateEvent) => void) {
      listeners.add(fn);
    },
    removeEventListener(_t: string, fn: (e: MockNavigateEvent) => void) {
      listeners.delete(fn);
    },
    get lastEvent() {
      return lastEvent;
    },
  };
}

type NavMock = ReturnType<typeof makeNavigationMock>;

const DEST = 'http://localhost:3000/dest';

function jsonResponse(body: object): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/x-spf+json' },
  });
}

let mockNav: NavMock;

beforeEach(() => {
  config.clear();
  event.clear();
  cache.clear();
  document.body.innerHTML = '<div id="content">old</div>';
  document.head.innerHTML = '';
  mockNav = makeNavigationMock();
  Object.defineProperty(window, 'navigation', {
    value: mockNav,
    configurable: true,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse({
        title: 'New Title',
        body: { content: '<p>new content</p>' },
      }),
    ),
  );
});

afterEach(() => {
  nav.dispose();
  vi.unstubAllGlobals();
});

describe('new navigation (click)', () => {
  it('runs the SPF pipeline and applies the response', async () => {
    document.body.innerHTML =
      '<a id="l" class="spf-link" href="/dest">Go</a><div id="content">old</div>';
    expect(nav.init()).toBe(true);

    const order: string[] = [];
    event.on('spfrequest', () => {
      order.push('spfrequest');
    });
    event.on('spfprocess', () => {
      order.push('spfprocess');
    });
    event.on('spfdone', () => {
      order.push('spfdone');
    });

    document
      .getElementById('l')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }));

    const evt = mockNav.lastEvent!;
    expect(evt).not.toBeNull();
    expect(evt.intercepted).toBe(true);
    await evt.run();

    expect(document.getElementById('content')!.innerHTML).toBe('<p>new content</p>');
    expect(document.title).toBe('New Title');
    expect(order).toEqual(['spfrequest', 'spfprocess', 'spfdone']);
    expect(evt.scroll).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/dest?spf=navigate'),
      expect.anything(),
    );
  });

  it('ignores clicks without the spf-link class', () => {
    document.body.innerHTML = '<a id="l" href="/dest">Go</a>';
    expect(nav.init()).toBe(true);
    document
      .getElementById('l')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }));
    expect(mockNav.lastEvent).toBeNull();
  });

  it('cancels navigation when spfclick is prevented', () => {
    document.body.innerHTML = '<a id="l" class="spf-link" href="/dest">Go</a>';
    expect(nav.init()).toBe(true);
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('spfclick', prevent);
    try {
      document
        .getElementById('l')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }));
      expect(mockNav.lastEvent).toBeNull();
    } finally {
      document.removeEventListener('spfclick', prevent);
    }
  });

  it('emits spferror and falls back to a full navigation on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const errors: unknown[] = [];
    event.on('spferror', (d) => {
      errors.push(d);
    });
    // The fallback contract is observable via the sync `spfreload` event,
    // whose detail.url is the reload target (jsdom's location is not spyable).
    const reloads: unknown[] = [];
    document.addEventListener('spfreload', (e) => {
      reloads.push((e as CustomEvent).detail);
    });
    document.body.innerHTML = '<a id="l" class="spf-link" href="/dest">Go</a>';
    expect(nav.init()).toBe(true);
    document
      .getElementById('l')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }));
    await mockNav.lastEvent!.run();

    expect(errors).toHaveLength(1);
    expect(reloads).toHaveLength(1);
    expect((reloads[0] as { url: string }).url).toBe(DEST);
  });

  it('falls back to a full navigation on a reload:true response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ reload: true })));
    const errors: unknown[] = [];
    event.on('spferror', (d) => {
      errors.push(d);
    });
    const reloads: unknown[] = [];
    document.addEventListener('spfreload', (e) => {
      reloads.push((e as CustomEvent).detail);
    });
    document.body.innerHTML =
      '<a id="l" class="spf-link" href="/dest">Go</a><div id="content">old</div>';
    expect(nav.init()).toBe(true);
    document
      .getElementById('l')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }));
    await mockNav.lastEvent!.run();

    expect(errors).toHaveLength(1);
    expect(reloads).toHaveLength(1);
    expect((reloads[0] as { url: string }).url).toBe(DEST);
    // A reload:true response must NOT be applied as a successful navigation.
    expect(document.getElementById('content')!.innerHTML).toBe('old');
  });

  it('spf.navigate resolves when the pipeline settles', async () => {
    expect(nav.init()).toBe(true);
    const promise = nav.navigate(DEST);
    const evt = mockNav.lastEvent!;
    expect(evt.intercepted).toBe(true);
    await evt.run();
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('history navigation (traverse)', () => {
  it('restores from cache without a network request', async () => {
    cache.set(DEST, { title: 'Cached', body: { content: '<p>cached</p>' } }, 'new');
    expect(nav.init()).toBe(true);

    const historyEvents: unknown[] = [];
    // spfhistory is a *sync* dispatch (click-time semantics) — observe via
    // the document CustomEvent, not the Promise-aware registry.
    document.addEventListener('spfhistory', (e) => {
      historyEvents.push((e as CustomEvent).detail);
    });

    mockNav.dispatchTraverse(DEST, { spf: true });
    const evt = mockNav.lastEvent!;
    expect(evt.intercepted).toBe(true);
    await evt.run();

    expect(document.getElementById('content')!.innerHTML).toBe('<p>cached</p>');
    expect(document.title).toBe('Cached');
    expect(fetch).not.toHaveBeenCalled();
    expect(historyEvents).toHaveLength(1);
    expect(evt.scroll).toHaveBeenCalled();
  });

  it('fetches on traverse when nothing is cached', async () => {
    expect(nav.init()).toBe(true);
    mockNav.dispatchTraverse(DEST, { spf: true });
    await mockNav.lastEvent!.run();
    expect(document.getElementById('content')!.innerHTML).toBe('<p>new content</p>');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/dest?spf=navigate'),
      expect.anything(),
    );
  });

  it('leaves non-SPF back/forward navigations to the browser', () => {
    expect(nav.init()).toBe(true);
    mockNav.dispatchTraverse('http://localhost:3000/other', undefined);
    expect(mockNav.lastEvent!.intercepted).toBe(false);
  });
});

describe('prefetch', () => {
  it('stores a prefetch-eligible response and primes resources', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          head: '<script src="/app.js"></script><link rel="stylesheet" href="/app.css">',
          body: { content: '<p>x</p>' },
        }),
      ),
    );
    expect(nav.init()).toBe(true);

    await nav.prefetch(DEST);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/dest?spf=prefetch'),
      expect.anything(),
    );
    // prefetched responses are usable by one new navigation
    expect(cache.get(DEST, 'new')).not.toBeNull();
    // resources primed in the browser cache
    const links = [...document.head.querySelectorAll('link')].map((l) => `${l.rel}:${l.href}`);
    expect(links).toContain('modulepreload:http://localhost:3000/app.js');
    expect(links).toContain('preload:http://localhost:3000/app.css');
  });

  it('is aborted when spfrequest is cancelled', async () => {
    expect(nav.init()).toBe(true);
    event.on('spfrequest', () => false);
    const result = await nav.prefetch(DEST);
    expect(result).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('init/dispose', () => {
  it('returns false without the Navigation API', () => {
    Object.defineProperty(window, 'navigation', {
      value: undefined,
      configurable: true,
    });
    expect(nav.init()).toBe(false);
  });

  it('removes listeners on dispose', () => {
    expect(nav.init()).toBe(true);
    nav.dispose();
    document.body.innerHTML = '<a class="spf-link" href="/dest">Go</a>';
    document
      .querySelector('a')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }));
    expect(mockNav.lastEvent).toBeNull();
  });
});
