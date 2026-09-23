# Executor transcript — 2026-09-23T005002Z-claude-with-skill-2f0adb01-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T005002Z-claude-with-skill-2f0adb01-1/qa-quiz-005

## assistant
- **Bash** `ls -a && find . -name wagmiConfig.tsx -o -name scaffold.config.ts | head`

## assistant
- **Skill** `{"skill":"qa"}`

  > .
  > ..
  > .agents
  > .claude
  > .git
  > package.json
  > TASK.md

  > Launching skill: qa

## assistant
- **Bash** `cat TASK.md && cat package.json`

  > A Scaffold-ETH 2 dApp live on Base. Ops report: production traffic is
  > getting rate-limited on public endpoints — 429s from
  > mainnet.base.org — even though the config looks right:
  > 
  >     // scaffold.config.ts
  >     rpcOverrides: {
  >       [chains.base.id]: process.env.NEXT_PUBLIC_RPC_URL,
  >     },
  > 
  > On developer machines everything goes through the paid RPC and no
  > 429s appear. The deploy is a static Next.js  … [569 more chars]

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why production hits `mainnet.base.org` while dev machines don't

The config isn't wrong. The value it reads is missing at the only moment it
could ever have been read.

## Th … [6295 more chars]`

  >      143 answer.md

## assistant
Written to `answer.md`. The chain:

1. **`NEXT_PUBLIC_*` is a build-time textual substitution**, not a runtime lookup. `next build` replaces static `process.env.NEXT_PUBLIC_RPC_URL` accesses with a literal string from the *build process's* environment. A static export has no server left to read env at runtime, so setting the var on the host after the build does nothing.
2. **The build environment didn't have it.** Dev machines have gitignored `packages/nextjs/.env.local`; the CI/build container doesn't. Shipped bundle contains `rpcOverrides: { 8453: undefined }` — key present, value gone.
3. **`wagmiConfig.tsx` falls through.** `undefined` is falsy → bare `http()` branch. A bare `http()` isn't a no-op: viem resolves `chain.rpcUrls.default.http[0]`, which for Base is `https://mainnet.base.org`. No throw, no warning — silent public RPC for all prod users.

**The settling check:** grep the *deployed* JS chunks for the literal paid host (and for the absence of `mainnet.base.org`). `vercel env ls` / host env panels prove the var exists somewhere, not that the live artifact was built with it — the value is frozen at build time, so the fix is always set-in-build-env → rebuild → redeploy, and the grep confirms it took.

**The second trap:** SE-2's transport is `fallback([http(override), http(alchemy), http()], { rank: true })` — the bare `http()` stays in the array. With `rank: true` viem continuously probes *every* transport, so public RPC gets hit even while the paid one is healthy, and can be promoted to primary; plus any transient paid-provider blip fails over to it, precisely under load. Fix: drop the bare `http()`, use a second keyed provider for redundancy, `rank: false`, and make a missing override throw rather than degrade silently.

## run stats
- turns: 6
- duration: 59s
- cost: $0.35023200000000004
- tokens in/out: 99860/4533
- of which cache write/read: 19678/80174
