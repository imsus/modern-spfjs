# Navigation

SPF navigation is a pipeline driven by the
[Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API).
This page describes what happens from a click to the updated page.

## The pipeline

A navigation runs this sequence (the same order SPF used, modernized):

```text
click .spf-link
  → spfclick (cancelable)
  → window.navigation.navigate(url, { history: 'push', state: { spf: true } })
  → navigate event intercepted
  → spfrequest (cancelable)
  → cache lookup (in-memory → durable Cache API)
  → fetch (single JSON or NDJSON stream)        [see Streaming]
  → spfprocess (cancelable)
  → apply: title → url → head → attr → body → foot
  → spfdone
```

- **Click handling** — left-clicks without modifier keys on an `spf-link`
  anchor or form are intercepted; `spf-nolink` descendants opt out. The
  `spfclick` event is dispatched synchronously on `document` — cancel it with
  `preventDefault()` (or return `false` from a handler registered with
  `document.addEventListener`) to let the browser navigate normally.
- **Interception** — the `navigate` event is intercepted only for
  same-origin destinations that match the pending intent. Everything else is
  left to the browser.
- **Events** — the pipeline events (`spfrequest`, `spfprocess`, `spfdone`,
  `spferror`, `spfpartprocess`, `spfpartdone`) are Promise-aware: handlers
  registered with `spf.event.on(name, fn)` run before the `document`
  CustomEvent of the same name, may be async, and are awaited in order;
  returning `false` cancels the step and falls back to a full browser
  navigation. The click-time events (`spfclick`, `spfhistory`, `spfready`,
  `spfreload`) are synchronous and skip the registry. See
  [Events](/api/events).

## Processing order

The response is applied in SPF's order: **title → url → head → attr → body →
foot**. `head` and `foot` HTML are installed into `<head>` (scripts execute in
order and block unless `async`); `attr` sets attributes by element ID; `body`
replaces each fragment's content by ID.

## History navigation (back/forward)

Navigations with `navigationType === 'traverse'` to a page we recorded
(`state.spf`) are handled by SPF:

1. `spfhistory` fires (cancelable via the document event);
2. the response is served **from cache** — in-memory first, then the durable
   Cache API tier;
3. on a cache miss the URL is fetched and stored.

This gives instant back/forward to previously visited SPF pages, bfcache-like,
without a network round trip.

Back/forward to an entry **without** SPF state is left to the browser — except
that a _same-document_ destination would otherwise just rewind the URL and
leave the SPF-replaced DOM stale, so SPF cancels the traversal and forces a
full load of that URL instead (through the standard `spfreload` fallback).
Cross-document destinations load the real page themselves.

## Programmatic navigation

| Call                    | Effect                                                              |
| ----------------------- | ------------------------------------------------------------------- |
| `spf.navigate(url)`     | Full SPF navigation; pushes a history entry. Resolves when settled. |
| `spf.load(url)`         | Fetches and applies a response **without** a URL change.            |
| `spf.process(response)` | Applies an already-fetched response to the current page.            |
| `spf.prefetch(url)`     | Fetches into the cache for a later navigation; no DOM changes.      |

All return Promises and accept a `RequestOptions` object (see
[Types](/api/types)).

## Failure semantics

If the request fails, the response says `reload: true`, or a handler cancels
the pipeline, SPF **falls back to a full browser navigation**:

- `spferror` fires with the error (when there is one);
- `spfreload` fires with the target URL;
- `location.assign(target)` performs the full navigation.

If `reload-identifier` is configured (e.g. `?spf=full`), the reason parameter
is appended to the fallback URL so the server can distinguish full loads from
SPF requests.

> **Note:** `response.redirect` also falls back to a full navigation to the
> redirect target — the client intentionally does not follow redirects itself.
