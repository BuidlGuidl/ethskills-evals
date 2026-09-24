# Pill-shaped inputs: `--radius-field` in `globals.css`

## Short version

`--radius-field` is not a variable your app code invented — it is one of
daisyUI 5's three theme-level radius tokens. Every daisyUI form component
sets its `border-radius` from it. Setting it to `9999rem` tells the design
system "fields are pills," and the system then applies that to every field
in the app, including ones that don't exist yet. Per-component `rounded-*`
classes fight the symptom one element at a time and lose by construction.

The fix is a one-token change (`0.5rem`) applied in **both** theme blocks in
`packages/nextjs/styles/globals.css`, followed by deleting the patches.

---

## 1. The mechanism: what consumes the variable

daisyUI 5 exposes a small set of theme tokens for shape, declared inside each
`@plugin "daisyui/theme" { ... }` block alongside the colors:

| Token | Governs |
|---|---|
| `--radius-selector` | checkbox, radio, toggle, badge |
| `--radius-field` | **input, select, textarea, file-input, range, tab, and `btn`** |
| `--radius-box` | card, modal, alert, menu, dropdown surfaces |

daisyUI's own component CSS reads them, roughly:

```css
.input, .select, .textarea, .file-input, .btn, .tab {
  border-radius: var(--radius-field);
}
```

So the declaration is a *system-wide shape contract*, not a style on one
element. `9999rem` is the idiom for "clamp to a full pill" — a radius far
larger than any element, which the browser reduces to half the shorter side.
That is exactly what you want on a `btn` or a search chip and exactly what
you do not want on a `textarea`: on a tall multi-line box the corner arc is
half the *height*, so the rounding eats deep into the text column and clips
content at all four corners. Selects get the same treatment, with the chevron
pushed toward the curve.

Two consequences worth stating explicitly:

- **It is retroactive and prospective.** Every field already in the app and
  every field anyone adds next sprint inherits it, because the value is read
  at the component-class level, not at the call site. That is precisely why
  "every new form field the team adds comes out pill-shaped again."
- **It is not limited to inputs.** `--radius-field` also drives `btn` and
  `tab`. If the buttons in the app look deliberately pill-shaped, that is the
  same token, and changing it will change them too. That is usually the
  desired outcome (fields and buttons agreeing on shape is the point of the
  token), but it is the one visual side effect to expect and to look at after
  the change.

## 2. Why `rounded-lg` patching keeps losing

The teammate's patch works on the two inputs it was applied to, and only
those. It fails as a strategy for four compounding reasons:

1. **It is opt-in per element.** The theme token is the default; a utility
   class is an exception. Defaults apply to code nobody has written yet;
   exceptions apply only where someone remembered to type them. Every new
   `<input className="input input-bordered" />` reverts to the pill, forever.
   You cannot fix a default by enumerating its instances.

2. **Many fields aren't yours to patch.** Scaffold-ETH's own form components —
   `InputBase`, and the `AddressInput` / `EtherInput` / `IntegerInput` family
   built on it, plus RainbowKit's and daisyUI's internal markup — ship their
   own class strings. Patching those means forking scaffold components or
   overriding them with `!` utilities, which is a maintenance liability you'd
   carry through every SE-2 upgrade.

3. **The outer element is not the only thing that reads the token.** daisyUI
   uses `--radius-field` in related rules too — notably `join`, where
   `.join > *:first-child` / `:last-child` re-assert the field radius on the
   end caps with their own specificity. A bare `rounded-lg` on a joined input
   can be overridden there, so the patch appears to work in isolation and
   breaks inside a composed control.

4. **It guarantees drift.** Each patch hardcodes one number at one call site.
   The next person picks `rounded-md`, a third picks `rounded-xl`, and the
   real system value in `globals.css` still says `9999rem` — so the codebase
   now disagrees with itself in three places and with the theme in all of
   them. This is the "patched ones drift out of style" symptom, and it gets
   worse monotonically.

The correct layer for a decision that applies to every field in the app is
the layer that already applies to every field in the app.

## 3. The fix

**Value:** `--radius-field: 0.5rem;`

`0.5rem` (8px) is Tailwind's `rounded-lg`, so it matches what the teammate
chose by hand — the two patched inputs keep their current appearance and
everything else joins them. Anything in the `0.25rem`–`0.75rem` range is a
defensible product choice; the requirement is a real finite length, not the
pill sentinel.

**Where:** in `packages/nextjs/styles/globals.css`, in **every**
`@plugin "daisyui/theme"` block. Scaffold-ETH 2 ships two — `light` and
`dark` — each declaring the full token set independently. There is no
inheritance between them.

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

Editing only the `light` block is the classic half-fix: the app looks
correct until a user hits the header's `SwitchTheme` toggle (or arrives with
`prefers-color-scheme: dark`) and every field turns back into a pill. Grep
the file to be sure you got them all:

```bash
grep -n "radius-field" packages/nextjs/styles/globals.css
```

Every hit should read `0.5rem`. While you're in there, check
`--radius-selector` and `--radius-box` in both blocks for the same `9999rem`
sentinel — if the template was customized once, it was often customized
across all three, and box-level pills produce the same clipping on cards and
modals.

**Then remove the patches.** Delete the `rounded-lg` utilities the teammate
added to the two inputs. Once the token is correct they are redundant, and
leaving them in place recreates the drift problem the moment someone tunes
the theme value again — the patched fields would stop tracking the theme.

**Verify:** run the app, and in both light and dark mode look at a single-line
input, a `select`, a multi-line `textarea` (confirm the text no longer clips
at the corners), a `btn`, and a `join`-composed control such as an input with
a trailing button. All of them should now show the same 8px corner, which is
the signal that the shape is coming from one place.
