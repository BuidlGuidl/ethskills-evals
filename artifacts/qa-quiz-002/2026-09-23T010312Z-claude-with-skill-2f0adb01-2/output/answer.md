# Approve button "turns into one big spinner" — root cause and fix

## What DaisyUI actually does with `btn btn-primary loading`

`loading` is **not a modifier for `btn`**. Since DaisyUI v3 it is its own
standalone *component* class — the same one you use for a bare
`<span className="loading loading-spinner" />`. Putting it on the button
means "this element **is** a spinner", not "this button is in a loading
state".

The `loading` class applies roughly this to whatever element carries it:

```css
.loading {
  pointer-events: none;
  display: inline-block;
  aspect-ratio: 1 / 1;
  width: 1.5rem;                 /* loading-md default */
  background-color: currentColor;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-image: url("data:image/svg+xml,…spinner…");   /* animated spinner shape */
}
```

Three of those properties are what QA is seeing:

1. **`mask-image`** — the mask is applied to the element *and everything it
   paints, including its text children*. Anything outside the spinner glyph's
   alpha is clipped to fully transparent. That is why `"Approving..."` never
   appears: the text is still in the DOM (and still read by screen readers),
   it is simply masked out. This is also why no amount of `z-index`,
   `text-*` or contrast tweaking brings it back.
2. **`background-color: currentColor`** — the button's own background is
   repainted with the foreground color and then masked into the spinner
   shape, so the whole button surface becomes the spinner rather than
   containing one. `btn-primary`'s background is overridden.
3. **`aspect-ratio: 1/1` + `width: 1.5rem`** — the button is forced to a
   square. Combined with `btn`'s own `min-height`/padding you get a
   size change on the exact frame the tx goes pending — that's the layout
   jump. It is the same on desktop and mobile because it's geometry, not a
   breakpoint issue.

So the class combination is self-contradictory: `btn` says "padded pill with
text", `loading` says "I am a 24px masked spinner glyph". `loading` wins on
mask and background, and the label is collateral damage.

(Historical note for anyone who remembers this working: in DaisyUI v1/v2
`loading` on a `btn` rendered the spinner as a `::before` pseudo-element and
kept the label. That behavior was removed when `loading` became a component
in v3, and a lot of stale snippets and LLM training data still show the old
pattern.)

## The fix — inline spinner as a child, idiomatic DaisyUI / SE-2

Keep `loading` off the button. Put a sized `loading loading-spinner` **span
inside** the button, next to the text. The button stays a button; only the
span is a spinner.

```tsx
<button className="btn btn-primary" disabled={isPending} aria-busy={isPending}>
  {isPending && <span className="loading loading-spinner loading-sm" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

Notes on the details:

- **`loading-sm`** (or `loading-xs`) — without a size modifier you get
  `loading-md` (1.5rem), which is visually heavy next to `btn`'s text.
- **No `mr-2` needed** if you're on a DaisyUI version where `btn` is already
  `inline-flex` with `gap`; the gap spaces the spinner from the label.
  On older setups add `mr-2` to the span, or `flex items-center gap-2` to the
  button, so it never depends on that default.
- **`disabled={isPending}`** stays — that's what actually prevents the
  double-approve. The spinner is only the signal.
- **`aria-busy`** lets assistive tech announce the pending state; the
  spinner span itself is decorative and needs no label since the visible
  text ("Approving...") now carries the meaning.

### Avoiding the layout jump entirely

The corrected button still changes width slightly because "Approve" →
"Approving..." plus a spinner is wider. If the button sits in a tight layout,
pin the width so nothing reflows:

```tsx
<button
  className="btn btn-primary min-w-[10rem]"
  disabled={isPending}
  aria-busy={isPending}
>
  {isPending && <span className="loading loading-spinner loading-sm" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

## Repo-wide check

Every other button with a pending state has the same bug. Find them:

```bash
grep -rn '"loading"' packages/nextjs/
grep -rnE 'btn[^"`]*\bloading\b' packages/nextjs/
```

Any `loading` appearing in a `btn` element's own `className` is a defect —
it must only ever appear on a child `<span>`.
