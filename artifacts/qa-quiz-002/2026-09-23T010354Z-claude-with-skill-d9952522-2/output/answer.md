# QA-002: `btn loading` swallows the button label

## What DaisyUI actually does with `className="btn btn-primary loading"`

QA is right, and it isn't a CSS-cascade accident — it's a version mismatch.
In **daisyUI v1/v2, `loading` was a *modifier* for `btn`**: it injected a small
spinner via `::before` and left your text alone. That's the pattern most people
(and most stale blog posts / LLM training data) still have in their heads.

**From daisyUI v3 onward (v4 and v5 included, which is what Scaffold-ETH 2
ships), `loading` is a standalone *component*, not a button modifier.** It is
meant to be its own element:

```html
<span class="loading loading-spinner loading-sm"></span>
```

The rule behind it is roughly:

```css
.loading {
  pointer-events: none;
  display: inline-block;
  aspect-ratio: 1 / 1;              /* force a square */
  width: 1.5rem;                    /* loading-md default */
  background-color: currentColor;   /* paint the whole box */
  mask-image: url("data:image/svg+xml,…spinner…");
  mask-size: 100%;
  mask-repeat: no-repeat;
  mask-position: center;
}
```

Put that on the `<button>` itself and every one of those declarations now
applies to the button box:

1. **`background-color: currentColor` + `mask-image`** — the button is painted
   as one solid block of the current text color, then CSS-masked down to the
   spinner glyph. A mask applies to the element **and everything rendered
   inside it**, so the `Approving…` text node is still in the DOM and still
   accessible to screen readers, but visually it is clipped away by the spinner
   mask — and whatever survives the mask is `currentColor`-on-`currentColor`
   anyway. That's why the label "disappears": it isn't hidden, it's masked and
   painted over.
2. **`aspect-ratio: 1 / 1` + `width: 1.5rem`** fights `btn`'s own
   `height`/`min-height`/`padding-inline`. The button stops being sized by its
   text and starts being sized by the loading component, so it snaps to a
   square-ish blob. That is the layout jump QA saw — and it happens identically
   on desktop and mobile, because it's geometry, not a breakpoint.
3. **`pointer-events: none`** is harmless here (you also set `disabled`), but it
   is a tell that this class was never meant for an interactive element.

So: one big spinner filling the button, no text, size jump. Exactly the bug
report. Nothing is broken in your code — the class is just being used with v2
semantics against a v4/v5 stylesheet.

> Related trap: `btn-loading` no longer exists either. And `loading` with no
> `loading-*` variant still renders a spinner (spinner is the default mask), so
> it fails *silently* rather than doing nothing, which is why it slipped review.

## The corrected button

The idiomatic daisyUI/SE-2 pattern is to render the spinner as a **sibling
element next to the label**. `btn` is already `display: inline-flex` with
`align-items: center` and a `gap`, so a `<span class="loading …">` dropped
inside lines up with the text for free — no wrapper, no manual gap.

```tsx
<button
  className="btn btn-primary"
  disabled={isPending}
  aria-busy={isPending}
>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

Key points:

- **`loading` moves off the `<button>` and onto its own `<span>`.** That is the
  whole fix.
- **Always pair it with a size class** (`loading-xs` / `loading-sm`). The
  default `loading-md` (1.5rem) is taller than the text in a default-size `btn`
  and will stretch the button. `loading-xs` sits next to `btn` text; use
  `loading-sm` for `btn-lg`.
- **`loading-spinner`** is the right variant for a transaction in flight.
  (`loading-dots`, `loading-ring`, `loading-ball`, `loading-bars`,
  `loading-infinity` are the others — SE-2's own `FaucetButton` uses a ring.)
- **Keep `disabled={isPending}`** — that's what actually prevents a double
  submit and gives you daisyUI's disabled styling. Adding `aria-busy` tells
  assistive tech the control is working rather than merely unavailable.
- The spinner inherits `currentColor`, so it automatically tracks
  `btn-primary`'s content color and stays correct in every SE-2 theme, light
  and dark. Don't hardcode a spinner color.

### Killing the remaining layout jump

The class fix restores the label, but `"Approve"` → `"Approving..."` plus a new
spinner still changes the button's intrinsic width mid-transaction. In a toolbar
or a right-aligned action row that reflows the surrounding content. Pin the
width so only the contents change:

```tsx
<button
  className="btn btn-primary min-w-[10rem]"
  disabled={isPending}
  aria-busy={isPending}
>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

Pick a `min-w-*` that comfortably fits the longer of the two states. This is
worth doing on mobile in particular, where an action row is often the full
width of a card and any reflow is very visible.

### If you want it reusable

Most SE-2 apps end up with several of these (Approve / Deposit / Withdraw /
Mint). Factor it once rather than repeating the ternary:

```tsx
type TxButtonProps = {
  isPending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const TxButton = ({
  isPending,
  pendingLabel,
  children,
  className = "btn btn-primary",
  disabled,
  ...props
}: TxButtonProps) => (
  <button
    className={className}
    disabled={disabled || isPending}
    aria-busy={isPending}
    {...props}
  >
    {isPending && <span className="loading loading-spinner loading-xs" />}
    {isPending ? pendingLabel : children}
  </button>
);

// <TxButton isPending={isPending} pendingLabel="Approving...">Approve</TxButton>
```

### Quick grep before you ship

This mistake is copy-pasted easily, so sweep the whole frontend, not just this
component:

```bash
grep -rnE 'btn[^"'"'"'`]*\bloading\b|\bloading\b[^"'"'"'`]*btn' packages/nextjs --include=*.tsx
```

Any hit where `loading` and `btn` share one `className` is the same bug.
