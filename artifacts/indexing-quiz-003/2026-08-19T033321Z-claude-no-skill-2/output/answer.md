# Portfolio panel: do we need a subgraph?

**Short answer: no. Don't build it.** For "what does this wallet hold right now, across 40
tokens on Base," the correct implementation is **one `eth_call`** against Multicall3. Not one
per token — one, total, for all 40 balances. It is more accurate than the subgraph, not less,
and it's roughly a day of work instead of a sprint plus permanent operational ownership.

---

## Why the subgraph is the wrong tool here

The scoping note ends with "that way the balances are always accurate." That's the part worth
examining, because it has the tradeoff backwards. Let me go through it.

### 1. We'd be reconstructing state the chain already stores

An ERC-20 balance is not a derived quantity we have to compute. It's a storage slot in the
token contract, and every ERC-20 exposes it directly through `balanceOf(address)` — a free,
public `view` function. That value *is* the balance, by definition.

The proposed subgraph would replay every `Transfer` event since each token's deployment and
add/subtract its way to a number that we hope matches that storage slot. That's a
reimplementation of the token's own accounting, maintained by us, in TypeScript mappings.
The contract is the source of truth; the subgraph is a cached approximation of it. Indexing
is the right call when the answer *isn't* in a storage slot you can read — "top 100 holders,"
"balance over time," "who traded in the last 30 days." None of those are on the list.

### 2. The reconstruction is quietly wrong for a real slice of tokens

This is the strongest argument, and it's not theoretical. Summing `Transfer` events gives the
wrong balance whenever a token's balance changes through a mechanism that doesn't emit a
matching `Transfer`:

- **Rebasing / interest-bearing tokens.** aTokens (Aave), stETH-style tokens, and anything
  that accrues yield in the balance itself grow the holder's `balanceOf` continuously with no
  `Transfer` emitted. A Transfer-summing subgraph shows the deposit amount forever and drifts
  further from truth every block. `balanceOf` is correct by construction, because the token
  computes it from shares at read time.
- **Fee-on-transfer / reflection tokens.** The `Transfer` event's `value` is the amount sent,
  which is *not* the amount credited to the recipient. Every transfer of such a token adds a
  small permanent error to our number.
- **Non-standard mint/burn.** Tokens that mint or burn without emitting `Transfer` from/to
  the zero address, or that emit custom events instead.
- **Upgradeable tokens.** Most large tokens on Base are proxies. An implementation upgrade
  can change accounting semantics; our mapping logic silently keeps applying the old rules.
- **Admin balance adjustments.** Blacklist seizures, migrations, rescue functions — some emit
  nothing.

We support 40 tokens today and the list will grow. Every token we add is a fresh chance that
its accounting doesn't fit the mapping we wrote. The failure mode is the bad kind: no error,
no alert, just a wrong number rendered confidently in the user's portfolio panel. Users will
compare against their wallet or a block explorer — both of which call `balanceOf` — and we'll
be the ones who are wrong.

### 3. A subgraph is *strictly staler* than an RPC read

Indexers trail the chain head. Even a healthy subgraph is some blocks behind; during
re-syncs, reorg handling, or indexer incidents it can be minutes or hours behind, or stop
serving. `eth_call` at `latest` reads the current head state. So the plan trades away
freshness in the name of accuracy while getting neither.

This matters concretely: a user swaps in our dApp, opens the panel, and the subgraph hasn't
caught up. They see a stale balance right after the action that changed it. That's the single
most likely moment for someone to open a portfolio panel.

### 4. The cost is not one sprint, it's ongoing

- **Backfill.** Indexing `Transfer` for 40 tokens on Base means ingesting *every transfer by
  every holder* — for high-volume tokens like USDC that's tens of millions of events. Initial
  sync is hours to days of indexing for data we throw away.
- **Write amplification.** We'd maintain balance rows for millions of holders in order to
  serve one row at a time to one connected wallet. Essentially all of that work is wasted.
- **Adding token #41** means a new subgraph version and a full re-backfill before it serves.
  With the RPC approach it's one line in a JSON array.
- **Permanent ops.** Reorg handling, indexer health monitoring, hosting cost, an on-call story
  for "the panel is blank," and a schema/version migration path.

### 5. When we *would* build it

If the requirements gain history, charts, P&L, cost basis, holder leaderboards, or any
cross-wallet aggregation, the answer flips immediately — none of those can come from
`balanceOf`, and event indexing is the right and only tool. The brief explicitly rules all of
them out. If we expect them next quarter, that's worth saying now, but the panel as scoped
shouldn't be the justification.

---

## What to build instead

### The call count: **1**

40 `balanceOf(address)` reads → 1 batched `eth_call` → 1 HTTP round trip.

