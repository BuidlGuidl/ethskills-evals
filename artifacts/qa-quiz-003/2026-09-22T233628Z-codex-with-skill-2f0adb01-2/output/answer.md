`--radius-field` is a daisyUI theme token. The `@plugin "daisyui/theme"` blocks emit CSS custom properties for each active theme, and daisyUI's field components consume that token when it generates the styles for `.input`, `.select`, `.textarea`, and related field-like controls. In practice those components get their corner radius from `var(--radius-field)` / the `rounded-field` token, so setting:

```css
--radius-field: 9999rem;
```

makes every daisyUI-backed text input, select, and textarea in that theme render with a full pill radius. That is especially bad for multi-line textareas because the huge radius rounds the whole rectangle as if it were a capsule, so content near the corners can appear clipped.

The `rounded-*` patches on individual components are the wrong layer of the system. They only override the symptom for the fields someone remembered to patch, while every new field that uses daisyUI's `input`, `select`, or `textarea` classes still inherits the theme token. They also hard-code a one-off Tailwind radius instead of changing the shared design token, so those fields can drift away from the rest of the theme.

The fix belongs in `packages/nextjs/styles/globals.css`: change the field radius token in every daisyUI theme block, not at each component call site. I would set it to the same radius the team was trying to force with `rounded-lg`:

```css
--radius-field: 0.5rem;
```

Apply that in every `@plugin "daisyui/theme"` block in the file. For the Scaffold-ETH 2 globals file, that means at least:

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

If the file contains any additional custom daisyUI themes, they need the same `--radius-field: 0.5rem;` change too, otherwise switching to that theme will bring the pill-shaped fields back.
