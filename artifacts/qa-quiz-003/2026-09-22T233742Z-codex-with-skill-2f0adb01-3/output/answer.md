`--radius-field` is a DaisyUI theme token. DaisyUI's component CSS for form controls uses that token for field border radius, so classes like `input`, `select`, and `textarea` end up with a radius derived from:

```css
border-radius: var(--radius-field);
```

In Scaffold-ETH 2 those DaisyUI classes are used throughout the app, including shared form components and generated/debug contract UI. Because the value is defined inside `@plugin "daisyui/theme"`, DaisyUI emits it as part of the active theme's CSS custom properties. Every field under that theme inherits the same token. With:

```css
--radius-field: 9999rem;
```

every text input, select, and textarea becomes fully pill-shaped. That is especially bad for multi-line textareas because the huge corner radius cuts into the usable content area and makes text look clipped near the corners.

The `rounded-*` patches are the wrong level of fix. They only affect the specific components that were patched, while every new DaisyUI field still reads the global `--radius-field` token. They also create a second, local styling rule that can drift from the design system, theme changes, or third-party/shared Scaffold-ETH components.

The correct fix is to change the DaisyUI field-radius token once per theme in `packages/nextjs/styles/globals.css`:

```css
--radius-field: 0.5rem;
```

Apply that replacement everywhere `--radius-field` is defined in the file, specifically in both DaisyUI theme blocks:

```css
@plugin "daisyui/theme" {
  name: "light";
  ...
  --radius-field: 0.5rem;
  ...
}

@plugin "daisyui/theme" {
  name: "dark";
  ...
  --radius-field: 0.5rem;
  ...
}
```

That makes all DaisyUI-powered fields use the same `rounded-lg`-sized radius globally, in both light and dark themes, without per-component overrides.
