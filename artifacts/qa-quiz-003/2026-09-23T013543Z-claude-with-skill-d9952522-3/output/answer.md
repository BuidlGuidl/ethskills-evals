# Pill-shaped inputs: `--radius-field` in `globals.css`

## The mechanism

`--radius-field` is not a custom variable someone invented for this app — it is one of
daisyUI 5's three theme-level radius tokens, declared inside the `@plugin "daisyui/theme"`
block:

| token | applies to |
| --- | --- |
| `--radius-selector` | checkbox, radio, toggle, badge |
| `--radius-field` | **input, select, textarea, file-input, range, tab, btn** |
| `--radius-box` | card, modal, alert |

daisyUI's component CSS doesn't hardcode corner values. Every field component is written as

```css
.input, .select, .textarea, .file-input { border-radius: var(--radius-field); }
```

So the theme block isn't styling *a* field — it's setting the single value that every field
component in the library dereferences. `9999rem` is the "make it a pill" idiom
(any radius ≥ half the element's height fully rounds the ends), and because it lands on the
token rather than on an element, it fully rounds **every** field the app renders, present and
future, including the inputs nested inside Scaffold-ETH's own components (`InputBase`,
`AddressInput`, `EtherInput`, `IntegerInput`) and `btn`.

The textarea clipping is the same value doing what a radius does: a ~9999rem corner on a
multi-line box carves an enormous arc out of each corner, and the text lines that run into
that arc are cut off. There is no textarea-specific bug — it is the pill radius applied to a
tall element.

## Why the per-component `rounded-*` patching keeps losing

The patch is at the wrong altitude. `rounded-lg` on one `<input>` is a utility overriding one
element's `border-radius`; the pill is a *default* living in the design token. So:

- **Every new field starts pill-shaped again.** The token is the default for every component
  instance, so the team is not fixing a bug once — they're signing up to remember a class on
  every field they will ever write. The failure mode is silent: forget the class, ship a pill.
- **It can't reach everything.** Fields rendered inside SE-2 components you don't control the
  markup of (the `<input>` inside `AddressInput`/`EtherInput`, `select` in third-party
  widgets) have no place to hang the class, or only accept a className on the wrapper — so
  the wrapper squares off while the inner control stays pill, which looks worse than either.
- **It hardcodes a value outside the theme.** `rounded-lg` is a Tailwind scale value, not
  `var(--radius-field)`. Patched fields stop tracking the theme, which is exactly the "drift
  out of style with the rest" the team is seeing, and it compounds every time someone picks
  `rounded-md` instead.
- **It leaves the related tokens inconsistent.** `--radius-field` also drives `btn` and `tab`,
  so patching inputs alone splits the app into pill buttons and square inputs.

Overriding a symptom per instance never converges when the cause is a default.

## The fix

Set the token to a normal corner radius at theme level. `0.5rem` is the value to use — it
matches SE-2's stock look and sits correctly against daisyUI's other radius tokens.

In `packages/nextjs/styles/globals.css`, change it in **both** `@plugin "daisyui/theme"`
blocks — SE-2 ships two, `light` and `dark`:

```css
@plugin "daisyui/theme" {
  name: "light";
  ...
  --radius-field: 0.5rem;   /* was 9999rem */
  ...
}

@plugin "daisyui/theme" {
  name: "dark";
  ...
  --radius-field: 0.5rem;   /* was 9999rem */
  ...
}
```

Both are required. daisyUI emits one `[data-theme="..."]` rule per theme block with its own
copy of the variable; fixing only `light` means the header's `SwitchTheme` toggle brings the
pills straight back in dark mode — and that's the harder bug to catch, because the person who
fixed it was probably testing in light.

While you're in the file, grep for any other `--radius-field` (or `--radius-box` /
`--radius-selector`) declaration in a `:root`, `[data-theme=...]`, or `@layer` block that
could re-set it after the theme blocks; the token must have exactly one source of truth.

Then delete the teammate's `rounded-lg` patches on the two inputs. Left in place they now
override the corrected token with a *different* radius, which is the same drift problem with
the sign flipped. Once the token is right, every field — including ones nobody has written
yet — is correct by default, and any future change to the app's corner style is a one-line
edit in two places instead of a codebase-wide grep.
