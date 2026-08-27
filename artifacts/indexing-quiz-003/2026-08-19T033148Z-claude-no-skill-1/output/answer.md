# Portfolio panel: subgraph vs. direct reads

**Verdict: the subgraph is overkill, and it is also *less* accurate than the
alternative, not more.** Build the panel on direct contract reads batched through
Multicall3. That is **one onchain call** (one `eth_call`) to fetch all 40 balances
for one wallet, and it is correct by construction because it reads current chain
state rather than a derived replica of it.

---

## 1. Why the subgraph is the wrong tool here

The proposed design is: index `Transfer` for 40 tokens → maintain a running
`balance` per (token, holder) → query it by wallet.

That is a *derived index*. Indexes earn their keep when the question you're asking
cannot be answered by reading current state:

| Question | Needs an index? |
|---|---|
| "What does wallet X hold right now, of these 40 known tokens?" | **No** — it's a state read |
| "How did X's balance change over 6 months?" | Yes — history |
| "Who are the top 100 holders of token T?" | Yes — cross-account aggregation |
| "What's X's realized P&L / cost basis?" | Yes — event-derived |
| "What arbitrary tokens does X hold?" (unknown token set) | Yes (or a provider API) |

The panel's stated scope is explicitly the first row: known token list, one wallet,
current values, no history, no charts, no P&L. `balanceOf(address)` is a **view
function on every one of those 40 contracts that already returns exactly the number
you want**. The subgraph would spend a sprint reconstructing, from event logs, a
value the chain will hand you directly for free.

### The accuracy argument is backwards

The engineer's justification is "that way the balances are always accurate." A
`Transfer`-derived running balance is accurate only if every balance change on
every one of the 40 tokens emits a `Transfer` you handle correctly. Real token
sets break that assumption:

- **Rebasing / share-based tokens** (stETH-style, aTokens, some yield-bearing
  wrappers) change `balanceOf` *without* a `Transfer`. Your index silently drifts
  and never self-corrects.
- **Fee-on-transfer / deflationary tokens** where the emitted amount ≠ the amount
  actually credited. You accumulate a permanent error.
- **Upgradeable tokens** that change accounting, or admin functions that mint/burn
  or seize balances without emitting standard events.
- **Non-standard or missing events** on older/odd ERC-20s.
- **Indexing lag.** Even when the mapping logic is perfect, the subgraph is behind
  the head by an indexing delay. A user who just swapped opens the panel and sees
  their *old* balance. That's the single most visible failure mode for a "what do I
  hold right now" panel, and it's inherent to the architecture.
- **Reorgs / re-syncs.** Handled, but they're operational surface you now own.

`balanceOf` has none of these failure modes. Whatever the token does internally —
rebase, fee, upgrade, admin mint — `balanceOf` is the token's own authoritative
answer. You cannot drift from the source of truth when you *are* reading the source
of truth.

### And the ongoing cost is real

A subgraph is not a one-time sprint. It's a deployment to operate: backfilling
`Transfer` history for 40 tokens (some with millions of events) at every schema
change, monitoring sync health, an availability dependency that can go down and
take your panel with it, and a redeploy + full resync every time you add token #41.
Adding token #41 to the direct-read approach is **one line in a config array**.

---

## 2. What to build instead

Read `balanceOf` on all 40 tokens in a single batched call via **Multicall3**,
deployed on Base (and ~every chain) at
`0xcA11bde05977b3631167028862bE2a173976CA11`.

### Onchain call count: **1**

Precisely:

- **1** JSON-RPC `eth_call` to the node, targeting Multicall3's `aggregate3`.
- Inside that call, the EVM performs **40 `staticcall`s** to the 40 token contracts.
- **0 transactions, 0 gas, 0 signatures.** `eth_call` is a free read.

So: one network round trip, one node request, forty contract reads inside it.

Counted the naive way — one `eth_call` per token — it's 40 requests. Multicall
collapses that to 1. Both are trivially cheap compared to standing up a subgraph,
but the multicall version is the one to ship, for the consistency reason in §3.

If you also want the native ETH balance, it stays **1 call**: Multicall3 exposes
`getEthBalance(address)`, so fold it into the same batch as a 41st sub-call.

**Two things that must not inflate the count:**

1. **Do not fetch `decimals()`, `symbol()`, or `name()` at runtime.** They're
   immutable for a fixed, curated list of 40 tokens. Hardcode them in your token
   config. Fetching them would triple the work to ~120 sub-calls for data that
   never changes.
2. **Don't confuse JSON-RPC batching with multicall.** Sending 40 `eth_call`s in
   one HTTP batch is 40 calls in one envelope — the node may serve them at
   *different block heights*. Multicall is one call, one block, one atomic
   snapshot.

