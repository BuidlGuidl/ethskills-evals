# Why every field in the app is pill-shaped — and the one-line fix

## 1. The mechanism: `--radius-field` is a DaisyUI theme token, not a style on one component

`--radius-field` is one of DaisyUI 5's three global radius tokens, declared inside the
`@plugin "daisyui/theme" { ... }` block in `packages/nextjs/styles/globals.css`:

- `--radius-selector` → checkbox, radio, toggle, badge, tab
- `--radius-field` → **input, select, textarea, file-input, range, btn, join items**
- `--radius-box` → card, modal, alert, dropdown/menu surfaces

The plugin emits those declarations onto the theme scope (`:root` / `[data-theme="light"]`),
and DaisyUI's own component CSS consumes them. Every DaisyUI field class is authored as
roughly:

```css
.input, .select, .textarea, .file-input {
  border-radius: var(--radius-field);
}
```

So setting `--radius-field: 9999rem` is not "a style on one input." It rewrites the
computed `border-radius` of every element in the app carrying `input`, `select`,
`textarea`, `file-input`, `btn`, or a `join` child class — including the ones inside
Scaffold-ETH's own components (`AddressInput`, `EtherInput`, `IntegerInput`,
`InputBase`, the Debug Contracts page, the faucet modal). That is why *every* field is
affected and why new fields are born pill-shaped: the field shape is inherited from the
theme, and each new `className="input input-bordered"` opts straight back into it.

**Why textareas clip.** `9999rem` is an absurd radius. The browser clamps a radius that
exceeds the box to half the shorter side, which on a single-line input is exactly the
stadium/pill shape. On a multi-line `textarea` the box is tall, so the clamp lands at a
large radius on *all four* corners, and the rounded corner arcs cut across the text area's
content box. First and last lines get visually chopped at the corners. Same story for
`select` (the chevron collides with the arc) and for `join` groups, whose inner segments
inherit the outer radius and end up with lens-shaped seams.

## 2. Why the per-component `rounded-lg` patching keeps losing

Three independent reasons, all structural:

1. **It's opt-in patching against an opt-out default.** The theme token is the *default*
   for the class. A `rounded-lg` utility only fixes the one element it's typed on. There
   is no rule that makes the next `<input className="input" />` inherit the patch, so
   every new field the team adds reverts to `9999rem`. You are manually re-fixing a
   default forever, and the fix's coverage decays with every commit.

2. **It can't reach the fields you don't author.** The pill shape is also inside
   SE-2's shipped components and DaisyUI's own markup — `AddressInput`'s wrapper and
   its inner `join` segments, `EtherInput`'s currency-toggle button, the Debug Contracts
   form, dropdowns, date pickers. You cannot put a `rounded-lg` on markup you don't write
   without prop-drilling `className` through every scaffold component or resorting to
   `!rounded-lg` overrides and `[&_.input]:rounded-lg` arbitrary variants — which is
   worse code than the bug.

3. **It creates drift, by design.** `rounded-lg` is a hardcoded literal (0.5rem) that no
   longer tracks the theme. The moment anyone changes the design's radius scale, or adds
   a second theme, the two patched inputs stay at their frozen value while everything
   else moves. The patched inputs and the un-patched inputs disagree; that's exactly the
   "drift out of style" the team is seeing. Specificity fights are a symptom: utilities
   and DaisyUI component classes live in the same Tailwind layer, so whether
   `rounded-lg` even wins over `.input`'s `border-radius` depends on layer/source order,
   which is why people escalate to `!important` and make it permanent.

**The rule:** a value consumed by dozens of components must be fixed where it is
*defined*, not where it is *consumed*. One token edit fixes all current fields, all
scaffold-internal fields, and all future fields at once.

## 3. The correct fix

Set `--radius-field` to a normal radius — **`0.5rem`** (matches `rounded-lg`, the value
the teammate was reaching for, and reads correctly on both single-line inputs and
textareas). `0.375rem`–`0.75rem` are all defensible; pick one and use it everywhere.

### Every place in `globals.css` it has to be applied

`globals.css` in Scaffold-ETH 2 contains **two** `@plugin "daisyui/theme"` blocks — the
`light` theme and the `dark` theme. The token is per-theme, so patching only one leaves
the app pill-shaped the instant a user hits the `SwitchTheme` toggle or their OS reports
`prefers-color-scheme: dark`. **Both blocks must be edited.**

```css
@plugin "daisyui/theme" {
  name: "light";
  default: true;
  ...
  --radius-selector: 1rem;
  --radius-field: 0.5rem;   /* was 9999rem */
  --radius-box: 1rem;
  ...
}

@plugin "daisyui/theme" {
  name: "dark";
  prefersdark: true;
  ...
  --radius-selector: 1rem;
  --radius-field: 0.5rem;   /* was 9999rem */
  --radius-box: 1rem;
  ...
}
```

If the project has added any further `@plugin "daisyui/theme"` blocks (a third brand
theme, a print theme), each one needs the same line — the token does not cascade between
theme blocks.

### Then clean up after it

1. **Remove the two `rounded-lg` patches** the teammate added. Once the token is correct
   they are redundant, and leaving them in guarantees future drift: they're the two
   fields that won't follow the next radius change.
2. **Grep for other escapees** and delete them too, so the theme is the single source of
   truth:
   ```bash
   grep -rn "rounded-\|9999rem\|radius-field" packages/nextjs/styles/globals.css packages/nextjs/app/ packages/nextjs/components/
   ```
3. **Sanity-check the sibling tokens** while you're in the file. If `--radius-selector`
   or `--radius-box` also carry `9999rem`, badges/tabs and cards/modals have the same
   class of bug; `9999rem` is deliberate and fine only for `--radius-selector` if you
   actually want pill badges and toggles.
4. **Verify in both themes**, because the token is theme-scoped: load a page with a
   `textarea`, a `select`, and an `AddressInput` (the Debug Contracts page exercises all
   three), toggle light/dark, and confirm corners are square-ish and no text is clipped.

### Why this is the right shape of fix

One token, two declarations, and the entire app — current fields, Scaffold-ETH's internal
components, and every field written from here on — picks up the correct radius
automatically, in both themes, with nothing to remember and nothing to re-patch.
