# Why every field in the app is a pill — and the one-line fix

## 1. What actually consumes `--radius-field`

`--radius-field` is not a variable your code reads. It is one of daisyUI 5's three
**theme-level radius tokens**, declared inside the `@plugin "daisyui/theme"` block
and consumed by daisyUI's own component CSS:

| token | applied by daisyUI to |
|---|---|
| `--radius-selector` | checkbox, radio, toggle, badge |
| `--radius-field` | **input, select, textarea, file-input, btn, tab, join items, range** |
| `--radius-box` | card, modal, alert, menu, dropdown |

Every one of those component classes ships with, in effect:

```css
.input, .select, .textarea, .file-input, .btn, .tab {
  border-radius: var(--radius-field);
}
```

So the declaration in `packages/nextjs/styles/globals.css`:

```css
@plugin "daisyui/theme" {
  name: "light";
  --radius-field: 9999rem;
}
```

is not styling "a" field — it is redefining the shape of the *field primitive* for
the whole theme. Anything rendered with `className="input input-bordered"`,
`"select"`, `"textarea"`, or SE-2's own `<InputBase/>`, `<AddressInput/>`,
`<EtherInput/>`, `<IntegerInput/>` (all of which wrap daisyUI's `input`) inherits it.
There is no opt-in; you get it by using the component at all.

`9999rem` is ~160,000px. Border radii are clamped proportionally when they exceed
half the box, so the result is always a perfect stadium/pill:

- **Single-line inputs and selects:** cosmetically pill-shaped; the horizontal
  padding no longer clears the curve, so the caret and first character sit inside
  the arc, and the select's chevron crowds the right cap.
- **Textareas:** this is where it stops being cosmetic. A textarea is tall, so the
  clamped radius is half the *height*, not half the line-height — the corner arcs
  sweep deep into the text column. Wrapped lines at the top and bottom of the box
  are visually clipped by the curve and by overflow at the rounded corners. Content
  is genuinely lost, not just ugly.

## 2. Why the per-component `rounded-*` patching keeps losing

The teammate's patch is at the wrong layer. It loses for four independent reasons:

1. **Wrong scope — it's opt-out, not opt-in.** The token defines the default for
   every field the app will ever render. `rounded-lg` cancels that default on
   exactly one element. Every new `<input>`, every new SE-2 `<AddressInput/>`, every
   `<textarea>` a teammate adds starts from `9999rem` again. The patch is
   whack-a-mole against a default that is winning by construction.

2. **It cannot reach everything.** Some field geometry lives in daisyUI's internals
   and pseudo-elements that still read `var(--radius-field)` — the `file-input`'s
   inner button, `join` items' start/end corner overrides, the `select` arrow well,
   `tab` edges. A utility class on the outer element does not reach those, so you
   get half-corrected controls.

3. **The patched fields drift.** `rounded-lg` hardcodes `0.5rem` outside the theme
   system. It no longer tracks the theme, so it can't follow a future radius change,
   and it can't match `--radius-box` surfaces around it. That is exactly the
   "patched ones drift out of style" symptom.

4. **It only ever fixes one theme's worth of the problem anyway** — see below.

Utilities do override the component styles (Tailwind's `utilities` layer is emitted
after daisyUI's `components` layer), so the patch "works" where applied. That's what
makes it seductive and why it keeps getting reapplied instead of fixed.

## 3. The correct fix

Set the token itself, at theme level, to a sane field radius. `0.5rem` matches
`rounded-lg` and is the value SE-2 ships with by default:

```css
--radius-field: 0.5rem;
```

**Every place in `globals.css` it has to be applied — both `@plugin "daisyui/theme"`
blocks.** SE-2's `globals.css` declares two themes, and the token is per-theme:

```css
@plugin "daisyui/theme" {
  name: "light";
  default: true;
  ...
  --radius-field: 0.5rem;   /* was 9999rem */
  ...
}

@plugin "daisyui/theme" {
  name: "dark";
  prefersdark: true;
  ...
  --radius-field: 0.5rem;   /* was 9999rem — must be changed here too */
  ...
}
```

Fixing only the `light` block is the classic half-fix: the app looks correct until
someone hits the header's `<SwitchTheme/>` or loads with `prefers-color-scheme: dark`,
and every field is a pill again. Grep for the token and confirm you get two hits,
both changed:

```bash
grep -n "radius-field" packages/nextjs/styles/globals.css
```

While you're in there, check that the sibling radius tokens in **both** blocks are
coherent rather than also inflated — the usual daisyUI defaults are
`--radius-selector: 0.25rem` (or `2rem` if you want pill toggles/badges, which is
a legitimate choice) and `--radius-box: 1rem`. A stray `9999rem` on `--radius-box`
would do the same thing to cards and modals.

**Then delete the patch.** Remove the `rounded-lg` classes from the two inputs the
teammate touched. With the token corrected they are redundant, and leaving them in
re-creates problem #3 — hardcoded values that won't follow the theme the next time
the radius changes.

## 4. Why this is the shape of the fix in general

The token is the contract between your theme and every daisyUI component. Fix a
theme token once and it propagates to every existing and future field for free;
fight it with utilities and you pay per element, forever, and lose coherence as you
go. Any time a single visual property is wrong on *every* instance of a component
class, look for the theme token before you reach for a utility.
