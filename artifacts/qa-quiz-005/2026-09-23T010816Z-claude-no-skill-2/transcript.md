# Executor transcript — 2026-09-23T010816Z-claude-no-skill-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T010816Z-claude-no-skill-2/qa-quiz-005

## assistant
- **Bash** `ls -a && find . -path ./node_modules -prune -o -name "*.ts*" -print | head -50`

  > .
  > ..
  > .git
  > package.json
  > TASK.md

## assistant
No Scaffold-ETH source is checked out here (the directory holds only `TASK.md` and `package.json`), so the answer is written against the stock SE-2 `wagmiConfig.tsx` / `scaffold.config.ts` shape quoted in the report. Writing it now.

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why production lands on `mainnet.base.org` while dev doesn't

## 1. The chain, end to end

**Step 1 — `NEXT_PUBLIC_*` is a build-time constant, not a runtime lookup.**
Next.j … [7697 more chars]`

  > written
  >      145 answer.md

## assistant
Written to `answer.md`. The short version:

**The chain.** `NEXT_PUBLIC_*` is not a runtime lookup — webpack's DefinePlugin textually substitutes literal `process.env.NEXT_PUBLIC_RPC_URL` occurrences at `next build` time with whatever is in the build shell. Devs have a gitignored `.env.local`, so the dev server sees a real URL. The production build environment doesn't, so the expression is inlined as literal `undefined`. `scaffold.config.ts` is client-bundled, so `rpcOverrides` ships as `{ [base.id]: undefined }` — key present (config "looks right"), value falsy. Static export means no server, no runtime env injection: setting the variable in the host's dashboard afterward does nothing without a rebuild + redeploy. SE-2's `if (rpcOverrideUrl)` guard then falls through to bare `http()`, which is viem's "use `chain.rpcUrls.default.http[0]`" mode → `https://mainnet.base.org`. Multiply by SE-2's `pollingInterval` block-watching across concurrent visitors → 429s.

**The one check.** Grep the *served* JavaScript for the paid RPC hostname (`curl` the production chunk, or `grep -r` `.next/static/chunks/`). It bypasses every intermediate belief — `.env` file, CI secret, host env panel, source — and interrogates the only artifact that matters. It also catches the likeliest failed fix: env set, no fresh build, same chunk hash, same baked `undefined`.

**The second trap.** In `wagmiConfig.tsx` the override branch yields `[http(overrideUrl), http()]` — the bare public `http()` stays in the `fallback()` rotation. viem silently rotates to it on any paid-endpoint error (429, 5xx, timeout, unsupported `eth_getLogs` range) and marks the failed transport down for a cooldown, so a bad minute migrates traffic to the public RPC and keeps it there. Separately, the `isUsingDefaultKey` branch orders it `[http(), http(alchemyUrl)]` — public *first*, keyed on the Alchemy key rather than the override, so it can bite a chain you weren't considering.

One caveat on scope: this repo contains only `TASK.md` and `package.json`, so I reasoned against the stock SE-2 `wagmiConfig.tsx` rather than your actual file. Worth diffing yours against the upstream snippet in the answer — particularly whether the fallback arrays still contain the bare `http()`.

## run stats
- turns: 3
- duration: 75s
- cost: $0.28364350000000005
- tokens in/out: 56228/5719
- of which cache write/read: 11845/44377
