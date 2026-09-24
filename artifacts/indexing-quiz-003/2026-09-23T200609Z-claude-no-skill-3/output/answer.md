# Should we build a subgraph for the portfolio panel?

**No.** For "what does this wallet hold right now, across 40 known tokens, on Base,"
a subgraph is the wrong tool. It is more work to build, more work to operate, and —
this is the part worth pushing back on hardest — it is **less accurate** than the
one-line alternative, not more.

Build it as a **single batched `eth_call` through Multicall3**: 40 `balanceOf` reads
in **one** RPC round trip, pinned to one block.

---

## 1. Why the subgraph is the wrong shape for this problem

### The question being asked is a state read, not a history question

There are two kinds of onchain questions:

- **"What is true right now?"** → read state. The chain already stores it.
- **"What happened, and in what order?"** → read logs / index events.

A token balance is the first kind. `balanceOf(address)` is a `view` function over a
storage slot that every Base node already has materialized. The EVM *is* the index.

The proposed subgraph replays every `Transfer` event for 40 tokens since each token's
deployment and re-derives `balances[holder]` in mapping code — i.e. it rebuilds, off
chain, in TypeScript, a number the chain already maintains authoritatively in Solidity.
That is a reimplementation of the token contract's accounting, and it inherits all the
ways a reimplementation can drift from the original.

### The claim "that way the balances are always accurate" is backwards

A `Transfer`-derived balance is only correct if the contract's balance changes *only
ever* happen through `Transfer` events, with the transferred amount exactly equal to
the balance delta. That assumption breaks on a meaningful fraction of real ERC-20s:

| Failure mode | What breaks | Real examples |
|---|---|---|
| **Rebasing / share-based accounting** | `balanceOf` grows with no `Transfer` at all. Your running total freezes at the last transfer amount and silently drifts, forever. | stETH, Aave aTokens, Ampleforth-style tokens, most yield-bearing wrappers |
| **Fee-on-transfer / deflationary** | Sender is debited X, recipient is credited X−fee, but the event says X. Every hop adds error. | many "tax" tokens, some bridged assets |
| **Non-standard mint/burn** | Contracts that write balances directly, or mint without emitting `Transfer`. | older/nonconforming tokens, some bridge mint paths |
| **Upgradeable proxies** | A token can change its accounting logic under you after your mapping is written and deployed. | most bridged/major tokens on Base are proxies |
| **Indexing lag** | The subgraph is behind the chain head by seconds to minutes, and by *hours or days* during a resync or after a mapping bug. `balanceOf` is never behind. | inherent to any indexer |
| **Reorgs** | graph-node handles them, but the panel can briefly show a rolled-back balance. | inherent |
| **Your own bug** | A mapping bug corrupts balances permanently until you fix and fully reindex. | inherent |

Note the asymmetry: when a subgraph is wrong, it is **silently** wrong, and stays wrong
until someone notices and reindexes. `balanceOf` cannot be silently wrong — it is the
token contract's own answer, the same number that governs whether a transfer succeeds.

### And the operational cost is real

Indexing all `Transfer` events for 40 tokens on Base is a very large event set (Base is
a high-throughput L2; the majors alone are hundreds of millions of transfers). That means:

- a multi-day-to-multi-week initial sync before the panel shows anything,
- a hosted/Studio bill or a self-hosted graph-node + Postgres + archive RPC to run,
- a new production dependency that can go down, fall behind, or need reindexing,
- a schema/mapping to version and migrate every time you add token #41,
- an on-call surface for a feature that should have zero infrastructure.

You'd be spending a sprint, plus ongoing headcount and money, to get a **worse** number.

### When a subgraph *would* be right

To be clear, this isn't "subgraphs are bad." Index events when the question genuinely
requires history or cross-entity aggregation that no contract exposes as state:

- balance **history** / time-series charts, cost basis, realized P&L
- "top 100 holders of token X", holder counts, distribution stats
- "all wallets that ever touched contract Y", user activity feeds
- anything requiring joins/filters across many addresses at once

Your own scope explicitly rules all of those out: *"No history, no charts, no P&L,
just what you hold right now."* If that scope changes later, revisit this — but build
the panel now, and build the indexer when there's an actual history feature to serve.

---

## 2. What the panel should do instead

### The call count: **1**

One `eth_call` to Multicall3, which fans out to 40 `balanceOf` calls inside a single
EVM execution and returns 40 results.

