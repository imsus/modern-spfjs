# `spf` namespace

The public surface is concept-compatible with SPF: `init` / `dispose` /
`navigate` / `load` / `process` / `prefetch`, `spf.cache`, `spf.script`,
`spf.style`, `spf.config`, `spf.event`, and the `spf*` event names — with
modern, Promise-aware, typed semantics (see
[ADR 0001](/adr/0001-concept-compatible-not-dropin)).

The IIFE build exposes this object as the global `spf`; the ESM build exports
the same members as named exports.

> The API reference is hand-maintained (typedoc-style) rather than generated:
> TypeDoc 0.28 peers only `typescript ≤ 6.0.x`, and the TS7 native compiler
> no longer exposes the legacy JS compiler API (`createProgram` etc.) that
> TypeDoc depends on — so TypeDoc cannot run against this codebase.

```ts
spf.init(optConfig?)      // → boolean
spf.dispose()             // → void
spf.navigate(url, opts?)  // → Promise<void>
spf.load(url, opts?)      // → Promise<SingleResponse>
spf.process(response)     // → Promise<void>
spf.prefetch(url, opts?)  // → Promise<SingleResponse | undefined>
spf.cache                 // cache namespace
spf.script                // script manager
spf.style                 // style manager
spf.config                // configuration
spf.event                 // event registry
spf.version               // string
```

## `init(optConfig?)`

```ts
function init(optConfig?: Partial<SpfConfig>): boolean;
```

Initializes SPF: applies the optional config, wires the Navigation API
`navigate` event, click delegation, viewport prefetching and speculation
rules, then fires `spfready`.

Returns `false` (with a console warning) when the Navigation API is
unavailable — the page keeps working with full browser loads. Calling `init`
again is a no-op until `dispose`.

## `dispose()`

```ts
function dispose(): void;
```

Removes all listeners, disconnects the viewport observer, removes the injected
speculation-rules script, and clears pending navigation state.

## `navigate(url, options?)`

```ts
function navigate(url: string, options?: RequestOptions): Promise<void>;
```

Performs a full SPF navigation: pushes a history entry and runs the pipeline
(`spfrequest` → cache/fetch → `spfprocess` → apply → `spfdone`). Resolves when
the pipeline settles — success _or_ fallback to a full browser navigation.
Without the Navigation API it falls back to `location.assign` immediately.

## `load(url, options?)`

```ts
function load(url: string, options?: RequestOptions): Promise<SingleResponse>;
```

Fetches and applies a response **without changing the URL**. Returns the
applied response. A `reload: true` response triggers the fallback path and
resolves with the response.

## `process(response)`

```ts
function process(response: SingleResponse): Promise<void>;
```

Applies an already-fetched response to the current page, outside any
navigation flow (processing order: title → url → head → attr → body → foot).

## `prefetch(url, options?)`

```ts
function prefetch(url: string, options?: RequestOptions): Promise<SingleResponse | undefined>;
```

Fetches a URL into the cache as a one-shot `prefetch` entry and primes the
browser cache for its scripts and stylesheets. No DOM changes. Resolves to the
response, or `undefined` if the `spfrequest` handler cancelled the prefetch.

## `version`

```ts
const version: string;
```

The library version (currently `0.0.1`). Bumped manually to match the npm
version at release time (semantic-release only updates `package.json`).
