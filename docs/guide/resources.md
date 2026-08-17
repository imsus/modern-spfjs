# Scripts & styles

modern-spf manages two kinds of resources across navigations:

- **managed** — scripts and stylesheets registered by a _name_ so they load
  once and can be swapped between versions (see
  [ADR 0002](/adr/0002-esm-native-resource-manager) and
  [ADR 0003](/adr/0003-import-map-driven-modules));
- **unmanaged** — classic `<script>` and `<link>` tags inside `head`/`foot`
  response HTML, which are re-installed on every navigation.

## Managed scripts — `spf.script`

Scripts are **ES modules**, loaded via dynamic `import()` so they execute
exactly once per name:

| Method     | Signature                         | Effect                                                                                                                                                                                 |
| ---------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `load`     | `(specifier, name?) → Promise<T>` | Import a module once; returns its namespace. Bare specifiers resolve through the page's [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap). |
| `prefetch` | `(specifier) → void`              | Prime the browser cache with a `modulepreload` link; does not execute.                                                                                                                 |
| `unload`   | `(name) → void`                   | Drop the registry entry; the next `load` re-resolves the specifier.                                                                                                                    |
| `isLoaded` | `(name) → boolean`                | Whether a name is currently registered.                                                                                                                                                |

```js
// page has: <script type="importmap">{ "imports": { "player": "/assets/player.v2.js" } }</script>

const player = await spf.script.load('player', 'player');
player.play();
```

Because an ES module cannot be unmounted once loaded, "unloading" a managed
script only drops the registry entry — the next `load` re-resolves the
specifier (which may point at a new version in the import map).

## Managed styles — `spf.style`

Stylesheets are applied via **constructable stylesheets**
(`document.adoptedStyleSheets`), with a classic `<link>` fallback when
adoption is impossible (cross-origin/CSP):

| Method     | Signature                                                  | Effect                                                    |
| ---------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| `load`     | `(url, name?) → Promise<CSSStyleSheet \| HTMLLinkElement>` | Fetch and apply once (deduped by name/URL).               |
| `prefetch` | `(url) → void`                                             | Prime the cache with a `<link rel="preload" as="style">`. |
| `unload`   | `(name) → void`                                            | Remove the managed stylesheet from the page.              |
| `isLoaded` | `(name) → boolean`                                         | Whether a name is registered.                             |

## Unmanaged tags in responses

`head`/`foot` HTML from responses is installed into `<head>`:

- **classic `<script>` tags** execute **in order**, and block the pipeline
  unless they carry `async`;
- **`<style>` and `<link rel="stylesheet">`** are appended to `<head>`;
- other elements are appended as-is.

This matches SPF's behavior for legacy inline scripts and is intentionally
separate from the ESM-native managed path.
