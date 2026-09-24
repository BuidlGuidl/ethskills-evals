# Executor transcript — 2026-09-23T014800Z-claude-with-skill-d9952522-3

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-23T014800Z-claude-with-skill-d9952522-3/qa-quiz-005

## assistant
- **Bash** `ls -a && cat scaffold.config.ts 2>/dev/null; find . -name wagmiConfig.tsx -not -path "*/node_modules/*"`

  > .
  > ..
  > .agents
  > .claude
  > .git
  > package.json
  > TASK.md

## assistant
- **Skill** `{"skill":"qa","args":"RPC posture: production 429s from mainnet.base.org despite rpcOverrides with NEXT_PUBLIC_RPC_URL"}`

  > Launching skill: qa

## assistant
No project source here (only `TASK.md`), so this is an analysis writeup. Writing `answer.md`:

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Why production hits `mainnet.base.org` while dev machines don't

## The chain, link by link

**1. `NEXT_PUBLIC_*` is a build-time substitution, not a runtime lookup.**
Next.j … [6479 more chars]`

  >      139 answer.md

## assistant
Written to `answer.md`. The short version:

**The chain:** `NEXT_PUBLIC_*` is a build-time string substitution, not a runtime lookup — Next.js inlines the value into client bundles during `next build`. With a static export on generic hosting there's no server to re-read env at request time, so only the *build* environment ever mattered. Devs have a gitignored `.env.local`; the CI build container almost certainly doesn't, so `process.env.NEXT_PUBLIC_RPC_URL` inlined as `undefined`. That makes `rpcOverrides[base.id]` an entry whose *value* is undefined — which fails the truthiness check in `wagmiConfig.tsx` exactly like a missing entry. The transport then falls through to bare `http()` with no URL, and viem resolves that to `chain.rpcUrls.default.http[0]` = `https://mainnet.base.org`. (The `else` branch is no rescue either — SE-2's default Alchemy key is a shared, rate-limited demo key.)

**The settling check:** grep the *deployed* JS bundles for the paid RPC hostname. If it isn't in the served chunks, the variable wasn't present at build time — full stop. The bundle is the only place the substitution's outcome is observable; the config source, the host's env-var panel, and `.env.local` each test something other than what shipped. Also: an env-var change without a fresh build is a no-op.

**The second trap:** `const rpcFallbacks = [http()]` puts the *public* default at index 0, and the override is `push`ed after it. viem's `fallback` tries transports in array order, and with default `rank: false` that order never re-sorts. So even with the env var fixed, `mainnet.base.org` absorbs 100% of first attempts and the paid RPC only serves the error tail — requests the public endpoint answers successfully never reach the paid provider at all. Fix is to order the override first and keep bare `http()` last (or drop it for production chains); the `as Record<number, string>` cast is also what lets `undefined` through the type checker silently.

## run stats
- turns: 5
- duration: 67s
- cost: $0.300529
- tokens in/out: 78682/5158
- of which cache write/read: 13916/64758
