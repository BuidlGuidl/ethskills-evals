## system: init (model claude-opus-5)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: Skill
```json
{"skill":"indexing"}
```

### tool_result
Launching skill: indexing

### user
Base directory for this skill: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/indexing-quiz-003/2026-08-19T033148Z-claude-with-skill-1/workspace/.claude/skills/indexing

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

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

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

### tool_use: Bash
```json
{"command":"cat > /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/indexing-quiz-003/2026-08-19T033148Z-claude-with-skill-1/workspace/answer.md <<'EOF'\n# Portfolio panel: subgraph or direct reads?\n\n**Verdict: the subgraph is overkill and is also the less accurate option here. Don't build it.**\n\nThe panel needs one thing: \"what does this wallet hold right now, across 40 known ERC-20s on Base.\"\nThat is *current state*, and current state is what a contract returns on request. `balanceOf(user)`\nis a view function on every one of those 40 tokens. Indexing exists to answer questions the chain\n*won't* answer on request — history, aggregates across all holders, rankings, time series. None of\nthose are in scope: no history, no charts, no P&L.\n\n## Why the proposed subgraph is the wrong shape for this\n\n1. **It reconstructs, from events, a number the chain already stores.** The mapping would replay\n   every `Transfer` for 40 tokens across all holders — millions of events, a large backfill, a\n   persistent store, and ongoing operation — to derive a value one `eth_call` returns exactly.\n\n2. **It indexes ~100% data you never read.** You index every holder of 40 tokens i
```

### tool_result
written

### assistant
Written to `answer.md`. Short version:

**The subgraph is overkill — and would actually be *less* accurate than the simple approach.**

The panel needs current state, and current state is what a contract returns on request. `balanceOf` is a view function on all 40 tokens. Indexing exists for questions the chain won't answer on request (history, cross-holder aggregates, rankings) — explicitly none of which are in scope.

**Call count: 1 RPC request per panel open.** 40 `balanceOf` reads encoded as 40 entries in a single Multicall3 `aggregate3` call at `0xcA11bde05977b3631167028862bE2a173976CA11` on Base — one `eth_call`, not 40 round trips. Native ETH goes in the same array via `getEthBalance` (still one). `symbol`/`decimals` are static for a curated list, so they ship in the token list: zero runtime calls.

**Why "always accurate" is backwards:** the derived balance is the one that drifts. Balance == sum of Transfers breaks on rebasing tokens (balance changes with no event at all), fee-on-transfer tokens, and non-standard mint/burn — each needing a per-token special case in the mapping forever. A subgraph is also always behind chain head by its indexing lag, so a swap on Base followed by reopening the panel shows the stale number. A direct read at latest block *is* the state.

**Accuracy becomes a fetch policy, not an indexing problem:** refetch on open, on account/chain change, on tx receipt, optionally poll while open. Adding a 41st token is one array entry, no re-sync.

Also flagged the operational cost: the free hosted service was sunset June 2024, `graph deploy` only reaches Studio (testing), production requires publishing to the network and is metered — real recurring work and spend for data any RPC gives you free. The answer ends with the trigger conditions that would make an indexer correct (P&L, leaderboards, activity feed) and notes that if that day comes, the indexer's production home needs naming alongside the architecture.

## result: success — turns 5, 73844ms, cost $0.260191
