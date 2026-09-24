# Why `btn btn-primary loading` eats the label

## What DaisyUI actually does with that class

In DaisyUI 1–2, `loading` was a **modifier for `.btn`**: `.btn.loading` kept the
button intact and injected a small spinner via `::before`. Lots of older
Scaffold-ETH snippets and blog posts still show that pattern.

Since DaisyUI 3 (and still in 4/5 — the versions SE-2 ships), `loading` is a
**standalone component class**, not a button modifier. Its definition is
roughly:

```css
.loading {
  pointer-events: none;
  display: inline-block;
  aspect-ratio: 1 / 1;
  width: 1.5rem;                 /* loading-md default */
  background-color: currentColor;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-image: url("data:image/svg+xml,…animated spinner…");
}
```

Three of those lines explain the whole bug report:

1. **`mask-image` applies to the element's entire rendered content, including
   its text children.** Putting `loading` on the `<button>` makes the button
   itself the spinner: everything the button paints — background, border, and
   the "Approving..." text nodes — gets clipped to the animated spinner mask.
   The label isn't hidden by `color: transparent` or `display: none`; it is
   masked out. That's why it can never show, at any breakpoint or font size.
   `background-color: currentColor` on top of that repaints the button surface
   in the text color, which is what makes it read as "one big solid spinner."

2. **`width: 1.5rem; aspect-ratio: 1/1`** fights the button's own sizing
   (`.btn` has `height: 3rem`, horizontal padding, `min-height`). The winner
   depends on specificity/order, and either way the button's box changes the
   instant `isPending` flips — that's the layout jump QA saw. The button also
   resizes from "Approve" width to "Approving..." width, compounding it.

3. **`pointer-events: none`** silently disables the button, which is fine here
   only because `disabled={isPending}` already does it — but it hides the fact
   that the class was never meant for an interactive element.

Also note that on its own, `loading` has no shape variant. The idiomatic usage
is always two classes: `loading loading-spinner` (or `loading-dots`,
`loading-ring`, …) plus a size (`loading-xs` … `loading-lg`).

## The corrected button

Render the spinner as a **child element** next to the text, so the mask only
clips the `<span>`:

```tsx
<button
  className="btn btn-primary"
  disabled={isPending}
  aria-busy={isPending}
  onClick={handleApprove}
>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

`.btn` is already `display: inline-flex` with `align-items: center` and
`gap: 0.5rem`, so the spinner sits inline before the label with correct spacing
and vertical centering — no extra wrapper, no margin utilities needed.
`loading-xs` (1rem) is the right scale for `btn` default height; use
`loading-sm` for `btn-lg`.

### Killing the remaining layout jump

The class fix restores the label; the width still changes because "Approving..."
plus a spinner is wider than "Approve". Two options:

```tsx
/* A. reserve the width — best when the button sits in a tight row */
<button className="btn btn-primary min-w-32" disabled={isPending} aria-busy={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>

/* B. keep the label stable and only add the spinner */
<button className="btn btn-primary" disabled={isPending} aria-busy={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  Approve
</button>
```

Option B is what most SE-2 components do (see the `Faucet` / `FaucetButton`
components in `@se-2/nextjs/components/scaffold-eth`): a single stable label
with a conditional `loading loading-spinner` span, so the button never resizes
mid-transaction.

## Quick checklist

- `loading` is a component, never a `btn` modifier — DaisyUI ≥ 3.
- Always pair it: `loading loading-spinner loading-xs`.
- Put it on a child `<span>`, never on the `<button>`.
- `.btn`'s flex + gap handles the layout; don't add `mr-2`.
- Keep `disabled={isPending}` (guards the click) and add `aria-busy` for
  screen readers.
