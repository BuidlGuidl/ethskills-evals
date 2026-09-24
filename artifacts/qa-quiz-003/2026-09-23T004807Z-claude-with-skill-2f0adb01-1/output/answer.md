# Pill-shaped inputs in Scaffold-ETH 2: `--radius-field`

## 1. The mechanism

`--radius-field` is not a variable your app code invented — it is one of daisyUI 5's
three **theme-level shape tokens**:

| token | applies to |
|---|---|
| `--radius-selector` | small toggles: checkbox, radio, toggle, badge |
| `--radius-field` | **anything daisyUI calls a "field"**: `.input`, `.select`, `.textarea`, `.file-input`, `.btn`, `.tab`, `.range`, `.join-item`, `.dropdown` triggers |
| `--radius-box` | containers: `.card`, `.modal`, `.alert`, `.menu` |

The `@plugin "daisyui/theme" { ... }` block in
`packages/nextjs/styles/globals.css` is not styling a component. It is **declaring a
theme**: daisyUI compiles that block into a rule that sets the listed custom properties
on the theme root — roughly

```css
[data-theme="light"] { /* …colors… */ --radius-field: 9999rem; }
```

Every daisyUI field component's own stylesheet then reads that token rather than
hard-coding a number:

```css
.input, .select, .textarea, .file-input { border-radius: var(--radius-field); }
```

So the single declaration `--radius-field: 9999rem` is inherited down the whole document
tree and consumed by **every field daisyUI has ever rendered anywhere in the app** — your
own forms, and equally the inputs inside Scaffold-ETH's own components (`InputBase`,
`AddressInput`, `EtherInput`, `IntegerInput`, `Bytes32Input`, the Debug Contracts page,
the faucet modal). That is why it "reshapes every field": it is the default, not an
override.

**Why `9999rem` produces a pill, and why textareas clip.** A `border-radius` larger than
the element permits is clamped by the CSS spec to the largest value that still fits —
half the shorter side. On a one-line input (~3rem tall) that clamp yields a 1.5rem
radius on each end: a perfect pill, which is the intended aesthetic. On a **multi-line
textarea** the shorter side is the *width*, so the clamp lands on a radius of tens of
rem, and the four corner arcs sweep so far into the box that they cut across the text
rows — the corner clipping the team is seeing. Same single value, two different
symptoms, because the clamp depends on element geometry.

## 2. Why the per-component `rounded-*` patching keeps losing

The patch isn't losing a cascade fight — in Tailwind v4, daisyUI's component rules live
in `@layer components` and `rounded-lg` lives in `@layer utilities`, which sorts later,
so `rounded-lg` does win *on the element it is written on*. That is precisely the
problem:

1. **It is opt-in against a wrong default.** The theme token sets the baseline for
   everything; each `rounded-lg` buys back exactly one element. A new field is
   pill-shaped the moment it is typed, because nobody has to *do* anything to get the
   bad value — it is inherited. You are hand-patching the tail of an infinite list.
2. **It cannot reach the fields you don't render.** `<AddressInput/>`, `<EtherInput/>`,
   `<IntegerInput/>` and the Debug Contracts UI construct their internal `<input
   className="input …">` themselves. There is no className prop path from your JSX to
   that node, so those stay pills no matter how much you patch your own markup — and SE2
   apps are mostly *those* inputs.
3. **Wrapper-vs-control mismatch.** SE2 inputs are usually a `.input`/`.join` wrapper
   around the real control. `rounded-lg` on the outer div reshapes the border while the
   inner control keeps `var(--radius-field)`, and `.join`'s own
   `:first-child`/`:last-child` rules re-apply `--radius-field` to the segment ends —
   so segmented inputs go back to pill ends even on patched markup.
4. **Drift is structural.** `rounded-lg` is a literal, chosen per site. The theme token is
   the single source of truth every unpatched field follows. The two values are not
   linked, so the patched inputs and the rest of the app can only diverge — exactly the
   "patched ones drift out of style" complaint. Retuning the app's radius later means
   editing the token *and* hunting every literal.
5. **It's the wrong layer.** Shape is a design-token decision, the same as color. Encoding
   it per component throws away the theming system SE2 already gives you, including the
   ability for light and dark to differ.

## 3. The correct fix

Set the token itself. Use a normal, non-clamping radius:

```css
--radius-field: 0.5rem;
```

`0.5rem` matches Tailwind's `rounded-lg` — the value the teammate reached for by hand —
so the fix lands on the style they were already converging toward and the existing
patched inputs become visually identical to everything else. `0.25rem`–`0.75rem` are all
defensible; the requirement is only that it be a real length, small relative to the
element, so the spec's clamp never engages and a textarea's corners stop eating text.

### Every place in this file it has to be applied

`globals.css` in Scaffold-ETH 2 declares **two** themes, and each `@plugin
"daisyui/theme"` block is an independent set of custom properties — a value set in one
does **not** carry into the other. The fix must be applied in **every** such block in the
file:

```css
@plugin "daisyui/theme" {
  name: "light";
  /* … */
  --radius-field: 0.5rem;   /* ← was 9999rem */
  /* … */
}

@plugin "daisyui/theme" {
  name: "dark";
  /* … */
  --radius-field: 0.5rem;   /* ← was 9999rem */
  /* … */
}
```

Concretely, in that file:

- [ ] `--radius-field` in the `name: "light"` block → `0.5rem`
- [ ] `--radius-field` in the `name: "dark"` block → `0.5rem`
- [ ] any additional `@plugin "daisyui/theme"` block the project has added (custom brand
      themes) → same value
- [ ] grep to be sure nothing was missed:
      `grep -n 'radius-field' packages/nextjs/styles/globals.css`
      — every hit must read `0.5rem`, and there must be one hit per theme block. A theme
      block with **no** `--radius-field` line inherits daisyUI's own default, so add the
      line there rather than leaving it absent.

Missing the dark block is the usual half-fix: the app looks correct until someone hits
the SE2 `<SwitchTheme/>` toggle, or lands with `prefers-color-scheme: dark`, and every
field is a pill again.

### Then clean up

Once the token is correct, **remove** the `rounded-lg` patches from the two inputs the
teammate fixed. Leaving them in re-creates the drift problem from the other direction:
they become literals that no longer track the theme, and the next time the radius is
retuned they will be the two fields that don't change. Leave shape to the token; leave
`rounded-*` utilities for genuine one-off exceptions.

### Don't confuse the siblings

Only `--radius-field` governs form controls. If the app *also* has pill-shaped cards or
modals, that is `--radius-box`; oddly-shaped checkboxes and toggles are
`--radius-selector`. Each is a separate token and each must be set in every theme block.
