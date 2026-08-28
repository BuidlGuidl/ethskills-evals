## system: init (model claude-opus-5)

### assistant
I'll pull up the indexing skill first, since this is squarely a "read onchain history" question.

### tool_use: Skill
```json
{"skill":"indexing"}
```

### tool_result
Launching skill: indexing

### user
Base directory for this skill: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/indexing-quiz-001/2026-08-19T033705Z-claude-with-skill-3/workspace/.claude/skills/indexing

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

## system: thinking_tokens (model ?)

## system: thinking_tokens (model ?)

### tool_use: Bash
```json
{"command":"pwd && ls -a","description":"List working directory contents"}
```

### tool_result
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/indexing-quiz-001/2026-08-19T033705Z-claude-with-skill-3/workspace
.
..
.agents
.claude
TASK.md

### tool_use: Bash
```json
{"command":"cat > /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/indexing-quiz-001/2026-08-19T033705Z-claude-with-skill-3/workspace/answer.md <<'EOF'\n# Sanity check: the \"eth_getLogs from block 0\" plan\n\nShort version: the plan does not ship. Not \"is slow and we optimize later\" — the\nfirst RPC call it makes is rejected by every mainstream provider, and the\nworkaround the contractor will reach for turns one page load into thousands of\nrequests that get slower every single day. Historical onchain data comes from an\nindexer, never from a scan at request time.\n\nBelow: the concrete request count and what forces it, the failure order in\nproduction, and what to build instead.\n\n---\n\n## 1. What that one page load actually becomes\n\n### The plan's own numbers\n\nAssume the collection deployed ~3 years ago. At 12s blocks that is\n`3 × 365 × 24 × 3600 / 12 ≈ 7,884,000` blocks, so the contract went live around\nblock **17,900,000**. The plan scans from block 0 to 25,800,000 — **25.8M\nblocks**, of which the first ~17.9M are before the contract existed. That waste\nis real but it is not the problem; fixing it changes the numbers by ~30% and\nchanges nothing else.\n\n#
```

### tool_result
262 /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/indexing-quiz-001/2026-08-19T033705Z-claude-with-skill-3/workspace/answer.md

### assistant
Written to `answer.md`. The verdict and the key numbers:

**The plan doesn't ship.** The literal request — `eth_getLogs` from block 0 to latest — is rejected by every mainstream provider before any data moves. The workaround (pagination) is what produces the damage.

**The request count and what forces it.** Two independent caps compound. The block-span cap per call is commonly 10,000 blocks, often 2,000 on shared tiers — so 25.8M blocks becomes **2,580 calls at best, ~12,900 on a common tier**, per visitor, per refresh. Then the matched-log cap (typically 10k logs/response) forces recursive subdivision exactly in the dense windows — the mint, marketplace listings — adding more round trips where the interesting history lives. It also grows permanently: +263 calls/year at a 10k cap, +1,300/year at 2k. Concretely on cost, at Alchemy's 75 CU for `eth_getLogs`, one page load is ~193,500 CU — roughly 1,500 page loads against a 300M CU/month free tier. Plus 30–90 MB of JSON to the browser each load.

**What breaks first:** rate limiting (429s) is the first real production failure — 2,600 serialized calls is a 4-minute spinner, parallelized it's a 429 storm with a silently incomplete history. And a dropped Transfer doesn't just lose a feed row, it corrupts every holder balance after it.

**A gap the plan misses entirely:** the feed is specced as "mint, sale, and transfer," but the `Transfer` event carries no price and a sale is indistinguishable from a gift. Labelling sales requires joining marketplace fills (Seaport `OrderFulfilled`) on transaction hash — which a browser-side scan structurally cannot do.

**What to build:** one backfill into a persistent store that then tails the head; frontend makes two indexed queries (~100ms). I recommend launching on a provider NFT/data API — zero new infrastructure, ~a day — and building a subgraph or Ponder in parallel only if sale-labelling doesn't fit. Have the frontend talk to a small data module so the swap is one file.

**Infrastructure you don't have, flagged explicitly:** for the subgraph route — `graph deploy` reaches Studio, which is *testing only*; you must publish to the network for a production endpoint, the free hosted service is gone (sunset June 2024), production queries are metered (~100K free/month, then ~$2/100K, checked 2026-08-18), and publishing needs a funded wallet. For Ponder — host, managed Postgres, process supervision, and indexing-lag alerting, since a stalled indexer serves a plausible stale feed.

One thing worth pulling out: the top-holders panel is *current state*, so once you have the candidate addresses from the index, batch their `balanceOf` through Multicall3 in a single request rather than trusting the replayed balances.

## result: success — turns 5, 137802ms, cost $0.42352049999999997
