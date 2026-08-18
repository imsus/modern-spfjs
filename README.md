<div align="center">
    <h1>modern-spf</h1>
</div>

<p align="center">
    <a href="https://github.com/imsus/modern-spfjs/actions"><img src="https://img.shields.io/github/actions/workflow/status/imsus/modern-spfjs/ci.yml?branch=main&label=CI&style=flat-square" alt="CI"></a>
    <a href="https://github.com/imsus/modern-spfjs/blob/main/LICENSE"><img src="https://img.shields.io/github/license/imsus/modern-spfjs?style=flat-square" alt="License"></a>
    <a href="https://github.com/imsus/modern-spfjs"><img src="https://img.shields.io/github/languages/top/imsus/modern-spfjs?style=flat-square" alt="TypeScript"></a>
    <a href="https://github.com/imsus/modern-spfjs/commits/main"><img src="https://img.shields.io/github/last-commit/imsus/modern-spfjs/main?style=flat-square" alt="Last commit"></a>
</p>

A modern re-creation of YouTube's
[**SPF**](https://github.com/youtube/spfjs) ("Structured Page Fragments") — a
lightweight, zero-dependency, framework-agnostic library for fast same-origin
navigation: clicking an `spf-link` fetches only the fragments that change
(JSON), never the whole page. Built on 2026 browser technology — the
**Navigation API** (Baseline January 2026), view transitions, streaming
responses, speculation rules, ES modules and the Cache API. Evergreen
browsers only, no polyfills.

## Requirements

- A browser with the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) — latest + 1–2 of Chrome/Edge/Firefox/Safari
- Zero runtime dependencies, zero polyfills

## Installation

```sh
npm install @imsus/modern-spf
```

Script tag (IIFE build, global `spf`):

```html
<script src="node_modules/modern-spf/dist/index.iife.js"></script>
<a class="spf-link" href="/destination">Go!</a>
<script>
  spf.init();
</script>
```

ES module:

```js
import { init, navigate } from '@imsus/modern-spf';

init();
navigate('/destination');
```

## Quick Start

The server detects the SPF URL identifier (`?spf=navigate`, configurable) and
responds with either a **single JSON object** or an **NDJSON stream** of
parts (see the [wire protocol](docs/protocol.md)). The client swaps only the
changed fragments into the page:

```
click .spf-link
  → spfclick → spfrequest
  → cache lookup → fetch (single JSON or NDJSON stream)
  → spfprocess → apply: title → url → head → attr → body → foot
  → spfdone
```

Every step is cancellable and observable through Promise-aware `spf*` events
(`spfrequest`, `spfprocess`, `spfdone`, `spfpartprocess`, `spfpartdone`, …):

```js
spf.event.on('spfdone', ({ url, transitioned }) => {
  console.log('navigated to', url, 'transitioned:', transitioned);
});
```

Back/forward navigations to visited SPF pages are restored **from cache** —
an in-memory LRU plus the Cache API durable tier — with no network request.
View transitions wrap the swap by default (`prefers-reduced-motion` and
`spf-no-transition` respected), and failures fall back to a full browser
navigation (`spferror`/`spfreload`).

## Features

- **Fragment-only navigation** — `spf.init/navigate/load/process/prefetch`, concept-compatible with SPF
- **Streaming** — NDJSON parts, processed event-wise as they arrive
- **Hybrid response cache** — in-memory LRU + Cache API; new/history eligibility split
- **ESM-native resources** — `spf.script` (import-map driven) and `spf.style` (constructable stylesheets)
- **Prefetch** — `spf.prefetch`, in-viewport observation, speculation rules (prefetch/prerender)
- **View transitions** — default-on, reduced-motion aware, per-link opt-out

## Server protocol

The wire contract is language-agnostic: `?spf=navigate|prefetch|load` plus
`Accept: application/x-spf+json, application/x-spf+ndjson;q=0.9`. See
[`docs/protocol.md`](docs/protocol.md) for the request/response shapes,
streaming parts, caching hints and failure semantics. Working implementations
ship with the repo as demos.

## Documentation

- **Docs site** — [https://imsus.github.io/modern-spfjs/](https://imsus.github.io/modern-spfjs/) (Vitepress: guides + hand-maintained API reference)
- `docs/protocol.md` — the wire protocol
- `docs/design.md` — the agreed design (shared-understanding record)
- `docs/adr/` — architecture decision records
- `docs/glossary.md` — the domain glossary

## Demos

| Demo                                     | Stack                        | What it shows                                                                                                         |
| ---------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [`demo/hono`](demo/hono/README.md)       | Hono (Node), TS run natively | Full feature tour: navigation, streaming, caching, resources, prefetch, transitions, events, forms, failure fallbacks |
| [`demo/laravel`](demo/laravel/README.md) | Laravel (PHP)                | Single JSON + NDJSON streaming responses, `spf-link` views                                                            |

## Development

The project uses the **Vite+** toolchain (`vp`) with **pnpm** and
**TypeScript 7** (the native compiler):

```sh
pnpm install
pnpm check          # vp check — format + lint + typecheck
pnpm test           # unit tests (Vitest)
pnpm test:e2e       # Playwright E2E (8 specs)
pnpm build          # vp pack — ESM + CJS + IIFE (global `spf`) + .d.ts via TS7
pnpm docs:dev       # vitepress dev server
pnpm check:publish  # build + publint + arethetypeswrong (packaged-output checks)
```

CI runs check, unit tests, the library and docs builds, publish checks and
the Playwright suite on every push; `semantic-release` publishes on main when
conventional commits land.

## Acknowledgements

A modern re-creation of **SPFJS** ("Structured Page Fragments"), originally
built by YouTube and open-sourced by Google:

- [github.com/youtube/spfjs](https://github.com/youtube/spfjs)
- [youtube.github.io/spfjs](https://youtube.github.io/spfjs/)

The `?spf=` identifier, JSON field names, `spf*` event names and the
`spf-link` class are inherited from the original for concept compatibility
(see [ADR 0001](docs/adr/0001-concept-compatible-not-dropin.md)).

## License

MIT — see [LICENSE](LICENSE).
