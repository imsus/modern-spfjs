/**
 * Demo page registry and HTML views for the modern-spf Hono demo.
 *
 * Every page has three shapes:
 *  - `title`/`content`: the full page (rendered inside the shared layout);
 *  - `fragment`: the SPF fragment swapped into #content by a navigation.
 *
 * Special pages (reload/redirect) and special response fields (head/foot/
 * attr/cacheKey) are handled in app.ts.
 */

export interface DemoPage {
  /** Full-page <title>. */
  title: string;
  /** Full-page content, rendered inside <main id="content">. */
  content: string;
  /**
   * SPF fragment (innerHTML for #content). Defaults to `content` so feature
   * pages keep their interactive UI after an SPF swap; only demo-only pages
   * (about/plain) ship a distinct stub fragment.
   */
  fragment?: string;
}

export const PAGE_NAMES = [
  'home',
  'about',
  'navigation',
  'stream',
  'caching',
  'resources',
  'prefetch',
  'transitions',
  'events',
  'forms',
  'failure',
  'plain',
] as const;

export type PageName = (typeof PAGE_NAMES)[number];

export const PAGES = {
  home: {
    title: 'Home',
    content: `
      <h1>modern-spf · Hono demo</h1>
      <p>A minimal <a href="https://hono.dev">Hono</a> app demonstrating every
      feature of <code>modern-spf</code> — the wire protocol, caching,
      resources, prefetch, view transitions, events and failure semantics.</p>
      <p>Every navigation below is an <code>spf-link</code> click: only the
      changed fragment is fetched (<code>?spf=navigate</code>) and swapped in,
      never a full page load. Watch the <strong>event log</strong> at the
      bottom of the page and the network tab.</p>
      <ul>
        <li><a class="spf-link" href="/navigation">Navigation</a> — spf-links, spf.navigate / load / process, spf-nolink</li>
        <li><a class="spf-link" href="/stream">Streaming</a> — NDJSON parts arriving incrementally</li>
        <li><a class="spf-link" href="/caching">Caching</a> — back/forward restore, cache-unified, cacheKey</li>
        <li><a class="spf-link" href="/resources">Resources</a> — managed scripts &amp; styles, unmanaged classics</li>
        <li><a class="spf-link" href="/prefetch">Prefetch</a> — viewport, speculation rules, spf.prefetch</li>
        <li><a class="spf-link" href="/transitions">View transitions</a> — default, opt-out, reduced motion</li>
        <li><a class="spf-link" href="/events">Events</a> — the full spf* event reference</li>
        <li><a class="spf-link" href="/forms">Forms</a> — POST navigation</li>
        <li><a class="spf-link" href="/failure">Failure</a> — reload / redirect / error fallbacks</li>
      </ul>`,
  },
  about: {
    title: 'About',
    content:
      '<h1>About</h1><p id="text">About page content — a simple second page for the caching demo (visit it, then press the browser back button).</p>',
    fragment: '<p id="text">About via SPF</p>',
  },
  navigation: {
    title: 'Navigation',
    content: `
      <h1>Navigation</h1>
      <p>Click an <code>spf-link</code> to navigate; the <code>spfclick</code>
      and pipeline events land in the event log. <code>spf-nolink</code>
      forces a full page load.</p>
      <p><a class="spf-link" href="/about">spf-link to /about</a></p>
      <p><a class="spf-nolink" href="/plain">spf-nolink to /plain (full load)</a></p>
      <p>Programmatic API:</p>
      <ul>
        <li><button data-spf-navigate="/about">spf.navigate('/about')</button> — full navigation (pushState)</li>
        <li><button data-spf-load="/about">spf.load('/about')</button> — applies the response without changing the URL</li>
        <li><button data-spf-process="/about">fetch + spf.process()</button> — processes an already-fetched response</li>
      </ul>
      <p>The SPF response for this page also updates an attribute
      (<code>attr</code> → <code>data-navigated="yes"</code> on #content).</p>`,
  },
  stream: {
    title: 'Stream',
    content: `
      <h1>Streaming</h1>
      <p>This page responds with <code>application/x-spf+ndjson</code>: seven
      parts, written 120&nbsp;ms apart, terminated by a <code>done</code>
      part. The client parses each line as it arrives — the
      <code>spfpartprocess</code> / <code>spfpartdone</code> events below fill
      in progressively while the stream is still open.</p>
      <p><a class="spf-link" href="/stream">Navigate here via SPF</a></p>
      <p>The streamed response also carries an <code>attr</code> part
      (<code>data-streamed="yes"</code>) and a <code>foot</code> part with a
      classic script that runs after the body is applied:</p>
      <p id="streamfoot">foot script pending…</p>`,
  },
  caching: {
    title: 'Caching',
    content: `
      <h1>Caching</h1>
      <p>The response cache is hybrid: an in-memory LRU plus the Cache API
      durable tier. A cached response serves <strong>history</strong>
      (back/forward) navigations instantly; new navigations hit the server
      unless the entry was prefetched.</p>
      <p><strong>Try it:</strong> navigate to <a class="spf-link" href="/about">/about</a>,
      then press the browser <em>back</em> button. The back navigation is
      served from cache (<code>spfhistory</code> in the log, no new request).
      The server's SPF response for this page also sends a
      <code>cacheKey</code> hint.</p>
      <p><button id="toggle-unified">cache-unified: false</button>
      — when enabled, cached responses serve all navigations.</p>
      <p>The live cache size is shown in the event log summary below
      (updates as responses are stored).</p>`,
  },
  resources: {
    title: 'Resources',
    content: `
      <h1>Scripts &amp; styles</h1>
      <p><strong>Managed script</strong> (ES module via the page import map,
      loaded once — <code>spf.script.load</code>):</p>
      <p><button id="load-widget">spf.script.load('demo-widget')</button>
      <button id="unload-widget">spf.script.unload('demo-widget')</button></p>
      <p id="widgetout">Widget not loaded yet.</p>
      <p><strong>Managed style</strong> (constructable stylesheet —
      <code>spf.style.load</code>):</p>
      <p><button id="load-style">spf.style.load('/demo-theme.css')</button>
      <button id="unload-style">spf.style.unload('demo-theme')</button></p>
      <p class="theme-demo">This line turns green while the managed stylesheet is loaded.</p>
      <p><strong>Unmanaged classic script</strong>: this page's SPF response
      ships a <code>foot</code> with a classic <code>&lt;script&gt;</code> —
      it executes on every navigation (counts below):</p>
      <p id="footcount">0</p>`,
  },
  prefetch: {
    title: 'Prefetch',
    content: `
      <h1>Prefetch</h1>
      <p><button data-spf-prefetch="/about">spf.prefetch('/about')</button>
      — fetches into the cache as a one-shot <code>prefetch</code> entry, then
      the next <a class="spf-link" href="/about">navigation to /about</a>
      serves from cache.</p>
      <p><code>prefetch-viewport</code> is on: every <code>spf-link</code>
      below is prefetched as it enters the viewport (scroll down).</p>
      <p id="speculation-status">checking speculation rules support…</p>
      <div style="height: 80vh"></div>
      <p><a class="spf-link" href="/caching">Caching (viewport prefetch target)</a></p>
      <p><a class="spf-link" href="/resources">Resources (viewport prefetch target)</a></p>`,
  },
  transitions: {
    title: 'View transitions',
    content: `
      <h1>View transitions</h1>
      <p>Same-document view transitions are on by default; the
      <code>spfdone</code> event reports <code>transitioned</code> (see the
      event log). Reduced motion (<code>prefers-reduced-motion: reduce</code>)
      disables them automatically.</p>
      <p><a class="spf-link" href="/about">Default — transition runs</a></p>
      <p><a class="spf-link spf-no-transition" href="/about">spf-no-transition — no transition</a></p>
      <p><button data-spf-navigate-notransition="/about">spf.navigate('/about', { noTransition: true })</button></p>`,
  },
  events: {
    title: 'Events',
    content: `
      <h1>Events</h1>
      <p>Every <code>spf*</code> event is logged below as it fires. Click
      around the demo and watch <code>spfclick</code> → <code>spfrequest</code>
      → <code>spfprocess</code> → <code>spfdone</code>, the per-part events on
      <a class="spf-link" href="/stream">the streaming page</a>, and
      <code>spfhistory</code> on back/forward.</p>
      <p><a class="spf-link" href="/about">Trigger a navigation</a></p>`,
  },
  forms: {
    title: 'Forms',
    content: `
      <h1>Forms (POST)</h1>
      <p>The wire protocol supports <code>POST</code> with form data and the
      same <code>?spf=navigate</code> identifier. The click delegation handles
      <code>&lt;a&gt;</code> links; for POST the form is submitted
      programmatically via <code>spf.navigate(action, { method: 'POST',
      postData })</code> (wired in <code>demo.js</code>).</p>
      <form id="spf-form" action="/forms/submit" method="post">
        <label>Your name: <input type="text" name="name" value="Ada"></label>
        <button type="submit">Submit via SPF POST</button>
      </form>`,
  },
  failure: {
    title: 'Failure',
    content: `
      <h1>Failure semantics</h1>
      <p>SPF falls back to a full browser navigation on failure, firing
      <code>spferror</code> and <code>spfreload</code> first. The demo config
      sets <code>reload-identifier: 'spf=full'</code>, so fallback URLs carry
      <code>?spf=full</code> — the server renders the landing page with a
      notice.</p>
      <ul>
        <li><a class="spf-link" href="/failure-reload">reload: true</a> — the SPF response demands a full reload</li>
        <li><a class="spf-link" href="/failure-redirect">redirect</a> — the SPF response redirects to /about</li>
        <li><a class="spf-link" href="/missing">missing page</a> — the server 404s; the fetch fails</li>
      </ul>`,
  },
  plain: {
    title: 'Plain',
    content: '<h1>Plain</h1><p id="text">Plain page content (reached via a full page load)</p>',
    fragment: '<p id="text">Plain via SPF</p>',
  },
} satisfies Record<PageName, DemoPage>;

