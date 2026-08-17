# Configuration

`spf.config` holds the global configuration, initialized from
[SPF's defaults](https://github.com/youtube/spfjs) with modern additions.
Pass a partial config object to `spf.init()` (or `spf.config.init()`), or read
and write individual keys at runtime.

## Keys

| Key                               | Default           | Meaning                                                                                    |
| --------------------------------- | ----------------- | ------------------------------------------------------------------------------------------ |
| `url-identifier`                  | `?spf=__type__`   | URL marker for SPF requests; `__type__` is replaced by `navigate` \| `prefetch` \| `load`. |
| `link-class`                      | `spf-link`        | Class marking an `<a>`/`<form>` as SPF-enabled.                                            |
| `nolink-class`                    | `spf-nolink`      | Class opting an element out of SPF handling.                                               |
| `cache-lifetime`                  | `600000` (10 min) | Maximum time (ms) a cache entry is valid.                                                  |
| `cache-max`                       | `50`              | Maximum number of cache entries (LRU).                                                     |
| `cache-unified`                   | `false`           | When `true`, cached responses are eligible for all navigations.                            |
| `request-timeout`                 | `0`               | Request timeout in ms; `0` = none.                                                         |
| `request-headers`                 | `null`            | Global request headers object.                                                             |
| `reload-identifier`               | `null`            | Reason parameter appended to fallback reload URLs.                                         |
| `navigate-limit`                  | `20`              | Max navigations per session (SPF behavior).                                                |
| `navigate-lifetime`               | `86400000` (24 h) | Session lifetime in ms for the navigation limit.                                           |
| `animation-class`                 | `spf-animate`     | Class added to animated elements during view transitions.                                  |
| `animation-duration`              | `425`             | View transition duration in ms (informational).                                            |
| `advanced-header-identifier`      | `null`            | When set, identifies SPF requests via `X-SPF-Request` instead of the URL.                  |
| `experimental-prefetch-mousedown` | `false`           | Prefetch on mousedown (SPF experiment).                                                    |
| `prefetch-viewport`               | `true`            | Prefetch `spf-link`s as they enter the viewport.                                           |
| `speculation`                     | `prefetch`        | Speculation rules strategy: `prefetch` \| `prerender` \| `none`.                           |

## API

| Method  | Signature                                 | Effect                                      |
| ------- | ----------------------------------------- | ------------------------------------------- |
| `init`  | `(optConfig?: Partial<SpfConfig>) → void` | Apply an optional config over the defaults. |
| `get`   | `(key) → value`                           | Read a configuration value.                 |
| `set`   | `(key, value) → value`                    | Set a configuration value; returns it.      |
| `clear` | `() → void`                               | Reset to defaults.                          |

## Examples

```js
spf.init({
  'url-identifier': '?spf=__type__',
  'cache-unified': true,
  speculation: 'prerender',
});

spf.config.set('prefetch-viewport', false);
const cls = spf.config.get('link-class'); // "spf-link"
```