### Concrete implementation (viem / wagmi)

```ts
// tokens.ts — the whole "schema"
export const TOKENS = [
  { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
  // ...39 more
] as const;
```

```ts
// usePortfolio.ts
import { useAccount, useReadContracts } from "wagmi";
import { erc20Abi } from "viem";
import { TOKENS } from "./tokens";

export function usePortfolio() {
  const { address } = useAccount();

  return useReadContracts({
    contracts: TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address!],
    })),
    // one eth_call via Multicall3, all reads at the same block
    multicallAddress: "0xcA11bde05977b3631167028862bE2a173976CA11",
    allowFailure: true,           // one bad token can't blank the whole panel
    query: {
      enabled: Boolean(address),
      staleTime: 12_000,
      refetchOnMount: true,       // "refreshed when they reopen the panel"
      refetchOnWindowFocus: true,
    },
  });
}
```

wagmi batches these into a single `aggregate3` automatically when `batch.multicall`
is enabled on the client (it is by default in `createConfig`'s HTTP transport
setup — verify it's on, since that's what makes this 1 call instead of 40).

`allowFailure: true` matters: if one of the 40 tokens reverts or gets
self-destructed/paused, you render 39 balances and one "unavailable" cell instead
of an empty panel.

Format with `formatUnits(balance, decimals)` from the hardcoded decimals. Ship it
in an afternoon, not a sprint.

---

## 3. How this stays accurate as balances change

This is the part the subgraph proposal was trying to solve, and direct reads solve
it more simply:

**Freshness — there is no cache to invalidate.** Every `eth_call` executes against
the node's current state at the latest block. There is no replica, no lag, no
"catching up." Base has ~2s blocks; a read issued now reflects the chain as of a
block that is at most ~2s old. The panel's stated refresh policy — "refreshed when
they reopen the panel" — is literally just refetching on mount, which is one line
of config above.

**Consistency — all 40 balances come from the same block.** Because Multicall3
executes all 40 `staticcall`s inside a single `eth_call`, they are evaluated
against one identical state root. You can never render a panel where USDC is from
block N and WETH is from block N-3. Forty separate `eth_call`s, even batched over
HTTP, give you no such guarantee. If you want to display it, request the batch
pinned to an explicit `blockNumber` and label the panel "as of block N."

**Correctness under weird tokens — automatic.** Rebases, fee-on-transfer, admin
mints, contract upgrades: all of them are already reflected in what `balanceOf`
returns, because the token contract computes it. There is no mapping logic of yours
that can be wrong, and nothing to backfill or repair when a token behaves
unexpectedly.

**Live updates, if you want them.** Optional, and still cheap:

- **Poll**: `refetchInterval: 12_000` → one `eth_call` every 12s while the panel is
  open. Fine at any realistic user count.
- **Block-driven**: `useBlockNumber({ watch: true })` and refetch on new blocks
  (throttle it — 2s blocks on Base is faster than a portfolio panel needs).
- **After user actions**: invalidate the query in your tx-success handler so the
  panel updates the instant the user's own swap/transfer confirms. This is the case
  users actually notice, and it's exactly the case the subgraph handles *worst*.

**Reliability.** Your dependency is an RPC endpoint you already have, not a
separate indexing service with its own uptime, sync state, and on-call rotation.

---

## 4. When to revisit this

Build the subgraph (or adopt a hosted portfolio/indexing API) the moment the
product actually asks for something state reads can't answer:

- balance **history**, charts, or "value over time"
- **P&L / cost basis** (needs the trade events)
- **holder-side** queries: top holders, holder counts, distribution
- **token discovery** — showing arbitrary tokens a wallet holds rather than your
  curated 40 (for this, reach for `alchemy_getTokenBalances` or a similar provider
  endpoint before writing a subgraph)
- an offchain system needing to **react** to transfers rather than display them

None of those are in scope today. Ship the multicall, keep the token list in a
config file, and spend the sprint on something the users asked for.

---

## Summary

| | Proposed subgraph | Recommended: Multicall3 reads |
|---|---|---|
| Onchain calls per refresh | 0 (queries an offchain replica) | **1 `eth_call`** (40 staticcalls inside) |
| Gas cost | 0 (+ hosting/indexing cost) | 0 |
| Freshness | behind head by indexing lag | current block (~2s on Base) |
| Cross-token consistency | eventual | same block, atomic |
| Rebasing / fee-on-transfer tokens | silently drifts | correct by construction |
| Adding token #41 | redeploy + full resync | one line in an array |
| Build time | a sprint + ongoing ops | an afternoon, no ops |
