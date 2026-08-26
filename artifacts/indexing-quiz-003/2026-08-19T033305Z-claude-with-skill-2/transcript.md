## system: init (model claude-opus-5)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: Skill
```json
{"skill":"indexing"}
```

### tool_result
Launching skill: indexing

### user
Base directory for this skill: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/indexing-quiz-003/2026-08-19T033305Z-claude-with-skill-2/workspace/.claude/skills/indexing

# Onchain Data and Indexing

Historical onchain data comes from an indexer, never from a scan at request time. Public RPCs cap each `eth_getLogs` call by block span and by matched-log count, so a full-history scan is thousands of paginated calls that grow with every block and fail on rate limits, timeouts or credits. Back a feed, streak, ranking or dashboard with a one-time backfill into a persistent indexed store that then tails new events — a subgraph, Ponder, a provider data API, or your own indexer. Rebuilding past state from archive-node reads is the same mistake in another shape.

Design contracts event-first: every state change emits an event carrying what the read side needs, because a change with no event is invisible to every indexer, frontend and explorer. Keep aggregation, ranking and pagination offchain; if a result must be committed onchain, store a hash.

Current state is not indexing work. Balances, allowances, ownership and other "as of now" reads are direct contract calls, batched into one request with Multicall3 (`0xcA11bde05977b3631167028862bE2a173976CA11`, same address on most chains) or a provider balances endpoint. Do not build or operate a subgraph to track a number the chain returns on request.

The read side is not designed until its production home is named. Decide where the indexer runs in production and by which command or service, and write that down next to the architecture — this is the decision that silently stays open, leaving a read side that only ever ran on a laptop.

On The Graph, deploying is not publishing, and the free hosted service is gone (sunset June 2024), so there is no free public endpoint to deploy to:

```bash
graph init <slug>          # then codegen/build
graph auth <deploy-key>
graph deploy <slug>        # -> Subgraph Studio: testing only
```

Publish the subgraph from Studio to the network to get the production endpoint, and query it with a Studio API key. Production queries are metered: about 100K free per month, then about $2 per 100K (checked 2026-08-18 — re-read the live pricing page before quoting a budget). Self-hosting a Graph Node or a Ponder process is a fine alternative, but then the host, the persistent store and the process supervision are yours to name.

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: Bash
```json
{"command":"ls -a && cat package.json 2>/dev/null | head -40","description":"List workspace contents"}
```

### tool_result
.
..
.agents
.claude
TASK.md

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: Bash
```json
{"command":"cat > answer.md <<'EOF'\n# Portfolio panel: subgraph or direct reads?\n\n**Verdict: the subgraph is the wrong tool here, and it would make the panel *less*\naccurate, not more.** Current balances are an \"as of now\" read — the chain answers\nthem on request. Build the panel on **one batched `eth_call` per panel open** via\nMulticall3.\n\n---\n\n## Why the subgraph is overkill for this panel\n\nThe scoped design reconstructs, offchain, a number the token contract already\nexposes. `balanceOf(address)` is a public view function on all 40 contracts. A\nsubgraph that replays every `Transfer` since genesis to arrive at that same number\nis doing a large amount of work to produce a value one RPC call returns directly.\n\nConcretely, what a sprint of subgraph work buys and costs:\n\n| | Subgraph | Direct reads |\n|---|---|---|\n| Build | mappings, schema, 40 datasources, ABIs, tests | a static token list + one hook |\n| Backfill | full `Transfer` history for 40 tokens on Base — the large ones (USDC, WETH, cbBTC…) are tens of millions of events each; hours-to-days of sync before the panel shows anything | none |\n| Ongoing ops | Studio publish, API key, indexing health, re-syn
```

### tool_result
written: 188 lines

### assistant
Written to `answer.md`. The short version:

**The subgraph is overkill, and it would make the panel less accurate — not more.**

**Why.** Current balance is an "as of now" read; the token contract already exposes it as `balanceOf(address)`. The scoped design replays every `Transfer` since genesis to reconstruct a number one call returns directly — and it would index hundreds of millions of rows (USDC/WETH on Base alone) in order to ever read *one row per connected wallet*. Nothing in the spec (no history, no charts, no P&L) needs the event history a subgraph exists to hold.

**The accuracy argument runs backwards.** A `Transfer`-derived running balance is a *model* of the balance, and it drifts: rebasing/share-based tokens change `balanceOf` with **no Transfer event at all**; fee-on-transfer tokens credit less than the logged amount; upgradeable tokens can change accounting or add a mint path; plus indexer lag and silent mapping bugs that need a full re-sync to fix. `balanceOf` has none of these, because it isn't a reconstruction — it's the contract's own accounting.

**The call count: 1 onchain call per panel open.** One `eth_call` to Multicall3 (`0xcA11bde05977b3631167028862bE2a173976CA11`, same address on Base) using `aggregate3` with 40 encoded `balanceOf(user)` sub-calls. Not 40 — one round trip. Native ETH goes in the same array via `getEthBalance` (still 1 call). `decimals`/`symbol` are **0 calls** — immutable, so they're constants in a checked-in `tokens.base.ts`. Adding token #41 is one line in that array, not a redeploy and re-sync.

**How it stays accurate.** Every fetch is evaluated at a block against live state, so there's nothing to fall behind. Refetch on panel open (satisfies the spec alone), on account/chain change, after any tx your dApp sends confirms, plus an optional ~12s poll while the panel is open. Worst case is bounded — at most one refresh stale, and the next fetch is unconditionally correct.

Two things I put in the doc that are easy to miss in implementation: use `allowFailure: true` so one paused or non-compliant token degrades to a missing row instead of a blank panel, and **verify your wagmi client has `batch: { multicall: true }`** — without it you silently get 40 separate RPC calls instead of one. I also named the production home for the read path (your existing Base RPC endpoint + a `fallback()` transport), since there's no indexer to host but the call still needs a named owner and request budget.

The subgraph goes back in the drawer for when the panel grows charts, P&L, an activity feed, or leaderboards — all of which need event history. Even then, the current-balance column should keep coming from the multicall.

## result: success — turns 5, 94798ms, cost $0.3094835
