`--radius-field` is a daisyUI theme token. The daisyUI plugin consumes it when it generates the component CSS for form controls: `.input`, `.select`, `.textarea`, and related field utilities use `border-radius: var(--radius-field)` / `rounded-field`. Scaffold-ETH 2 uses daisyUI components throughout the Next.js app, so one theme variable in `packages/nextjs/styles/globals.css` becomes the default shape for every text input, select, and textarea that uses those classes.

With:

```css
--radius-field: 9999rem;
```

the token means "make field controls fully pill-shaped." That works poorly for multi-line controls because a textarea is not pill geometry; the huge corner radius rounds deeply into the box and clips the content/background at the corners.

The `rounded-*` fixes on individual components are the wrong layer. They only patch the few fields that happen to receive those classes, while every new daisyUI field still reads the global `--radius-field` token. They also drift because the component-level class is fighting the theme-level design token instead of correcting the token all components share.

The correct fix is to change the token once per daisyUI theme in `packages/nextjs/styles/globals.css`:

```css
--radius-field: 0.5rem;
```

Apply that in every `@plugin "daisyui/theme"` block in the file:

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

Do not solve this by adding `rounded-lg` to each field. Set `--radius-field` to `0.5rem` in both the `light` and `dark` theme definitions so inputs, selects, and textareas share the same non-pill radius everywhere.