/** Escape HTML special characters (user-supplied values rendered into fragments). */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** The shared layout: nav, the page fragment slot, the event log, demo glue. */
export function layout(title: string, content: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · modern-spf hono demo</title>
  <script type="importmap">
    { "imports": { "demo-widget": "/demo-widget.js" } }
  </script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; }
    nav a { margin-right: 1rem; }
    main { margin-top: 1rem; }
    button { margin-right: 0.5rem; }
    .eventlog { margin-top: 2rem; border-top: 1px solid #ddd; padding-top: 0.5rem; }
    .eventline { font-family: ui-monospace, monospace; font-size: 0.8rem; }
    .theme-demo { color: red; }
    #eventlog { max-height: 16rem; overflow: auto; }
  </style>
</head>
<body>
  <nav>
    <a class="spf-link" href="/">Home</a>
    <a class="spf-link" href="/navigation">Navigation</a>
    <a class="spf-link" href="/stream">Stream</a>
    <a class="spf-link" href="/caching">Caching</a>
    <a class="spf-link" href="/resources">Resources</a>
    <a class="spf-link" href="/prefetch">Prefetch</a>
    <a class="spf-link" href="/transitions">Transitions</a>
    <a class="spf-link" href="/events">Events</a>
    <a class="spf-link" href="/forms">Forms</a>
    <a class="spf-link" href="/failure">Failure</a>
    <a class="spf-nolink" href="/plain">Plain</a>
  </nav>
  <main id="content">${content}</main>
  <details class="eventlog" open>
    <summary>Event log (spf* events) · cache: <span id="cachesize">0</span> entries</summary>
    <div id="eventlog"></div>
  </details>
  <script src="/modern-spf.js"></script>
  <script src="/demo.js"></script>
</body>
</html>`;
}

/** Renders a full page for a demo page. */
export function fullPage(page: DemoPage): string {
  return layout(page.title, page.content);
}
