# Why every field is a pill: `--radius-field`

## 1. What consumes the variable

`--radius-field` is not a Scaffold-ETH variable and not a Tailwind variable. It is
one of daisyUI 5's three **theme radius tokens**, declared inside a
`@plugin "daisyui/theme" { ... }` block:

| Token | Applied to |
|---|---|
| `--radius-selector` | checkbox, radio, toggle, badge |
| `--radius-field` | **input, select, textarea, file-input, button, tab, range, join items** |
| `--radius-box` | card, modal, alert, menu, dropdown content |

daisyUI's own component CSS is written against these tokens. Every field
component ships a rule of essentially this shape:

```css
.input, .select, .textarea, .file-input, .btn, .tab {
  border-radius: var(--radius-field);
}
```

So the theme block is not styling one component — it is setting the **single
source of truth that every field-shaped component in the library dereferences at
render time**. Setting it to `9999rem` rewrites the corner radius of every
input, select, textarea, file input, button, tab and joined control in the app in
one stroke, including components that don't exist yet.

## 2. Why `9999rem` produces pills *and* clipped textareas

CSS never renders a radius larger than the box allows. Per the border-radius
overlapping-curves rule, if the radii on any edge sum to more than that edge's
length, the browser scales **all** radii by `f = min(L_i / S_i)`. A `9999rem`
radius therefore always collapses to "half of the shorter dimension":

- **Single-line input** (~40px tall): radius clamps to 20px on each corner —
  a perfect pill. Looks intentional, so nobody suspects the token.
- **Textarea** (say 400 x 120px): radius clamps to **60px** per corner. Four
  60px arcs are carved out of the content box. The text still lays out in the
  full rectangle, so the first and last lines run straight into the curve and
  get visually clipped at the corners.

Same token, same clamp rule; the textarea just makes the damage legible. This is
the tell that it's a token problem and not a per-component problem: the two
symptoms are one cause.

## 3. Why the per-component `rounded-*` patching keeps losing

The patch isn't wrong about specificity — a Tailwind utility does land in a later
cascade layer than daisyUI's component layer, which is why those two inputs
visibly changed. It loses for four structural reasons:

1. **It treats the symptom at N sites instead of the cause at 1 site.** The token
   is still `9999rem`, so the default shape of a field in this app is still a
   pill. Every new `<InputBase>`, `<AddressInput>`, `<EtherInput>`, `<select>` or
   `<textarea>` starts from the broken default and has to be remembered
   individually. That's an opt-in fix against an opt-out problem, and it fails on
   the first PR where someone forgets.
2. **Duplication guarantees drift.** `rounded-lg` here, `rounded-md` there, a
   bare field somewhere else — three shapes in one form. That's exactly the
   "patched ones drift out of style" symptom.
3. **Coverage is incomplete by construction.** Scaffold-ETH's field components
   are composites: `InputBase` renders a bordered `.input` wrapper around a bare
   `<input>`, `AddressInput` and `EtherInput` add prefix/suffix children, and
   `join` groups override corner radii on first/last members. A utility class on
   whichever element you happened to reach only reshapes that element — the
   wrapper, the inner control, the joined siblings and any pseudo-elements keep
   reading `var(--radius-field)`. You end up with a rounded wrapper containing a
   pill, or vice versa.
4. **It never reaches the non-input consumers.** Buttons, tabs and file inputs
   read the same token. Patching inputs leaves the rest of the UI pill-shaped and
   inconsistent with the now-square inputs.

Fixing a design token by overriding its consumers is always a losing race: the
token has unlimited reach and the overrides have to be applied by hand, forever.

## 4. The correct fix

Set the token itself, to a real radius. Use the daisyUI/Scaffold-ETH default:

```css
--radius-field: 0.5rem;
```

`0.5rem` is Tailwind's `rounded-lg`, so it matches what the teammate already
chose for the two patched inputs — the rest of the app snaps to their shape
rather than the other way around. (If you want a tighter look, `0.25rem` is
daisyUI's stock value; the only hard requirement is a small absolute length, not
a clamping one.)

### Where it has to be applied in `globals.css`

**Every `@plugin "daisyui/theme"` block in the file, with the same value in each.**
A Scaffold-ETH 2 `globals.css` declares at minimum two:

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
  --radius-field: 0.5rem;   /* was 9999rem */
  ...
}
```

Fixing only the light block is the classic follow-up bug: the app looks correct
until someone toggles the theme, because the dark block redeclares the token and
wins whenever `data-theme="dark"` is active. Grep the whole file — if any
additional theme blocks, a `:root` override, or an `@theme` / `@theme inline`
block also declare `--radius-field`, set them all; the last matching declaration
for the active theme is the one that renders.

Also check the sibling tokens in the same blocks. If `--radius-selector` or
`--radius-box` were given the same `9999rem` treatment, badges/toggles and
cards/modals are distorted too. Sane values: `--radius-selector: 0.5rem` (or
`2rem` if you want pill toggles/badges, which is a legitimate look for those) and
`--radius-box: 1rem`.

### Cleanup after the token fix

Remove the `rounded-lg` utilities the teammate added to those two inputs. Once
the token is correct they're redundant, and leaving them in place reintroduces
the drift problem — they'll be the two fields that *don't* follow the theme the
next time the radius is tuned. From then on, radius changes are a one-line edit
per theme block, and new form fields are correctly shaped with no action
required.
