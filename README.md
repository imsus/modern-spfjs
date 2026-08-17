# modern-spf

A modern re-creation of YouTube's **SPF** ("Structured Page Fragments") — a
lightweight, zero-dependency, framework-agnostic library for fast same-origin
navigation: only the changed fragments of a page are fetched and applied,
never the whole page.

Built on 2026 browser technology: the **Navigation API** (Baseline Jan 2026),
**View Transitions**, streaming responses, speculation rules, ES modules and
constructable stylesheets, and the Cache API. Evergreen browsers only.

## Status

All six build-order phases complete — library, docs site, publish checks,
CI/release config, Playwright E2E, and the Laravel demo (see
`docs/design.md`). Not yet published.

## Quick shape

```html
<script src="path/to/modern-spf.global.js"></script>
<a class="spf-link" href="/destination">Go!</a>
<script>
  spf.init();
</script>
```

The server detects `?spf=navigate` (configurable) and returns either a single
SPF JSON object or an NDJSON stream of parts. See `docs/protocol.md`.

## Docs

The docs site (Vitepress) lives in `docs/` — run `pnpm docs:dev` to browse it.
Source files:

- `docs/` — the docs site (guides + hand-maintained API reference)
- `docs/design.md` — the agreed design (shared-understanding record)
- `docs/adr/` — architecture decision records
- `docs/protocol.md` — the wire protocol
- `docs/glossary.md` — the domain glossary
- `docs/research.md` — research notes on the original SPF

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
pnpm docs:dev     # vitepress dev server
pnpm docs:build   # build the docs site
pnpm check:publish  # build + publint + arethetypeswrong (packaged-output checks)
```

## License

MIT
