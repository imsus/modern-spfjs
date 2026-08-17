// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { event } from '../events';
import type { SpfEventDetail } from '../types';

afterEach(() => {
  event.clear();
});

describe('event', () => {
  it('awaits async handlers before resolving', async () => {
    const order: string[] = [];
    event.on('spfrequest', async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push('handler');
    });
    const promise = event.emit('spfrequest', { url: '/x' });
    order.push('after-emit-start');
    await promise;
    expect(order).toEqual(['after-emit-start', 'handler']);
  });

  it('cancels when a handler returns false', async () => {
    let externalFired = false;
    event.on('spfrequest', () => false);
    document.addEventListener('spfrequest', () => {
      externalFired = true;
    });
    const result = await event.emit('spfrequest', { url: '/x' });
    expect(result).toBe(false);
    expect(externalFired).toBe(false);
  });

  it('dispatches a CustomEvent on document for external listeners', async () => {
    let detail: SpfEventDetail | null = null;
    document.addEventListener('spfrequest', (e) => {
      // SAFETY: SPF dispatches its events as CustomEvents with an SpfEventDetail.
      detail = (e as CustomEvent<SpfEventDetail>).detail;
    });
    await event.emit('spfrequest', { url: '/y' });
    expect(detail).toEqual({ url: '/y' });
  });

  it('cancels when an external listener calls preventDefault', async () => {
    document.addEventListener('spfclick', (e) => e.preventDefault());
    const result = await event.emit('spfclick', {});
    expect(result).toBe(false);
  });

  it('off removes a handler', async () => {
    let calls = 0;
    const fn = () => {
      calls += 1;
    };
    event.on('spfdone', fn);
    event.off('spfdone', fn);
    await event.emit('spfdone', {});
    expect(calls).toBe(0);
  });
});
