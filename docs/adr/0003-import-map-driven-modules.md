# Import-map-driven module resolution

Managed modules are stored as bare specifiers and loaded via `import()`, so
resolution is delegated to the page's import map; absolute URLs are also
accepted. Version switching is therefore a server-side import-map change (or a
new URL), not a library API call. This keeps the library out of the business of
rewriting paths and makes the page's module graph the single source of truth.

- **Status**: accepted
- **Considered Options**: (a) library-owned name→URL map (SPF's `declare`/`path`
  model) — rejected, duplicates what the import map already does and splits the
  module graph; (b) no names, raw specifiers only — rejected, loses the
  load-once/name-switching affordance; (c) import-map-driven — chosen.
- **Consequences**: pages using bare specifiers must ship an import map; the
  library must not cache module results across specifier resolutions (a name
  must be re-resolved on every load so import-map updates take effect).
