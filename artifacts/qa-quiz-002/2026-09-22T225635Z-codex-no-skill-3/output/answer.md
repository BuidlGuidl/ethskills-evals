In DaisyUI 5, `loading` is not a button state modifier. It is the loading component itself.

So this:

```tsx
className={`btn btn-primary ${isPending ? "loading" : ""}`}
```

turns the `<button>` into both a DaisyUI button and a DaisyUI loading element. The `btn` class makes the element an inline-flex button with padding, height, gap, primary colors, etc. Then `loading` applies the loader component styles to that same element: `pointer-events-none`, `inline-block`, `aspect-square`, `bg-current`, a fixed loader width, and, most importantly, a CSS `mask-image` spinner with `mask-size: 100%`.

Because the mask is applied to the button element itself, the whole button box is clipped/painted as the spinner. The text child still exists in the DOM, but it is inside an element that has been turned into a masked loading glyph, so `"Approving..."` is not visible as normal button text. That is why QA sees one oversized spinner, no label, and a layout jump.

The idiomatic DaisyUI / Scaffold-ETH 2 pattern is to keep `loading` on a child `<span>`, not on the button:

```tsx
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-sm" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

This leaves the button as a button and renders a small inline DaisyUI spinner next to visible text.
