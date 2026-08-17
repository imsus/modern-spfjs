# modern-spf

A modern re-creation of YouTube's **SPF** ("Structured Page Fragments") — a
lightweight, zero-dependency, framework-agnostic library for fast same-origin
navigation: only the changed fragments of a page are fetched and applied,
never the whole page.

Built on 2026 browser technology: the **Navigation API** (Baseline Jan 2026),
**View Transitions**, streaming responses, speculation rules, ES modules and
constructable stylesheets, and the Cache API. Evergreen browsers only.

## Status

Kickoff in progress — design tree closed (see `DESIGN.md`), vertical slice
being built. Not yet published.

## Quick shape

```html
<script src="path/to/modern-spf.global.js"></script>
<a class="spf-link" href="/destination">Go!</a>
<script>
  spf.init();
</script>
```

The server detects `?spf=navigate` (configurable) and returns either a single
SPF JSON object or an NDJSON stream of parts. See `spec/PROTOCOL.md`.

## Docs

- `DESIGN.md` — the agreed design (shared-understanding record)
- `docs/adr/` — architecture decision records
- `spec/PROTOCOL.md` — the wire protocol
- `CONTEXT.md` — the domain glossary

## Development

The project uses the **Vite+** toolchain (`vp`) with **pnpm** and
**TypeScript 7** (the native compiler):

```sh
pnpm install
pnpm dev          # vite dev server (demo later)
pnpm test         # vp test run (Vitest)
pnpm typecheck    # tsc --noEmit (TypeScript 7)
pnpm lint         # vp lint (Oxlint)
pnpm fmt          # vp fmt (Oxfmt)
pnpm check        # vp check — format + lint + typecheck
pnpm build        # vp pack — ESM + CJS + IIFE (global `spf`) + .d.ts via TS7
```

## License

MIT
