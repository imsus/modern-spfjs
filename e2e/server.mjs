/**
 * E2E harness server for modern-spf.
 *
 * A zero-dependency Node HTTP server serving a small SPF test app and
 * implementing the wire protocol from docs/protocol.md:
 *   - full HTML pages for normal navigations,
 *   - single JSON responses (`application/x-spf+json`) for `?spf=…`,
 *   - NDJSON streaming responses (`application/x-spf+ndjson`) for `/stream`.
 *
 * The library IIFE build is served from dist/index.iife.js (run `pnpm build`
 * first; the `test:e2e` script does this automatically).
 *
 * Test bookkeeping endpoints:
 *   /__ready  — health check for Playwright's webServer
 *   /__counts — JSON map of SPF request counts by path
 *   /__reset  — resets the counters
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = Number(process.env.PORT ?? 4173);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const iifePath = join(root, 'dist', 'index.iife.js');
const iife = existsSync(iifePath) ? readFileSync(iifePath) : null;

/** SPF request counts by path (tests assert cache restore via deltas). */
const counts = new Map();

function count(path) {
  counts.set(path, (counts.get(path) ?? 0) + 1);
}

function spfRequest(url) {
  const spf = url.searchParams.get('spf');
  return spf === 'navigate' || spf === 'prefetch' || spf === 'load';
}

function pageHtml({ title, body, extra = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <script src="/modern-spf.js"></script>
  ${extra}
</head>
<body>
  <nav>
    <a class="spf-link" href="/" id="link-home">Home</a>
    <a class="spf-link" href="/about" id="link-about">About</a>
    <a class="spf-link" href="/stream" id="link-stream">Stream</a>
    <a class="spf-link spf-no-transition" href="/about" id="link-notransition">About (no transition)</a>
  </nav>
  <main id="content">${body}</main>
  <script>
    // Harness init: viewport prefetch and speculation rules are disabled so
    // tests are deterministic (a prefetch's late spfdone/part events would
    // race the assertions). Prefetch itself is out of E2E scope.
    spf.init({ 'prefetch-viewport': false, speculation: 'none' });
    window.__loads = (window.__loads ?? 0) + 1;
    window.__parts = [];
    window.__lastTransitioned = undefined;
    spf.event.on('spfpartdone', (detail) => {
      window.__parts.push({ part: detail.part.part, t: performance.now() });
    });
    spf.event.on('spfdone', (detail) => {
      window.__lastTransitioned = detail.transitioned;
    });
    spf.init();
  </script>
</body>
</html>`;
}

const PAGES = {
  '/': {
    title: 'Home',
    body: '<p id="text">Home page content</p>',
  },
  '/about': {
    title: 'About',
    body: '<p id="text">About page content</p>',
  },
  '/stream': {
    title: 'Stream',
    body: '<p id="text">Stream page content</p>',
  },
};

function sendJson(res, body) {
  res.writeHead(200, { 'content-type': 'application/x-spf+json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendPage(res, path) {
  const page = PAGES[path];
  if (!page) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(pageHtml(page));
}

/** Single JSON response for / and /about. */
function spfJson(path) {
  if (path === '/about') {
    return {
      title: 'About — SPF',
      body: { content: '<p id="text">About via SPF</p>' },
    };
  }
  return {
    title: 'Home — SPF',
    body: { content: '<p id="text">Home via SPF</p>' },
  };
}

/**
 * NDJSON stream for /stream: parts written incrementally (120ms apart) so
 * tests can observe parts arriving over time, terminated by a `done` part.
 */
function streamResponse(res) {
  res.writeHead(200, { 'content-type': 'application/x-spf+ndjson; charset=utf-8' });
  const parts = [
    { part: 'title', value: 'Stream — SPF' },
    { part: 'url', value: '/stream' },
    { part: 'head', html: '<style>.streamed { color: green; }</style>' },
    { part: 'attr', id: 'content', attrs: { 'data-streamed': 'yes' } },
    { part: 'body', id: 'content', html: '<p id="text" class="streamed">Streamed content</p>' },
    { part: 'foot', html: '' },
    { part: 'done' },
  ];
  let i = 0;
  const writeNext = () => {
    if (i >= parts.length) {
      res.end();
      return;
    }
    // SAFETY: parts are plain JSON values produced above; the current index
    // is always in range while i < parts.length.
    const part = parts[i];
    i += 1;
    res.write(`${JSON.stringify(part)}\n`);
    setTimeout(writeNext, 120);
  };
  writeNext();
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === '/__ready') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (path === '/__counts') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(Object.fromEntries(counts)));
    return;
  }
  if (path === '/__reset') {
    counts.clear();
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (path === '/modern-spf.js') {
    if (!iife) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('dist/index.iife.js missing — run pnpm build first');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/javascript' });
    res.end(iife);
    return;
  }

  if (spfRequest(url)) {
    count(path);
    if (path === '/stream') {
      streamResponse(res);
    } else {
      sendJson(res, spfJson(path));
    }
    return;
  }

  sendPage(res, path);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`modern-spf e2e server on http://127.0.0.1:${PORT}`);
});
