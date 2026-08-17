# Hono demo

A minimal [Hono](https://hono.dev) (Node) app demonstrating the `modern-spf`
protocol ([`docs/protocol.md`](../../docs/protocol.md)):

- every page route detects the SPF URL identifier (`?spf=navigate|prefetch|load`)
  and responds with a **single `application/x-spf+json` object**;
- `/stream` responds with an **`application/x-spf+ndjson` stream** — one part
  per line, written 120&nbsp;ms apart so the stream is observable, terminated
  by a `done` part;
- the views use `class="spf-link"` for dynamic navigation, with
  `spf-nolink` (force a full load) and `spf-no-transition` (skip the view
  transition) shown in action;
- `/modern-spf.js` serves the library's IIFE build from the repo-root
  `dist/` directory.

The app runs TypeScript directly on Node (no build step): Node 24+ strips
types natively, so the source is run as-is.

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

Open the app, click the `spf-link`s and watch the network tab: each click
sends only a `?spf=navigate` request, and `/stream` arrives as an NDJSON
stream that the client parses part by part. Back/forward navigations between
visited SPF pages are served from the client cache.

## Tests

```sh
pnpm --filter modern-spf-demo-hono test
pnpm --filter modern-spf-demo-hono typecheck
```

The tests exercise the Hono app in-process (`app.request`): full pages carry
the SPF markup, `?spf=` requests return the single JSON object (all three
identifier values), and `/stream` returns the NDJSON parts terminated by
`done`.
