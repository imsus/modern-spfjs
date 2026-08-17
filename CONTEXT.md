# SPFJS-Next (working title)

A modern re-creation of YouTube's SPF ("Structured Page Fragments") — a
lightweight, framework-agnostic JavaScript library for fast same-origin page
navigation: only the changed fragments of a page are fetched and applied,
never the whole page.

This glossary inherits its baseline vocabulary from the original SPF domain
(see `spfjs-research.md` for the reference). Terms are being sharpened as the
design is grilled out; unresolved or contested terms are marked.

## Language

**Navigation**:
Moving from one URL to another on the same origin without a full page load.
_Avoid_: page transition, routing, SPA navigation

**Fragment**:
A section of the page identified by an element ID whose content is replaced
during a navigation.
_Avoid_: region, component, slot, partial

**Response**:
The data describing what changed during a navigation — title, head, per-fragment
body, foot, attribute updates — in the SPF JSON wire format.
_Avoid_: page data, payload, state

**Part**:
One unit of a streamed Response — e.g. a single fragment's content, or the
head/foot — processed as it arrives rather than after the whole response is
received. Resolved: streamed as NDJSON parts over a single request.

**Managed Resource**:
A script or stylesheet registered by a name so it loads once across navigations
and can be swapped between versions. The counterpart of an _unmanaged resource_,
which is re-executed on every navigation.
_Avoid_: asset, dependency, bundle

**Prefetch**:
Fetching a navigation's response (and priming its resources) before the user
actually triggers the navigation.
_Avoid_: preload, prerender (distinct browser primitives — terms not yet settled)

**Response Cache**:
The local store of previously received Responses, used to avoid network
requests on repeat and back/forward navigations.
_Avoid_: HTTP cache, bfcache (different mechanisms)

**New vs History Navigation**:
A _new_ navigation is user- or API-initiated; a _history_ navigation is
back/forward. The cache treats them differently: a cached response is only
eligible for history navigation unless unified. Resolved: this distinction is
kept.

**SPF Identifier**:
The URL marker (default `?spf=__type__`, e.g. `?spf=navigate`) that tells the
server a request is an SPF request. Resolved: kept, with the response type
negotiated via the `Accept` header.

**SPF Link**:
An `<a>` or `<form>` element marked with the `spf-link` class (class name
configurable) that triggers SPF navigation; `spf-nolink` opts an element out.

**Module Specifier**:
A bare name or URL used to import a managed resource. Bare names resolve
through the page's import map; absolute URLs import directly. Version
switching happens by changing what a specifier resolves to, not by reloading
the same URL.
