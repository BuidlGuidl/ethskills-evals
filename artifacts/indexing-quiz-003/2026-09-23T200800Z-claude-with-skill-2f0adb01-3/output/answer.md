# Do we need a subgraph for the portfolio panel?

**No. This panel needs zero indexing infrastructure.** Build it on one batched RPC
call per wallet. The subgraph is a sprint of work plus permanent operational
burden to produce an answer that is *strictly less accurate* than the one-line
alternative.

---

## Why the subgraph is the wrong tool here

The dividing line for indexing is **current state vs. historical state**:

- **Historical state** (what did this wallet hold last Tuesday? what's their P&L?
  show me a balance chart) — you cannot get this from RPC cheaply. Archive nodes
  are slow and expensive, and scanning blocks with `eth_getLogs` is O(n) over
  chain history. This is exactly what The Graph exists for.
- **Current state** (what does this wallet hold *right now*) — this is a plain
  `eth_call`. Every full node has it in its state trie. It is one of the cheapest
  reads in Ethereum.

The panel as scoped — "just the live numbers as of now, refreshed when they
reopen the panel, no history, no charts, no P&L" — is entirely in the second
category. The proposed subgraph would replay years of `Transfer` events across 40
contracts to reconstruct a number that the token contract will hand you directly
for free.

### The accuracy argument runs the other way

The scoping note says "that way the balances are always accurate." That is the
part I'd push back on hardest — a Transfer-derived balance is an *approximation*
of `balanceOf`, and it drifts:

1. **Indexing lag.** A subgraph is always some blocks behind head. The panel
   would show a stale balance right after the user swaps — the single most likely
   moment for them to open it. `balanceOf` at `latest` is never stale.
2. **Rebasing and yield-bearing tokens** (stETH-style, and any share/index-based
   token) change a holder's balance **with no `Transfer` event emitted**. Your
   mapping never sees the change; your number is permanently wrong and silently
   diverges. If any of the 40 are rebasing or interest-accruing, this is fatal on
   day one.
3. **Fee-on-transfer / deflationary tokens** emit a `Transfer` for the nominal
   amount while crediting the recipient less. Naive `balance += value` overstates.
4. **Reorgs**, upgradeable tokens that change accounting, and admin
   mint/burn/clawback paths that skip events add more drift.
5. **Any bug in the mapping** produces a wrong balance that nobody notices until
   a user complains, and then you re-index to fix it.

`balanceOf` is the token's own source of truth. It is definitionally correct for
every one of these cases, because it's the same number the token uses to
authorize the user's next transfer.

### And the cost side

The subgraph adds: initial sync across 40 high-volume Base ERC-20s (USDC/WETH
`Transfer` volume is enormous — this is a real sync wait, not minutes), a schema
+ mappings to write and test, a deploy, and then **forever**: monitoring sync
health, handling re-indexes on mapping changes, a new deploy every time product
adds token #41, and a hard dependency where the panel breaks if the indexer is
behind or down. All of that is a liability with no offsetting benefit here.

---

## What to build instead

**Multicall3 at `0xcA11bde05977b3631167028862bE2a173976CA11`** — same address on
Base as on every other major chain. Batch all 40 `balanceOf(user)` calls into a
single `aggregate3` and send it as one `eth_call`.

### The call count: **1 RPC call** (2 if you want native ETH)

Forty `balanceOf` reads → one `aggregate3` → **one `eth_call` round trip**, on
every panel open. If the panel also shows native ETH, that's a separate
`eth_getBalance`, so **2 calls total**. With viem's batching those two can even
ride in one HTTP request.

```ts
import { createPublicClient, http, erc20Abi } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
  batch: {
    multicall: { batchSize: 8192 }, // see note below
  },
});

export async function fetchPortfolio(user: `0x${string}`) {
  const results = await client.multicall({
    contracts: SUPPORTED_TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [user],
    } as const)),
    allowFailure: true, // one bad token can't blank the whole panel
  });

  return SUPPORTED_TOKENS.map((t, i) => ({
    ...t,
    balance: results[i].status === 'success' ? results[i].result : null,
  }));
}
```

Two practical notes:

- **Raise `batchSize`.** viem's default multicall `batchSize` is 1024 bytes of
  calldata. Each `aggregate3` entry is ~160 bytes encoded, so 40 calls is ~6.4KB
  and viem will silently split it into ~7 separate `eth_call`s. Setting
  `batchSize: 8192` (or passing `batchSize: 0` to disable splitting) keeps it at
  a genuine single round trip. This is the detail people miss when they claim
  "multicall didn't help."
- **`allowFailure: true`**, so a single reverting or non-standard token yields
  `null` for that row instead of failing all 40.
- Decimals and symbols are **static metadata** — hardcode them in your token list
  at build time. Don't spend calls on them. (If you'd rather read them onchain,
  it's a one-time 80-call multicall at startup, cached forever, not per panel open.)

### How it stays accurate as balances change

This is the part the subgraph approach gets backwards. Accuracy here is not
something you maintain — it's structural:

- `eth_call` against block `latest` reads the **canonical current state trie**.
  Whatever the token contract would use to authorize the user's next transfer is
  exactly the number you get back. There is no derived state to drift.
- All 40 reads execute **against the same block**, so the panel is internally
  consistent — you can't show a half-updated mid-swap snapshot. Pin
  `blockNumber` explicitly if you want to display "as of block N".
- "Refreshed when they reopen the panel" is already the correct freshness model,
  and it's one call. You can also refetch on `wagmi`'s `useBlockNumber` watch, on
  window focus, or after any tx your dApp sends — each refresh is still one call.
- Rebases, fee-on-transfer, admin mints, reorgs: all invisible to you, because
  you never model balances. You just ask.

### Cost

One `eth_call` per panel open. Even at 10k panel opens a day that's ~10k RPC
requests — noise on any free or entry-tier plan. Compare against a hosted
subgraph indexing 40 high-traffic Base tokens indefinitely.

### If you'd rather not maintain the token list

`alchemy.core.getTokenBalances(address)` returns every ERC-20 the wallet holds in
one HTTP request, no list needed. It's a centralized dependency and it discovers
tokens you don't support (you'd filter to your 40 anyway), so for a fixed
curated list I'd stay with Multicall3 — it's provider-agnostic and you can point
it at any Base RPC.

---

## When to revisit this

Build the subgraph the moment the product adds anything **historical**:

- a balance-over-time chart
- P&L, cost basis, or realized gains
- a transaction/activity feed ("you received 500 USDC on Tuesday")
- "top holders" or any cross-wallet aggregate
- portfolio value snapshots at past blocks

Every one of those genuinely requires replaying `Transfer` events, and none of
them can be done with `balanceOf`. That's the right time to spend the sprint —
and note that even then, the subgraph serves the *history* while `balanceOf`
should still serve the *current* row, for all the drift reasons above.

## Summary

| | Proposed subgraph | Multicall3 |
|---|---|---|
| Calls per panel open | 1 GraphQL query | **1 `eth_call`** (+1 for native ETH) |
| Build time | ~1 sprint | ~1 hour |
| Ongoing ops | sync monitoring, re-indexes, redeploy per new token | none |
| Adding token #41 | code change + redeploy + re-sync | one line in a config array |
| Rebasing tokens | **silently wrong** | correct |
| Fee-on-transfer | **overstated** | correct |
| Freshness | lags head | `latest`, always |
| Failure mode | panel breaks if indexer lags/dies | same as the rest of your dApp's RPC |

Ship the multicall this week. Keep the subgraph in the backlog, tied to the first
historical feature that actually needs it.