Multicall3 is deployed on Base at the same canonical address as every other EVM chain,
`0xcA11bde05977b3631167028862bE2a173976CA11`. We encode all 40 `balanceOf` calls into a
single `aggregate3` and send it as one `eth_call`. The node executes the 40 staticcalls
internally against a single state root and returns 40 results. No gas, no transaction, no
signature — it's a read.

If we want native ETH alongside the tokens, Multicall3's own `getEthBalance(address)` goes
into the same batch. Still one call. Total: 41 reads, 1 request.

With viem this is one function call, and wagmi wraps it for React:

```ts
// tokens.ts — static, committed. Decimals/symbols never change; never fetch them at runtime.
export const TOKENS = [
  { address: '0x833589f...', symbol: 'USDC', decimals: 6 },
  // ...39 more
] as const;
```

```ts
import { useAccount, useReadContracts, useBlockNumber } from 'wagmi';
import { erc20Abi } from 'viem';

function usePortfolio() {
  const { address } = useAccount();

  return useReadContracts({
    allowFailure: true,          // one bad token can't blank the whole panel
    contracts: TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address!],
    })),
    query: { enabled: !!address },
    // viem batches these into a single Multicall3 aggregate3 eth_call
  });
}
```

Two details that matter:

- **`allowFailure: true`** — `aggregate3` lets individual sub-calls revert without reverting
  the batch. If we ever add a token that's paused or self-destructed, that row shows an error
  and the other 39 still render.
- **Pin the block.** Passing an explicit `blockNumber` (or letting viem use one consistent
  `latest`) means all 40 balances come from the *same* state root. That's an atomic snapshot —
  strictly better than 40 independent calls, which could straddle a block boundary and show a
  swap's "out" leg without its "in" leg. The subgraph gives you consistency too, but so does
  this, at the head instead of behind it.

Practically: ~200–400ms, comfortably inside any RPC free tier, no infrastructure of our own.

**A note on the count you'll sometimes hear.** Done naively — 40 separate `eth_call`s — this
is 40 requests, and that's where "we need a subgraph, 40 calls is too many" usually comes
from. Multicall3 removes that objection entirely. If we'd rather not hand-roll it, enabling
`batch: { multicall: true }` on the viem transport makes it automatic: concurrent `eth_call`s
in a short scheduling window get folded into one Multicall3 request without changing app code.

(Provider-specific endpoints like Alchemy's `alchemy_getTokenBalances` are also one request,
but they lock us to one vendor and return the long tail of every token the wallet has ever
touched, which isn't what the panel wants. Multicall3 keeps us provider-agnostic and returns
exactly our 40.)

### How it stays accurate as balances change

This is where the approach is genuinely stronger than the subgraph, not merely cheaper:

1. **There's no derived state to drift.** We never store a balance. Every render reads the
   token contract's current storage. Rebases, fee-on-transfer mechanics, mints, airdrops,
   admin seizures, and any future mechanism we haven't thought of are all handled correctly
   for free, because we're asking the token rather than modelling it. Correctness doesn't
   depend on our understanding of any token's internals.

2. **Refresh is just re-running the one call.** The brief asks for "refreshed when they
   reopen the panel" — that's a refetch on mount, which is wagmi/TanStack Query's default.
   Beyond that, cheap upgrades if we want them:
   - refetch on new block (`useBlockNumber({ watch: true })` → invalidate the query), or a
     10–15s poll while the panel is open;
   - refetch on `useWaitForTransactionReceipt` after any swap/transfer in our own dApp, so
     the number updates the instant the user's action confirms — the exact case where the
     subgraph would have been stale.

3. **Reorgs need no handling.** If Base reorgs, the next read returns the reorged state and
   we're correct again. Self-healing, because we hold nothing. A subgraph must implement
   rollback for this and is a known source of indexing bugs.

4. **No sync state to be behind on, and no service of ours to be down.** The panel's
   availability equals our RPC provider's availability, which we already depend on for the
   rest of the dApp. We're not adding a new failure domain.

5. **Growing the token list is a data change, not a deploy-and-backfill.** Append to
   `TOKENS`, ship the frontend. Still one call — `aggregate3` handles 40 or 400 in a single
   request (a few hundred is fine; past that, split into batches of ~200–500 to stay under
   provider response limits).

---

## Recommendation

Cancel the subgraph sprint. Build the panel on a single batched `balanceOf` multicall — one
`eth_call` for all 40 tokens, refetched when the panel opens and after any transaction our
dApp sends. It's about a day of work, adds no infrastructure to operate, and returns the
token contracts' own numbers, which is the highest standard of accuracy available.

Revisit indexing the moment the product asks for history, charts, P&L, or cross-holder
analytics — that's a real subgraph, and it should be scoped against those requirements rather
than against this panel.

The engineer's instinct — "I want these balances to be right" — is the correct instinct. It
just points at `balanceOf`, because reading the token beats reimplementing it.
