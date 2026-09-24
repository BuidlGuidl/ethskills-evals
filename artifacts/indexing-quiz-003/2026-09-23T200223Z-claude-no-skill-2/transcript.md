# Executor transcript — 2026-09-23T200223Z-claude-no-skill-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/shiv/.cache/ethskills-evals/2026-09-23T200223Z-claude-no-skill-2/indexing-quiz-003

## assistant
I'll write up the analysis.

## assistant
- **Bash** `ls -la && cat *.md 2>/dev/null | head -50`

  > total 20
  > drwxrwxr-x 3 shiv shiv 4096 Sep 23 20:02 .
  > drwxrwxr-x 3 shiv shiv 4096 Sep 23 20:02 ..
  > drwxrwxr-x 7 shiv shiv 4096 Sep 23 20:02 .git
  > -rw-rw-r-- 1 shiv shiv 1048 Sep 23 20:02 TASK.md
  > -rw-rw-r-- 1 shiv shiv   50 Sep 23 20:02 package.json
  > We're adding a portfolio panel to our dApp. When a user connects, the panel shows
  > their current balance of the 40 ERC-20 tokens we support, on Base — just  … [890 more chars]

## assistant
- **Bash** `cat > answer.md <<'EOF'
# Should we build a subgraph for the portfolio panel?

**No. Don't build it.** The subgraph is the wrong tool for this panel, and it is
strictly *less* accurate than the one-li … [8270 more chars]`

  > 168 answer.md

## assistant
Written to `answer.md`. The short version:

**The subgraph is overkill — and it's less accurate, not more.** Indexing exists to answer questions chain state can't: history, P&L, holder aggregates. "What do I hold right now" is not one of those — it's live contract state, sitting in each token's `balanceOf` mapping. The proposal replays every `Transfer` since deployment to recompute a number the contract hands you for free.

The "always accurate" claim is the weakest part. A derived-balance mapping silently drifts on:
- **Rebasing tokens** (stETH-style, aTokens) — balances change with **no `Transfer` event at all**
- **Fee-on-transfer tokens** — event amount ≠ amount credited
- Non-standard mints/burns, proxy upgrades, and plain arithmetic bugs in your own mappings

Plus indexing lag, reorg handling, a 40-token backfill before anything renders, and a permanent service to operate — where adding token #41 means a redeploy and re-sync.

**Instead: one `eth_call`.** A single `aggregate3` to Multicall3 on Base (`0xcA11bde05977b3631167028862bE2a173976CA11`) carrying 40 encoded `balanceOf` calldatas. One round trip, 40 results. `viem`'s `multicall` / wagmi's `useReadContracts` does this by default. Symbols and decimals are immutable for a fixed list — hardcode them, zero extra calls (fetching `decimals()` at runtime is how teams accidentally turn this into 121 calls).

Accuracy holds because all 40 reads execute in one EVM execution at one block — an atomically consistent snapshot with no skew, read from the chain head with no cache or derived table in between. Rebases and fee-on-transfer are correct for free precisely because you never modeled them. Refresh = re-run the call on panel open.

If you want live updates while it's open, you can filter `Transfer` logs on the connected address — but only as a *cache-invalidation signal* that triggers a re-read. Events never become the balance, so a missed one costs seconds of freshness, not a permanently wrong number.

Roughly an afternoon vs. a sprint plus indefinite ops. I'd keep the subgraph design on file — it becomes the right call the day the product asks for charts, P&L, or top-holder queries.

## run stats
- turns: 3
- duration: 71s
- cost: $0.257446
- tokens in/out: 57181/4763
- of which cache write/read: 11553/45622
