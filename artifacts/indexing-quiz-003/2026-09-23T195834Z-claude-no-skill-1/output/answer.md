# Do we need a subgraph for the portfolio panel?

**No. Don't build it.** The panel as scoped — "what does this wallet hold right now,
across our 40 tokens, on Base" — is a **single `eth_call`**. A subgraph would be a
sprint of build plus indefinite operational cost to produce a *less* accurate answer
than the one-liner.

---

## 1. Why the subgraph is the wrong tool here

The proposed design reconstructs `balanceOf` by replaying every `Transfer` event since
each token's deployment and maintaining a running sum per holder. But `balanceOf` is
**already** that number, maintained by the token contract itself, and it's free to read.
You'd be rebuilding onchain state off-chain in order to answer a question the chain
answers directly.

Concretely, what the subgraph costs you:

- **Backfill.** Forty tokens' full `Transfer` history on Base is on the order of tens of
  millions of events. That's days of initial sync before the panel shows anything, and a
  re-sync every time you change the schema or the mapping logic.
- **Adding token #41 means a redeploy and another backfill.** With `balanceOf`, adding a
  token is one line in a JSON config.
- **Ongoing ops.** A hosted indexer (Graph Network signal/query fees, or your own graph-node
  + Postgres + a Base archive node) becomes a production dependency with an on-call story.
  When it falls behind or halts on a mapping error, the portfolio panel shows wrong numbers.
- **You inherit a stale-data problem you didn't have.** The panel goes from reading chain
  head to reading an index that trails chain head.

### The "always accurate" claim is backwards

This is the part worth pushing back on directly, because it's the stated justification.

A subgraph-derived balance is accurate **only if** every balance change on every one of the
40 tokens is expressible as a `Transfer` event your mapping saw and summed correctly. That
assumption breaks in ways that are common in a 40-token list:

- **Rebasing / share-based tokens.** stETH-style and aToken-style balances change with no
  `Transfer` emitted at all. Your running sum silently drifts from reality and never
  self-corrects.
- **Fee-on-transfer and deflationary tokens.** The amount in the event is not the amount
  credited. Your sum is wrong by the fee, permanently.
