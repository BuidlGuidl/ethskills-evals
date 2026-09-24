# Do we need a subgraph for the portfolio panel?

**No. The subgraph is overkill, and it is also the less accurate option.** Build the
panel on direct contract reads batched through Multicall3: **one RPC call per panel
open** for all 40 balances.

## Why the subgraph is the wrong tool here

The panel's requirement is *current state* — "what do you hold right now." Indexers
exist to answer questions the chain will not answer on request: history, aggregates,
rankings, feeds, anything that requires replaying past events. `balanceOf` is not one
of those questions. The chain returns the number on demand, at the latest block, for
free.

The proposed design re-derives, in a database, a value the token contract already
stores in a public getter. That means:

- **You own a new liability.** A Graph Node or Studio-published subgraph is a
  deployment, a persistent store, an ongoing query bill, and a thing that can fall
  behind, halt on a mapping error, or need a resync-and-reindex when you add token
  #41. None of that buys the panel anything.
- **It is more likely to be wrong, not less.** The claim "that way the balances are
  always accurate" is backwards. A `Transfer`-derived running balance is a
  *reconstruction*, and it drifts from truth in every case where supply moves without
  a `Transfer` you handled: rebasing tokens, fee-on-transfer tokens where the credited
  amount differs from the logged `value`, mint/burn paths that emit non-standard
  events, tokens with admin/upgrade hooks that adjust balances directly, and
  proxy-upgraded tokens that change semantics mid-stream. Across 40 tokens, assume at
  least one of these bites you. Reading `balanceOf` is accurate *by construction*
  because it is the same storage the token itself uses to settle transfers.
- **It is always stale by design.** A subgraph lags the chain head by its indexing
  latency plus reorg handling. A direct read is current as of the block you read.
- **Cost.** There is no free hosted Graph endpoint anymore (sunset June 2024).
  Studio deploys are testing-only; production means publishing to the network and
  paying metered queries (~100K free/month, then roughly $2/100K — check the live
  pricing page before budgeting). You would be paying per query for data that an RPC
  `eth_call` gives you in one round trip.

A sprint of build plus indefinite operations, to be slower and less correct, is the
trade here.

## What to build instead

**Multicall3 `aggregate3`, one call, 40 `balanceOf(address)` sub-calls.**

Multicall3 is deployed at `0xcA11bde05977b3631167028862bE2a173976CA11` on Base (same
address as on most chains). You encode 40 `balanceOf(user)` calldatas, pass them as
one array, and the RPC executes all 40 reads inside a single `eth_call` against a
single block.

### The call count, precisely

- **1 onchain call per panel open** — one `eth_call` to Multicall3 carrying all 40
  `balanceOf` reads. Not 40.
- **0 additional calls for token metadata.** Symbol, name and decimals for your 40
  supported tokens are static; hardcode them in the frontend token list. Do not spend
  runtime calls re-reading constants you already know.
- **Optional +1** if you also want native ETH in the panel: `getEthBalance` is a
  Multicall3 method, so fold it into the *same* aggregate — still 1 call total.

So: **one RPC round trip renders the whole panel.** If you later support more chains,
it is one call per chain, not one per token per chain.

Sketch with viem, which wraps this natively:

```ts
import { createPublicClient, http, erc20Abi } from 'viem'
import { base } from 'viem/chains'

const client = createPublicClient({ chain: base, transport: http(RPC_URL) })

// SUPPORTED_TOKENS: 40 entries of { address, symbol, decimals } — static config
const balances = await client.multicall({
  contracts: SUPPORTED_TOKENS.map((t) => ({
    address: t.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress],
  })),
  allowFailure: true,   // one odd token can't blank the panel
  // viem batches these into a single Multicall3 aggregate3 call
})
```

`allowFailure: true` matters: if one token address is a weird proxy that reverts, you
render 39 balances and a placeholder for the 40th rather than failing the panel.

A provider "token balances" endpoint (Alchemy/Ankr/etc.) is an acceptable alternative
— one HTTP request, and it also discovers tokens you didn't list. But since the spec
is a fixed set of 40 supported tokens, Multicall3 is simpler, provider-neutral, and
has no extra trust assumption.

## How this stays accurate as balances change

It stays accurate because **there is no cached copy to go stale.** The panel holds no
derived state; every open re-reads the source of truth.

- Each `eth_call` is evaluated against a specific block's state — by default the
  latest block. Whatever transfers, mints, burns, rebases or airdrops landed before
  that block are reflected, whether or not they emitted an event you anticipated.
- "Refreshed when they reopen the panel" is exactly the refresh model this supports:
  open → 1 call → current numbers. Reorgs are a non-issue; the next open simply reads
  the canonical chain.
- For in-session freshness, cache the result for ~10–15s and re-fetch on panel open,
  on wallet/chain change, and after any transaction your dApp sends that could touch a
  supported token. That is a client-side `staleTime` (wagmi's `useReadContracts`
  handles it), not infrastructure.
- Pin all 40 reads to one `blockNumber` in the aggregate if you want a
  self-consistent snapshot — Multicall3 already gives you this, since every sub-call
  executes at the same block. A per-token loop would not.

## When you would revisit this

Build an indexer when the panel's requirements change shape, not before:

- Historical balance charts, "value 30 days ago," or portfolio P&L → needs history,
  needs an indexer (and a price feed).
- A transaction/activity list for the user → needs `Transfer` history, so index it.
- Leaderboards, holder counts, or "top holders of token X" → aggregation across all
  holders, needs an indexer.
- Auto-discovering arbitrary tokens the user holds beyond the supported 40 → provider
  balances API or an indexer.

If any of those land on the roadmap, the design conversation changes and the first
thing to settle is where the indexer *runs in production* — which host, which process
supervisor, which persistent store, named in writing. That is the decision that
quietly stays open and leaves you with a read side that only ever ran on a laptop.
For today's scope, none of it is needed.

## Recommendation

Cut the subgraph from the sprint. The panel is a frontend task: a static 40-token
config, one `useReadContracts`/Multicall3 call on open, `allowFailure: true`, format
with the known decimals. Roughly an afternoon, zero new infrastructure, zero query
bill, and accurate by construction.
