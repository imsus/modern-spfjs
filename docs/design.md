# modern-spf — Design

The shared-understanding record from the design-grilling session. Each branch
of the design tree that was settled is listed here; the reasons behind the
surprising ones live in `adr/`.

## Decisions

| Branch           | Decision                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Goal             | Production-quality personal library (tested, documented, npm-publishable)                                                                              |
| Compatibility    | Concept-compatible with SPF — not drop-in (ADR 0001)                                                                                                   |
| Backbone         | Navigation API (`window.navigation`, intercept, transitionWhile) — Baseline Jan 2026                                                                   |
| Browsers         | Evergreen-only (latest + 1–2 of Chrome/Edge/Firefox/Safari), zero polyfills                                                                            |
| Dependencies     | Zero runtime dependencies                                                                                                                              |
| Language         | TypeScript 7 (native compiler), ESM-first + CJS + IIFE (`spf` global), built with Vite+ (`vp pack` → Rolldown + tsdown, .d.ts emitted by TS7)          |
| Fragments        | Per-ID fragments, innerHTML replacement; response body is `{id: html}`                                                                                 |
| Streaming        | NDJSON parts over one request (title→url→head→attr→body→foot→done); classic single JSON always accepted                                                |
| Request          | URL identifier `?spf=navigate \| prefetch \| load` (configurable) + `Accept` negotiation                                                               |
| Cache            | Hybrid: in-memory LRU + Cache API; SPF new/history eligibility split with `cache-unified` opt-out                                                      |
| Scripts          | ESM-native manager: `import()`, name→specifier registry, import-map-driven resolution (ADR 0002, ADR 0003)                                             |
| Styles           | Constructable stylesheets (`adoptedStyleSheets`) with `<link>` fallback                                                                                |
| Fragment scripts | Unmanaged classic `<script>` tags still execute (in order, wait unless `async`)                                                                        |
| Events           | Same `spf*` names; typed detail; Promise-aware dispatch; `spf.navigate` returns a Promise                                                              |
| Prefetch         | `spf.prefetch` + in-viewport trigger (IntersectionObserver); speculation rules when available; fetch fallback; prerender opt-in                        |
| Transitions      | Same-document view transitions, default-on, `prefers-reduced-motion` respected, `spf-no-transition` class + per-call option                            |
| Failure          | Fall back to full browser navigation; `spferror` hook                                                                                                  |
| Public surface   | `spf.init/dispose/navigate/load/process/prefetch`, `spf.cache.remove/clear`, slim `spf.script.*` / `spf.style.*`, `spf.config`, `spf.event`            |
| Package          | `modern-spf` on npm                                                                                                                                    |
| Docs             | Vitepress site + hand-maintained API reference (TypeDoc is incompatible with the TS7 native compiler); protocol spec lives in the site (`protocol.md`) |
| Testing          | Vitest units + Playwright E2E                                                                                                                          |
| Release          | Semantic-release + GitHub Actions                                                                                                                      |
| Demo             | Laravel (PHP) app in `demo/laravel/` showing classic + streaming responses                                                                             |

## Build order

1. Scaffold (package, TS 7, Vite+ toolchain, Vitest, vitepress, semantic-release) — **done**
2. Vertical slice: `spf.init` → `spf-link` click → Navigation API intercept → `?spf=navigate` fetch → single JSON apply → `spfdone` — **done**
3. Deepen: cache (hybrid + policy) → NDJSON streaming (part events) → resources (import map, adoptedStyleSheets, unmanaged classics) → prefetch (speculation rules + viewport) → view transitions (default-on) → failure semantics — **done** (back/forward restore from cache, durable Cache API tier, speculation-rules injection, resource priming, transitions around apply only)
4. Ship: IIFE build, API reference in the docs site, protocol spec, CI/release, publish checks — **done** (Vitepress site, hand-maintained API reference, publint + attw checks, semantic-release + GitHub Actions)
5. Laravel demo: `?spf=` detection, JSON + NDJSON responses, `spf-link` views — **done** (Laravel app in `demo/laravel/`: `SpfPageController` with single-JSON and 120ms-part NDJSON stream responses, spf-link/spf-nolink/spf-no-transition views, feature tests for the wire protocol)
6. Test coverage: vitest (protocol, cache, registry) + Playwright E2E (navigation, streaming, back/forward, transitions, reduced-motion) — **done** (42 unit tests; 8 Playwright E2E specs against a zero-dependency harness server; Laravel demo verified in-browser)
