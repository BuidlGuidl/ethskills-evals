`--radius-field` is a DaisyUI theme token. DaisyUI's form components consume it when generating the styles for field-like controls such as `.input`, `.select`, and `.textarea`; those component rules set their border radius from `var(--radius-field)`. Because `globals.css` defines the active DaisyUI themes globally, every component using DaisyUI field classes inherits the same value.

With:

```css
--radius-field: 9999rem;
```

the radius is effectively infinite compared with normal input heights, so text inputs and selects become capsules with fully rounded ends. Textareas use the same token even though they can be multi-line, so the huge radius rounds deeply into the box and the textarea content/background can look clipped at the corners.

The `rounded-*` fixes on individual components are the wrong layer to solve this. They only affect the specific fields that were patched, so every new `.input`, `.select`, or `.textarea` still reads the global DaisyUI field token and comes out pill-shaped. They also drift from the rest of the app because those one-off Tailwind utilities are no longer tied to the theme token DaisyUI uses for the rest of its field styling.

The correct fix is to change the DaisyUI theme token once, in `packages/nextjs/styles/globals.css`, anywhere the app defines a DaisyUI theme. In this Scaffold-ETH 2 file that means both theme blocks:

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

`0.5rem` is the same radius as Tailwind's `rounded-lg`, but applied at the DaisyUI theme-token level. After that, every existing and future DaisyUI input, select, and textarea will share the intended rounded-rectangle shape without per-component patches.
