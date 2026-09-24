# Executor transcript — 2026-09-23T200508Z-claude-with-skill-d9952522-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/shiv/.cache/ethskills-evals/2026-09-23T200508Z-claude-with-skill-d9952522-2/indexing-quiz-003

## assistant
- **Skill** `{"skill":"indexing"}`

  > Launching skill: indexing

## assistant
- **Bash** `cat > /home/shiv/.cache/ethskills-evals/2026-09-23T200508Z-claude-with-skill-d9952522-2/indexing-quiz-003/answer.md <<'EOF'
# Portfolio panel: subgraph vs. direct reads

**Verdict: the subgraph is ove … [6309 more chars]`

  > written

## assistant
Written to `answer.md`. Short version:

**The subgraph is overkill — don't build it.** Indexing exists because the chain won't hand you the past. This panel doesn't need the past; every ERC-20 exposes `balanceOf(address)` right now.

What the sprint would actually buy: a backfill of all Transfer events for 40 tokens across all of Base (for *every* holder, to serve the few wallets that connect), plus a production endpoint that isn't free — `graph deploy` only reaches Subgraph Studio (testing), the hosted service was sunset June 2024, so you must publish to the network and pay metered queries (~100K free/month, then ~$2/100K as of 2026-08-18) or self-host and own the Postgres and supervision. And the running balance can silently drift on rebasing or fee-on-transfer tokens — which you'd only detect by calling `balanceOf` anyway. The "always accurate" claim is inverted: the subgraph is the only one of the two that can be wrong, and it's always a few blocks behind head.

**Instead: 1 onchain call.** One `eth_call` to Multicall3 (`0xcA11bde05977b3631167028862bE2a173976CA11`, same address on Base) with 40 encoded `balanceOf` calls batched in — `aggregate3` with `allowFailure: true` so one bad token doesn't blank the panel, and a pinned block so all 40 read the same state. In practice that's `useReadContracts` in wagmi. Decimals/symbols are static — hardcode them.

**Accuracy:** it doesn't stay accurate, it's re-read — there's no cache to go stale. You read the token contract's storage, which *is* the balance. Fetch on panel open, on account/chain change, and after any tx your dApp sends; optionally poll while visible.

Revisit indexing when a feature actually needs history — balance-over-time, P&L, a trade feed, a holders leaderboard. The spec rules all of those out.

## run stats
- turns: 4
- duration: 48s
- cost: $0.208167
- tokens in/out: 55976/3210
- of which cache write/read: 10516/45454
