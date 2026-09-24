The bug is caused by putting DaisyUI's `loading` class on the same element as `btn`.

`btn` styles the element as an inline-flex button: fixed button height, horizontal padding, centered content, and a gap between children. `loading` is not a "button is busy" state class. It is DaisyUI's loading component class. It turns the element itself into a spinner by applying spinner-specific layout and paint rules such as `pointer-events: none`, `aspect-ratio: 1`, a spinner-sized width, `background-color: currentColor`, and, most importantly, a `mask-image`/`mask-size: 100%` spinner mask.

So this:

```tsx
className={`btn btn-primary ${isPending ? "loading" : ""}`}
```

does not mean "show a spinner inside this button." It means "make this button element also be the loading element." The browser then paints the whole button, including its text children, through DaisyUI's spinner mask. The `Approving...` text is still in the DOM, but it is clipped away by the mask, so visually all you get is the masked spinner. Because `btn` and `loading` also disagree about layout, width, display, and sizing, the button's dimensions can jump.

The DaisyUI/Scaffold-ETH 2 pattern is to keep the button as a button and render the spinner as a child next to the label:

```tsx
<button className="btn btn-primary" disabled={isPending} aria-busy={isPending}>
  {isPending && <span className="loading loading-spinner loading-sm" />}
  <span>{isPending ? "Approving..." : "Approve"}</span>
</button>
```

Here the `btn` remains the flex container, DaisyUI's built-in button gap spaces the children, and the `loading loading-spinner loading-sm` classes apply only to the small inline spinner element. The label remains visible on desktop and mobile.
