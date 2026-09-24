# Do we need a subgraph for the portfolio panel?

**No. It's overkill, and it's also *less* accurate than the simple approach.**

Build it as **one batched `eth_call` to Multicall3** per panel open.

---

## The reasoning

The scoping proposal has a hidden assumption: that "balances" are historical data
that must be reconstructed from events. They aren't. A token balance is **current
contract state**. It lives in the token's storage right now, and `balanceOf(user)`
returns it. There is nothing to reconstruct.

The rule of thumb:

| Question | Tool |
|---|---|
| "What is true *right now*?" | RPC read (`eth_call`) — no indexer |
| "What happened *over time*?" | Indexer (The Graph / Ponder / Dune) |

This panel is explicitly the first row. No history, no charts, no P&L — the spec
says so. So: direct reads.

### The subgraph would be a strictly worse source of truth

This is the part worth internalizing, because the proposal justifies the subgraph
on the grounds that "balances are always accurate." The opposite is true. A
`Transfer`-derived running balance is a *replica* of state, and replicas drift:

1. **Rebasing / interest-bearing tokens.** stETH, aTokens, and similar tokens
   change a holder's balance with **no `Transfer` event at all** — the balance is
   computed from a share count times a global index. Your mapping will show a
   stale number forever. `balanceOf` is correct by construction.
2. **Fee-on-transfer / deflationary tokens.** The amount in the `Transfer` event
   is not necessarily the amount credited to `to`. Summing event amounts
   overstates or understates the balance.
3. **Non-standard or buggy tokens.** Any token that mints, burns, slashes, or
   adjusts balances without emitting a conforming `Transfer` silently corrupts
   the index. With 40 tokens you are betting that all 40 behave perfectly, today
   and after every future upgrade.
4. **Indexing lag.** A subgraph is always some blocks behind head. A user who
   just swapped opens the panel and sees the old number — the exact moment the
   panel matters most.
5. **Reorg and re-sync risk.** Base reorgs are shallow but real. A bad deploy or
   a schema change means a full re-index before the panel works again. An
   `eth_call` has no such failure mode.
6. **Operational cost forever.** A sprint to build, then permanent ownership:
   hosting, monitoring, re-syncs, and a redeploy every time product adds token
   #41. The direct-read version adds token #41 by appending one line to an array.

You'd be spending a sprint to build a cache of a value that is already one cheap
call away, and the cache is wrong for an entire category of tokens.

---

## What to build instead

### Onchain call count: **1 RPC request** for all 40 balances

Multicall3 is deployed at the same address on Base as on every other chain:
`0xcA11bde05977b3631167028862bE2a173976CA11`. It aggregates 40 `balanceOf`
staticcalls into a single `eth_call`. viem's `multicall` does the batching,
encoding, and decoding for you.

```ts
import { createPublicClient, http, erc20Abi } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

// The 40 tokens we support, as a plain config array.
export const SUPPORTED_TOKENS = [
  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
  // ...39 more
] as const;

export async function fetchPortfolio(user: `0x${string}`) {
  const results = await client.multicall({
    contracts: SUPPORTED_TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [user],
    })),
    allowFailure: true,   // one bad token can't blank the whole panel
    // blockNumber omitted -> reads at 'latest'
  });

  return SUPPORTED_TOKENS.map((token, i) => ({
    ...token,
    balance: results[i].status === 'success' ? (results[i].result as bigint) : null,
  })).filter((t) => t.balance === null || t.balance > 0n);
}
```

**Count: 1.** Not 40. One HTTP round trip, ~40 staticcalls executed inside a
single node-side call, typically well under a second on Base. Zero gas — reads
are free.

Two notes on that count:
- If you also want native ETH, add one `eth_getBalance` (Multicall3's
  `getEthBalance` can fold it into the same call, keeping it at 1).
- Decimals/symbols are immutable: hardcode them in the config above, or fetch
  them once at build time. Don't spend calls on them at runtime.

### How this stays accurate as balances change

It doesn't need to "stay" accurate — it is *re*-derived from canonical state on
every fetch, so there is no staleness window to manage:

- **`eth_call` at `latest` reads the token contract's own storage** at the chain
  head. Whatever the token says your balance is, that's what the panel shows.
  Rebases, fee-on-transfer, exotic mint logic — all handled, because the token
  computes the answer, not us.
- **The spec's refresh model is already the right one.** "Refreshed when they
  reopen the panel" = re-run `fetchPortfolio` on panel open. With
  wagmi/TanStack Query: `useReadContracts` with the multicall batching on, and
  `staleTime` of ~15s so re-opens within a few seconds reuse the cache.
- **Want it to feel live while the panel is open?** Poll every ~10–15s
  (`refetchInterval`), or refetch on `watchBlockNumber`. Both are still one call
  each. Base blocks are 2s, so a 10s poll is ~5 calls/min per open panel —
  nothing.
- **Want instant feedback after the user's own swap?** Invalidate the query on
  transaction confirmation. That's the only "live" case that actually matters to
  users, and it's a one-line cache invalidation.

### If you'd rather not maintain even the token list call

`alchemy.core.getTokenBalances(address)` returns every ERC-20 the wallet holds in
one HTTP call, and you filter to your 40. That's a reasonable fallback and even
less code, at the cost of a vendor dependency and a provider-side view of state.
I'd still prefer Multicall3: it reads from the chain directly, works with any
RPC, and the "supported tokens" list is product config you want explicit anyway.

---

## When to revisit this

Build the subgraph the day the product actually needs history. Concretely:

- cost basis / realized P&L
- a balance-over-time chart
- a transaction or activity feed
- "top holders" or any cross-wallet aggregate

Every one of those requires knowing what happened between blocks, which `eth_call`
genuinely cannot answer — that's the real indexer use case, and it's a good
reason to reach for The Graph or Ponder then. None of them are in this panel's
spec today.

---

## Recommendation

Don't spend the sprint. Ship the panel in roughly an afternoon:

1. A `SUPPORTED_TOKENS` config array (address, symbol, decimals) for Base.
2. `useReadContracts` / `client.multicall` → **1 RPC call**, 40 `balanceOf`
   results, `allowFailure: true`.
3. Refetch on panel open, on wallet/chain change, and on the user's own tx
   confirmations.

This is more accurate than the subgraph (it's the source of truth, not a replica
of it), has no sync lag, no reorg handling, no re-index risk, and nothing to
operate. Adding token #41 is a one-line diff.
