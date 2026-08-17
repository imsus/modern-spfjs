import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';

const IIFE_URL = new URL('../../../dist/index.iife.js', import.meta.url);

describe('SPF protocol (hono demo)', () => {
  beforeEach(() => {
    // Instant part delivery: the stream handler reads this per request.
    process.env.SPF_PART_DELAY_MS = '0';
  });

  it('serves full pages with the spf markup', async () => {
    const res = await app.request('/about');

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('spf-link');
    expect(body).toContain('About page content');
  });

  it('responds to ?spf=navigate with a single JSON object', async () => {
    const res = await app.request('/about?spf=navigate');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/x-spf+json');
    expect(await res.json()).toEqual({
      title: 'About — SPF',
      body: { content: '<p id="text">About via SPF</p>' },
    });
  });

  it('accepts the prefetch and load identifiers', async () => {
    for (const type of ['prefetch', 'load']) {
      const res = await app.request(`/about?spf=${type}`);

      expect(res.status).toBe(200);
      // JSON.parse (typed any) instead of res.json() (typed unknown under
      // Node's fetch types) so no cast is needed.
      expect(JSON.parse(await res.text())).toMatchObject({ title: 'About — SPF' });
    }
  });

  it('streams NDJSON parts terminated by a done part', async () => {
    const res = await app.request('/stream?spf=navigate');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/x-spf+ndjson');

    const body = await res.text();
    for (const part of ['title', 'url', 'head', 'attr', 'body', 'foot', 'done']) {
      expect(body).toContain(`"part":"${part}"`);
    }
    expect(body.endsWith('{"part":"done"}\n')).toBe(true);
  });

  it.skipIf(!existsSync(IIFE_URL))('serves the built library when dist exists', async () => {
    const res = await app.request('/modern-spf.js');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
  });
});
