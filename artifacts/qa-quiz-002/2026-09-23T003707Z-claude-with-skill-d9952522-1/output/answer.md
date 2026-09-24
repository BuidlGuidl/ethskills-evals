# QA-002 — "Approving…" label disappears behind a full-button spinner

## What DaisyUI actually does with `btn loading`

`loading` is **not a modifier for `btn`** — it is DaisyUI's standalone
*Loading* component, meant to be its own element (`<span class="loading
loading-spinner" />`). It carries its own geometry:

- it sets `display: inline-block` with its own `width`/`height` (default
  ~1.5rem, scaled by `loading-xs/sm/md/lg`),
- and it paints the spinner via `background-color: currentColor` plus a
  `mask-image` of the animated SVG.

When you put that class on the `<button>` itself, the button element
*becomes* the spinner:

1. **The mask swallows the text.** `mask-image` applies to the element's
   entire painted content box, including its text children. Anything
   outside the spinner glyph's mask is clipped to transparent — so
   "Approving…" is still in the DOM and still read by screen readers, but
   it is masked out to nothing visually. This is why it looks like the
   label "never renders": it renders, then gets masked away.
2. **The layout jumps.** `btn` sizing (its `height`, `padding-inline`,
   `min-width` from the label) is overridden by the loading component's
   fixed square `width`/`height`. The button collapses from a
   text-width pill to a small square — or, combined with `btn-primary`'s
   background and `currentColor` fill, reads as one solid blob — and the
   row it sits in reflows. Hence "turns into one big spinner that fills
   the entire button," on both breakpoints, since nothing here is
   responsive.
3. `disabled` is fine and should stay — it is doing the right thing.
   It's `loading` on the `btn` that is the bug.

Note the historical trap: in **DaisyUI 3 and earlier**, `btn-loading`/
`loading` on a button was supported and injected the spinner via a
pseudo-element while keeping the label. In **DaisyUI 4/5** (what SE-2
ships) that behavior was removed and `loading` became a standalone
component. So this patch is a pattern that used to work, copied from an
old tutorial or an LLM trained on v2/v3 docs. It fails silently — no
console error, nothing in the type checker.

## The corrected button

The idiomatic DaisyUI / Scaffold-ETH 2 pattern is a separate inline
`<span className="loading loading-spinner loading-sm" />` *inside* the
button, next to visible text. `btn` is already a flex row with a gap, so
the spinner and label sit side by side with no extra layout work:

```tsx
<button className="btn btn-primary" disabled={isMining}>
  {isMining && <span className="loading loading-spinner loading-sm" />}
  {isMining ? "Approving..." : "Approve"}
</button>
```

Why this shape:

- `loading-sm` (≈1.25rem) fits inside a default `btn` without forcing it
  taller. `loading-md` is the default and slightly overfills a normal
  button; use `loading-xs` on a `btn-sm`.
- Rendering the spinner conditionally rather than toggling a class keeps
  the label's own element untouched, so nothing is masked.
- The button keeps its `btn` geometry the whole time. To kill the
  remaining few pixels of width jump between "Approve" and the wider
  "Approving…" + spinner, give it a floor: `className="btn btn-primary
  min-w-[9rem]"`.
- For screen readers, the spinner is decorative — `disabled` plus the
  changed label already announce the state. If you want it explicit, add
  `aria-busy={isMining}` to the button and `aria-hidden="true"` to the
  span.

## One flag beyond the styling bug

Note the variable rename above: `isPending` → `isMining`.

If this button is wired to `useScaffoldWriteContract`, gate it on the
hook's **`isMining`**, not the `isPending` it passes through from wagmi.
`isPending` drops as soon as the wallet hands back the tx hash, which
re-enables the button *while the transaction is still unconfirmed* — the
user can fire a second approval. `isMining` is held across
`waitForTransactionReceipt` and clears in the hook's `finally` on both
confirmation and rejection, which is the window the label is describing.

(`isMining` is only set on the async path — `writeContractAsync`. If the
call site uses the synchronous `writeContract`, `isMining` never flips
and the button never locks.)

So the fix is the spinner markup; the `isMining` swap is the correctness
half of the same "button during a pending tx" story. If this button is
on plain wagmi rather than the scaffold hook, keep your existing flag and
apply only the markup change.
