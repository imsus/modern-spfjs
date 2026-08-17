# Concept-compatible public API, not drop-in compatibility

`modern-spf` re-creates SPF's concepts and recognizable surface — `spf.init` /
`spf.navigate` / `spf.prefetch`, `spf*` events, the `spf-link` class — but
modernizes the semantics (async/await, Promise-returning calls, typed events,
streaming responses). We deliberately do **not** guarantee that old SPF sites
or servers work unchanged: drop-in fidelity would force the legacy
callback-based, string-typed API onto the public contract, which is the part we
set out to modernize.

- **Status**: accepted
- **Considered Options**: (a) full drop-in — locks in legacy semantics; (b)
  concept-compatible — chosen; (c) inspired-only — throws away the recognizable
  surface this project is named for.
- **Consequences**: server code needs small tweaks (e.g. Accept-header
  negotiation); the `?spf=` identifier and JSON field names are kept so the
  changes stay small.
