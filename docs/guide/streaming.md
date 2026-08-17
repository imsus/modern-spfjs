# Streaming

A server may answer an SPF request with an **NDJSON stream** of parts
(`Content-Type: application/x-spf+ndjson`) instead of a single JSON object.
Each line is one part, parsed and fired as an event as it arrives — the
response is never held whole in memory before processing starts, which is
useful for slow servers and big pages.

> **Note:** the DOM is updated once the stream completes — streaming is
> incremental for _parsing and events_, not for fragment application. The
> aggregated response is applied (and cached) like a single JSON response;
> per-part events let you observe progress as the stream arrives.

## Stream format

Parts follow the same order as the single response
(**title → url → head → attr → body → foot**) and are terminated by a `done`
part:

```text
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

The client decides which format to use from the response `Content-Type`; the
single JSON format is always accepted as a fallback. See the
[wire protocol](/protocol) for the exact byte-level contract.

## Part events

Each part fires two events as it arrives:

- `spfpartprocess` — `{ part, response }`; returning `false` **skips** the part;
- `spfpartdone` — `{ part, response }` — fired after the part was aggregated.

Because parts arrive incrementally, the `response` detail object is the
**partial** aggregate so far — later parts will not be present yet.

## Aggregation

All parts are aggregated into one `SingleResponse` object, which is what gets
applied and cached. This means a streamed response behaves identically to a
single JSON response after it arrives — the cache, apply pipeline and
`spfdone` all see the same shape.
