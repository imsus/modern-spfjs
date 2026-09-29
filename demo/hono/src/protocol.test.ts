import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

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

  it('ships an attr update on the navigation page response', async () => {
    const res = await app.request('/navigation?spf=navigate');

    expect(JSON.parse(await res.text())).toMatchObject({
      attr: { content: { 'data-navigated': 'yes' } },
    });
  });

  it('ships a cacheKey hint on the caching page response', async () => {
    const res = await app.request('/caching?spf=navigate');

    expect(JSON.parse(await res.text())).toMatchObject({ cacheKey: 'caching-demo' });
  });

  it('ships head and foot (classic script) on the resources page response', async () => {
    const res = await app.request('/resources?spf=navigate');

    const data = JSON.parse(await res.text());
    expect(data.head).toContain('<style>');
    expect(data.foot).toContain('<script>');
    expect(data.foot).toContain('__spfFootCount');
  });

  it('returns reload:true for /failure-reload SPF requests', async () => {
    const res = await app.request('/failure-reload?spf=navigate');

    expect(await res.json()).toEqual({ reload: true });
  });

  it('returns a redirect for /failure-redirect SPF requests', async () => {
    const res = await app.request('/failure-redirect?spf=navigate');

    expect(await res.json()).toEqual({ redirect: '/about' });
  });

  it('404s for unknown pages', async () => {
    const res = await app.request('/missing?spf=navigate');

    expect(res.status).toBe(404);
  });

  it('marks full-load fallbacks via the reload identifier', async () => {
    const res = await app.request('/about?spf=full');

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Full-load fallback');
  });

  it('echoes (escaped) posted form data for POST /forms', async () => {
    const form = new FormData();
    form.set('name', '<Ada>');

    const res = await app.request('/forms/submit?spf=navigate', { method: 'POST', body: form });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/x-spf+json');
    const body = await res.text();
    expect(body).toContain('&lt;Ada&gt;');
    expect(body).not.toContain('<Ada>');
  });

  it('serves the demo assets', async () => {
    for (const [path, type] of [
      ['/demo.js', 'text/javascript; charset=utf-8'],
      ['/demo-widget.js', 'text/javascript; charset=utf-8'],
      ['/demo-theme.css', 'text/css; charset=utf-8'],
    ]) {
      const res = await app.request(path);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe(type);
    }
  });

  it.skipIf(!existsSync(IIFE_URL))('serves the built library when dist exists', async () => {
    const res = await app.request('/modern-spf.js');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
  });
});
