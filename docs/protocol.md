# modern-spf — Wire Protocol (v0.1 draft)

The contract between the client library and a server. Language-agnostic; the
Laravel demo in `demo/` implements it.

## Request

SPF requests are same-origin requests marked so the server can respond with
fragments instead of a full page.

- **URL identifier** (default): the client appends `?spf=navigate` (configurable
  via `url-identifier`, `__type__` replaced by `navigate` | `prefetch` | `load`).
- **Headers**:
  - `Accept: application/x-spf+json, application/x-spf+ndjson;q=0.9`
  - `X-SPF-Referer` — the current page URL (history navigations)
  - `X-SPF-Previous` — the URL being left
  - custom headers from config (`request-headers`) and per-request `headers`
- Forms: `POST` with form data, same identifier appended.

## Response — single (baseline)

`Content-Type: application/x-spf+json`

A single JSON object; all fields optional. Field names are inherited from SPF
for concept compatibility:

```json
{
  "title": "Page Title",
  "url": "https://example.com/destination",
  "head": "<style>…</style>",
  "attr": { "content": { "class": "wide" } },
  "body": { "content": "<p>New content</p>" },
  "foot": "<script>…</script>",
  "cacheKey": "…",
  "cacheType": "…",
  "timing": { "…": 123 },
  "data": null,
  "redirect": "…",
  "reload": false
}
```

| Field       | Meaning                                                             |
| ----------- | ------------------------------------------------------------------- |
| `title`     | New document title                                                  |
| `url`       | Correct URL for this request; replaces the current entry in history |
| `head`      | HTML containing early CSS/JS, installed into `<head>`               |
| `attr`      | `{elementId: {attrName: value}}` — attributes to set on elements    |
| `body`      | `{elementId: html}` — replaces each element's content               |
| `foot`      | HTML containing late JS/CSS, installed after body                   |
| `redirect`  | A URL to request instead of this one                                |
| `reload`    | `true` → perform a full page reload                                 |
| `cacheKey`  | Cache key the client used/stores for this response                  |
| `cacheType` | Cache eligibility hint (`new` / `history` / `prefetch`)             |
| `timing`    | Arbitrary server timings, surfaced on `spfdone`                     |
| `data`      | Reserved for client data                                            |

Processing order: **title → url → head → attr → body → foot**.

## Response — streaming

`Content-Type: application/x-spf+ndjson` — one JSON object per line, processed
as it arrives, same ordering, terminated by a `done` part:

```
{"part":"title","value":"Page Title"}
{"part":"head","html":"<style>…</style>"}
{"part":"body","id":"content","html":"<p>New content</p>"}
{"part":"attr","id":"content","attrs":{"class":"wide"}}
{"part":"foot","html":"<script>…</script>"}
{"part":"done"}
```

| Part    | Fields        | Effect                                      |
| ------- | ------------- | ------------------------------------------- |
| `title` | `value`       | Document title                              |
| `url`   | `value`       | History URL replacement                     |
| `head`  | `html`        | Early CSS/JS into `<head>`                  |
| `attr`  | `id`, `attrs` | Set attributes on element `id`              |
| `body`  | `id`, `html`  | Replace content of element `id`             |
| `foot`  | `html`        | Late JS/CSS                                 |
| `done`  | —             | Terminates the stream; response is complete |

The client aggregates all parts into one cacheable single response.
Events `spfpartprocess` / `spfpartdone` fire per part; `spfdone` on `done`.

## Failure

If the response indicates `reload: true`, or the request fails, the client
falls back to a full browser navigation to the URL (optionally with a
`reload-identifier` reason parameter) and dispatches `spferror`.

## Caching

Responses are cached client-side (in-memory + Cache API). A cached response is
eligible only for back/forward (history) navigations unless `cache-unified` is
enabled or the response's `cacheType`/`cacheKey` says otherwise. Prefetched
responses are eligible for one subsequent new navigation.
