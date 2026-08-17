# Types

The public TypeScript types exported by `modern-spf`.

## `SingleResponse`

A single (non-streamed) SPF response. All fields optional.

| Field       | Type                                     | Meaning                                                           |
| ----------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `title`     | `string`                                 | New document title.                                               |
| `url`       | `string`                                 | Correct URL for this request; replaces the current history entry. |
| `head`      | `string`                                 | HTML containing early CSS/JS, installed into `<head>`.            |
| `foot`      | `string`                                 | HTML containing late JS/CSS, installed after body.                |
| `body`      | `Record<string, string>`                 | Map of element IDs to HTML (the fragments).                       |
| `attr`      | `Record<string, Record<string, string>>` | Map of element IDs to attribute name/value maps.                  |
| `redirect`  | `string`                                 | A URL to request instead of this one.                             |
| `reload`    | `boolean`                                | `true` → perform a full page reload.                              |
| `cacheKey`  | `string`                                 | Cache key the client used/stores for this response.               |
| `cacheType` | `string`                                 | Cache eligibility hint: `new` \| `history` \| `prefetch`.         |
| `timing`    | `Record<string, number>`                 | Arbitrary server timings, surfaced on `spfdone`.                  |
| `data`      | `unknown`                                | Reserved for client data.                                         |

## `StreamPart`

One line of a streamed (NDJSON) SPF response — a discriminated union:

```ts
type StreamPart =
  | { part: 'title'; value: string }
  | { part: 'url'; value: string }
  | { part: 'head'; html: string }
  | { part: 'attr'; id: string; attrs: Record<string, string> }
  | { part: 'body'; id: string; html: string }
  | { part: 'foot'; html: string }
  | { part: 'done' };
```

## `RequestOptions`

Options for requesting a URL.

| Field             | Type                     | Meaning                                                                                                        |
| ----------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `method`          | `'GET' \| 'POST'`        | HTTP method; defaults to `GET`.                                                                                |
| `headers`         | `Record<string, string>` | Extra headers to send.                                                                                         |
| `postData`        | `BodyInit`               | Body for POST requests.                                                                                        |
| `withCredentials` | `boolean`                | Include credentials (cookies) in the request.                                                                  |
| `referer`         | `string`                 | Sent as `X-SPF-Referer` — the URL of the page being left (history navigations).                                |
| `current`         | `string`                 | Sent as `X-SPF-Previous` — the URL being left.                                                                 |
| `onRequest`       | `SpfEventHandler`        | Invoked after the `spfrequest` event (navigate/load only); the return value is ignored — cancel via the event. |
| `onProcess`       | `SpfEventHandler`        | Invoked after the `spfprocess` event (navigate/load only); the return value is ignored — cancel via the event. |
| `onDone`          | `SpfEventHandler`        | Invoked after processing is done (navigate/load only).                                                         |
| `onPartProcess`   | `SpfEventHandler`        | **Not invoked by the current implementation** — use the `spfpartprocess` event.                                |
| `onPartDone`      | `SpfEventHandler`        | Invoked per streamed part after it is aggregated (navigate/load only).                                         |
| `onError`         | `SpfEventHandler`        | Invoked on request failure (navigate/load only).                                                               |
| `noTransition`    | `boolean`                | Disable view transitions for this navigation.                                                                  |

## `SpfEventDetail`

Detail object passed to SPF event handlers and request callbacks.

| Field          | Type              | Meaning                                                         |
| -------------- | ----------------- | --------------------------------------------------------------- |
| `url`          | `string`          | The URL of the request.                                         |
| `previous`     | `string`          | The URL of the page being left (`spfhistory`).                  |
| `referer`      | `string`          | The URL of the page being left (`spfrequest`).                  |
| `target`       | `Element \| null` | The clicked element (`spfclick`).                               |
| `response`     | `SingleResponse`  | The (possibly partial) response (`process`/`done`/part events). |
| `part`         | `StreamPart`      | One part of a streamed response (part events).                  |
| `err`          | `Error`           | The error that occurred (`spferror`, request failures only).    |
| `transitioned` | `boolean`         | Whether view transitions were used for this navigation.         |

## `SpfEventHandler`

```ts
type SpfEventHandler = (detail: SpfEventDetail) => boolean | void | Promise<boolean | void>;
```

Returning `false` cancels the event; handlers may be async.

## `SpfEventName`

The canonical SPF event names:

```ts
type SpfEventName =
  | 'spfready'
  | 'spfclick'
  | 'spfhistory'
  | 'spfrequest'
  | 'spfprocess'
  | 'spfdone'
  | 'spferror'
  | 'spfreload'
  | 'spfpartprocess'
  | 'spfpartdone';
```

## `SpfRequestType` / `SpfNavigationType`

```ts
type SpfRequestType = 'navigate' | 'prefetch' | 'load'; // selects the URL identifier value
type SpfNavigationType = 'new' | 'history'; // drives cache eligibility
```

## `SpfConfig`

The configuration shape — see the [Configuration guide](/guide/configuration)
for the full key table.

> **Internal:** `SpfConfig` is defined in `src/config.ts` but is **not**
> re-exported from the package entry — the public `spf.config` API is typed
> against it. The same applies to `ApplyOptions` (used by `spf.process`) and
> `CacheType` (used by `spf.cache`). They appear here for reference; the
> exported public types are `SingleResponse`, `StreamPart`, `RequestOptions`,
> `SpfEventDetail`, `SpfEventHandler`, `SpfEventName`, `SpfRequestType` and
> `SpfNavigationType`.
