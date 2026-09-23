`--radius-field` is a DaisyUI theme token. DaisyUI's form components (`input`, `select`, `textarea`, and related field-style components/classes) consume it when they generate their component CSS, effectively doing:

```css
border-radius: var(--radius-field);
```

So when the Scaffold-ETH 2 theme sets:

```css
--radius-field: 9999rem;
```

every DaisyUI field in that theme inherits a huge radius. On single-line controls that collapses visually into a pill, because the radius is larger than the control height. On multi-line `textarea`s, that same pill radius is the wrong shape and can clip text/paint near the corners.

The per-component `rounded-*` patches keep losing because they fix individual symptoms instead of the theme token that all fields share. They only affect the few elements where someone remembered to add them, new fields still get DaisyUI's global `--radius-field`, and they create local one-off styling that can fight DaisyUI's generated component CSS or drift when the theme changes.

The correct fix is to change the DaisyUI field radius at the theme level in `packages/nextjs/styles/globals.css`:

```css
--radius-field: 0.5rem;
```

That value is the `rounded-lg`-sized radius the teammate was trying to get locally, but applied once through DaisyUI's design token so every current and future field inherits it consistently.

Apply it in every `@plugin "daisyui/theme"` block in the file. In the standard Scaffold-ETH 2 setup, that means both theme definitions:

```css
@plugin "daisyui/theme" {
  name: "light";
  /* ... */
  --radius-field: 0.5rem;
  /* ... */
}

@plugin "daisyui/theme" {
  name: "dark";
  /* ... */
  --radius-field: 0.5rem;
  /* ... */
}
```

If the file has additional DaisyUI theme blocks, they need the same replacement too. The important rule is: no `--radius-field: 9999rem` should remain in `packages/nextjs/styles/globals.css`.
