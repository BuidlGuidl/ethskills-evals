# QA-002 — "Approving…" label disappears behind a full-size spinner

**Verdict: the bug is real, and it's in the `className`, not in the label logic.**
`loading` is not a modifier for `btn`. It is DaisyUI's own standalone
*component* class, and putting it on the button turns the button itself
**into** the spinner.

---

## What DaisyUI actually does with `btn btn-primary loading`

`loading` is not written as `btn-loading`, and that naming is the tell — DaisyUI
modifiers are namespaced to their component (`btn-primary`, `btn-sm`,
`btn-outline`). `loading` belongs to no component; it's the spinner element
itself. Its rule set is roughly:

```css
.loading {
  pointer-events: none;
  display: inline-block;
  aspect-ratio: 1 / 1;
  width: 1.5rem;                 /* loading-md default */
  background-color: currentColor;
  mask-image: url("data:image/svg+xml,…spinner…");
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: 100%;
}
```

Applied to the `<button>`, every one of those lines fights the button:

1. **`mask-image` + `mask-size: 100%` clips the element's entire painted
   output — background, border, *and the text node* — to the silhouette of the
   spinner SVG.** This is why the label "never shows." The `"Approving…"` text is
   still in the DOM (it will read fine in the accessibility tree and in
   `document.querySelector(...).textContent`), it is simply masked out of the
   paint. That's also why "hide the text" fixes people try — `text-transparent`,
   conditional rendering — don't change anything: the text was never the problem.
2. **`background-color: currentColor`** repaints the whole box in the button's
   *foreground* color, then the mask carves the spinner out of it. So the
   button's `btn-primary` background is gone too, replaced by a solid
   primary-content-colored spinner shape.
3. **`mask-size: 100%` scales the spinner to the button's box**, not to the text.
   Hence "one big spinner that fills the entire button" — it is literally the
   button, stretched.
4. **`aspect-ratio: 1 / 1` + `display: inline-block`** override `btn`'s
   `inline-flex` and its horizontal padding-driven width, so the element
   re-measures to a square. That is your **layout jump** — the row reflows the
   moment `isPending` flips, on desktop and mobile alike.
5. **`pointer-events: none`** silently overlaps with `disabled`. Harmless here,
   but it means a `loading` button can't even fire a `mouseleave`, so tooltips
   and hover states get stuck.

Nothing about this is viewport-dependent, which matches QA seeing it on both
desktop and mobile.

### Accessibility note
Because the label is masked rather than removed, a screen reader still announces
"Approving…" while sighted users see only a blob — the states diverge. The fix
below keeps both in sync and marks the spinner `aria-hidden` so it isn't
announced as stray content.

---

## The corrected button

The idiomatic DaisyUI/SE-2 pattern is: **leave `btn` alone, and render the
spinner as a child `<span>`**, sized down with `loading-sm` so it sits inline
next to the text.

```tsx
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

`btn` is already `inline-flex` with `gap`, so the spinner and the label space
themselves correctly — no margin utility needed. (If your DaisyUI version's
`btn` doesn't set `gap`, add `mr-2` to the span.)

### Why this holds up

- `loading loading-spinner` on a `<span>` is the class combination DaisyUI
  documents: `loading` supplies the mask machinery, `loading-spinner` selects
  *which* SVG, `loading-sm` sets `width: 1.25rem` so it matches cap height
  instead of the button box.
- The mask now clips only the span. The button keeps `btn-primary`'s background,
  padding, and `inline-flex`.
- `disabled={isPending}` stays on the button, which is what actually blocks the
  double-click — `pointer-events: none` from `loading` was never a substitute
  (it doesn't block keyboard activation).

### Avoiding the layout jump entirely

Adding the spinner widens the button by ~1.25rem + gap. If this button sits in a
row where that shift is visible, pin the width:

```tsx
<button className="btn btn-primary min-w-[10rem]" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-sm" aria-hidden="true" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

`min-w` (not a fixed `w`) keeps the button able to grow if the label is ever
translated to something longer.

---

## Grep to catch the rest of them

This pattern rarely appears once. Sweep the app before shipping:

```bash
grep -rn '"loading"' packages/nextjs/
grep -rn 'btn.*\bloading\b' packages/nextjs/ --include=*.tsx
```

Any bare `"loading"` inside a `btn` className — templated or not — is the same
bug. The only legitimate `loading` is on a standalone element that also carries
a `loading-*` variant (`loading-spinner`, `loading-dots`, `loading-ring`).

### One related thing to confirm while you're in here

`isPending` is only correct for this UI if it stays true until the block
confirms. If it comes from raw wagmi `useWriteContract`, it drops to `false` the
moment the wallet hands back a tx hash — the spinner vanishes and the button
re-enables while the tx is still in flight, which lets the user approve twice.
SE-2's `useScaffoldWriteContract` waits for confirmation and is what this button
should be reading from.
