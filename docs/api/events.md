# Events

SPF dispatches `spf*` events (concept-compatible names with the original SPF).
Dispatch is **Promise-aware for the pipeline events**: handlers registered with
`spf.event.on` run first, are awaited in order, and a handler returning
`false` cancels the event; then a cancelable `CustomEvent` is dispatched on
`document` (so `document.addEventListener('spfrequest', …)` also works, and
external listeners may cancel via `preventDefault()`).

The **click-time events** (`spfclick`, `spfhistory`, `spfready`, `spfreload`)
are dispatched synchronously via `emitSync` and only honor the `document`
CustomEvent — they skip the `spf.event` registry entirely, so registering a
handler for them with `spf.event.on` has no effect (cancel them with
`document.addEventListener(name, e => e.preventDefault())` instead).

## `spf.event`

| Method     | Signature                           | Effect                                                                            |
| ---------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| `on`       | `(name, handler) → () => void`      | Register a handler; returns an unsubscribe function.                              |
| `off`      | `(name, handler) → void`            | Unregister a handler.                                                             |
| `clear`    | `() → void`                         | Remove all handlers (tests/dispose).                                              |
| `emit`     | `(name, detail) → Promise<boolean>` | Dispatch (registry handlers, then document event); resolves `false` if cancelled. |
| `emitSync` | `(name, detail) → boolean`          | Synchronous dispatch — document CustomEvent only (click-time events).             |

Handlers have the type
`(detail: SpfEventDetail) => boolean | void | Promise<boolean | void>`.

## Event reference

| Event            | Detail fields                     | When                                                       | Cancel effect                      | Registry? |
| ---------------- | --------------------------------- | ---------------------------------------------------------- | ---------------------------------- | --------- |
| `spfready`       | —                                 | After `init()` wires up.                                   | —                                  | no (sync) |
| `spfclick`       | `url`, `target`                   | A `spf-link` was clicked.                                  | Browser navigates normally.        | no (sync) |
| `spfhistory`     | `url`, `previous`                 | Back/forward to one of our entries.                        | Browser handles it (full load).    | no (sync) |
| `spfrequest`     | `url`, `previous`, `referer`      | Before the request is sent.                                | Pipeline aborts → fallback reload. | yes       |
| `spfprocess`     | `url`, `response`                 | Response received, before applying.                        | Fallback reload.                   | yes       |
| `spfdone`        | `url`, `response`, `transitioned` | Response applied.                                          | —                                  | yes       |
| `spferror`       | `url`, `err?`                     | Request failure (with `err`), or `reload: true` (without). | —                                  | yes       |
| `spfreload`      | `url` (fallback target)           | Fallback to a full navigation.                             | —                                  | no (sync) |
| `spfpartprocess` | `part`, `response` (partial)      | A streamed part arrives, before aggregation.               | The part is skipped.               | yes       |
| `spfpartdone`    | `part`, `response` (partial)      | A streamed part was aggregated.                            | —                                  | yes       |

## Example

```js
const off = spf.event.on('spfdone', ({ url, response, transitioned }) => {
  console.log('navigated to', url, 'transitioned:', transitioned);
  return undefined; // do not cancel
});

// ...later
off(); // unregister
```
