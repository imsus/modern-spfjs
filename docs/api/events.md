# Events

SPF dispatches `spf*` events (concept-compatible names with the original SPF).
Each event is **Promise-aware**: handlers registered with `spf.event.on` run
first, are awaited in order, and a handler returning `false` cancels the
event; then a cancelable `CustomEvent` is dispatched on `document` (so
`document.addEventListener('spfrequest', …)` also works, and external
listeners may cancel via `preventDefault()`).

## `spf.event`

| Method  | Signature                           | Effect                                               |
| ------- | ----------------------------------- | ---------------------------------------------------- |
| `on`    | `(name, handler) → () => void`      | Register a handler; returns an unsubscribe function. |
| `off`   | `(name, handler) → void`            | Unregister a handler.                                |
| `clear` | `() → void`                         | Remove all handlers (tests/dispose).                 |
| `emit`  | `(name, detail) → Promise<boolean>` | Dispatch; resolves `false` if cancelled.             |

Handlers have the type
`(detail: SpfEventDetail) => boolean | void | Promise<boolean | void>`.

## Event reference

| Event            | Detail fields                     | When                                         | Cancel effect                      |
| ---------------- | --------------------------------- | -------------------------------------------- | ---------------------------------- |
| `spfready`       | —                                 | After `init()` wires up.                     | —                                  |
| `spfclick`       | `url`, `target`                   | A `spf-link` was clicked.                    | Browser navigates normally.        |
| `spfhistory`     | `url`, `previous`                 | Back/forward to one of our entries.          | Browser handles it (full load).    |
| `spfrequest`     | `url`, `previous`, `referer`      | Before the request is sent.                  | Pipeline aborts → fallback reload. |
| `spfprocess`     | `url`, `response`                 | Response received, before applying.          | Fallback reload.                   |
| `spfdone`        | `url`, `response`, `transitioned` | Response applied.                            | —                                  |
| `spferror`       | `url`, `err`                      | Request failure / `reload: true`.            | —                                  |
| `spfreload`      | `url` (fallback target)           | Fallback to a full navigation.               | —                                  |
| `spfpartprocess` | `part`, `response` (partial)      | A streamed part arrives, before aggregation. | The part is skipped.               |
| `spfpartdone`    | `part`, `response` (partial)      | A streamed part was aggregated.              | —                                  |

## Example

```js
const off = spf.event.on('spfdone', ({ url, response, transitioned }) => {
  console.log('navigated to', url, 'transitioned:', transitioned);
  return undefined; // do not cancel
});

// ...later
off(); // unregister
```
