# Executor transcript — 2026-09-23T012046Z-claude-no-skill-3

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T012046Z-claude-no-skill-3/qa-quiz-002

## assistant
- **Bash** `ls -a && cat package.json 2>/dev/null; grep -rn "daisyui" --include=package.json -r . 2>/dev/null | head`

  > .
  > ..
  > .git
  > package.json
  > TASK.md
  > {
  >   "name": "eval-workspace",
  >   "private": true
  > }

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why `btn loading` eats the label

## What the teammate wrote

```tsx
<button
  className={`btn btn-primary ${isPending ? "loading" : ""}`}
  disabled={isPending}
>
  {isPendi … [5014 more chars]`

  > done

## assistant
Written to `answer.md`. The short version:

**What's happening:** `loading` isn't a button modifier in DaisyUI v3+ (it was in v2, which is what people misremember). It's a standalone component class that sets `mask-image: url(<spinner svg>)`, `mask-size: 100%`, `background-color: currentColor`, `width: 1.5rem`, and `aspect-ratio: 1/1`. A CSS mask clips the *entire rendered element including its text*, so "Approving..." is still in the DOM and the a11y tree but simply isn't painted — it's clipped to the spinner silhouette. `currentColor` overrides `btn-primary`'s background, and because the mask scales to 100% of the button's box you get one giant spinner instead of a 1.5rem one. The forced square + fixed width is the layout jump. Pure CSS composition, hence identical on desktop and mobile.

**The fix** — give the spinner its own element; `.btn` is already `inline-flex` with `gap`, so it lines up for free:

```tsx
<button className="btn btn-primary" disabled={isPending}>
  {isPending && <span className="loading loading-spinner loading-xs" />}
  {isPending ? "Approving..." : "Approve"}
</button>
```

Same pattern SE-2 uses in `FaucetButton`/`Faucet`. `loading-xs` matters — the default `loading-md` is 1.5rem and will stretch a normal `btn`. The file also covers keeping `disabled` (the attribute, not `btn-disabled`, which is visual-only and doesn't block clicks), plus optional `min-w-*` to stop the remaining width wobble and `aria-busy`/`aria-hidden`.

## run stats
- turns: 3
- duration: 51s
- cost: $0.231278
- tokens in/out: 56081/4135
- of which cache write/read: 10509/45566
