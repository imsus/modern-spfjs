# SPFJS ("Structured Page Fragments") — Research Report

**Subject:** SPFJS (`youtube/spfjs`), the lightweight JavaScript framework from YouTube for fast, same-origin, fragment-based page navigation.
**Version documented:** v2.4.0 (last release) — the official API reference is headed "The following API reference is for **SPF 24 (v2.4.0)**" ([/api/](http://youtube.github.io/spfjs/api/)).
**Date of research:** compiled from the live official docs (youtube.github.io/spfjs) and the v2.4.0 source tree; the Wayback Machine was unavailable and was deliberately not used.

---

## 1. What SPFJS Is

SPFJS — "Structured Page Fragments," or SPF for short — is a lightweight JavaScript framework for fast navigation and page updates, originally built by YouTube and open-sourced by Google. The project README defines it as:

> "Structured Page Fragments — or SPF for short — is a lightweight JS framework for fast navigation and page updates from YouTube. Using progressive enhancement and HTML5, SPF integrates with your site to enable a faster, more fluid user experience by updating just the sections of the page that change during navigation, not the whole page." ([README.md](https://github.com/youtube/spfjs/blob/master/README.md))

**Why it existed.** SPF was designed to combine the benefits of a static, server-rendered first page load with the performance and UX of dynamic updates. From the home page ([youtube.github.io/spfjs/](http://youtube.github.io/spfjs/)):

- **User Experience:** get the fastest possible initial page load; keep a responsive persistent interface during navigation.
- **Performance:** leverage existing techniques for static rendering; load small responses and fewer resources each navigation.
- **Development:** use any server-side language and template system; be productive by using the same code for static and dynamic rendering.

In static navigation the whole HTML page is sent and rendered; in dynamic navigation "only document fragments are sent, and the changed sections are updated accordingly" (home page). The framework provides: a JSON response format for sending document fragments, a script/style management system, an in-memory cache, on-the-fly (streaming multipart) processing, and prefetching ([README.md](https://github.com/youtube/spfjs/blob/master/README.md)).

**Size and dependencies.** The README describes the client library as "a single ~10K [UMD](https://github.com/umdjs/umd) JS file with no dependencies"; the commonly cited size is ~14 KB. All functions are exposed via a global `spf` object ([README.md](https://github.com/youtube/spfjs/blob/master/README.md)).

**Browser support.** Dynamic navigation requires the HTML5 History API (pushState/popstate) — "Chrome 5+, Firefox 4+, and IE 10+" per the README; underlying functionality such as AJAX page updates and script/style loading is supported more broadly, "IE 8+" ([README.md](https://github.com/youtube/spfjs/blob/master/README.md)).

**History and archived status.** The repository `youtube/spfjs` was created 2014-05-02 and has since been **archived** on GitHub (archived = true; ~2.3k stars), meaning it is read-only. The project was open-sourced by Google in 2014 under the MIT license ("Copyright 2012-2017 Google, Inc." per the README license line). The final release is **v2.4.0 (2016-06-23)**. npm history of the `spf` package runs from **2.0.0-alpha.1 (2014-07-11)** through **v2.4.0 (2016-06-23)**; the npm package has **no 1.x releases** (npm metadata via [registry.npmjs.org/spf](https://registry.npmjs.org/spf), repo metadata via [api.github.com/repos/youtube/spfjs](https://api.github.com/repos/youtube/spfjs)). Note: the repository's git tags only go back to v2.0.0, and the pre-2.0 era used a different source layout; early (1.x-era, pre-open-source) spfjs.org documentation described activating SPF with `data-spf` attributes on links rather than the `spf-link` class — **(unverified via archive — Wayback was down during research; not confirmed from any other primary source)**.

**Repository layout (master = v2.4.0).** Client source under `src/client/` (modules: `base.js`, `bootloader.js`, `config.js`, `state.js`, `main.js`; `nav/{nav,request,response}.js`; `net/{connect,xhr,resource,script,style}.js`; plus `cache/`, `history/`, `dom/`, `pubsub/`, `tasks/`, `async/`, `url/`, `string/`, `array/`, `debug/`, `tracing/`, `testing/`), a Python reference server under `src/server`, documentation sources under `doc/`, and the docs-site source under `web/` (verified from the local clone at `/tmp/spfjs-src-verify`). The repo also ships a demo app runnable with `npm install && npm start` → http://localhost:8080/ (Get Started docs).

---

## 2. How It Works

### 2.1 Progressive enhancement and link activation

SPF does not change a site's navigation automatically; it uses **progressive enhancement**. The developer adds the class `spf-link` to an `<a>` tag (or to a container of links, or to a form) to activate SPF for it, and `spf-nolink` to opt an element (or subtree) back out ([Get Started](http://youtube.github.io/spfjs/documentation/start/), [nav.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/nav.js)). The class names are configurable via `link-class` and `nolink-class`.

```html
<!-- Link enabled: a SPF request will be sent -->
<a class="spf-link" href="/destination">Go!</a>
```

After `spf.init()`, `spf.nav.init()` installs a document-level `click` listener (`spf.nav.handleClick_`) ([nav.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/nav.js)). On each click the handler:

1. bails if `evt.defaultPrevented` (another handler already canceled it);
2. ignores clicks with modifier keys (`metaKey`/`altKey`/`ctrlKey`/`shiftKey`) or non-left buttons (`button > 0`);
3. walks up the DOM looking for an ancestor with the `link-class`; if none, ignores the click; if an ancestor with `nolink-class` is found, ignores the click;
4. finds the nearest ancestor with an `href` (excluding `<img>`), then
5. checks same-origin (`spf.nav.isAllowed_`) and eligibility (`spf.nav.isEligible_`: navigation must be initialized, within `navigate-limit` navigations per session, and within `navigate-lifetime`);
6. dispatches the `spfclick` event (cancelable — canceling it aborts SPF handling, i.e. the click is ignored);
7. navigates, then calls `evt.preventDefault()` to stop the browser's default navigation (no full page reload).

Optionally, if `experimental-prefetch-mousedown` is set and the platform is not touch-capable, a `mousedown` listener prefetches the link's URL. A `scroll` listener also guards against premature scrolling during history changes (scroll position is saved and restored until content is updated).

### 2.2 The request: identifier and headers

SPF sends an XHR for the destination URL with a **configurable identifier appended** so the server can distinguish SPF requests from normal ones. The default identifier is `?spf=__type__`, where `__type__` is the request type — producing `?spf=navigate`, `?spf=prefetch`, `?spf=load` ([Get Started](http://youtube.github.io/spfjs/documentation/start/), [url.js](https://github.com/youtube/spfjs/blob/master/src/client/url/url.js)). `spf.url.identify()` supports three identifier styles ([url.js](https://github.com/youtube/spfjs/blob/master/src/client/url/url.js), tests in `url_test.js`):

- **query-based** (`?spf=__type__`): appended to the query string — `/path` → `/path?spf=navigate`, `/path?q=1` → `/path?q=1&spf=navigate`;
- **extension-based** (`.spf.json`): replaces the file extension (or appends `index.ident` to a directory URL);
- **path-based**: appended to the path.

The server may instead use the **header-based identifier** (advanced): with `advanced-header-identifier` configured, SPF sends `X-SPF-Request: navigate` (the `__type__` placeholder is replaced by the request type) plus `Accept: application/json` instead of the URL parameter ([request.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/request.js)). The source documents two caveats verbatim:

1. "The server MUST return a `Vary` header on some value that is different between SPF requests and default browser requests to avoid caching problems" — the recommended approach is `Vary: Accept`, since the SPF request sends `Accept: application/json`;
2. "The server MUST use SPF-based redirection, as custom headers (i.e. the `X-SPF-Request` header) are typically not propagated by browsers during 30X HTTP redirection."

Other headers ([request.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/request.js)):

- `X-SPF-Referer` — set for history navigations from `options.referer` (the referring URL, without the SPF identifier);
- `X-SPF-Previous` — set from `options.current` (the previously visible URL), again for history navigations;
- `request-headers` (config) — a map of additional headers applied to every request (options-provided headers override config headers).

Transport details: requests are GET by default (POST is used when `postData`/method `POST` is specified, with the `postData` type being `ArrayBuffer | Blob | Document | FormData | null | string`); `request-timeout` configures an optional timeout (default 0 = none); the advanced config `advanced-response-type-json` sets `xhr.responseType = 'json'` (more efficient parsing of large responses, at the cost of losing on-the-fly chunked parsing).

### 2.3 The response wire format

The SPF response is a **JSON object** (transport is JSON; see [Get Started](http://youtube.github.io/spfjs/documentation/start/) and [Responses](http://youtube.github.io/spfjs/documentation/responses/)). Fields (all optional; the commonly needed ones are `title`, `head`, `body`, `foot`):

| Field       | Type    | Meaning                                                                  |
| ----------- | ------- | ------------------------------------------------------------------------ |
| `title`     | string  | New document title                                                       |
| `url`       | string  | Correct URL for the current request; replaces the current URL in history |
| `head`      | string  | HTML containing CSS and/or JS tags to install early                      |
| `attr`      | object  | Map of element IDs → maps of attribute name → value                      |
| `body`      | object  | Map of element IDs → HTML strings (may contain script/style tags)        |
| `foot`      | string  | HTML containing JS and/or CSS tags to install late                       |
| `redirect`  | string  | URL to request instead                                                   |
| `reload`    | boolean | Page should be fully reloaded                                            |
| `cacheKey`  | string  | Cache key used to store this response                                    |
| `cacheType` | string  | Type of caching to use for this response                                 |
| `timing`    | object  | Map of timing attributes to timestamps                                   |
| `data`      | any     | Reserved for client data of any type                                     |

**Processing order** (from [Responses](http://youtube.github.io/spfjs/documentation/responses/), confirmed in [response.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/response.js)):

1. `title` — update document title
2. `url` — update document URL (history replaced)
3. `head` — install early JS and CSS
4. `attr` — set element attributes
5. `body` — set element content and install JS and CSS
6. `foot` — install late JS and CSS

The `head`/`foot` split follows the good practice of "styles in the head, scripts at the end of the body"; `foot` represents "end of body" without requiring an explicit element. `body` values replace the `innerHTML` of the element with the given DOM id.

**`redirect` / `reload` handling.** If the response has `reload: true`, SPF performs a full page reload (dispatching `spfreload` with a reason). If it has `redirect: <url>`, SPF issues a new request to that URL instead, replacing the current history entry and preserving the URL hash ([nav.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/nav.js)).

**Multipart (streaming) responses.** A server may send a multipart SPF response by setting the headers `X-SPF-Response-Type: multipart` and `Transfer-Encoding: chunked`. The response body is a stream of JSON parts that SPF parses **on the fly** as chunks arrive, processing each part as it is received (early rendering). Each part is a `spf.SingleResponse`; the complete logical response is a `spf.MultipartResponse` (`type: "multipart"`, `parts: [...]`). The `spfpartprocess` event fires before each part is processed and `spfpartdone` after. The API reference notes that with valid multipart/chunked headers, the `onPartProcess`/`onPartDone` callbacks "will be executed on-the-fly as chunks are received." (See [Multipart Responses](http://youtube.github.io/spfjs/documentation/features/multipart/) — the official page is a stub that says "We will be adding documentation and code samples to explain and demonstrate this functionality in coming weeks" — and the chunking implementation in [request.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/request.js) / [response.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/response.js).)

### 2.4 History handling

SPF uses the **HTML5 History API**: `history.pushState` for forward navigations, `popstate` listener for back/forward, `history.replaceState` for URL corrections (the `url` response field, redirects, and storing per-entry state). When navigating, SPF first replaces the current entry with the current scroll position (`spf-position`), then pushes the new entry with `spf-referer` state ([nav.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/nav.js), [history.js](https://github.com/youtube/spfjs/blob/master/src/client/history/history.js)).

On `popstate`, the history module compares entry timestamps (`spf-timestamp`) to determine direction, sets `spf-back`/`spf-current` on the state, and invokes the navigation callback, which fires `spfhistory` and then performs a history-type request (`navigate-back` or `navigate-forward`). Back/forward navigations read the response from the **local cache** instead of the network when available (see §2.5), and after processing, restore the saved scroll position. Scroll restoration is deferred until content is updated to avoid the browser's premature default scroll ([nav.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/nav.js)).

**Old-IE fallback.** `spf.init()` returns `false` if the HTML5 history modification API is unsupported (the API reference: "If the HTML5 history modification API is not supported, returns false"). Internally, `spf.history.doPushState_`/`doReplaceState_` verify `pushState`/`replaceState` are callable on the contentWindow of a helper iframe (`spf.history.getIframe()`, a `history-iframe` element created on demand) — a workaround for third-party code that breaks `pushState` and for environments with partial support ([history.js](https://github.com/youtube/spfjs/blob/master/src/client/history/history.js), [main.js](https://github.com/youtube/spfjs/blob/master/src/client/main.js)). The README's support statement limits dynamic navigation to History-API browsers (IE 10+).

**Failure fallback.** If a navigation request fails, the response fails to parse, or a cancelable event is canceled during navigation, SPF falls back to a **full browser redirect** to the URL (`spf.nav.reload`, which sets `window.location.href`). If `reload-identifier` is configured, the reload URL gets a query parameter with that name whose value is the URL-encoded reload reason ([nav.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/nav.js)).

### 2.5 Cache

SPF keeps a **local, in-memory, configurable response cache** to avoid network requests ([Caching](http://youtube.github.io/spfjs/documentation/caching/)):

- Before sending a request, SPF checks the cache for a valid entry for the URL; if found, it is used instead of a network request (returned asynchronously to mimic XHR timing). If not, the received response is stored for future use ([request.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/request.js)).
- **Default policy (bfcache-like):** cached responses are eligible only for _history_ navigations (back/forward), matching the browser back-forward cache — the server receives requests for every link click, but not for back-button uses. With `cache-unified: true`, any cached response is eligible for all navigations.
- **Prefetched responses:** stored as eligible for **one** _new_ navigation; after that single use they become history-only. With `cache-unified: true` they behave like other cached entries.
- Implementation: cache keys are the absolute URL (identifier stripped); with the default (non-unified) model, entries are namespaced by purpose — `'prefetch ' + url` when set by a prefetch and read by a new navigation, `'history ' + url` when set by a navigation or back/forward and read by history navigation; responses can additionally be scoped with `' previous ' + current URL` (cacheType `url`) or `' previous ' + path` (cacheType `path`) ([request.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/request.js)).
- **Configuration:** `cache-lifetime` (600000 ms = 10 min), `cache-max` (50 entries), `cache-unified` (false).
- **Garbage collection** (automatic, at two times): (1) if a requested entry is found but expired per the lifetime, it is removed instead of used; (2) each time a new entry is added, asynchronous GC runs — first removing all expired entries, then evicting entries beyond `cache-max` with a **least-recently-used (LRU)** policy ([Caching](http://youtube.github.io/spfjs/documentation/caching/)).
- **Manual adjustment:** each `spfdone` event carries a `cacheKey` on the response object; `spf.cache.remove(key)` removes one entry and `spf.cache.clear()` removes all (both affect normal and history navigations). Example use: a user action changes the page, so you evict the stale entry to force a fresh request.

### 2.6 Script and style management

SPF extracts scripts and styles from response fragments and handles them in two ways ([Resources](http://youtube.github.io/spfjs/documentation/resources/)):

**Unmanaged resources.** Scripts and styles inside `head`, `body`, and `foot` fragments are extracted and executed by appending them to the document `<head>`. SPF **waits for script loading/execution to complete before continuing**, matching browser behavior and preserving execution order; add the `async` attribute to a script to avoid waiting. These steps repeat on every navigation (each visit re-executes them).

**Managed resources.** A resource with a **`name` attribute** (on `<script>`, `<style>`, or `<link rel="stylesheet">`) is loaded only once across navigations. When the same name appears again, SPF skips reloading it. Example from the docs: a shared `common-library.js` (named `common`) used by both a search page and an item page loads once; navigating search → item → search → item loads each page script only the first time it is encountered. Named resources are also the basis for dependency management and unloading via the `spf.script.*`/`spf.style.*` APIs (see §3).

**Versioning** ([Versioning](http://youtube.github.io/spfjs/documentation/versioning/)) — automatic version switching applies only to managed resources. SPF tracks the external URL or inline text associated with each resource name; if a changed URL or text is discovered in a response, SPF unloads the existing resource and loads the new one. To guarantee switching between versions, "use a unique URL each time" (e.g. `common-library-v1.js` → `common-library-v2.js`). For inline scripts/styles, SPF tracks a **quick hash of the text content**; whitespace is ignored when computing the hash, so formatting/indentation changes do not trigger updates (implemented as `'hash-' + spf.string.hashcode(text.replace(/\s/g, ''))` in [resource.js](https://github.com/youtube/spfjs/blob/master/src/client/net/resource.js)). Resource unload events: `spfcssbeforeunload`, `spfcssunload`, `spfjsbeforeunload`, `spfjsunload`. When switching versions, the **old style is unloaded only after the new style is loaded** (to avoid flashes of unstyled content); old scripts are likewise unloaded after the new script loads for consistency.

### 2.7 Prefetching

Prefetching fetches responses before they are requested ([Prefetching](http://youtube.github.io/spfjs/documentation/prefetching/)):

- `spf.prefetch(url)` behaves nearly identically to `spf.navigate` and accepts the same `spf.RequestOptions` callbacks (`onRequest` → Abort, `onProcess` → Abort, `onDone`). The request carries the identifier `?spf=prefetch` by default. The received response is stored in the local cache as eligible for **one** "new" navigation; after that one use it becomes history-only (unless `cache-unified: true`).
- When a prefetched response is processed, SPF **prefetches its resources** to prime the browser cache: scripts and stylesheets referenced by the response are requested but not loaded, so a later navigation finds them already cached.
- Manual resource prefetching: `spf.script.prefetch(urls)` and `spf.style.prefetch(urls)` ("the scripts will be requested but not loaded").
- Implementation detail: a navigation to a URL with a prefetch **still in flight** "promotes" the prefetch XHR into the navigation request rather than issuing a second request (task queues keyed per URL, `spf.nav.promoteKey`/`preprocessKey` in [nav.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/nav.js)); other in-flight prefetches are aborted to reduce network contention.

### 2.8 Lifecycle and events

All SPF events are `spf.Event` objects — cancelable `CustomEvent`s dispatched on `document` with a `detail` property conforming to `spf.EventDetail` ([Events](http://youtube.github.io/spfjs/documentation/events/), [base.js](https://github.com/youtube/spfjs/blob/master/src/client/base.js)). The navigation lifecycle:

```
spfready → (spfclick | spfhistory) → spfrequest → spfprocess → spfdone
```

- `spfready` — dispatched once when the SPF API finishes loading/exporting ([main.js](https://github.com/youtube/spfjs/blob/master/src/client/main.js)).
- `spfclick` — a valid `spf-link` click is being handled (early indication of navigation; element-level UI feedback).
- `spfhistory` — a `popstate` back/forward navigation is being handled (like `spfclick` for history).
- `spfrequest` — before a request is sent, for all navigation types (clicks, back/forward, API calls); "fired even if a response is fetched from cache and no actual network request is made" — good place to start a progress bar.
- `spfprocess` — a response was received (network or cache), before it is processed — advance the progress bar, dispose event listeners.
- `spfdone` — after processing completes — finalize UI feedback, initialize listeners.
- `spferror` — a request/parse error occurred (detail: `err`, `url`, `xhr`); canceling prevents the default full-page reload fallback.
- `spfreload` — a reload is about to happen (detail: `url`, `reason`).
- `spfpartprocess` / `spfpartdone` — before/after each part of a multipart response is processed.
- `spfcssbeforeunload`, `spfcssunload`, `spfjsbeforeunload`, `spfjsunload` — before/after managed style/script resources are unloaded (version switching).

**Cancellation semantics.** "Almost all events and callbacks can be canceled by calling `preventDefault` or returning `false`, respectively" ([Events](http://youtube.github.io/spfjs/documentation/events/)):

| Event        | Callback    | State                         | Cancel action |
| ------------ | ----------- | ----------------------------- | ------------- |
| `spfclick`   | —           | Link Clicked                  | **Ignore**    |
| `spfhistory` | —           | Back/Forward Clicked          | **Ignore**    |
| `spfrequest` | `onRequest` | Started; Sending Request      | **Reload**    |
| `spfprocess` | `onProcess` | Processing; Response Received | **Reload**    |
| `spfdone`    | `onDone`    | Done                          | —             |

For prefetching the equivalent callbacks (`onRequest`, `onProcess`) cancel with **Abort**. In the source, callbacks returning `false` stop the operation ([nav.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/nav.js), `spf.nav.callback`), and event listeners calling `preventDefault()` cancel the underlying `CustomEvent` ([base.js](https://github.com/youtube/spfjs/blob/master/src/client/base.js)).

---

## 3. Public API Reference (v2.4.0)

From the official API reference ([youtube.github.io/spfjs/api/](http://youtube.github.io/spfjs/api/)). The API is exported on the global `spf` object; core functions live on the top-level namespace, extras on second-level namespaces ([main.js](https://github.com/youtube/spfjs/blob/master/src/client/main.js)).

### 3.1 `spf` (top-level)

- **`spf.init(opt_config)`** → `boolean`. Initializes SPF. `opt_config: Object` optional global config. Returns whether initialization succeeded; **false if the HTML5 history modification API is unsupported**.
- **`spf.dispose()`** — Disposes SPF.
- **`spf.navigate(url, opt_options)`** — Navigates to a URL. A pushState history entry is added; if the request/response fails, the browser is redirected to the URL. **Only a single navigation request can be in flight at once; a second `navigate` cancels the first.** `url` is the destination without the SPF identifier; `opt_options: Object | spf.RequestOptions`.
- **`spf.load(url, opt_options)`** → `XMLHttpRequest`. Loads a URL for traditional content updates, not page navigation; not subject to the single-request limit.
- **`spf.process(response, opt_callback)`** — Processes an SPF response on the current page outside a navigation flow. `response: spf.SingleResponse | spf.MultipartResponse`; `opt_callback(response)` runs when done.
- **`spf.prefetch(url, opt_options)`** → `XMLHttpRequest`. Prefetches a URL: primes the SPF request cache with the content and the browser cache with script/stylesheet URLs; a successfully parsed response is also preprocessed to prefetch its scripts and stylesheets.

### 3.2 `spf.cache`

- **`spf.cache.remove(key)`** — Removes one entry (pass a `cacheKey` from a response object); affects normal and history navigations.
- **`spf.cache.clear()`** — Clears all entries.

### 3.3 `spf.script` (script loading)

- **`spf.script.load(url, name, opt_fn)`** — Loads a script asynchronously and defines a `name` for dependency management/unloading. Subsequent loads of the same URL do not reload; unload first to reload. When a name is given, all other scripts with the same name are unloaded before the callback runs (enables version switching, e.g. "main-A.js"/"main-B.js" are both "main"). The callback runs each time, even if the script was not reloaded.
- **`spf.script.unload(name)`** — Unloads a script by name. Note: prevents execution of all pending callbacks but is "NOT guaranteed to stop the browser loading a pending URL."
- **`spf.script.get(url, opt_fn)`** — Unconditionally loads a script by creating an element and appending it, ignoring dependencies/previous loads; cannot be unloaded by name. Compare with `load`.
- **`spf.script.ready(names, opt_fn, opt_require)`** — Waits for one or more named scripts to load, then executes `opt_fn`; `opt_require` executes if names are specified that have not yet been defined/loaded.
- **`spf.script.ignore(names, fn)`** — Cancels a pending callback registered by `load`/`ready` (the same names must be used as when registered).
- **`spf.script.done(name)`** — Notifies waiting callbacks that `name` has completed loading; use with `ready` for arbitrary readiness not tied to scripts.
- **`spf.script.require(names, opt_fn)`** — Recursively loads scripts by name, loading dependencies first (dependencies defined by `declare`).
- **`spf.script.unrequire(names)`** — Recursively unloads scripts by name, unloading dependencies first.
- **`spf.script.declare(deps, opt_urls)`** — Sets the dependency map (and optional URL map) used by `require`.
- **`spf.script.path(paths)`** — Sets the path prefix or replacement map for resolving relative URLs (replacement order not guaranteed).
- **`spf.script.prefetch(urls)`** — Prefetches one or more scripts (requested but not loaded) to prime the browser cache.

### 3.4 `spf.style` (stylesheet loading)

- **`spf.style.load(url, name, opt_fn)`** — Loads a stylesheet asynchronously with a name for management/unloading; same-URL reloads are skipped; same-name stylesheets are unloaded on version switch. The load callback is best-effort (supported in IE 6, Chrome 19, Firefox 9, Safari 6 per the API docs).
- **`spf.style.unload(name)`** — Unloads a stylesheet by name.
- **`spf.style.get(url)`** — Unconditionally loads a stylesheet; cannot be unloaded by name.
- **`spf.style.path(paths)`** — Sets the path prefix/replacement map for relative URLs.
- **`spf.style.prefetch(urls)`** — Prefetches one or more stylesheets (requested but not loaded).

### 3.5 Classes

- **`spf.SingleResponse`** — A single SPF response object. Attributes: `attr` (Object<string, Object<string,string>>), `body` (Object<string,string>), `cacheKey` (string), `cacheType` (string), `data` (*), `head` (string), `foot` (string), `redirect` (string), `reload` (boolean), `timing` (Object<number|string|boolean>), `title` (string), `url` (string). All optional.
- **`spf.MultipartResponse`** — A multipart SPF response. Attributes: `cacheKey` (string), `cacheType` (string), `parts` (Array<spf.SingleResponse>), `timing` (Object<string,number>), `type` (string, always `"multipart"`).
- **`spf.RequestOptions`** — Options when requesting a URL. Attributes: `headers` (Object<string>), `method` (string, defaults to `"GET"`), `postData` (ArrayBuffer | Blob | Document | FormData | null | string; only used with POST), and callbacks `onError`, `onRequest`, `onProcess`, `onPartProcess`, `onPartDone`, `onDone`. Each callback receives an object conforming to the `spf.EventDetail` interface for the corresponding event name (e.g. `onRequest` receives the `spfrequest` detail).
- **`spf.Event`** — CustomEvents dispatched by SPF. Attribute: `detail` (`spf.EventDetail`).
- **`spf.EventDetail`** — The CustomEvent `detail` attribute, also used as callback arguments. Attributes: `err` (Error; `spferror`), `name` (string; resource unload events), `part` (spf.SingleResponse; `spfpartprocess`/`spfpartdone`), `previous` (string; `spfhistory`/`spfrequest`), `reason` (string, reason code + text, debug only; `spfreload`), `referer` (string; `spfhistory`/`spfrequest`), `response` (spf.SingleResponse | spf.MultipartResponse; `spfprocess`/`spfdone`), `target` (Element; `spfclick`), `url` (string; most events), `xhr` (XMLHttpRequest; error events).
- **`spf.TaskScheduler`** — Scheduler API the application can use to control task execution.
  - **`spf.TaskScheduler#addTask(task)`** → `number` — adds a task executed asynchronously as determined by the scheduler; returns the task ID.
  - **`spf.TaskScheduler#cancelTask(id)`** — cancels a task that has not yet been executed.

---

## 4. Events (names, timing, payload, cancellation)

All events are `spf.Event` (`CustomEvent`) objects dispatched on `document`; detail conforms to `spf.EventDetail`; canceling means calling `preventDefault()` on the event (or returning `false` from the corresponding RequestOptions callback, which prevents the event from being dispatched at all).

| Event                | Fired when                                              | Detail fields                           | Cancelable?                         |
| -------------------- | ------------------------------------------------------- | --------------------------------------- | ----------------------------------- |
| `spfready`           | API finished loading (once)                             | —                                       | —                                   |
| `spfclick`           | handling a valid `spf-link` click                       | `url`, `target`                         | yes → Ignore (link not SPF-handled) |
| `spfhistory`         | handling a `popstate` back/forward                      | `url`, `referer`, `previous`            | yes → Ignore                        |
| `spfrequest`         | before a request is sent (network or cache)             | `url`, `referer`, `previous`            | yes → Reload                        |
| `spfprocess`         | response received, before processing (single responses) | `url`, `response`                       | yes → Reload                        |
| `spfdone`            | processing complete                                     | `url`, `response` (single or multipart) | —                                   |
| `spferror`           | request/parse error                                     | `url`, `err`, `xhr`                     | yes (prevents reload fallback)      |
| `spfreload`          | a reload is about to occur                              | `url`, `reason`                         | —                                   |
| `spfpartprocess`     | before a multipart part is processed                    | `url`, `part`                           | yes (Reload for navigation)         |
| `spfpartdone`        | after a multipart part is processed                     | `url`, `part`                           | —                                   |
| `spfcssbeforeunload` | before unloading a managed style                        | `url`, `name`                           | —                                   |
| `spfcssunload`       | when unloading a managed style                          | `url`, `name`                           | —                                   |
| `spfjsbeforeunload`  | before unloading a managed script                       | `url`, `name`                           | —                                   |
| `spfjsunload`        | when unloading a managed script                         | `url`, `name`                           | —                                   |

Lifecycle order: `spfready` → (`spfclick` | `spfhistory`) → `spfrequest` → `spfprocess` → `spfdone`. Event names in source: `spf.EventName` enum in [base.js](https://github.com/youtube/spfjs/blob/master/src/client/base.js) (CLICK `'spfclick'`, CSS_BEFORE_UNLOAD `'spfcssbeforeunload'`, CSS_UNLOAD `'spfcssunload'`, DONE `'spfdone'`, ERROR `'spferror'`, HISTORY `'spfhistory'`, JS_BEFORE_UNLOAD `'spfjsbeforeunload'`, JS_UNLOAD `'spfjsunload'`, PART_DONE `'spfpartdone'`, PART_PROCESS `'spfpartprocess'`, PROCESS `'spfprocess'`, READY `'spfready'`, RELOAD `'spfreload'`, REQUEST `'spfrequest'`).

---

## 5. Configuration

Passed to `spf.init(opt_config)` as a plain object. Defaults from [src/client/config.js](https://github.com/youtube/spfjs/blob/master/src/client/config.js):

| Key                  | Default            | Meaning                                                                                                    |
| -------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `animation-class`    | `'spf-animate'`    | CSS class for animation during navigation                                                                  |
| `animation-duration` | `425`              | Animation duration (ms)                                                                                    |
| `cache-lifetime`     | `600000` (10 min)  | Max time (ms) a cache entry is considered valid                                                            |
| `cache-max`          | `50`               | Max number of cache entries                                                                                |
| `cache-unified`      | `false`            | Whether all cache responses are eligible for all navigations                                               |
| `link-class`         | `'spf-link'`       | Class that enables SPF on a link/container                                                                 |
| `nolink-class`       | `'spf-nolink'`     | Class that opts out of SPF                                                                                 |
| `navigate-limit`     | `20`               | Max navigations per session                                                                                |
| `navigate-lifetime`  | `86400000` (1 day) | Session lifetime (ms)                                                                                      |
| `reload-identifier`  | `null`             | Query param name appended (with the reason) on reloads; "Always a param, no '?' needed"                    |
| `request-timeout`    | `0`                | Request timeout (ms); 0 = none                                                                             |
| `url-identifier`     | `'?spf=__type__'`  | Identifier appended to URLs; `__type__` replaced by the request type (e.g. `navigate`, `prefetch`, `load`) |

**Advanced / experimental keys** (no defaults; set only if provided; `config.init` copies any non-default key into config, [config.js](https://github.com/youtube/spfjs/blob/master/src/client/config.js)):

- `request-headers` — object map of headers sent with every request (options-level headers override these).
- `advanced-header-identifier` — e.g. `'X-SPF-Request: __type__'`-style identifier: sends `X-SPF-Request: <type>` and `Accept: application/json` instead of the URL identifier (requires server `Vary` handling and SPF-based redirects; see §2.2).
- `advanced-response-type-json` — set `xhr.responseType = 'json'` (faster parsing of large responses; disables on-the-fly multipart chunking).
- `advanced-navigate-persist-timing` — when set, Resource Timing entries are not cleared before navigations (default clears them).
- `experimental-prefetch-mousedown` — prefetch `spf-link` URLs on `mousedown` (non-touch platforms).
- `experimental-remove-history` — on reload fallback, remove the current history entry first (Chrome/Firefox 301 divergence workaround).
- `experimental-html-handler` — noted in a source TODO as a function-typed config (experimental).

---

## 6. Minimal Working Example

From [Get Started](http://youtube.github.io/spfjs/documentation/start/):

**Client — enable SPF:**

```html
<script src="PATH-TO-YOUR-JS/spf.js"></script>
<script>
  spf.init();
</script>
```

**Client — activate a link (progressive enhancement):**

```html
<!-- Static navigation: -->
<a href="/destination">Go!</a>

<!-- Dynamic navigation: a SPF request will be sent -->
<a class="spf-link" href="/destination">Go!</a>
```

**Server — respond to the SPF request.** Static navigation receives `GET /destination` and returns a full HTML page. Dynamic navigation receives `GET /destination?spf=navigate` (the default identifier) and returns only the changed fragments as JSON. For the common masthead/content/footer layout where only `#content` changes:

```json
{
  "head": "<!-- Styles -->",
  "body": {
    "content": "<!-- Content -->"
  },
  "foot": "<!-- Scripts -->"
}
```

`head` carries early CSS/JS, `body` maps DOM ids to HTML content (element contents replaced), and `foot` carries late JS/CSS. Add `title`, `attr`, `url`, `redirect`, `reload`, `cacheKey`, `cacheType`, `timing`, and `data` as needed (see §2.3). For an end-to-end demo, the repo ships a Python demo: `cd spfjs && npm install && npm start`, then open http://localhost:8080/.

---

## 7. Legacy Status & Context

- **Last release:** v2.4.0 (2016-06-23). The npm `spf` package history spans 2.0.0-alpha.1 (2014-07-11) → v2.4.0; there are no 1.x npm releases ([registry.npmjs.org/spf](https://registry.npmjs.org/spf)).
- **Archived:** the `youtube/spfjs` repository is archived on GitHub (read-only; created 2014-05-02, ~2.3k stars, `archived: true` per the GitHub API).
- **Still-live docs:** the official documentation site http://youtube.github.io/spfjs/ remains fully online (API reference, all documentation sections, download page). The docs site itself is a dogfooded SPF app (it loads `spf.js` 2.1.1 and uses `spf-link` classes).
- **Stale spots in the docs:** the [Multipart Responses](http://youtube.github.io/spfjs/documentation/features/multipart/) page is an unfinished stub promising "documentation and code samples … in coming weeks"; the [Features](http://youtube.github.io/spfjs/documentation/features/) page is a bare index listing only the multipart guide.
- **Why it mattered / legacy:** SPF was an early, polished exemplar of the "static first render + dynamic fragment updates" architecture — the same idea as GitHub's **pjax** (2011), **Turbolinks** (Rails, 2012), and later **Turbo** (Hotwire), **barba.js**, and **htmx** (which popularized fragment swapping driven by server responses and HTML attributes). SPF's distinctive contributions were the streaming **multipart JSON response protocol** with on-the-fly processing, an explicit **managed-resource (script/style) system with version switching** (including inline-text hashing), a **bfcache-matching in-memory response cache** with LRU GC, and prefetch/promotion of in-flight requests. Modern successors largely re-implement subsets of these ideas (Turbo Drive for navigation + Turbo Frames for fragments; htmx for attribute-driven fragment swapping), which is a large part of why SPF remains historically interesting despite being archived.
- **Caveats for anyone reviving it:** built for the 2012–2016 browser landscape (IE 8+ support for resource loading, `document.createEvent('CustomEvent')`, no module system — Closure-compiled UMD with a global `spf` object); the docs' server-side Python example and the `spfjs@googlegroups.com`/Twitter support channels are defunct.

---

## 8. Sources

**Official documentation (live; primary source):**

- [http://youtube.github.io/spfjs/](http://youtube.github.io/spfjs/) — home / overview
- [http://youtube.github.io/spfjs/api/](http://youtube.github.io/spfjs/api/) — full API reference (v2.4.0)
- [http://youtube.github.io/spfjs/documentation/start/](http://youtube.github.io/spfjs/documentation/start/) — Get Started (enable, requests, minimal response)
- [http://youtube.github.io/spfjs/documentation/responses/](http://youtube.github.io/spfjs/documentation/responses/) — response format and processing order
- [http://youtube.github.io/spfjs/documentation/events/](http://youtube.github.io/spfjs/documentation/events/) — lifecycle, event descriptions, cancellations
- [http://youtube.github.io/spfjs/documentation/resources/](http://youtube.github.io/spfjs/documentation/resources/) — unmanaged vs managed resources
- [http://youtube.github.io/spfjs/documentation/versioning/](http://youtube.github.io/spfjs/documentation/versioning/) — version switching and resource events
- [http://youtube.github.io/spfjs/documentation/caching/](http://youtube.github.io/spfjs/documentation/caching/) — cache policy, config, GC
- [http://youtube.github.io/spfjs/documentation/prefetching/](http://youtube.github.io/spfjs/documentation/prefetching/) — request/resource prefetching
- [http://youtube.github.io/spfjs/documentation/features/](http://youtube.github.io/spfjs/documentation/features/) — features index
- [http://youtube.github.io/spfjs/documentation/features/multipart/](http://youtube.github.io/spfjs/documentation/features/multipart/) — multipart responses (stub)
- [http://youtube.github.io/spfjs/download/](http://youtube.github.io/spfjs/download/) — download page

**Source code (github.com/youtube/spfjs, master = v2.4.0; verified from a local clone):**

- [README.md](https://github.com/youtube/spfjs/blob/master/README.md)
- [src/client/config.js](https://github.com/youtube/spfjs/blob/master/src/client/config.js) — config defaults
- [src/client/main.js](https://github.com/youtube/spfjs/blob/master/src/client/main.js) — init/dispose, API export
- [src/client/base.js](https://github.com/youtube/spfjs/blob/master/src/client/base.js) — `spf.EventName`, event dispatch
- [src/client/nav/nav.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/nav.js) — click handling, navigate/load/prefetch/process, events, reload fallback
- [src/client/nav/request.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/request.js) — headers, identifiers, caching keys, chunked multipart
- [src/client/nav/response.js](https://github.com/youtube/spfjs/blob/master/src/client/nav/response.js) — response processing order, fragment extraction
- [src/client/history/history.js](https://github.com/youtube/spfjs/blob/master/src/client/history/history.js) — pushState/popstate, iframe fallback
- [src/client/url/url.js](https://github.com/youtube/spfjs/blob/master/src/client/url/url.js) — `spf.url.identify`, absolute/path/origin helpers
- [src/client/net/resource.js](https://github.com/youtube/spfjs/blob/master/src/client/net/resource.js) — resource load/unload, version hashing, unload events
- [package.json](https://github.com/youtube/spfjs/blob/master/package.json) — `spf` v2.4.0 metadata

**Metadata / registry:**

- [https://registry.npmjs.org/spf](https://registry.npmjs.org/spf) — npm package version history (2.0.0-alpha.1 → 2.4.0, no 1.x)
- [https://api.github.com/repos/youtube/spfjs](https://api.github.com/repos/youtube/spfjs) — repo metadata (created 2014-05-02, ~2.3k stars, archived)
- [https://github.com/youtube/spfjs](https://github.com/youtube/spfjs) — repository home

_Unverified note (per research constraints): the pre-2.0, pre-open-source era reportedly used `data-spf` attributes on links per early spfjs.org docs; this could not be confirmed because the Wayback Machine was down during research, and no other primary source was checked for it._
