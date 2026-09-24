`--radius-field` is a daisyUI theme token. The `@plugin "daisyui/theme"` blocks in `packages/nextjs/styles/globals.css` define CSS custom properties for each active theme, and daisyUI's component styles consume those properties. Field-like daisyUI components such as `.input`, `.select`, `.textarea`, buttons, and tabs use the field radius token through `var(--radius-field)` / `rounded-field`.

With:

```css
--radius-field: 9999rem;
```

every daisyUI field component gets an effectively infinite border radius. Browsers clamp that to the element's dimensions, so normal inputs and selects become pills. Textareas also inherit the same radius, but because they are taller multi-line boxes, the huge rounded corners cut into the usable rectangle and can visibly clip text/background at the corners.

The per-component `rounded-*` patches keep losing because they fight the design system instead of fixing it. They only affect the fields someone remembered to patch, so every newly added `.input`, `.select`, or `.textarea` still picks up the theme token. They can also drift from the rest of the app because Tailwind utility radius values and daisyUI component/theme styles are now competing instead of sharing one source of truth.

The correct fix is to change the daisyUI theme token itself:

```css
--radius-field: 0.5rem;
```

`0.5rem` matches Tailwind's default `rounded-lg` radius, but applies consistently through daisyUI's field styling.

Apply it in every `@plugin "daisyui/theme"` block in `packages/nextjs/styles/globals.css`, specifically both app themes:

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

After that, remove the one-off `rounded-lg` patches from individual fields unless a field is intentionally meant to differ from the app-wide form control shape.
