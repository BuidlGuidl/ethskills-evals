# Pill-shaped inputs in Scaffold-ETH 2: `--radius-field`

## 1. What consumes the variable

`--radius-field` is not a Scaffold-ETH variable. It is one of daisyUI 5's three
theme-level radius tokens, declared inside each `@plugin "daisyui/theme" { ... }`
block in `packages/nextjs/styles/globals.css`:

| token              | consumed by                                                   |
|--------------------|---------------------------------------------------------------|
| `--radius-selector`| checkbox, radio, toggle, badge                                 |
| `--radius-field`   | **input, select, textarea, file-input, tab, button**           |
| `--radius-box`     | card, modal, alert, menu, dropdown                             |

daisyUI's own component CSS does not hardcode corner values. Every form-control
class ships as roughly:

```css
.input, .select, .textarea, .file-input { border-radius: var(--radius-field); }
```

So the variable is the single source of truth for the corner radius of every
field in the app. Setting it to `9999rem` resolves to a radius far larger than
any control's height, which CSS clamps to "half the shorter side" — the
definition of a pill. That is why it looks intentional on a single-line input
and broken on a `textarea`: a tall multi-line box gets a radius clamped to half
its *width*, so the arcs cut deep into the top and bottom rows and the first and
last lines of text disappear behind the curve.

It reshapes *every* field because the theme block is global. SE-2's own wrappers
(`InputBase`, and through it `AddressInput`, `EtherInput`, `IntegerInput`,
`Bytes32Input`) and the entire Debug Contracts page render daisyUI `input` /
`textarea` / `select` classes, so they all read the same variable. One
declaration, app-wide blast radius.

## 2. Why per-component `rounded-*` patching keeps losing

The teammate's `rounded-lg` does win on the two elements it is attached to —
Tailwind utilities land in a later cascade layer than daisyUI's component
styles. That is exactly the problem: it wins *locally* and changes nothing about
the default.

- **It treats a symptom, not the cause.** `--radius-field: 9999rem` is still the
  app's declared default. Every field the team adds tomorrow — and every field
  inside SE-2 internals, Debug Contracts, and any daisyUI component the team
  never touches — is born pill-shaped. The patch has to be re-applied by hand,
  forever, by whoever remembers.
- **It hardcodes a literal and forks the design system.** `rounded-lg` is a fixed
  `0.5rem`, disconnected from the theme token. When the theme value is tuned
  later, the patched inputs do not follow — that is precisely the "drift out of
  style" the team is seeing. The patched fields and the unpatched fields are now
  two different design languages.
- **It is incomplete by construction.** A single `rounded-lg` on a wrapper misses
  compound controls: input groups with `join`, prefix/suffix add-ons, the
  `select` arrow well, `file-input`. Those need per-corner utilities
  (`rounded-l-lg` / `rounded-r-lg`) that nobody writes, so the group ends up
  half-pill, half-square.
- **It cannot be enforced.** There is no lint rule that says "every new input
  must carry `rounded-lg`". A theme token needs no enforcement — it is the
  default.

The rule: fix radius once at theme level, never per component.

## 3. The correct fix

Set the value to a normal UI radius. `0.5rem` matches the rest of the SE-2
surface work; anything in the `0.375rem`–`0.75rem` range is defensible — pick one
and use the same number everywhere.

```css
--radius-field: 0.5rem;
```

**Where it has to be applied — every `@plugin "daisyui/theme"` block in
`packages/nextjs/styles/globals.css`, not just the one you found.** SE-2 ships
two by default:

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

If the project has added further themes, each one needs the same line — a theme
block that omits it falls back to the daisyUI default, so the toggle would
change corner shape along with color. Verify none are missed:

```bash
grep -n "radius-field" packages/nextjs/styles/globals.css
```

Every `@plugin "daisyui/theme"` block in the file must appear in that output with
the identical value.

### Clean-up that belongs with the fix

1. **Remove the two `rounded-lg` patches.** Leaving them in place re-creates the
   drift as soon as the theme value is ever tuned. Once the token is correct they
   are dead weight.
2. **Sweep for other hardcoded overrides**, including SE-2 wrapper components
   that may carry an explicit `rounded-full`:
   ```bash
   grep -rn "rounded-full\|rounded-lg\|rounded-xl" packages/nextjs/components/scaffold-eth/ packages/nextjs/app/ | grep -i "input\|select\|textarea"
   ```
   Anything matching a form control should be deleted so the element inherits the
   token. (`rounded-full` on an avatar, blockie, or icon button is correct — leave
   those.)
3. **Expect buttons to change too.** In daisyUI 5 `.btn` also reads
   `--radius-field`, so this un-pills buttons app-wide along with the inputs.
   That is almost always what you want — consistent radius across the form
   surface. If pill buttons are a deliberate brand choice, keep them with an
   explicit `rounded-full` on `.btn` rather than by reverting the token; the
   token exists to serve fields, and fields are the thing that is broken.
4. **Re-check `--radius-selector` and `--radius-box`** in the same blocks while
   you are in the file. If `--radius-field` was left at the scaffold default,
   the other two often were as well, and `--radius-box: 9999rem` produces the
   same clipping on cards and modals.

### Verification

Reload with the dev server running (the theme block is build-time CSS, so a hard
refresh may be needed), then confirm on both themes:

- a `textarea` on any form shows square-ish corners with no clipped first/last
  line
- the Debug Contracts page inputs match the hand-written form fields
- `<AddressInput/>` / `<EtherInput/>` groups have matching corners across the
  input and its add-on
- toggling light/dark changes color only, never corner shape