- **Upgradeable tokens.** A proxy implementation upgrade can change balance accounting
  (or add a mint path that doesn't emit) mid-history, and your mapping won't know.
- **Non-standard or buggy ERC-20s** that skip events on mint/burn.
- **Indexing lag.** Base produces a block every ~2s. An indexer is by construction some
  number of blocks behind head. A user who just swapped and reopens the panel sees their
  *old* balance — which is the single most visible, most complained-about failure mode a
  portfolio panel can have.
- **Reorgs.** Handled, but they're another moving part that can leave the index in a bad
  state.
- **Drift is silent and cumulative.** Once a running sum is wrong, nothing fixes it short of
  a re-sync. `balanceOf` has no memory — it's right on every single call regardless of what
  happened before.

`balanceOf` at the latest block **is the canonical answer, by definition.** It is not an
approximation of the balance; it is the balance. There is no accuracy argument for the
subgraph here — the accuracy argument runs the other way.

### When a subgraph *would* be right

To be fair to the engineer, this is a real tool with a real use case. Reach for it when the
question can't be answered by reading current state:

- Historical balance series / portfolio charts over time
- Realized & unrealized P&L (needs per-transfer cost basis)
- "Who are all the holders of token X" / leaderboards / holder counts
- Aggregations across many wallets
- Anything that needs to filter or sort over history

The scope explicitly says **no history, no charts, no P&L**. Every one of the subgraph's
advantages is excluded by the requirements. If the roadmap adds charts in two quarters,
revisit it then — and note that by then a hosted balance-history API may cover it without
an indexer of your own.

---

## 2. What the panel should do instead

**Read `balanceOf(user)` on all 40 tokens in one batched `eth_call` via Multicall3.**

Multicall3 is deployed on Base at the canonical address
`0xcA11bde05977b3631167028862bE2a173976CA11`. It takes an array of `(target, calldata)`
pairs, executes them all inside a single `eth_call`, and returns the array of results.

### Call count

| What | Onchain calls (`eth_call`) | RPC round trips |
|---|---|---|
| Naive loop over 40 tokens | 40 | 40 |
| JSON-RPC batch (single HTTP request) | 40 | 1 |
| **Multicall3 `aggregate3` (recommended)** | **1** | **1** |

**One.** One `eth_call` per panel open, for all 40 balances. It costs zero gas (`eth_call`
is a read against a node's state, it never touches a block), and it's well inside any
provider's response-size and gas-cap limits — 40 `balanceOf` calls is ~40 × 32 bytes of
return data and a few hundred thousand gas of simulated execution.

### Metadata is not a per-call cost

`decimals`, `symbol`, and `name` are immutable for practical purposes and you already know
which 40 tokens you support. **Hardcode them in your token list** (address, symbol, decimals,
logo) at build time. Don't fetch them at runtime — that's the mistake that turns 1 call into
120. If you'd rather derive them, fetch once at build/deploy time and commit the result.

USD pricing, if the panel shows it, comes from a price API keyed by token address — that's an
off-chain HTTP call, orthogonal to this, and also not a reason to index anything.

### Sketch (viem / wagmi)

```ts
import { erc20Abi } from 'viem'
import { useReadContracts } from 'wagmi'
import { base } from 'viem/chains'

const TOKENS = [
  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
  // ... 39 more, static config
] as const

export function usePortfolio(user?: `0x${string}`) {
  return useReadContracts({
    allowFailure: true,           // one bad token can't blank the whole panel
    contracts: TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [user!],
      chainId: base.id,
    })),
    query: {
      enabled: Boolean(user),
      staleTime: 12_000,
      refetchOnWindowFocus: true,
    },
  })
}
```

`useReadContracts` / `readContracts` routes through Multicall3 automatically when the chain
config has a `multicall3` entry — viem's `base` chain does. Make sure your client has
`batch: { multicall: true }` so this collapses to the single `aggregate3` call rather than 40.

Note `allowFailure: true`: with `aggregate3`, a revert in one token's `balanceOf` (paused
token, weird implementation) comes back as a per-item failure instead of reverting the whole
batch. You render 39 balances and a dash, rather than an empty panel.

If you're not on viem: `ethers` v6 + the Multicall3 ABI does the same thing, or use
`Multicall3.aggregate3` directly with an ABI-encoded array.

**Engineering cost: roughly an afternoon**, most of it spent assembling the token list and
formatting decimals — versus a sprint plus permanent ops.

---

## 3. How this stays accurate as balances change

This is the key inversion: **it doesn't need to "stay" accurate, because it never caches a
derived value.** There is no running sum to drift.

- **Every read is fresh canonical state.** `eth_call` at `latest` executes `balanceOf`
  against the node's current state trie. Whatever moved the balance — a transfer, a mint, a
  rebase, a fee-on-transfer deduction, an airdrop, a token upgrade, a mechanism nobody told
  you about — is already reflected, because you're asking the token contract itself. Reading
  current state is immune to every one of the event-replay failure modes listed above,
  *by construction*.

- **All 40 balances come from the same block.** Because they execute inside one `eth_call`,
  the snapshot is internally consistent — you can't show a half-updated portfolio mid-swap
  (USDC already debited, WETH not yet credited). Multicall3's `getBlockNumber` /
  `aggregate3` variants let you return the block number alongside, so you can display
  "as of block N" and pin refetches to a block for deterministic behavior.

- **Refresh is trivially cheap, so refresh often.** The requirement is "refreshed when they
  reopen the panel" — one `eth_call`. Since it's cheap, you can be more generous than the
  spec without thinking about it:
  - refetch on panel open and on window focus (shown above);
  - invalidate the query in your tx-success handler so a swap or send updates the panel
    immediately;
  - optionally `watchBlockNumber` and refetch every N blocks while the panel is open, if you
    want it live-ticking.

- **Freshness ceiling is the RPC provider's head, not an indexer's cursor.** Worst case
  you're one block (~2s on Base) behind, and only because that's how fast the chain moves.
  A subgraph's lag is that *plus* indexing latency, and its error can be unbounded and
  permanent.

- **Failure mode is honest.** If the RPC is down, the call fails and you show a retry — the
  user knows they're not looking at data. A lagging indexer shows a confidently wrong number
  with no signal that anything is off. For a screen whose entire job is "what do I hold,"
  that difference matters a lot.

---

## Recommendation

Cancel the subgraph sprint. Ship the Multicall3 `balanceOf` batch: **1 onchain call per
wallet per refresh**, zero gas, zero infrastructure, no backfill, and correct by construction
for rebasing and fee-on-transfer tokens that the event-replay approach would get wrong. Keep
the token list (address/symbol/decimals) as static config so adding token #41 is a one-line
PR instead of a redeploy and re-sync.

Revisit indexing only when a requirement actually needs history — charts, P&L, or holder-set
queries. Reading current state and replaying history are different jobs; this panel is
squarely the first one.
