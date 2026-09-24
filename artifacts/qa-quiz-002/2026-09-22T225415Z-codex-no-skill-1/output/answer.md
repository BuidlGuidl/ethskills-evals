DaisyUI's `loading` class is not a "put this button into a loading state" modifier. It is the base class for the loading indicator component itself.

So this combination:

```tsx
<button className={`btn btn-primary ${isPending ? "loading" : ""}`}>
```

puts both `btn` and `loading` on the same DOM element. When `isPending` is true, DaisyUI styles the `<button>` as the loading element: it gives that element spinner sizing/aspect-ratio and spinner mask/background behavior. Because those styles apply to the button itself instead of to a small child inside the button, the button becomes the spinner surface. The text is still in the DOM, but visually it is covered/clipped by the loading component styling, so `"Approving..."` does not appear and the button's dimensions/layout can change.

The idiomatic DaisyUI / Scaffold-ETH 2 pattern is to keep the button a `btn`, and render a separate loading component inside it:

```tsx
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-sm" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

Here `loading loading-spinner loading-sm` lives on the inline `<span>`, so DaisyUI creates a small spinner next to the visible label while the button keeps its normal button styling and layout.
