# Caching

SPF uses a **hybrid response cache**: an in-memory LRU for the current session,
plus a **Cache API** durable tier that survives reloads, so back/forward
navigations to previously visited pages can be served without the network.

## Eligibility rules

The cache policy is SPF's classic split between _new_ and _history_
navigations, controlled by one rule:

- a cached response is eligible only for **history** (back/forward)
  navigations — _unless_ `cache-unified` is enabled;
- a **prefetched** response is eligible for **one** subsequent new navigation,
  then downgrades to history-only (one-shot semantics);
- new navigations otherwise always hit the server — the freshness guarantee.

A server may override the stored type per response with `cacheType`
(`new` | `history` | `prefetch`) and address entries with `cacheKey`.

## The two tiers

**In-memory LRU** (`spf.cache`) — fastest tier; entries expire after
`cache-lifetime` ms and the LRU is capped at `cache-max` entries.

**Durable tier** (`spf.cache.persistent`) — the Cache API (`modern-spf` cache
store). Written on every navigation; serves history navigations on a miss in
memory. The durable tier only serves history navigations (unless
`cache-unified`), preserving the "new navigations hit the server" guarantee.

Lookup order: memory → durable → network.

## Public API

| Method       | Signature                                          | Purpose                                                    |
| ------------ | -------------------------------------------------- | ---------------------------------------------------------- |
| `get`        | `(url, navType) → SingleResponse \| null`          | Read an eligible entry (consumes prefetch).                |
| `set`        | `(url, response, type?) → string`                  | Store a response; returns the cache key.                   |
| `remove`     | `(key) → void`                                     | Remove by cache key or `response.cacheKey`, incl. durable. |
| `clear`      | `() → void`                                        | Clear both tiers.                                          |
| `size`       | `() → number`                                      | Live entry count.                                          |
| `durableGet` | `(url, navType) → Promise<SingleResponse \| null>` | Durable-tier lookup honoring the policy.                   |
| `persistent` | `{ put, match, delete }`                           | Raw Cache API tier access.                                 |

See [Cache API reference](/api/cache) for details.

## Configuration

| Key              | Default           | Meaning                                              |
| ---------------- | ----------------- | ---------------------------------------------------- |
| `cache-lifetime` | `600000` (10 min) | Entry lifetime in ms.                                |
| `cache-max`      | `50`              | LRU entry cap.                                       |
| `cache-unified`  | `false`           | When `true`, cached responses serve all navigations. |
