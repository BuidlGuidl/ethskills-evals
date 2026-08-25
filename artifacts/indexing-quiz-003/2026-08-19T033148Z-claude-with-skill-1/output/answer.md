# Portfolio panel: subgraph or direct reads?

**Verdict: the subgraph is overkill and is also the less accurate option here. Don't build it.**

The panel needs one thing: "what does this wallet hold right now, across 40 known ERC-20s on Base."
That is *current state*, and current state is what a contract returns on request. `balanceOf(user)`
is a view function on every one of those 40 tokens. Indexing exists to answer questions the chain
*won't* answer on request — history, aggregates across all holders, rankings, time series. None of
those are in scope: no history, no charts, no P&L.

## Why the proposed subgraph is the wrong shape for this

1. **It reconstructs, from events, a number the chain already stores.** The mapping would replay
   every `Transfer` for 40 tokens across all holders — millions of events, a large backfill, a
   persistent store, and ongoing operation — to derive a value one `eth_call` returns exactly.

2. **It indexes ~100% data you never read.** You index every holder of 40 tokens in order to serve
   balances for the handful of wallets that open your panel.

3. **"Always accurate" is backwards — the derived balance is the one that can drift.** A subgraph is
   only as correct as the assumption that balance == sum of Transfers, which quietly breaks on:
   - **Rebasing / elastic-supply tokens** (stETH-style, aTokens): balances change with no `Transfer`
     at all. Your tracked number is simply wrong and stays wrong.
   - **Fee-on-transfer / deflationary tokens**: the amount in the event is not the amount credited.
   - **Non-standard mint/burn** that doesn't emit `Transfer` from/to the zero address.
   - **Upgradeable tokens** that change transfer accounting after you've written the mapping.
   - Every one of those needs a per-token special case in the mapping, forever, for all 40 tokens.

4. **It adds latency you can't remove.** A subgraph is always *behind* chain head by its indexing
   lag, and it reorg-handles after the fact. On Base a user swaps, the panel reopens two seconds
   later, and the subgraph shows the pre-swap balance. A direct read at latest block cannot show a
   stale balance — it *is* the state.

5. **It costs a sprint plus a production home plus a bill.** The Graph's free hosted service was
   sunset in June 2024, so there's no free public endpoint. `graph deploy` only puts it in Subgraph
   Studio (testing); you must *publish* to the network for a production endpoint, then queries are
   metered (roughly 100K/month free, then ~$2 per 100K — re-check the live pricing page before
   budgeting; figures as of 2026-08-18). Self-hosting Graph Node or Ponder instead means you own a
   host, a Postgres, and process supervision. All of that is real recurring work for data you can
   get for free from your existing RPC provider.

## What to build instead

Read the balances directly, batched through **Multicall3** at
`0xcA11bde05977b3631167028862bE2a173976CA11` (same address on Base as on most chains).

### Call count: **1 RPC request per panel open.**

- 40 `balanceOf(address)` reads → encoded as 40 entries in a single `aggregate3` call → **one
  `eth_call`** to your RPC endpoint. Not 40 round trips; one.
- Want the native ETH balance in the same panel? Multicall3's own `getEthBalance(address)` goes in
  as a 41st entry in that same array. Still **one** request.
- Token metadata (`symbol`, `decimals`, `name`) is static for a fixed list of 40 supported tokens:
  ship it in the token list at build time. **Zero** calls at runtime, ever.
- So the steady state is: **1 eth_call, ~41 reads inside it, per refresh.** No backfill, no
  database, no deploy, no indexing lag.

`aggregate3` also lets each sub-call be `allowFailure: true`, so one weird token reverting degrades
to "—" for that row instead of blanking the panel.

### Sketch (viem / wagmi)

```ts
// wagmi does the Multicall3 batching for you when batch.multicall is enabled on the transport
const { data, refetch } = useReadContracts({
  contracts: SUPPORTED_TOKENS.map((t) => ({
    address: t.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
    chainId: base.id,
  })),
  query: { enabled: !!account },
});
// -> one eth_call to Multicall3 on Base; decimals/symbol come from SUPPORTED_TOKENS, not the chain
```

If you'd rather not maintain the token list at all, a provider balances endpoint (Alchemy /
Covalent `getTokenBalances`) is one HTTP call and discovers tokens for you — but for a curated
40-token list, Multicall3 is provider-neutral, free with any RPC, and keeps you off a vendor API.

## How this stays accurate as balances change

It stays accurate because it never caches a derived number — every render's numbers come from a
fresh read of canonical chain state at the latest block. Accuracy is a *fetch policy*, not an
indexing problem:

- **On panel open / wallet connect** — refetch. This is your stated requirement and it's one call.
- **On account or chain change** — refetch (wagmi keys the query on both, so this is automatic).
- **After a user transaction confirms** — invalidate the query on the receipt, so a swap or send
  updates the panel immediately.
- **While the panel is open** (optional) — `watch: true` / poll on new blocks. Base blocks are ~2s;
  even a 10–15s interval is one cheap `eth_call` per tick and is more current than any subgraph
  could be.

The property that matters: a direct `balanceOf` at latest block is *definitionally* the current
balance, including for rebasing and fee-on-transfer tokens, tokens you add to the supported list
tomorrow (adding a token = one line in the array, no re-sync), and tokens whose transfer accounting
changes under you. There is nothing to keep in sync, so there is nothing that can fall out of sync.

## When the subgraph would become the right call

The moment the scope grows a time axis or an all-users axis:

- "show my balance over the last 90 days" / P&L / cost basis → needs historical `Transfer` history
- "top holders of our tokens" / TVL over time / any leaderboard or analytics → needs cross-holder aggregation
- "my full activity feed" → needs past events

Those genuinely can't come from an `eth_call`, and a full-history `eth_getLogs` scan at request time
is not an alternative (public RPCs cap each call by block span and matched-log count, so it's
thousands of paginated calls that grow with every block). If any of that lands on the roadmap, build
the indexer *then* — and when you do, name its production home in the same document as the
architecture: which service runs it, under which command, against which persistent store. That's the
decision that otherwise stays open and leaves you with a read side that only ever ran on a laptop.

For "what do I hold right now," though: one `eth_call`, refetched on open.
