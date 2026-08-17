# Prefetch

Prefetching fetches a navigation's response (and primes its resources) _before_
the user actually navigates, so the later navigation can be served from cache
instantly.

## Ways to prefetch

1. **`spf.prefetch(url)`** — programmatic. Fetches the response into the cache
   as a `prefetch` entry and primes the browser cache for its scripts and
   stylesheets. Dispatches `spfrequest` / `spfprocess` / `spfdone` like a
   navigation. Resolves to the response, or `undefined` if cancelled
   (`spfrequest` returning `false` aborts).

2. **Viewport observation** — when `prefetch-viewport` is `true` (default), an
   `IntersectionObserver` watches `spf-link` anchors and prefetches them as
   they enter the viewport (with a 200px root margin). Each link is
   prefetched once.

3. **Speculation rules** — when the browser supports
   [speculation rules](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API)
   (Chrome/Edge), a `speculationrules` script is injected listing the
   same-origin `spf-link` URLs on the page. The strategy is configurable:

   | `speculation`        | Behavior                               |
   | -------------------- | -------------------------------------- |
   | `prefetch` (default) | Browser-level prefetch of listed URLs. |
   | `prerender`          | Opt-in prerendering of listed URLs.    |
   | `none`               | No speculation script.                 |

   The script is refreshed after every navigation (`refreshLinks`) so new page
   content gets coverage.

## Cache semantics

A prefetched response is stored as a **one-shot** entry: it is eligible for
exactly one subsequent _new_ navigation, after which it downgrades to a
history-only entry. This keeps new navigations fresh while still making the
prefetched page instant.

## Resource priming

`spf.prefetch` scans the response's `head`/`foot` HTML and primes the browser
cache for referenced resources without executing them:

- `<script src>` → `modulepreload` (`spf.script.prefetch`);
- `<link rel="stylesheet">` → `preload as=style` (`spf.style.prefetch`).

Use `spf.script.prefetch` / `spf.style.prefetch` directly to prime resources
that are not part of any SPF response.
