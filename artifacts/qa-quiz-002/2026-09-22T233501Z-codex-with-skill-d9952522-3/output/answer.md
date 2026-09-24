The bug is the `loading` class on the same element as `btn`.

In DaisyUI, `btn btn-primary` makes the element a button, but `loading` is also a component class. When the button becomes pending, this:

```tsx
className={`btn btn-primary ${isPending ? "loading" : ""}`}
```

turns the actual `<button>` into a DaisyUI loading component. DaisyUI's `.loading` class sets the element to an inline-block loading shape with a square aspect ratio, `background-color: currentColor`, and an SVG mask for the spinner. Because that mask is applied to the whole button element, the button's children are effectively swallowed by the masked spinner rendering. The text is still in the DOM, but it is no longer painted as normal button content, so `"Approving..."` disappears and the button dimensions/layout jump to match the loader styling.

The SE-2/DaisyUI pattern is: keep `btn` on the button, and render a separate inline loader element inside it.

```tsx
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-sm" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

If this button is wired to `useScaffoldWriteContract`, prefer the transaction lifecycle flag that stays true through confirmation, usually `isMining`, instead of wagmi's `isPending`:

```tsx
<button className="btn btn-primary" disabled={isMining}>
  {isMining && <span className="loading loading-spinner loading-sm" />}
  {isMining ? "Approving..." : "Approve"}
</button>
```
