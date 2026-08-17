# Scripts — `spf.script`

The ESM-native script manager (ADR 0002, ADR 0003): managed resources are ES
modules loaded via `import()`, resolved through the page's import map for bare
specifiers. See the [Scripts & styles guide](/guide/resources).

## Methods

### `load(specifier, name?)`

```ts
function load<T = unknown>(specifier: string, name?: string): Promise<T>;
```

Loads a module once (deduped by name or specifier) and returns its namespace.
Bare specifiers resolve through the page's import map; absolute URLs import
directly. Failed loads are removed from the registry so a later `load` can
retry. The generic `T` describes the module the caller imports; the module
namespace contract is the caller's to assert at this boundary.

```js
const player = await spf.script.load('player', 'player');
```

### `prefetch(specifier)`

```ts
function prefetch(specifier: string): void;
```

Requests a module without executing it, priming the browser cache with a
`<link rel="modulepreload">`.

### `unload(name)`

```ts
function unload(name: string): void;
```

Drops the registry entry. A module cannot be unmounted once loaded, so the
next `load` re-resolves the specifier — which may now point at a different
version in the import map.

### `isLoaded(name)`

```ts
function isLoaded(name: string): boolean;
```

Whether a name is currently registered.
