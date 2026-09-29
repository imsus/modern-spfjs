# Responses

An overview of SPF responses and how they are processed.

In dynamic navigation, SPF updates the page with content from the response.
Processing happens in a fixed order:

**title → url → head → attr → body → foot**

| Step    | Effect                                                |
| ------- | ----------------------------------------------------- |
| `title` | Updates `document.title`                              |
| `url`   | Rewrites the current history entry to the correct URL |
| `head`  | Installs early CSS/JS into `<head>`                   |
| `attr`  | Sets attributes on elements by ID                     |
| `body`  | Replaces each fragment's content by ID                |
| `foot`  | Installs late JS/CSS after the body                   |

All fields are optional; the commonly needed ones are `title`, `head`,
`body`, and `foot`.

## Single response

A response is typically a single JSON object:

```json
{
  "title": "Page Title",
  "head": "<style>…</style>",
  "body": { "content": "<p>New content</p>" },
  "foot": "<script>…</script>"
}
```

- `head` — early CSS/JS, installed into `<head>`;
- `body` — `{ "elementId": "HTML" }`, replaces each element's content;
- `foot` — late JS/CSS, installed after the body.

This follows the general good practice of "styles in the head, scripts at the
end of the body". The `foot` field represents the "end of the body" section
without requiring developers to create an explicit element.

## Updating attributes

To update element attributes instead of content:

```json
{
  "attr": {
    "content": { "class": "wide", "aria-busy": "false" }
  }
}
```

## Beyond the basics

- **Streaming** — a server may answer with an NDJSON stream of parts instead
  of one JSON object, processed as they arrive; see
  [Multipart responses](/guide/streaming).
- **Caching hints** — `cacheKey` and `cacheType` let the server address and
  classify entries in the response cache; see [Caching](/guide/caching).
- **Failure** — `reload: true` forces a full browser navigation;
  `redirect` falls back to a full navigation of the target URL.

See the [wire protocol](/protocol) for the exact byte-level contract
(identifier, headers, streaming) and the [Types](/api/types) reference for
the `SingleResponse` shape.
