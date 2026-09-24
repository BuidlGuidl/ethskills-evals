The bug is caused by putting DaisyUI's `loading` component class on the
same element as the button:

```tsx
className={`btn btn-primary ${isPending ? "loading" : ""}`}
```

In DaisyUI, `loading` is not a "button is busy" modifier. It is the
loader component itself. When `isPending` is true, the `<button>` becomes
both `btn btn-primary` and `loading`.

That means DaisyUI applies the loader styles to the button element:
`pointer-events: none`, `display: inline-block`, a square `aspect-ratio`,
a fixed loader `width`, `background-color: currentColor`, and, most
importantly, a CSS `mask-image` for the spinner shape. Because the mask is
on the button itself, the button's whole painted output is clipped into the
spinner mask. The text node is still in the DOM, but it is painted through
the spinner-shaped mask, so the `"Approving..."` label effectively
disappears. The sizing/layout also changes because the element is now being
styled like a loader rather than like a normal button.

The idiomatic DaisyUI / Scaffold-ETH 2 pattern is to keep `loading` on a
child `<span>`, not on the button:

```tsx
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

If the button needs to keep exactly the same width between states, add a
stable width class such as `min-w-32` or the width already used by the
surrounding component:

```tsx
<button className="btn btn-primary min-w-32" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```
