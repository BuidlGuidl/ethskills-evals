`--radius-field` is a DaisyUI theme token. DaisyUI consumes it when it generates the component CSS for field-like controls, including `.input`, `.select`, and `.textarea`. Those component styles set their border radius from the active theme's field radius variable, so a theme value of:

```css
--radius-field: 9999rem;
```

makes every DaisyUI field in that theme render as a pill. For single-line inputs and selects that means fully rounded ends; for multi-line textareas it is especially visible because the enormous border radius rounds and clips the content area at the corners.

The per-component `rounded-*` patches keep losing because they treat the symptom at individual call sites. The root style is still the DaisyUI component/theme layer, so every new `.input`, `.select`, or `.textarea` inherits the bad token again. Those local utilities also drift because they override only the fields someone remembered to patch, instead of changing the shared design token that all DaisyUI fields are supposed to use.

The correct fix is to change the theme token, not each component. In `packages/nextjs/styles/globals.css`, set:

```css
--radius-field: 0rem;
```

in every `@plugin "daisyui/theme"` block that defines an app theme. In this file that means applying the same value in both places:

```css
@plugin "daisyui/theme" {
  name: "light";
  ...
  --radius-field: 0rem;
  ...
}

@plugin "daisyui/theme" {
  name: "dark";
  ...
  --radius-field: 0rem;
  ...
}
```

Both themes have to be updated because DaisyUI resolves the token from the currently active theme. If only `light` is fixed, fields become square in light mode but stay pill-shaped in dark mode.
