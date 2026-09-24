# Why `btn btn-primary loading` eats the label

## `loading` is a component, not a button modifier

In DaisyUI v1/v2, `loading` *was* a `btn` modifier: it injected a spinner via a
pseudo-element and left the button's text alone. From DaisyUI v3 onward (and in
v4/v5, which is what Scaffold-ETH 2 ships), `loading` was promoted to its own
standalone component — it is meant to be put on an empty `<span>`, never on an
element that has children you want to see.

The `loading` class roughly expands to:

```css
.loading {
  pointer-events: none;
  display: inline-block;
  aspect-ratio: 1 / 1;
  width: 1.5rem;                 /* loading-md, the default size */
  background-color: currentColor;
  -webkit-mask-image: url("data:image/svg+xml,…spinner…");
          mask-image: url("data:image/svg+xml,…spinner…");
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: 100%;
}
```

Every one of those declarations fights the button:

1. **`mask-image` clips the whole element, children included.** A CSS mask is
   applied to the element's entire rendered subtree — background, borders, *and*
   text. Everything outside the spinner glyph's alpha channel is masked to
   transparent, and the part inside is painted flat `currentColor`. So
   "Approving..." is still in the DOM and still in the accessibility tree — it's
   just painted and then erased by the mask. That is the whole answer to "why
   does the label disappear": it isn't hidden, it's masked out.
2. **`aspect-ratio: 1/1` + `width: 1.5rem`** collapse the button to a square.
   Combined with `btn`'s `min-height: 3rem` / `min-width` rules you get a
   shape change on every state flip — that's the layout jump QA saw. In a flex
   row it also lets the neighbouring elements slide.
3. **`background-color: currentColor`** overrides `btn-primary`'s background, so
   the button loses its primary fill and becomes a solid-coloured spinner
   silhouette.
4. **`mask-size: 100%`** is why the spinner is "one big spinner filling the
   button" rather than a small glyph — the mask is scaled to the element box.
5. **`pointer-events: none`** silently duplicates what `disabled` already does,
   which is harmless but a hint you're using the wrong class.

It is identical on desktop and mobile because nothing here is
viewport-dependent — it's pure class semantics.

Note also `loading` alone is under-specified even on a `<span>`: you want an
animation variant (`loading-spinner`, `loading-dots`, …). Bare `loading` in v4+
falls back to the spinner mask, which is why you get a spinner shape at all.

## The corrected button

Put the spinner in its own `<span>` *inside* the button, sized small, next to
the text. This is the pattern used throughout Scaffold-ETH 2 (e.g. the
`FaucetButton` / `Faucet` components):

```tsx
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

Why this works:

- `btn` is already `display: inline-flex; align-items: center; gap: 0.5rem`, so
  the spinner and the label sit on one baseline with correct spacing — no extra
  flex wrapper or margin needed.
- The mask now only clips the empty `<span>`, so the label renders normally.
- `loading-xs` (0.75rem) / `loading-sm` (1.25rem) keeps the spinner
  proportional to the text instead of to the button.
- `disabled` still blocks the click; you no longer rely on `pointer-events`.

### Killing the layout jump

The button still grows when "Approve" (7 chars) becomes "Approving..." plus a
spinner. Two idiomatic fixes — pick one:

```tsx
// A. Reserve the width so the button never resizes.
<button className="btn btn-primary min-w-[8rem]" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

```tsx
// B. Keep the label constant and only add the spinner.
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  Approve
</button>
```

### Accessibility

The spinner is decorative markup with no text; announce the state instead of
relying on it:

```tsx
<button className="btn btn-primary min-w-[8rem]" disabled={isPending} aria-busy={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

## Rule of thumb

`loading` goes on an empty `<span>`, never on a `btn` (or any element with
visible children). If you ever see a masked-out label, look for a DaisyUI
component class applied to a wrapper that already has content.
