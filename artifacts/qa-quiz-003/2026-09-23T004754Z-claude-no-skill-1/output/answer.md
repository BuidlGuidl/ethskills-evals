# Why every input in the app is pill-shaped

## 1. What `--radius-field` actually is

`--radius-field` is not a Scaffold-ETH variable and not a Tailwind variable. It is one of
daisyUI 5's three **theme-level border-radius tokens**, declared inside a
`@plugin "daisyui/theme" { ... }` block:

| token | governs |
| --- | --- |
| `--radius-selector` | small "selector" controls: checkbox, radio, toggle, badge |
| `--radius-field`    | **field-sized controls: `input`, `select`, `textarea`, `file-input`, `btn`, `tab`, `range`, `join` children** |
| `--radius-box`      | large surfaces: `card`, `modal`, `alert`, `dropdown`/menu panels |

daisyUI ships its component CSS with the radius *already delegated* to those tokens. The
compiled rules look like:

```css
.input    { border-radius: var(--radius-field); }
.select   { border-radius: var(--radius-field); }
.textarea { border-radius: var(--radius-field); }
.btn      { border-radius: var(--radius-field); }
.tab      { border-radius: var(--radius-field); }
```

So the component classes never hardcode a radius — they *read* one. The
`@plugin "daisyui/theme" { name: "light"; ... }` block you quoted is compiled by the plugin
into a scoped custom-property declaration, roughly:

```css
[data-theme="light"] { ... --radius-field: 9999rem; ... }
```

Because custom properties inherit, that declaration on the theme root cascades into every
descendant in the document. Every `.input`, `.select`, `.textarea`, `.btn`, `.tab` anywhere
in the tree — pages you wrote, Scaffold-ETH's own `AddressInput` / `EtherInput` /
`IntegerInput`, RainbowKit-adjacent chrome that uses daisyUI classes, and any field a
teammate adds tomorrow — resolves `var(--radius-field)` to `9999rem`.

## 2. Why `9999rem` produces a pill, and why textareas clip

`border-radius` is clamped by the spec: if the sum of radii along any edge exceeds that
edge's length, the browser scales **all** radii down by a common factor until they fit. A
`9999rem` (~160,000px) radius on a 40px-tall input is reduced to exactly half the short
side — 20px — on all four corners. That is the definition of a pill/stadium shape. The value
is effectively "infinity"; it is the idiomatic way to say *always fully round* and is why
every field, regardless of size, comes out perfectly capsule-shaped rather than
inconsistently rounded.

For a single-line `input` that's merely a style choice. For a **`textarea`** it is a
functional bug: the element is tall, so the clamp lands at half of the *width* is not
reached first — the radius resolves to half the shorter dimension, carving huge circular
arcs out of all four corners. Text is laid out in the element's rectangular content box and
is not reflowed around the border curve, so the first and last lines run straight into the
arc and are visually cut off by the border/background edge. Same mechanism truncates the
corners of multi-line `select` popovers and any tall `.btn`.

This is also why it looks like "the whole app changed at once": one token declaration,
one inherited variable, every field component in daisyUI's library.

## 3. Why per-component `rounded-lg` patching keeps losing

The teammate's fix is `class="input rounded-lg"`. Tailwind v4 puts utilities in a later
cascade layer than daisyUI's component layer, so on *that one element* `rounded-lg` does
win. The patch isn't failing on specificity — it's failing structurally, in four ways:

1. **It is opt-in against a default.** The broken value lives in the theme and is what every
   element gets for free. The correction lives per-element and must be remembered every
   time. The default always wins the long game: any field added without the extra class is
   born pill-shaped again. You are fighting the cascade's inheritance with manual discipline,
   and discipline does not scale across a team or across dependency-provided markup.

2. **You cannot patch markup you don't own.** Scaffold-ETH 2's own components
   (`AddressInput`, `EtherInput`, `IntegerInput`, `InputBase`, `Faucet`, `ContractInput` in
   the Debug Contracts tab) render daisyUI classes internally. Those fields stay pill-shaped
   unless you fork or prop-drill a className into every one.

