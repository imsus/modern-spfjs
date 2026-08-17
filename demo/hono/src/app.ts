/**
 * Hono demo of the modern-spf wire protocol (docs/protocol.md).
 *
 * Every page route answers both full-page and SPF requests: the SPF URL
 * identifier (?spf=navigate|prefetch|load) yields a single JSON object, or an
 * NDJSON stream for /stream. /modern-spf.js serves the library's IIFE build
 * from the repo-root dist/ directory.
 */

import { existsSync, readFileSync } from 'node:fs';
import { ReadableStream } from 'node:stream/web';
import { Hono } from 'hono';

import type { Context } from 'hono';

const PAGES = ['home', 'about', 'stream', 'plain'] as const;

type PageName = (typeof PAGES)[number];

const app = new Hono();

app.get('/modern-spf.js', scriptHandler);
app.get('/', (c) => pageHandler(c, 'home'));
app.get('/about', (c) => pageHandler(c, 'about'));
app.get('/stream', (c) => pageHandler(c, 'stream'));
app.get('/plain', (c) => pageHandler(c, 'plain'));

/** The SPF URL identifier values (__type__ in ?spf=__type__). */
function isSpfRequest(c: Context): boolean {
  const spf = c.req.query('spf');
  return spf === 'navigate' || spf === 'prefetch' || spf === 'load';
}

function pageHandler(c: Context, page: PageName): Response {
  if (isSpfRequest(c)) {
    if (page === 'stream') return streamResponse();
    return jsonResponse(page);
  }
  return c.html(fullPage(page));
}

/** Single JSON response: application/x-spf+json, body = {elementId: html}. */
function jsonResponse(page: PageName): Response {
  const { title, body } = pageData(page);
  return new Response(JSON.stringify({ title, body: { content: body } }), {
    status: 200,
    headers: { 'content-type': 'application/x-spf+json' },
  });
}

/** SPF response data: the fragment HTML swapped into #content. */
function pageData(page: PageName) {
  switch (page) {
    case 'about':
      return { title: 'About — SPF', body: '<p id="text">About via SPF</p>' };
    case 'plain':
      return { title: 'Plain — SPF', body: '<p id="text">Plain via SPF</p>' };
    case 'stream':
      return { title: 'Stream — SPF', body: '<p id="text" class="streamed">Streamed content</p>' };
    default:
      return { title: 'Home — SPF', body: '<p id="text">Home via SPF</p>' };
  }
}

/** Full-page content (distinct from the SPF fragments). */
function pageContent(page: PageName) {
  switch (page) {
    case 'about':
      return { title: 'About', content: '<h1>About</h1><p id="text">About page content</p>' };
    case 'plain':
      return {
        title: 'Plain',
        content: '<h1>Plain</h1><p id="text">Plain page content (reached via a full page load)</p>',
      };
    case 'stream':
      return { title: 'Stream', content: '<h1>Stream</h1><p id="text">Stream page content</p>' };
    default:
      return { title: 'Home', content: '<h1>Home</h1><p id="text">Home page content</p>' };
  }
}

/** NDJSON stream parts, one per line, terminated by a done part. */
const STREAM_PARTS = [
  { part: 'title', value: 'Stream — SPF' },
  { part: 'url', value: '/stream' },
  { part: 'head', html: '<style>.streamed { color: green; }</style>' },
  { part: 'attr', id: 'content', attrs: { 'data-streamed': 'yes' } },
  { part: 'body', id: 'content', html: '<p id="text" class="streamed">Streamed content</p>' },
  { part: 'foot', html: '' },
  { part: 'done' },
] as const;

/** NDJSON stream: application/x-spf+ndjson, parts written 120ms apart. */
function streamResponse(): Response {
  // Tests set this to 0 so part delivery is instant.
  const delay = Math.max(0, Number(process.env.SPF_PART_DELAY_MS ?? 120));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      for (const part of STREAM_PARTS) {
        controller.enqueue(encoder.encode(`${JSON.stringify(part)}\n`));
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'application/x-spf+ndjson' },
  });
}

/** Full pages: the same #content fragment structure the SPF responses swap in. */
function fullPage(page: PageName): string {
  const { title, content } = pageContent(page);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script src="/modern-spf.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
    nav a { margin-right: 1rem; }
    main { margin-top: 1rem; }
  </style>
</head>
<body>
  <nav>
    <a class="spf-link" href="/">Home</a>
    <a class="spf-link" href="/about">About</a>
    <a class="spf-link" href="/stream">Stream</a>
    <a class="spf-link spf-no-transition" href="/about">About (no transition)</a>
    <a class="spf-nolink" href="/plain">Plain (full load)</a>
  </nav>
  <main id="content">${content}</main>
  <script>
    // Viewport prefetch and speculation rules are on by default; the demo
    // keeps them on so prefetching is observable in the network tab.
    spf.init({ speculation: 'prefetch' });
  </script>
</body>
</html>`;
}

/** Serves the library's IIFE build from the repo-root dist/ directory. */
function scriptHandler(c: Context): Response {
  const iife = new URL('../../../dist/index.iife.js', import.meta.url);

  if (!existsSync(iife)) {
    return c.text('modern-spf not built — run `pnpm build` in the repo root first.', 500);
  }

  return new Response(readFileSync(iife), {
    status: 200,
    headers: { 'content-type': 'text/javascript; charset=utf-8' },
  });
}

export { app };
