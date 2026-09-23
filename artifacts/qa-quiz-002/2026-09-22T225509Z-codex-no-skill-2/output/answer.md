The bug is caused by putting DaisyUI's `loading` component class on the
`button` itself:

```tsx
className={`btn btn-primary ${isPending ? "loading" : ""}`}
```

In current DaisyUI, `loading` is not a `btn` modifier. It is the loading
indicator component. The class gives the element spinner behavior directly:
`pointer-events: none`, `inline-block`, `aspect-square`, `shrink-0`,
`bg-current`, a default spinner-sized width, and a CSS `mask-image` for the
spinner shape.

So when the same element is both `btn btn-primary` and `loading`, DaisyUI is
asked to render the button itself as the spinner. The mask is applied to the
whole button element, not to a small child icon. The button's child text is
still in the DOM, but it is painted through the spinner mask, so the
`Approving...` label effectively disappears. The sizing/display rules from the
spinner component also fight the button layout, which is why the control jumps
and reads as a broken full-button loader.

The idiomatic DaisyUI / Scaffold-ETH 2 pattern is to keep the button a button
and render a small `loading` element inside it:

```tsx
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-sm" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

Use `loading-xs` instead of `loading-sm` if the surrounding SE-2 button is very
compact, but the important part is that `loading loading-spinner ...` belongs on
the child `<span>`, not on the `<button>`.
