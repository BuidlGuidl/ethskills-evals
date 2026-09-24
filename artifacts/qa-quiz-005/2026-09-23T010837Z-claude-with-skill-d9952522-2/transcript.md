# Executor transcript — 2026-09-23T010837Z-claude-with-skill-d9952522-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T010837Z-claude-with-skill-d9952522-2/qa-quiz-005

## assistant
- **Bash** `ls -a && find . -name wagmiConfig.tsx -o -name scaffold.config.ts | head`

  > .
  > ..
  > .agents
  > .claude
  > .git
  > package.json
  > TASK.md

## assistant
- **Bash** `cat TASK.md package.json && find .agents .claude -type f | head -50`

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
  > 429s appear. The deploy is a static Next.js  … [623 more chars]

## assistant
- **Bash** `cat .claude/skills/qa/SKILL.md`

  > ---
  > name: qa
  > description: "Use when a Scaffold-ETH 2 frontend is about to ship or needs a second look: \"is this ready\", \"check my dApp\", a teammate's patch. The checks people forget: wallet flow, wrong-network gating, contract registration, theme and loading states, branding, RPC posture, mobile wallets. Best from a fresh reviewer context. Not for how the frontend behaves for its users in gene … [5697 more chars]

## assistant
No repo code here — just the task and the `qa` skill. Writing the analysis.

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why production hits `mainnet.base.org` while dev machines don't

## The chain, link by link

**1. `NEXT_PUBLIC_*` is a build-time substitution, not a runtime lookup.**
Next.j … [5519 more chars]`

  >      108 answer.md

## assistant
Written to `answer.md`. Summary:

**The chain:** `NEXT_PUBLIC_*` is a *compile-time string substitution*, not a runtime lookup — `next build` inlines whatever the build process saw. Dev machines have `packages/nextjs/.env.local` (gitignored, never reaches CI); the build host doesn't, so the bundle ships `rpcOverrides: { 8453: undefined }`. Setting the var in a static host's *runtime* env is a no-op — no server evaluates env at request time. In `wagmiConfig.tsx`, a falsy override takes the `else` branch, and the fallback transport is built from bare **`http()` with no URL**, which viem resolves to `chain.rpcUrls.default.http[0]` = `https://mainnet.base.org`. If `alchemyApiKey` is still SE-2's shared default, that branch puts the public endpoint *first* on purpose — so all traffic, multiplied by `pollingInterval` across every session, hits it.

**The decisive check:** grep the shipped JS chunks for the paid RPC hostname. Source is not evidence; only the artifact is. Corollary — the fix requires setting the var in the *build* environment and redeploying.

**The second trap:** even with the override set, the array is `fallback([http(url), http()])` — the public endpoint is still entry two, and viem fails over on 429/5xx/timeout, so traffic spills back to `mainnet.base.org` exactly when load is heaviest. Compounding it, `enabledChains` auto-appends `mainnet` for ENS, and `rpcOverrides` only keys `base.id` — so every `<Address/>`/`<AddressInput/>` resolution is a public-RPC call regardless.

## run stats
- turns: 5
- duration: 69s
- cost: $0.3287545
- tokens in/out: 98231/5540
- of which cache write/read: 14852/83369
