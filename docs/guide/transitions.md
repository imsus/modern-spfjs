# View transitions

SPF applies same-document **view transitions** around the DOM swap by default:
when the new content replaces the old, the browser animates the change instead
of flashing to a blank page.

## How it works

Only the **apply step** is wrapped in
[`document.startViewTransition()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition)
— the network fetch happens _outside_ the transition, so the old page stays
live and interactive while the response is in flight. Wrapping the fetch would
freeze the old snapshot for the whole request.

## When transitions are skipped

A transition does not run when any of these hold:

- the user prefers reduced motion
  (`prefers-reduced-motion: reduce` is respected automatically);
- the link has the `spf-no-transition` class;
- `noTransition: true` was passed in the request options;
- the browser lacks `document.startViewTransition`.

The `spfdone` event's detail includes `transitioned: true` when a transition
actually ran.

## Opting out

```html
<a class="spf-link spf-no-transition" href="/plain">No transition for this link</a>
```

```js
spf.navigate('/plain', { noTransition: true });
```

## Configuration

| Key                  | Default       | Meaning                                              |
| -------------------- | ------------- | ---------------------------------------------------- |
| `animation-class`    | `spf-animate` | Class added to animated elements during transitions. |
| `animation-duration` | `425`         | Informational transition duration in ms.             |

The view transition itself is CSS-driven — add styles for the `::view-transition`
pseudo-elements (or the `animation-class`) to customize the animation.
