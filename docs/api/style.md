# Styles — `spf.style`

The style manager: constructable stylesheets (`document.adoptedStyleSheets`)
with a `<link>` fallback where adoption can't apply (cross-origin/CSP). See
the [Resources guide](/guide/resources); version switching is covered in
[Versioning](/guide/versioning).

## Methods

### `load(url, name?)`

```ts
function load(url: string, name?: string): Promise<CSSStyleSheet | HTMLLinkElement>;
```

Loads a stylesheet once (deduped by name or URL) and applies it. Returns the
adopted `CSSStyleSheet`, or the fallback `HTMLLinkElement` when the fetch or
adoption failed (cross-origin/CSP).

```js
await spf.style.load('/theme/dark.css', 'theme-dark');
```

### `prefetch(url)`

```ts
function prefetch(url: string): void;
```

Requests a stylesheet without applying it, priming the browser cache with a
`<link rel="preload" as="style">`.

### `unload(name)`

```ts
function unload(name: string): void;
```

Removes a managed stylesheet from the page: un-adopts a `CSSStyleSheet` or
removes the fallback `<link>` element.

### `isLoaded(name)`

```ts
function isLoaded(name: string): boolean;
```

Whether a name is currently registered.
