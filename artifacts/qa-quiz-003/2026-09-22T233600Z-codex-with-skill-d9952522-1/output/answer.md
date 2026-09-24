`--radius-field` is a DaisyUI theme token. DaisyUI consumes it when it generates the component styles for form controls such as `.input`, `.select`, and `.textarea`; those component classes set the field border radius from `var(--radius-field)`.

Because Scaffold-ETH 2 form controls generally use DaisyUI field classes, this is not an isolated input bug. The theme says fields have a radius of `9999rem`, so every text input, select, and textarea that uses the normal DaisyUI styling inherits a pill-shaped border radius. On a single-line input that looks like a capsule. On a multiline textarea, the same enormous radius rounds the box so aggressively that text and backgrounds can appear clipped at the corners.

The per-component `rounded-*` patches are the wrong layer. They only fix the specific elements someone noticed, so every new field still gets the bad radius from the theme. They also make those patched fields diverge from the rest of the design system: one field is now governed by a local Tailwind utility while the rest are governed by DaisyUI theme tokens. Even when a local utility appears to win in the cascade, it is a one-off override fighting the source of truth instead of correcting it.

The correct fix is to change the theme token itself:

```css
--radius-field: 0.5rem;
```

Apply that in `packages/nextjs/styles/globals.css` everywhere `--radius-field` is defined, specifically in both DaisyUI theme blocks: the `name: "light";` theme and the matching dark theme block. After that, remove the local `rounded-*` patches from individual form controls unless a component genuinely needs a unique shape for product reasons.
