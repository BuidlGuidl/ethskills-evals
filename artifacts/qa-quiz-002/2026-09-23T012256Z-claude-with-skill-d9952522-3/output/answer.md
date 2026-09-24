# QA-002 — "Approve" button becomes one giant spinner while pending

## What DaisyUI actually does with `btn btn-primary loading`

In DaisyUI v1/v2, `loading` was a **button modifier**: `.btn.loading::before` injected a small spinner pseudo-element and the label stayed visible. That is the pattern this snippet was copied from.

Since DaisyUI v3/v4 (what Scaffold-ETH 2 ships), `loading` is no longer a modifier — it is a **standalone component class that turns the element it sits on into the spinner itself**. Roughly:

```css
.loading {
  display: inline-block;
  aspect-ratio: 1 / 1;
  width: 1.5rem;                 /* loading-md default */
  background-color: currentColor;
  -webkit-mask-image: url("…spinner.svg");
          mask-image: url("…spinner.svg");
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: 100%;
}
```

Put that on a `<button>` and three things happen at once:

1. **The label disappears.** `background-color: currentColor` floods the whole box with the button's text color, and `mask-image` clips the element **and all of its descendants** to the spinner glyph. The `"Approving..."` text node is a descendant, so it is painted inside that flood and then masked away. Nothing is `display: none` — the text is still in the DOM and still read by screen readers — it is simply masked out of the paint. That's why it looks "broken" rather than "missing".
2. **The spinner is button-sized.** `mask-size: 100%` scales the spinner SVG to the element's box, so the mask stretches across the full button width/height instead of being a 1rem glyph.
3. **The layout jumps.** `.loading` sets `width: 1.5rem` and `aspect-ratio: 1/1`, which fights `.btn`'s own `height`/`padding-inline`/`min-height`. Whichever wins in the cascade, the button's computed box changes the instant `isPending` flips — hence the reflow QA saw. It is not a mobile/desktop issue; it's every viewport, because it's a pure CSS component collision.

Secondary detail: `.btn` is `display: inline-flex`, `.loading` is `display: inline-block`. They're in the same DaisyUI layer, so the later rule wins and the button also stops being a flex container — any icon/text alignment inside it is lost too.

**Rule of thumb:** in modern DaisyUI, `loading` goes on a `<span>` *inside* the button, never on the button.

## Corrected button (idiomatic DaisyUI + SE-2)

```tsx
<button className="btn btn-primary" disabled={isPending} aria-busy={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

Why this is the right shape:

- The spinner is its own element, so the mask only clips the `<span>`. The label paints normally next to it.
- `loading-xs` (≈1rem) keeps it inline-sized. `loading-sm` is fine on `btn-lg`; don't leave it at the `loading-md` default inside a normal button.
- No wrapper/margin needed: `.btn` already sets `gap: 0.5rem`, so the flex gap spaces the spinner from the text for free.
- `disabled` still blocks double-submits; `aria-busy` tells assistive tech the control is working rather than just dead.

### Killing the remaining layout jump

"Approve" → "Approving..." plus a spinner is a real width change, and a button that grows mid-transaction still nudges the row. Pin a floor:

```tsx
<button className="btn btn-primary min-w-[10rem]" disabled={isPending} aria-busy={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

Pick the `min-w` from the longest state's rendered width. SE-2's own components do the same thing (see `Faucet.tsx` / `FaucetButton.tsx`, which render `<span className="loading loading-ring loading-xs"></span>` inside the button).

### If you want spinner-only (no label)

Still don't put `loading` on the button — keep the accessible name:

```tsx
<button className="btn btn-primary btn-square" disabled={isPending} aria-label="Approve">
  {isPending ? <span className="loading loading-spinner loading-xs" /> : <CheckIcon className="h-4 w-4" />}
</button>
```

## One-line diff summary

Move `loading` off the `<button>` and into a child `<span className="loading loading-spinner loading-xs" />`; add `loading-xs` so it's glyph-sized, and a `min-w-*` so the button doesn't resize between states.
