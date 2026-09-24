The bug is that `loading` is not a "button is busy" modifier in DaisyUI. It is the loader component class itself.

With:

```tsx
className={`btn btn-primary ${isPending ? "loading" : ""}`}
```

the pending button becomes both `.btn` and `.loading`. DaisyUI's `.loading` class styles the element it is placed on as a spinner: it makes the element an inline-block square, uses `bg-current`, applies an SVG `mask-image`, and sizes it as the loading component. So the actual `<button>` gets masked into a spinner shape. The text node `{isPending ? "Approving..." : "Approve"}` is still in the DOM, but it is painted inside an element that has become the masked spinner, so the label is effectively swallowed. Because the button itself changes from a normal `.btn` layout to a loading component shape, the button width/layout can jump too.

The idiomatic DaisyUI / Scaffold-ETH 2 pattern is to keep the button a button and put the spinner inside it as a child:

```tsx
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-sm" />}
  <span>{isPending ? "Approving..." : "Approve"}</span>
</button>
```

That keeps the label visible, preserves the `.btn` flex layout and gap, and renders the loader as a small inline spinner next to the text instead of turning the entire button into the spinner.
