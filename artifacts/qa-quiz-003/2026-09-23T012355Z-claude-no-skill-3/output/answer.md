# Why every field is a pill: `--radius-field`

## 1. The mechanism

Scaffold-ETH 2 styles its UI with Tailwind CSS v4 + daisyUI v5, configured
entirely from CSS in `packages/nextjs/styles/globals.css`. daisyUI v5 no longer
hardcodes corner radii per component — it derives them from **three theme-level
custom properties**, which are part of the theme contract you declare in
`@plugin "daisyui/theme" { ... }`:

| Variable            | Controls the radius of                                            |
| ------------------- | ----------------------------------------------------------------- |
| `--radius-selector` | small "selector" controls — checkbox, radio, toggle, badge, tabs-boxed marker |
| `--radius-field`    | **form fields and field-sized controls** — `input`, `select`, `textarea`, `file-input`, `btn`, `tab`, `join-item`, `range` thumb, `dropdown` trigger |
| `--radius-box`      | large surfaces — `card`, `modal`, `alert`, `menu`, `dropdown-content`, `table` wrapper |

A `@plugin "daisyui/theme" { name: "light"; ... }` block does not just set
variables for a component — it emits a theme rule roughly equivalent to:

```css
:root:has(input.theme-controller[value=light]:checked),
[data-theme="light"] {
  --radius-field: 9999rem;
  /* …all the other theme tokens… */
}
```

Those are **inherited** custom properties declared on the theme root
(`<html data-theme="light">`), so their value is visible to every element in
the document. daisyUI's component rules then read them:

```css
.input, .select, .textarea, .file-input { border-radius: var(--radius-field); }
.btn                                     { border-radius: var(--radius-field); }
.join :where(.join-item)                 { border-radius: var(--radius-field); } /* plus corner-specific overrides */
```

So `--radius-field: 9999rem` is not "a style on one component." It is the single
input to every field-radius declaration daisyUI emits. One token, hundreds of
consuming rules, applied to everything under the theme root.

**Why 9999rem specifically produces pills, and why textareas clip.** Per the CSS
Backgrounds spec, when the sum of the radii on a side exceeds that side's
length, the browser scales *all* radii down by a common factor so they exactly
meet. A 9999rem radius always exceeds the box, so it is always scaled to
exactly half the shorter dimension — i.e. a perfect semicircular cap on each
end, at any width or height. That is the standard "pill" idiom, and it is
almost certainly what someone wanted for *buttons* (`.btn` also consumes
`--radius-field`) and got everywhere else as collateral.

On a single-line `input` the pill is merely a style choice. On a `textarea`,
which is tall, half the shorter dimension is a large number, so the corner arcs
sweep deep into the content box. The text itself is laid out in the rectangular
content box and is not reflowed around the curve, but the border/padding box is
clipped to it — so the first and last lines visually run into, and get cut off
by, the corners. Same cause for tall `select` dropdowns and multi-line
`AddressInput`/`EtherInput` wrappers. The "clipping" is not a separate bug; it
is the same 9999rem, seen on a box that isn't short.

Because every Scaffold-ETH 2 primitive (`InputBase`, `AddressInput`,
`EtherInput`, `IntegerInput`, `Bytes32Input`, the contract-debugger argument
fields, `AddressInfoDropdown`, the network switcher) is built on daisyUI's
`.input` / `.select` / `.btn` classes, they all inherit the pill by
construction.

## 2. Why per-component `rounded-*` patching keeps losing

The teammate's `rounded-lg` does technically win the cascade on the element it's
written on — daisyUI components are emitted into the `components` cascade layer
and Tailwind utilities into the later `utilities` layer, so the utility's
`border-radius: 0.5rem` overrides `border-radius: var(--radius-field)`. The
patch isn't failing because of specificity. It's failing because it's the wrong
kind of fix:

1. **It's an opt-out from a bad default, not a change of default.** The pill
   remains what the app *means* by "a field." Every new `<input className="input
   …">` any teammate writes, every `<InputBase>` rendered by the contract
   debugger, every field in a library or a future Scaffold-ETH upgrade, starts
   from `9999rem` again. You are patching instances of an infinite set.

