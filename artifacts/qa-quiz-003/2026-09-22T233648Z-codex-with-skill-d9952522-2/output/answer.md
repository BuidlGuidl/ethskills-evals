`--radius-field` is a DaisyUI theme token. DaisyUI's form component
classes, including `input`, `select`, and `textarea`, consume that token
when they generate their component CSS, effectively using it as the
`border-radius` for fields.

With this in `packages/nextjs/styles/globals.css`:

```css
@plugin "daisyui/theme" {
  name: "light";
  ...
  --radius-field: 9999rem;
  ...
}
```

every field that uses DaisyUI's form classes gets a fully rounded radius.
That is why the bug appears everywhere, including new form fields: the
shape is coming from the global theme, not from the individual component.
For single-line inputs and selects this makes pill-shaped controls. For
multi-line textareas it is especially visible because the huge radius can
round so deeply into the rectangle that content appears clipped at the
corners.

The per-component `rounded-*` patches keep losing because they are fixing
instances instead of the design token. They only affect the fields someone
remembered to patch, while any new `input`, `select`, `textarea`, or
Scaffold-ETH/DaisyUI wrapper component continues to inherit
`--radius-field: 9999rem`. They also create style drift: the patched
fields now have a local exception while the rest of the form system still
uses the theme's pill radius.

The correct fix is to change the DaisyUI field radius at the theme level:

```css
--radius-field: 0.5rem;
```

Apply that value everywhere `--radius-field` is defined in
`packages/nextjs/styles/globals.css`, specifically in every
`@plugin "daisyui/theme"` block, including the `light` theme and the other
theme block(s), such as `dark`. The field radius has to be consistent
across themes so switching themes does not bring the pill-shaped inputs
back.
