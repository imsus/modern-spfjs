# Versioning

Automatically update script and style versions.

Dynamic navigation turns short-lived pages into a long-lived application.
Pushing new code then raises a real concern: you don't want old JS attempting
to interact with new HTML, or new CSS applying to old HTML. modern-spf keeps
managed resources in sync with content through **unique URLs per version**,
resolved centrally so the client never hardcodes a version.

> **Note:** Automatic versioning applies only to
> [managed resources](/guide/resources).

## How it works

Managed resources are registered by a **name**; loading is deduped by name,
and "unloading" drops the registry entry so the next load re-resolves the
specifier. The server controls what a name resolves to at any time — for
scripts, through the page's
[import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap):

```html
<script type="importmap">
  { "imports": { "player": "/assets/player.v2.js" } }
</script>
```

```js
await spf.script.load('player', 'player');
```

When you push a new version, update the import map and the registry:

```html
<script type="importmap">
  { "imports": { "player": "/assets/player.v3.js" } }
</script>
```

```js
spf.script.unload('player');      // drop the old registry entry
await spf.script.load('player');  // resolves /assets/player.v3.js
```

Because an ES module cannot be unmounted once loaded, "unloading" a managed
script only drops the registry entry — code already loaded keeps running
until the page reloads, and the next managed `load` picks up the new version
(see [ADR 0003](/adr/0003-import-map-driven-modules)).

Styles use the same name-based registry: `spf.style.load(url, name)` dedupes
by name, and `spf.style.unload(name)` removes the sheet from
`document.adoptedStyleSheets` (or removes the fallback `<link>`). Give each
version its own URL and re-load after unload to switch.

## What is not version-managed

Unmanaged resources — classic `<script>`/`<link>` tags inside `head`/`foot`
response HTML — are re-installed on every navigation, so they always reflect
the current response. Version switching is a managed-resource feature only.

## Resource teardown

modern-spf dispatches no per-resource unload events (the original SPF fired
`spf*css*`/`spf*js*` unload events; the modern API has no equivalent).
Teardown is an explicit `unload` call, and per-page listener disposal should
be coordinated through navigation events — dispose in `spfdone` (or earlier
in `spfclick`) handlers instead; see [Events](/guide/events).