2. **It only reaches elements you can put a class on.** Plenty of the rules that
   consume `--radius-field` are on elements you don't author: `.join
   :where(.join-item)` recomputing corner radii for grouped input+button rows,
   `.select`'s internal arrow region, `.input:has(> input)` wrapper styling,
   `.file-input`'s button segment, `.tab`, `.dropdown` triggers. Those keep
   reading the token no matter what class you add to the outer node. Result:
   half-patched joins where the input is `rounded-lg` and the attached button is
   still a pill, and `AddressInput`'s inner field still curved inside a squared
   wrapper.

3. **Each patch is an independently chosen literal, so it drifts.** `rounded-lg`
   here, `rounded-md` there, `rounded-xl` when someone eyeballs it. There is no
   longer a single source of truth for field radius, so the patched fields
   diverge from each other and from every other radius in the app — exactly the
   symptom described. And when the design does change, you have to find and edit
   every patch site by hand instead of one line.

4. **It doesn't survive the dark theme or theme switching.** A utility class is
   a fixed value; `--radius-field` is per-theme. If only the light theme is
   broken, the patches over-apply in dark; if both are broken, the patches mask
   the problem in both and hide the actual defect.

The correct move is to fix the token the whole system reads, then **delete** the
`rounded-lg` patches so the components go back to inheriting from the theme.

## 3. The fix

Set `--radius-field` to a normal, small radius. The value to use:

```css
--radius-field: 0.5rem;
```

`0.5rem` is Tailwind's `rounded-lg` — it matches what the teammate reached for
by hand, so the patched fields keep the shape they have now while every
unpatched field joins them. (daisyUI's own stock value is `0.25rem`
= `rounded-sm`, which is also fine if you want tighter corners; pick one and use
it in every place below. The point is that it is one value, in one place, not
that it is this particular number.)

**Everywhere in `packages/nextjs/styles/globals.css` it has to be applied —
every `@plugin "daisyui/theme"` block, not just the one you noticed:**

```css
@plugin "daisyui/theme" {
  name: "light";
  default: true;
  --color-primary: …;
  /* … */
  --radius-selector: 0.5rem;   /* leave as-is unless selectors are also wrong */
  --radius-field: 0.5rem;      /* ← was 9999rem */
  --radius-box: 1rem;          /* leave as-is */
}

@plugin "daisyui/theme" {
  name: "dark";
  prefersdark: true;
  --color-primary: …;
  /* … */
  --radius-field: 0.5rem;      /* ← must be changed here too */
}
```

Concretely, the checklist for this file:

1. **The `light` theme block** — change `--radius-field: 9999rem` to
   `0.5rem`.
2. **The `dark` theme block** — Scaffold-ETH 2 ships light *and* dark theme
   blocks and they are independent; a token set in one is not inherited by the
   other. If `dark` also declares `--radius-field: 9999rem`, change it. If it
   omits the declaration entirely, **add** it — an omitted token falls back to
   daisyUI's default rather than to your light value, which is how themes
   silently drift apart. Declare it explicitly in both.
3. **Any additional custom theme blocks** in the file (`scaffoldEth`,
   `scaffoldEthDark`, or any brand theme the team added) — same treatment, one
   explicit `--radius-field` per block.
4. **Any stray override outside the theme blocks** — grep the file for
   `radius-field` and for bare `:root { }` / `[data-theme=…] { }` /
   `@layer base` rules that redeclare it. A later-declared or
   higher-specificity redeclaration of the token will beat the plugin block and
   re-pill everything, and it's easy to miss because it looks like theme setup.

```sh
grep -rn "radius-field\|radius-box\|radius-selector" packages/nextjs/styles/globals.css
```

should, when you're done, show exactly one `--radius-field` line per theme
block and nothing else.

5. **If you actually wanted pill *buttons*** — which is the likely origin of
   this — do not get it back via `--radius-field`, because buttons and fields
   share that token. Put `rounded-full` on the button component(s) you own (or
   add a `.btn { border-radius: 9999px }` rule scoped in
   `@layer components`), so the pill is a deliberate, one-place button decision
   rather than a global field default.

**Then remove the patches.** Delete the `rounded-lg` classes the teammate added
to the two inputs. Once the token is right they're redundant, and leaving them
in reintroduces the drift problem the moment the design radius changes — the
whole value of fixing the token is that there is now exactly one place to change
it.