3. **Composite components compute *derived* radii from the same token.** `join` (used by
   Scaffold-ETH for the input+unit-toggle pairs in `EtherInput`) sets the leading child's
   start corners and the trailing child's end corners from `--radius-field` via its own
   `--join-ss` / `--join-se` internals. `rounded-lg` on the outer wrapper does not reach
   those; `rounded-lg` on a child fights the join's own corner-zeroing rules. You get
   half-patched seams.

4. **It is a hardcoded value divorced from the theme, so it drifts.** `rounded-lg` is a
   literal `0.5rem` baked into JSX. It is unaffected by the `light`/`dark` theme blocks, so
   the moment the two themes differ, or someone tunes the design system's radius, the
   patched fields are frozen at an old value while everything else moves. That is exactly
   the "patched ones drift out of style" symptom — they stopped participating in the theme.

The general rule: **when a design token is wrong, fix the token. Patching consumers of a
bad token converts a one-line bug into an unbounded maintenance tax.**

## 4. The correct fix

Set `--radius-field` to a real radius, **in every theme block in `globals.css`**. In a stock
Scaffold-ETH 2 `packages/nextjs/styles/globals.css` that is *two* places, and they are easy
to half-fix:

```css
@plugin "daisyui/theme" {
  name: "light";
  default: true;
  ...
  --radius-selector: 0.5rem;   /* leave as-is unless selectors are also wrong */
  --radius-field: 0.5rem;      /* <-- was 9999rem */
  --radius-box: 1rem;
  ...
}

@plugin "daisyui/theme" {
  name: "dark";
  prefersdark: true;
  ...
  --radius-selector: 0.5rem;
  --radius-field: 0.5rem;      /* <-- was 9999rem; must be changed here too */
  --radius-box: 1rem;
  ...
}
```

**Value:** `0.5rem` (8px). This is deliberately the exact value Tailwind's `rounded-lg`
resolves to, so the app lands on the shape your teammate already hand-picked and approved —
nothing visually regresses at the two patched inputs, everything else catches up to them.
`0.375rem` (`rounded-md`) is the other defensible pick if you want a tighter, more
"app-like" field. Do not use `0`; daisyUI's field paddings and focus rings are tuned assuming
some curvature.

**Checklist for applying it:**

1. Change `--radius-field` in the `name: "light"` block.
2. Change `--radius-field` in the `name: "dark"` block. **Both.** Fixing only the default
   theme is the classic half-fix here — the bug survives for every dark-mode user, and
   `prefersdark: true` means that's whoever has a dark OS setting, not just people who
   clicked the toggle.
3. If the file has any *additional* `@plugin "daisyui/theme"` blocks (custom brand themes) or
   a `@plugin "daisyui" { themes: ... }` block naming more themes, each theme that declares
   `--radius-field` needs the same value. Grep the file:
   `grep -n 'radius-field\|daisyui/theme' packages/nextjs/styles/globals.css`.
4. While you're in there, sanity-check `--radius-box` and `--radius-selector` in both blocks
   — if one radius token got set to `9999rem`, the others are worth a look, and consistent
   values across the three tokens are what make the app read as one design system.
5. **Delete the `rounded-lg` patches** from the two components your teammate touched. Leaving
   them is harmless today but reintroduces the drift problem: they're now dead overrides that
   silently stop tracking the theme.

**Where *not* to put the fix.** Do not add `:root { --radius-field: 0.5rem; }` or an
`@layer base` override elsewhere in the file. daisyUI emits its value on `[data-theme="..."]`,
which has the same specificity as `:root` (0,1,0) — so which one wins is decided by source
order against plugin-generated CSS you don't control, and it breaks the moment the theme
toggle switches the attribute. Edit the value at its source, inside the theme blocks.

**One caveat to decide consciously:** `--radius-field` also governs `.btn` and `.tab`. If the
pill *buttons* were intentional and only the text fields were wrong, this change squares off
your buttons too. In that case still fix the token — then re-round buttons deliberately with
a single global rule rather than per-call-site classes:

```css
@layer components {
  .btn { border-radius: var(--radius-selector); }  /* or a dedicated 9999rem */
}
```

One rule, one place, still theme-aware — the same principle, not a retreat to per-component
patching.
