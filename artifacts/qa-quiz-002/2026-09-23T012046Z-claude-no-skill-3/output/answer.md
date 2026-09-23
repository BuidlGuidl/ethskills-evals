# Why `btn loading` eats the label

## What the teammate wrote

```tsx
<button
  className={`btn btn-primary ${isPending ? "loading" : ""}`}
  disabled={isPending}
>
  {isPending ? "Approving..." : "Approve"}
</button>
```

## What DaisyUI actually does with that class combination

`loading` is **not** a button modifier in DaisyUI v3/v4/v5 — it is a *standalone component class*, meant for its own element (`<span class="loading loading-spinner">`). It used to be a `.btn.loading` modifier back in DaisyUI v2 (where it rendered a spinner via a `::before` pseudo-element and left the label alone), and that legacy behaviour is what most people are remembering when they write this. It was removed in v3. Scaffold-ETH 2 ships DaisyUI v4/v5, so the v2 behaviour is gone.

The `.loading` component is defined roughly like this:

```css
.loading {
  pointer-events: none;
  display: inline-block;
  aspect-ratio: 1 / 1;
  width: 1.5rem;                 /* loading-md default */
  background-color: currentColor;
  -webkit-mask-image: url("data:image/svg+xml,…spinner…");
          mask-image: url("data:image/svg+xml,…spinner…");
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: 100%;
}
```

Put that on the `<button>` itself and every one of those declarations applies to the button element:

1. **`mask-image` / `mask-size: 100%`** — a CSS mask clips the *entire rendered element, including its text and child nodes*. The button now only paints where the spinner SVG is opaque. "Approving..." is still in the DOM and still in the accessibility tree, but it is masked out of the painted output. That is the disappearing label — it is not hidden, it is clipped.
2. **`background-color: currentColor`** — overrides `btn-primary`'s background with the text colour, so the masked silhouette is painted as a solid spinner shape filling the button box. Hence "one big spinner that fills the entire button": the mask is scaled to 100% of the button's box, not to 1.5rem of it.
3. **`width: 1.5rem` + `aspect-ratio: 1/1`** — fights the button's own sizing/padding and forces a square. The button's width and height change the instant `isPending` flips, which is the layout jump QA saw.
4. **`pointer-events: none`** — harmless here (the button is already `disabled`), but worth knowing it silently kills clicks if you ever apply `loading` without `disabled`.

This is purely a CSS-composition problem, so it reproduces identically on desktop and mobile — nothing viewport-dependent about it.

## The corrected button (idiomatic DaisyUI / SE-2 pattern)

Give the spinner its **own element inside** the button. `.btn` is already `inline-flex` with `align-items: center` and `gap: 0.5rem`, so a `<span class="loading">` sibling lines up next to the text automatically — no extra flex wrapper, no margin utilities needed.

```tsx
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

This is exactly the pattern used across Scaffold-ETH 2 itself (e.g. `FaucetButton` and the `Faucet` modal, which render `<span className="loading loading-spinner loading-xs"></span>` inside the button while a tx is in flight).

Notes on the details:

- **`loading-xs` (or `loading-sm`)** — the default `loading-md` is `1.5rem`, taller than the cap height of the label and it will stretch a normal `btn`. `loading-xs` sits cleanly beside the text; use `loading-sm` for `btn-lg`.
- **`disabled={isPending}`** — keep the real HTML attribute rather than DaisyUI's `btn-disabled` class. `btn-disabled` is only a visual style; it does not block clicks, keyboard activation, or form submission. The attribute does, and it is what screen readers announce.
- **`loading-spinner`** is the shape modifier. SE-2 also uses `loading-ring` and `loading-dots` in places — any of them works, but the shape class is required; bare `loading` renders nothing meaningful on its own in v5.

### Optional: kill the remaining width wobble

"Approve" → "Approving..." plus a spinner is genuinely wider, so the button still resizes a little. If the button sits in a row with others and that shift is objectionable, pin a minimum width:

```tsx
<button className="btn btn-primary min-w-36" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

### Optional: announce the state change

The visual fix is complete above; if you also want assistive tech to pick up the transition without moving focus:

```tsx
<button className="btn btn-primary" disabled={isPending} aria-busy={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

`aria-hidden` on the spinner keeps it out of the accessibility tree (it carries no information the label doesn't already carry), and `aria-busy` marks the control as in-flight.

## One-line takeaway

`loading` masks and resizes whatever element it's on — it is a spinner *element*, not a button *state*. Never put it on the `.btn`; nest it inside.
