# ESM-native resource manager

Managed resources are ES modules loaded via `import()` and resolved through the
page's import map; the manager keeps a name→specifier registry for load-once
and version switching, instead of SPF's classic-script system (manual
`require`/`unrequire`/`declare` dependency graphs and `script.path`). Native
module semantics replace the dependency manager, and version bumps become
import-map changes on the server. Classic `<script>` tags inside fragment HTML
remain supported as _unmanaged_ resources (executed in order, navigation waits
unless `async`) because real pages ship third-party classic scripts.

- **Status**: accepted
- **Considered Options**: (a) full SPF manager — dependency graphs are obsolete
  with native modules; (b) slim classic-script manager — would maintain two
  script systems; (c) ESM-native — chosen.
- **Consequences**: an ES module cannot be truly unmounted once loaded; "unload"
  means dropping the registry entry so the next load re-resolves the specifier
  (possibly to a new version via an updated import map).
