/**
 * Hono demo of the modern-spf wire protocol (docs/protocol.md).
 *
 * Every page route answers both full-page and SPF requests: the SPF URL
 * identifier (?spf=navigate|prefetch|load) yields a single JSON object, or an
 * NDJSON stream for /stream. The demo also exercises the rest of the library:
 * caching hints, head/foot installation, failure semantics (reload/redirect/
 * 404) and POST forms.
 */

import { existsSync, readFileSync } from 'node:fs';
import { ReadableStream } from 'node:stream/web';
import { Hono } from 'hono';

import type { Context } from 'hono';
import { PAGE_NAMES, PAGES, escapeHtml, layout } from './pages.ts';

import type { DemoPage, PageName } from './pages.ts';

const app = new Hono();

/** A single (non-streamed) SPF response; all fields optional. */
interface SpfResponse {
  title?: string;
  body?: Record<string, string>;
  head?: string;
  foot?: string;
  attr?: Record<string, Record<string, string>>;
  cacheKey?: string;
  reload?: boolean;
  redirect?: string;
}

/** Full pages for the failure fallback demo (not part of the SPF nav). */
const FAILURE_PAGES = {
  'failure-reload': {
    title: 'Failure — reload',
    content:
      '<h1>Reload fallback</h1><p id="text">The SPF response for this page says <code>reload: true</code> — the client fired <code>spferror</code>/<code>spfreload</code> and fell back to a full navigation.</p>',
    fragment: '<p id="text">Reload via SPF</p>',
  },
  'failure-redirect': {
    title: 'Failure — redirect',
    content:
      '<h1>Redirect fallback</h1><p id="text">The SPF response for this page says <code>redirect: "/about"</code> — the client fell back to a full navigation to /about.</p>',
    fragment: '<p id="text">Redirect via SPF</p>',
  },
} satisfies Record<string, DemoPage>;

// — static assets —

app.get('/modern-spf.js', (c) =>
  serveFile(
    c,
    new URL('../../../dist/index.iife.js', import.meta.url),
    'text/javascript; charset=utf-8',
    'modern-spf not built — run `pnpm build` in the repo root first.',
  ),
);
app.get('/demo.js', (c) =>
  serveFile(c, new URL('../static/demo.js', import.meta.url), 'text/javascript; charset=utf-8'),
);
app.get('/demo-widget.js', (c) =>
  serveFile(
    c,
    new URL('../static/demo-widget.js', import.meta.url),
    'text/javascript; charset=utf-8',
  ),
);
app.get('/demo-theme.css', (c) =>
  serveFile(c, new URL('../static/demo-theme.css', import.meta.url), 'text/css; charset=utf-8'),
);

// — demo pages —

app.get('/', (c) => pageHandler(c, 'home'));

for (const name of PAGE_NAMES) {
  app.get(`/${name}`, (c: Context) => pageHandler(c, name));
}

app.post('/forms/submit', (c) => formsPostResponse(c));
app.get('/failure-reload', (c) => failureHandler(c, 'failure-reload'));
app.get('/failure-redirect', (c) => failureHandler(c, 'failure-redirect'));

app.notFound((c) => {
  const notice =
    c.req.query('spf') === 'full'
      ? '<p><strong>Full-load fallback:</strong> the SPF request for this URL failed (404) and the client fell back to a full navigation.</p>'
      : '';
  return c.html(
    layout('Not found', `<h1>404</h1><p id="text">This page does not exist.</p>${notice}`),
    404,
  );
});

// — protocol handlers —

/** The SPF URL identifier values (__type__ in ?spf=__type__). */
function isSpfRequest(c: Context): boolean {
  const spf = c.req.query('spf');
  return spf === 'navigate' || spf === 'prefetch' || spf === 'load';
}

async function pageHandler(c: Context, page: PageName): Promise<Response> {
  if (isSpfRequest(c)) {
    if (page === 'stream') return streamResponse();
    return jsonResponse(spfData(page));
  }
  return c.html(fullPageWithNotice(c, PAGES[page]));
}

function failureHandler(c: Context, name: 'failure-reload' | 'failure-redirect'): Response {
  if (isSpfRequest(c)) {
    return name === 'failure-reload'
      ? jsonResponse({ reload: true })
      : jsonResponse({ redirect: '/about' });
  }
  return c.html(fullPageWithNotice(c, FAILURE_PAGES[name]));
}

/** Single JSON response: application/x-spf+json, body = {elementId: html}. */
function jsonResponse(data: SpfResponse): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/x-spf+json' },
  });
}

/** Per-page SPF data, with feature-specific extra fields. */
function spfData(page: PageName): SpfResponse {
  const demo: DemoPage = PAGES[page];
  const data: SpfResponse = {
    title: `${demo.title} — SPF`,
    body: { content: demo.fragment ?? demo.content },
  };

  if (page === 'navigation') {
    data.attr = { content: { 'data-navigated': 'yes' } };
  }
  if (page === 'caching') {
    data.cacheKey = 'caching-demo';
  }
  if (page === 'resources') {
    data.head = '<style>#footcount { font-weight: bold; }</style>';
    data.foot =
      '<script>window.__spfFootCount = (window.__spfFootCount || 0) + 1; ' +
      'var el = document.getElementById("footcount"); ' +
      'if (el) el.textContent = "unmanaged classic script executed " + window.__spfFootCount + " time(s)";</script>';
  }

  return data;
}

/** POST /forms: echoes the submitted field (escaped) in the SPF fragment. */
async function formsPostResponse(c: Context): Promise<Response> {
  const form = await c.req.formData();
  const name = escapeHtml(String(form.get('name') ?? ''));
  return jsonResponse({
    title: 'Forms — SPF',
    body: { content: `<p id="text">Hello, ${name} — submitted via an SPF POST.</p>` },
  });
}

/** NDJSON stream parts, one per line, terminated by a done part. */
const STREAM_PARTS = [
  { part: 'title', value: 'Stream — SPF' },
  { part: 'url', value: '/stream' },
  { part: 'head', html: '<style>.streamed { color: green; }</style>' },
  { part: 'attr', id: 'content', attrs: { 'data-streamed': 'yes' } },
  {
    part: 'body',
    id: 'content',
    html: PAGES.stream.content,
  },
  {
    part: 'foot',
    html:
      '<script>var el = document.getElementById("streamfoot"); ' +
      'if (el) el.textContent = "foot executed (classic script ran after the body was applied)";</script>',
  },
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

/** Full pages: renders a page, adding a fallback notice for ?spf=full. */
function fullPageWithNotice(c: Context, page: DemoPage): string {
  const notice =
    c.req.query('spf') === 'full'
      ? '<p><strong>Full-load fallback:</strong> this page was reached through the SPF reload fallback (reload-identifier).</p>'
      : '';
  return layout(page.title, notice + page.content);
}

/** Serves a static file from disk (used for the built library and demo assets). */
function serveFile(c: Context, url: URL, contentType: string, missingMessage?: string): Response {
  if (!existsSync(url)) {
    return c.text(missingMessage ?? 'file not found — build it first.', 500);
  }
  return new Response(readFileSync(url), {
    status: 200,
    headers: { 'content-type': contentType },
  });
}

export { app };
