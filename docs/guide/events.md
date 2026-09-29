# Events

Handle SPF events and the navigation life cycle.

SPF is designed to give developers enough flexibility during navigation to
both control application logic and provide UI updates for things like
progress bars. It dispatches `spf*` events at each step of a navigation.

## Navigation life cycle

A navigation runs the pipeline in this order (entry point in brackets):

```text
api|navigate   dom|click     history|traverse    prefetch
     |             |               |                |
     |        [ spfclick ]   [ spfhistory ]         |
     +-------------+---------------+----------------+
                   |
            [ spfrequest ]  ── cancel → fallback reload
                   |
     cache lookup → fetch (single JSON or NDJSON stream)
                   |
            [ spfprocess ] ── cancel → fallback reload
                   |
     apply: title → url → head → attr → body → foot
                   |
              [ spfdone ]
```

| Event            | When                                         | Cancel effect                      |
| ---------------- | -------------------------------------------- | ---------------------------------- |
| `spfready`       | After `init()` wires up.                     | —                                  |
| `spfclick`       | A valid `spf-link` was clicked.              | Browser navigates normally.        |
| `spfhistory`     | Back/forward to one of our entries.          | Browser handles it (full load).    |
| `spfrequest`     | Before the request is sent.                  | Pipeline aborts → fallback reload. |
| `spfprocess`     | Response received, before applying.          | Fallback reload.                   |
| `spfdone`        | Response applied.                            | —                                  |
| `spferror`       | Request failure or `reload: true`.           | —                                  |
| `spfreload`      | Falling back to a full navigation.           | —                                  |
| `spfpartprocess` | A streamed part arrives, before aggregating. | The part is skipped.               |
| `spfpartdone`    | A streamed part was aggregated.              | —                                  |

## Cancellation

Two dispatch mechanisms, with matching cancel semantics:

- **Promise-aware registry** — handlers registered with `spf.event.on(name,
fn)` run first, may be async, and are awaited in order; returning `false`
  cancels the event. Used for the pipeline events (`spfrequest`,
  `spfprocess`, `spfdone`, `spferror`, `spfpartprocess`, `spfpartdone`).
- **Document `CustomEvent`** — a cancelable event is then dispatched on
  `document`, so `document.addEventListener('spfrequest', …)` works like
  classic SPF and external listeners cancel with `preventDefault()`.

The click-time events (`spfready`, `spfclick`, `spfhistory`, `spfreload`)
are dispatched synchronously and honor only the document `CustomEvent` —
registering them with `spf.event.on` has no effect; cancel with
`document.addEventListener(name, e => e.preventDefault())`.

## Callbacks and cancellations

Instead of handling events, programmatic navigation may pass callbacks in a
`RequestOptions` object — `spf.navigate(url, { onRequest, onProcess,
onDone })`. Canceling aborts the pipeline; for a navigation this falls back
to a full browser load, for a prefetch it simply aborts:

| Callback    | State                         | Cancel                             |
| ----------- | ----------------------------- | ---------------------------------- |
| `onRequest` | Started; sending request      | Fallback reload (prefetch: abort). |
| `onProcess` | Processing; response received | Fallback reload (prefetch: abort). |
| `onDone`    | Done                          | —                                  |

See the [Events API reference](/api/events) for the registry methods and
per-event detail fields.
