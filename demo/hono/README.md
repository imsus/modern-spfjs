# Hono demo

A [Hono](https://hono.dev) (Node) app demonstrating **every feature of
`modern-spf`** — the wire protocol ([`docs/protocol.md`](../../docs/protocol.md))
plus caching, resources, prefetch, view transitions, events and failure
semantics.

The app runs TypeScript directly on Node (no build step): Node 24+ strips
types natively, so the source is run as-is.

## Feature tour

Every page is reachable through the `spf-link` nav — each click fetches only
`?spf=navigate` and swaps the fragment in, never a full page load. An
**event log** at the bottom of every page shows the `spf*` events live.

| Page           | Demonstrates                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/navigation`  | `spf-link` clicks, `spf-nolink` (full load), `spf.navigate` / `spf.load` / `spf.process`, `attr` updates                                                                           |
| `/stream`      | `application/x-spf+ndjson` — 7 parts written 120&nbsp;ms apart, `spfpartprocess`/`spfpartdone` firing as parts arrive, `attr` + `foot` (classic script) parts                      |
| `/caching`     | back/forward restore from cache (`spfhistory`, no new request), live cache size, `cache-unified` toggle, `cacheKey` hint                                                           |
| `/resources`   | managed script (`spf.script.load` via the page import map), managed style (`spf.style.load`, constructable stylesheet), unmanaged classic scripts in `foot`                        |
| `/prefetch`    | `spf.prefetch` (one-shot cache entry), viewport prefetch, speculation-rules support status                                                                                         |
| `/transitions` | default-on view transitions, `spf-no-transition`, `spf.navigate(…, { noTransition: true })`, `prefers-reduced-motion`                                                              |
| `/events`      | the full `spf*` event reference, logged live                                                                                                                                       |
| `/forms`       | SPF `POST` via `spf.navigate(action, { method: 'POST', postData })` (the submit URL is deliberately not prefetched so the POST always reaches the server)                          |
| `/failure`     | `reload: true`, `redirect`, and 404 fallbacks — `spferror`/`spfreload` then a full navigation carrying `?spf=full` (the `reload-identifier`), which the server marks with a notice |

The server responses carry feature-specific fields: `attr` (navigation),
`cacheKey` (caching), `head` + `foot` with an unmanaged classic script
(resources), and the NDJSON stream (stream).

## Prerequisites

- Node >= 24 (native TypeScript execution)
- the library built at the repo root: `pnpm build`

## Setup

The demo is a pnpm workspace member — dependencies are installed with the
root:

```sh
pnpm install
```

## Run

```sh
pnpm --filter modern-spf-demo-hono dev   # http://127.0.0.1:3000
```

## Tests

```sh
pnpm --filter modern-spf-demo-hono test
pnpm --filter modern-spf-demo-hono typecheck
```

The tests exercise the Hono app in-process (`app.request`): full pages carry
the SPF markup, `?spf=` requests return the single JSON object (all three
identifier values), the stream returns the NDJSON parts terminated by `done`,
and the special responses are covered — `attr`, `cacheKey`, `head`/`foot`,
`reload: true`, `redirect`, 404, the `?spf=full` fallback notice, and the
escaped POST echo.