- Multicall3 on Base: `0xcA11bde05977b3631167028862bE2a173976CA11`
  (same address on Base as on every other chain it's deployed to)
- Function: `aggregate3(Call3[])` — one entry per token, each
  `{ target: token, allowFailure: true, callData: balanceOf(user) }`
- Cost to the user: **zero gas, zero signatures.** `eth_call` is a simulated read.

Accounting for the whole panel:

| What | Calls | Notes |
|---|---|---|
| 40 × `balanceOf(user)` | **1** (batched in one `aggregate3`) | one RPC round trip |
| Native ETH balance, if shown | **0 extra** | add `Multicall3.getEthBalance(user)` as a 41st entry in the *same* aggregate |
| `decimals` / `symbol` / `name` | **0** | static per token — hardcode in the token list at build time; they never change |
| Prices, if you ever add USD values | 0 onchain | use an off-chain price API; don't read AMM spot prices for display |

So: **one call, whole panel.** Not 40, and certainly not a subgraph.

For comparison: the naive loop is 40 separate `eth_call`s (40 round trips, 40 different
block heights, waterfall latency, rate-limit risk). Multicall collapses that to one.

### Concretely, with viem/wagmi

```ts
// tokens.ts — static, checked into the repo. No onchain call needed for metadata.
export const TOKENS = [
  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
  // ... 39 more
] as const
```

```ts
// usePortfolio.ts
import { useReadContracts, useAccount } from 'wagmi'
import { erc20Abi } from 'viem'

export function usePortfolio() {
  const { address } = useAccount()

  return useReadContracts({
    allowFailure: true,          // one bad token can't blank the whole panel
    contracts: TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address!],
    })),
    query: {
      enabled: Boolean(address),
      refetchOnMount: 'always',  // "refreshed when they reopen the panel"
      staleTime: 12_000,
    },
    // wagmi/viem batches these into ONE Multicall3 aggregate3 eth_call
    // as long as the client has `batch: { multicall: true }` configured.
  })
}
```

Client setup — this is the bit that makes it one call rather than 40:

```ts
import { createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'

export const config = createConfig({
  chains: [base],
  batch: { multicall: { wait: 16 } },   // aggregate reads into one eth_call
  transports: { [base.id]: http(BASE_RPC_URL) },
})
```

If you'd rather be explicit than rely on the batcher, call
`publicClient.multicall({ contracts, allowFailure: true, blockNumber })` directly —
same thing, one request, and it lets you pin the block (next section).

Total infrastructure required: **an RPC endpoint you already have.** No new service,
no database, no sync, no on-call.

---

## 3. How this stays accurate as balances change

This is the part the engineer was worried about, and it's where the read-state approach
is strongest.

**1. It has no staleness of its own.** `eth_call` with the default `latest` block tag
executes against the node's current canonical state. There is nothing to sync and
nothing to fall behind — the answer is produced by running the token's own `balanceOf`
against the same storage the chain uses to validate transfers. If the balance changed
one block ago, the next read sees it. There is no class of balance change — transfer,
mint, burn, rebase, airdrop, direct storage write, a token upgrade that redefines
accounting entirely — that this can miss, because it asks the contract instead of
guessing from its event log.

**2. All 40 numbers come from the same block, so the panel is internally consistent.**
Because the 40 reads execute inside one `eth_call`, they're all evaluated against one
block's state. A swap that lands mid-fetch can't produce a snapshot showing both the
pre-swap USDC and the post-swap WETH. With 40 separate calls you'd have no such
guarantee. Pin it explicitly if you want to display it:

```ts
const blockNumber = await publicClient.getBlockNumber()
const balances = await publicClient.multicall({ contracts, blockNumber })
// render "as of block {blockNumber}" — an honest, verifiable freshness indicator
```

**3. Refresh is a re-read, and re-reads are cheap.** Your stated requirement is
"refreshed when they reopen the panel," which `refetchOnMount: 'always'` satisfies
exactly — one call per panel open. If you want it livelier, pick one:

- **Poll on new blocks.** Base blocks are ~2s; `useBlockNumber({ watch: true })` +
  refetch, throttled to every Nth block, keeps the panel near-live for one call each.
- **Invalidate on relevant activity (cheapest).** `watchContractEvent` on `Transfer`
  with `args: { to: address }` / `{ from: address }` across your 40 tokens, and refetch
  only when one fires. Note this is a *cache-invalidation hint*, not the source of
  truth — the number still comes from `balanceOf`, so a missed or malformed event
  costs you a delayed refresh, never a wrong balance. That's exactly the property the
  subgraph design lacks.
- **Refetch after your own transactions.** Invalidate the query on receipt of any tx
  the dApp submits; that covers the case users actually notice.

**4. Failure is per-token and visible.** With `allowFailure: true`, a token that
reverts (self-destructed, broken proxy, wrong address in your list) returns a failure
for that row only. Show a dash on that row and log it. The other 39 render fine. A
subgraph with a mapping bug, by contrast, tends to serve confidently wrong numbers.

**5. It scales well past 40.** One `aggregate3` with 40 `balanceOf` calls is roughly
1M gas of simulated execution — far under any provider's `eth_call` gas cap, and a few
KB of calldata. You have comfortable headroom to a few hundred tokens; past that, chunk
into batches of ~100–250 (viem's `batchSize` does this for you) and you're at 2–3 calls,
still not an indexer.

---

## Recommendation

Cut the subgraph from the sprint. Build the panel as a static 40-token list plus one
Multicall3 `eth_call`, refetched on panel open. That's a few hours of work, one call per
refresh, zero new infrastructure, zero operating cost, and a strictly more accurate
number than a `Transfer`-derived balance — because it's the token contract's own answer
rather than a reconstruction of it.

Revisit indexing the moment the scope grows a time axis — history, charts, P&L, or
holder-level aggregation across many wallets. Those genuinely need an indexer, and
that's the right time to spend a sprint on one.

### One thing to sanity-check before you build

If any of your 40 tokens are **rebasing or yield-bearing** (stETH-style, aTokens,
wrapped yield assets), that's independent confirmation of the argument above: those are
precisely the tokens whose balances a `Transfer`-derived subgraph would report wrongly
from day one, with no error surfaced. `balanceOf` handles them correctly for free. Worth
grepping the token list for them — not because it changes the recommendation, but
because it's the concrete example to show the engineer.
