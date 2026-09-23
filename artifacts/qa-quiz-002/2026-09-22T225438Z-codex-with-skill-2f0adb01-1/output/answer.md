`loading` should not be added to the same element as `btn`.

In DaisyUI, `btn btn-primary` makes the element a button: an inline-flex control with centered content, padding, button height, gap, color variables, and the primary button colors.

`loading`, however, is DaisyUI's loading component class. It is meant to be placed on a small child element, usually a `span`. It applies spinner-component styling to the element itself: pointer events are disabled, the element becomes a square inline block, gets a `bg-current` fill, and receives a CSS `mask-image` for the spinner. The spinner style classes, such as `loading-spinner`, choose the mask shape/animation and the size classes, such as `loading-xs` or `loading-sm`, control its width.

So with:

```tsx
className={`btn btn-primary ${isPending ? "loading" : ""}`}
```

the button is being styled as both a button and the loading component. The `loading` mask is applied to the whole button element, not to a separate icon. CSS masks clip the element and its children, so the text is still in the DOM, but it is painted through the spinner mask instead of being laid out as visible button text. That is why `"Approving..."` appears to vanish and why the button can jump/reflow: the button itself has become the spinner target.

Use a real button plus a child DaisyUI loading spinner:

```tsx
<button className="btn btn-primary" disabled={isPending} aria-busy={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  <span>{isPending ? "Approving..." : "Approve"}</span>
</button>
```

This keeps the `btn` layout on the button and puts the spinner mask on a small inline `span`, so the spinner sits next to visible text without replacing the whole control.
