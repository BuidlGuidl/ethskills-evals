# Portfolio panel: subgraph or direct reads?

**Verdict: the subgraph is the wrong tool here, and it would make the panel *less*
accurate, not more.** Current balances are an "as of now" read — the chain answers
them on request. Build the panel on **one batched `eth_call` per panel open** via
Multicall3.

---

## Why the subgraph is overkill for this panel

The scoped design reconstructs, offchain, a number the token contract already
exposes. `balanceOf(address)` is a public view function on all 40 contracts. A
subgraph that replays every `Transfer` since genesis to arrive at that same number
is doing a large amount of work to produce a value one RPC call returns directly.

Concretely, what a sprint of subgraph work buys and costs:

| | Subgraph | Direct reads |
|---|---|---|
| Build | mappings, schema, 40 datasources, ABIs, tests | a static token list + one hook |
| Backfill | full `Transfer` history for 40 tokens on Base — the large ones (USDC, WETH, cbBTC…) are tens of millions of events each; hours-to-days of sync before the panel shows anything | none |
| Ongoing ops | Studio publish, API key, indexing health, re-syncs on every schema change, re-deploy to add token #41 | none |
| Query cost | metered: ~100K free queries/month, then ~$2/100K (checked 2026-08-18 — re-read the live pricing page before budgeting) | your existing RPC quota, 1 call/panel-open |
| Freshness | behind chain head by the indexer's lag | the block you queried |
| Adding a token | code change + redeploy + re-sync | one line in a config array |

And the data shape is telling: you would index hundreds of millions of rows in
order to ever read **one row per connected wallet**. No history, no charts, no P&L,
no leaderboard, no cross-wallet aggregation — nothing in the requirement needs the
event history that the subgraph exists to hold.

### The accuracy argument runs backwards

The engineer's justification is "that way the balances are always accurate." A
`Transfer`-derived running balance is a *model* of the balance, and models drift
from the real thing:

- **Rebasing / share-based tokens** (stETH-style, and any token whose balance is
  computed from a share count and an index) change a holder's `balanceOf` with **no
  `Transfer` event at all**. Your mapping would show a permanently stale number.
- **Fee-on-transfer and deflationary tokens** credit the recipient less than the
  event amount, or burn on transfer outside the logged amount.
- **Upgradeable tokens** can change balance accounting, add a mint path, or write
  storage directly in an upgrade. The mapping keeps summing the old way.
- **Any non-standard mint/burn path** that forgets to emit, or emits with a
  non-standard signature, is invisible to the indexer.
- **Reorgs and indexing lag** mean the panel shows a state the chain has already
  moved past; a user who just swapped reopens the panel and sees the old number.
- **Mapping bugs** are silent. A missed edge case produces a wrong balance that
  nobody notices until a user complains, and the fix requires a full re-sync.

`balanceOf` has none of these failure modes, because it is not a reconstruction —
it *is* the contract's own accounting, including whatever rebasing, fees or upgrade
logic that token implements. The direct read is the ground truth the subgraph is
trying, imperfectly, to imitate.

---

## What to build instead

### The call count: **1 onchain call per panel open**

One `eth_call` to **Multicall3** at `0xcA11bde05977b3631167028862bE2a173976CA11`
(same address on Base and most chains), using `aggregate3`, with 40 encoded
`balanceOf(userAddress)` sub-calls in the payload. The node executes all 40 reads
inside a single EVM call and returns 40 return-values in one response.

- 40 tokens → **1** RPC round trip. Not 40.
- Need native ETH too? Multicall3's `getEthBalance(address)` goes into the *same*
  `aggregate3` array — still **1** call, 41 reads.
- `decimals`, `symbol`, `name` are **0 calls**: they are immutable per token, so
  they live as constants in your static token list alongside the addresses. Do not
  fetch them at runtime.
- Token #41 later? Still 1 call — the array just gets one entry longer. Multicall3
  handles 40 or 400 in one call; the practical limit is the node's gas cap on
  `eth_call`, far above what 40 `balanceOf`s consume.

So the steady-state cost of the whole panel is: **one RPC call, each time the user
opens it.**

### Sketch (viem / wagmi, matching a typical Scaffold-ETH dApp)

