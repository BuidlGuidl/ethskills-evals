# Why `btn ... loading` eats the label

## What the class combination actually does

In daisyUI 2/3, `loading` was a **modifier on the button**: `.btn.loading`
injected a spinner via `::before` and kept the label visible. That API is gone.

Since daisyUI 4 (and still in 5), `loading` is a **standalone component class**,
not a button modifier. Roughly:

```css
.loading {
  pointer-events: none;
  display: inline-block;
  aspect-ratio: 1 / 1;
  width: 1.5rem;                 /* loading-md default */
  background-color: currentColor;
  mask-image: url("data:image/svg+xml,…spinner…");
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: 100%;
}
```

Put that on the `<button>` itself and you are telling the browser: *this element
is the spinner*. Three things follow, and they match QA's report exactly:

1. **The label disappears.** `mask-image` applies to the element **and all of its
   descendants** — masking happens at composite time on the whole rendered
   subtree. The text node "Approving…" is painted, then clipped away everywhere
   the spinner SVG mask is transparent. On top of that, `background-color:
   currentColor` floods the button with the text color, so whatever survives the
   mask is the same color as the fill and invisible anyway. The label isn't
   hidden by a conditional — it's rendered and then masked out.
2. **The whole button becomes the spinner.** `mask-size: 100%` scales the
   spinner glyph to the button's full box, so the animation fills the entire
   button instead of sitting at 1.5rem.
3. **The layout jumps.** `aspect-ratio: 1 / 1` (plus `width: 1.5rem`) fights
   `.btn`'s own `height`/`min-width`/padding. Whichever wins, the button's box
   changes size the moment `isPending` flips — hence the reflow, on desktop and
   mobile alike.

Bonus footgun: `.loading` sets `pointer-events: none`, which silently swallows
hover/focus feedback — easy to mistake for "the button is broken".

The fix is not a different `loading-*` size on the button. `loading` belongs on a
**child element**, never on the `.btn` itself.

## The corrected button (idiomatic daisyUI + Scaffold-ETH 2)

```tsx
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

- The spinner is a `<span>` child, so the mask only clips the span — the label
  renders normally beside it.
- `loading-spinner` picks the spinner variant explicitly (daisyUI also ships
  `loading-dots`, `loading-ring`, `loading-ball`, `loading-bars`,
  `loading-infinity`); `loading-xs` (or `loading-sm`) keeps it inline-sized
  instead of 1.5rem next to your text.
- `.btn` is already a flex container with a gap, so the spinner and label space
  themselves — no extra wrapper or margin needed.
- Keep `disabled={isPending}`; drop `loading` from the button's class list
  entirely.

### Killing the remaining layout jump

"Approve" and "Approving…" + spinner are different widths, so the button still
resizes between states. Reserve the width:

```tsx
<button className="btn btn-primary min-w-32" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

### In context with a SE-2 write hook

```tsx
const { writeContractAsync, isPending } = useScaffoldWriteContract("YourContract");

return (
  <button
    className="btn btn-primary min-w-32"
    disabled={isPending}
    onClick={() =>
      writeContractAsync({ functionName: "approve", args: [spender, amount] })
    }
  >
    {isPending && <span className="loading loading-spinner loading-xs" />}
    {isPending ? "Approving..." : "Approve"}
  </button>
);
```

This is the same shape SE-2's own components use (e.g. the Faucet / FaucetButton
and the block explorer's search button): plain `btn` classes, a `loading
loading-spinner loading-xs` span as a child, label always visible.

Note: `isPending` from wagmi/SE-2 only covers wallet confirmation. If you want
the spinner to persist until the tx is mined, drive it from the SE-2 transactor's
mining state (or `useWaitForTransactionReceipt`'s `isLoading`) instead of, or
OR'd with, `isPending` — the markup above doesn't change.
