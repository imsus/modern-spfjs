# Cache — `spf.cache`

The response cache: an in-memory LRU (SPF semantics) plus a Cache API durable
tier. See the [Caching guide](/guide/caching) for the policy.

```ts
type CacheType = 'new' | 'history' | 'prefetch';
```

## Methods

### `get(url, navType)`

```ts
function get(url: string, navType: SpfNavigationType): SingleResponse | null;
```

Reads the first eligible cached entry for a navigation, checking `prefetch`,
then `history`, then `new` types. Expired entries are dropped. A `prefetch`
hit is **consumed** — the entry becomes history-only. Returns `null` on miss.

### `set(url, response, type?)`

```ts
function set(url: string, response: SingleResponse, type?: CacheType): string;
```

Stores a response, honoring a server `cacheType` hint over the caller's
default `type`. Evicts expired entries and LRU overflow (`cache-max`).
Returns the cache key (`"<type> <url>"`).

### `remove(key)`

```ts
function remove(key: string): void;
```

Removes an entry by cache key or by its `response.cacheKey`, including its
durable-tier copy.

### `clear()`

```ts
function clear(): void;
```

Clears all entries, including the durable tier.

### `size()`

```ts
function size(): number;
```

Number of live in-memory entries (tests/telemetry).

### `durableGet(url, navType)`

```ts
function durableGet(url: string, navType: SpfNavigationType): Promise<SingleResponse | null>;
```

Durable-tier lookup honoring the policy: the Cache API store only serves
**history** navigations (unless `cache-unified`), preserving the "new
navigations hit the server" guarantee. Returns `null` when unavailable.

### `persistent`

```ts
const persistent: {
  put(url: string, response: SingleResponse): Promise<void>;
  match(url: string): Promise<SingleResponse | null>;
  delete(url: string): Promise<boolean>;
};
```

Raw Cache API tier (store name `modern-spf`). Entries carry a timestamp and
expire per `cache-lifetime`. Feature-detects `caches` — in non-secure contexts
all methods are safe no-ops (`match` returns `null`).

> **Note:** `durableGet` and `persistent` are exposed for testing and
> advanced use; the primary surface is `get`/`set`/`remove`/`clear`.