```ts
// tokens.base.ts — static, no onchain call needed for any of this
export const BASE_TOKENS = [
  { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
  { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
  // … 38 more
] as const;
```

```ts
// usePortfolio.ts
const { data, refetch, isFetching } = useReadContracts({
  allowFailure: true,                 // one bad token can't blank the panel
  contracts: BASE_TOKENS.map(t => ({
    address: t.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [userAddress],
    chainId: base.id,
  })),
  query: { enabled: Boolean(userAddress) && panelOpen },
});
```

viem batches these into a single Multicall3 `aggregate3` `eth_call` automatically
when the client has `batch: { multicall: true }` configured (Scaffold-ETH's wagmi
config enables this; verify it, otherwise you silently get 40 separate calls).
Format with `formatUnits(balance, t.decimals)` and filter out zeros client-side.

`allowFailure: true` matters: `aggregate3` tolerates a per-call revert, so a token
that self-destructs, gets paused, or turns out to be non-compliant degrades to one
missing row instead of an empty panel.

### How it stays accurate as balances change

This is the part the subgraph was supposed to solve, and the direct read solves it
more simply:

1. **Every fetch is evaluated at a specific block.** The node runs `balanceOf`
   against state at the chain head (or a block you pin). There is no derived state
   to fall behind, no backfill to be missing, no mapping to be wrong. Whatever the
   token contract says a user holds — after rebases, fees, mints, upgrades — is
   what the panel shows.
2. **Refetch on the events that can invalidate it**, all of which are already
   observable in the frontend:
   - panel opens (the stated requirement — this alone satisfies the spec),
   - connected account changes or chain changes,
   - any transaction your dApp itself sends confirms → `refetch()` after the
     receipt, so the panel is correct immediately after a user action,
   - optionally, a light poll while the panel is *open and focused*
     (`refetchInterval: 12_000`, roughly a couple of Base blocks) so a balance that
     changed elsewhere converges without the user reopening.
3. **Cache with an explicit staleness window.** `staleTime` of ~10–15s in
   TanStack Query means reopening the panel twice in a few seconds reuses the
   result; anything older refetches. The panel is never showing a number it cannot
   name a block for.
4. **Worst case is bounded and self-healing**: the panel is at most one refresh
   stale, and the next fetch is unconditionally correct. A subgraph's worst case —
   a mapping that mishandles a token — is *unbounded* staleness that only a code
   fix and re-sync repairs.

### Production home for the read side

There is no indexer to host, but the read path still has a named home, and it
should be written into the architecture doc rather than left implicit:

- **Where the call goes:** your existing Base RPC provider endpoint (Alchemy /
  QuickNode / your own node), with the API key already in the dApp's env config —
  *name the specific endpoint and the key's owner*. The panel adds ~1 call per
  user-panel-open; check that against your plan's request budget, but for a
  once-per-open read this is noise.
- **Where the token list lives:** a checked-in `tokens.base.ts` in the frontend
  repo, reviewed like code. Adding a token is a PR, not a migration.
- **Fallback:** a second RPC URL in the wagmi transport (`fallback([...])`) so a
  provider blip degrades to a retry, not a broken panel.

---

## When you *would* build the subgraph

Keep the scoped design in the drawer. The moment the panel grows any of these, the
answer flips, because they all need event *history*, which no `balanceOf` can give
you:

- balance-over-time charts, or "your portfolio 30 days ago"
- P&L, cost basis, realized/unrealized gains (needs every transfer + prices)
- a transaction/activity feed for the wallet
- leaderboards, holder counts, top-holders, token-level analytics
- notifications on inbound transfers

At that point you build it properly: a one-time backfill into a persistent indexed
store that then tails new events (a published Graph Network subgraph, or a
self-hosted Ponder process with its own named host, Postgres and supervision) — and
even then, you keep the *current-balance* column coming from the direct multicall,
because that is the one number the chain answers better than any index of it.

---

## Recommendation

Don't spend the sprint. Ship the panel as a static 40-token config plus a single
Multicall3 `eth_call` per open — roughly a day of work, zero infrastructure, zero
query bill, and strictly more accurate than the `Transfer`-replay design for
rebasing, fee-on-transfer and upgradeable tokens. Revisit indexing when the product
asks for history, which by this spec it explicitly does not.
