---
layout: home

hero:
  name: modern-spf
  text: Fast same-origin navigation, the SPF way
  tagline: Fetch only the fragments that change — never the whole page. A modern re-creation of YouTube's SPF, built on the Navigation API, view transitions, streaming, and ES modules.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/spf

features:
  - title: Fragment-only navigation
    details: Clicking an spf-link fetches a small JSON response describing what changed — title, head, per-fragment body — and swaps it in via the Navigation API, instead of a full page load.
  - title: Streaming by default
    details: Servers may answer with an NDJSON stream of parts so the page updates as the response arrives — head and body land before the stream finishes.
  - title: Hybrid response cache
    details: An in-memory LRU plus the Cache API serve back/forward navigations instantly, while new navigations always hit the server unless a prefetched response is available.
  - title: Zero runtime dependencies
    details: 'Evergreen browsers only, no polyfills. Built on modern primitives: Navigation API, constructable stylesheets, speculation rules, ES modules.'
  - title: Concept-compatible with SPF
    details: The familiar surface — spf.init, spf.navigate, spf* events, the spf-link class — with modern, Promise-aware, typed semantics.
  - title: Same-document view transitions
    details: Default-on transitions around the DOM swap, respecting prefers-reduced-motion, with per-link and per-call opt-outs.
---
