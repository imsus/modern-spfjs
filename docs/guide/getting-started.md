# Getting started

**modern-spf** is a lightweight, zero-dependency, framework-agnostic library for
fast same-origin navigation. It re-creates YouTube's
[SPF](https://github.com/youtube/spfjs) — "Structured Page Fragments"
([original docs](https://youtube.github.io/spfjs/)) — on modern browser
primitives: clicking a link marked `spf-link` fetches only the
changed fragments of the page (as JSON) and swaps them in, instead of loading
the whole page.

## Browser requirements

Evergreen browsers only — no polyfills. The key primitive is the
[Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
(Baseline: January 2026). View transitions, constructable stylesheets,
speculation rules and the Cache API are used when available, with graceful
degradation when a specific feature is missing.

## Install

```sh
npm install @imsus/modern-spf
```

### Script tag (IIFE build)

```html
<script src="node_modules/modern-spf/dist/index.iife.js"></script>
<a class="spf-link" href="/destination">Go!</a>
<script>
  spf.init();
</script>
```

The IIFE build exposes the `spf` global.

### ES module

```js
import { init, navigate } from '@imsus/modern-spf';

init();

document.querySelector('#next').addEventListener('click', () => {
  navigate('/destination');
});
```

## Minimal server contract

An SPF request is a same-origin request marked with the URL identifier
(`?spf=navigate` by default) plus an `Accept` header. The server answers with
either:

- a **single JSON object** — `{ "title": …, "body": { "content": "<p>…</p>" }, … }`
- an **NDJSON stream** of parts, terminated by a `done` part.

See [the wire protocol](/protocol) for the full contract, and the
[Multipart responses](/guide/streaming) guide for the stream format.

## Quick tour

```html
<a class="spf-link" href="/about">About</a>
<a class="spf-link spf-no-transition" href="/blog">Blog (no view transition)</a>
<a class="spf-nolink" href="/account">Account (full page load)</a>
```

```js
spf.init({
  'link-class': 'spf-link',
  'prefetch-viewport': true, // prefetch spf-links as they enter the viewport
});
```

## Run the demo

Reference implementations of the protocol ship with the repo — the
[Hono demo](https://github.com/imsus/modern-spfjs/tree/main/demo/hono) (TS
run natively on Node) tours every feature, and the
[Laravel demo](https://github.com/imsus/modern-spfjs/tree/main/demo/laravel)
shows a PHP server. Run the Hono one:

```sh
pnpm install
pnpm --filter modern-spf-demo-hono dev   # http://127.0.0.1:3000
```

## Development

The project uses the **Vite+** toolchain (`vp`) with **pnpm** and
**TypeScript 7**:

```sh
pnpm install
pnpm dev          # vite dev server
pnpm test         # vp test run (Vitest)
pnpm typecheck    # tsc --noEmit (TypeScript 7)
pnpm check        # vp check — format + lint + typecheck
pnpm build        # vp pack — ESM + CJS + IIFE (global `spf`) + .d.ts via TS7
pnpm docs:dev     # vitepress dev server
pnpm docs:build   # build this site
pnpm check:publish  # build + publint + arethetypeswrong
```
