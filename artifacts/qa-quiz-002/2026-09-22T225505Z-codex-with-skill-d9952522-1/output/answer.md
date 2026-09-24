DaisyUI's `loading` class is not a `btn` modifier. It is the loading component itself.

When the button becomes:

```tsx
<button className="btn btn-primary loading" disabled>
  Approving...
</button>
```

DaisyUI applies the loading component CSS to the same DOM node as the button. That class sets the element to an inline loading glyph: `display: inline-block`, `aspect-ratio: 1 / 1`, a default `width` around spinner size, `background-color: currentColor`, and an SVG `mask-image` for the spinner. In other words, the button element itself is now being painted and masked as the spinner.

That is why the text disappears. The `"Approving..."` child is still in the DOM, but the parent button has been turned into a masked loading shape, so the normal button flex layout and visible label are swallowed by the spinner styling. If the button also has responsive/full-width sizing, the mask can scale across the whole button box, which is the "one big spinner" QA is seeing.

The idiomatic DaisyUI / Scaffold-ETH 2 pattern is: keep `loading` off the button, render a small loading element inside the button, and keep the label as normal visible text.

```tsx
<button className="btn btn-primary" disabled={isPending} aria-busy={isPending}>
  {isPending && <span className="loading loading-spinner loading-sm" />}
  <span>{isPending ? "Approving..." : "Approve"}</span>
</button>
```

If this is a Scaffold-ETH 2 contract write, the state used to disable the button should usually be the hook's mining/confirmation state, not wagmi's `isPending`, because `isPending` can clear once the wallet returns a hash. The DaisyUI fix is the same either way: spinner as an inline child, never `loading` on the `btn` itself.
