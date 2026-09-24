# Portfolio panel: subgraph vs. direct reads

**Verdict: the subgraph is overkill. Don't build it.** This panel asks one question —
"what does this wallet hold right now" — and the chain answers that question directly.
Ship the panel with batched `balanceOf` calls instead; it's ~1 RPC round trip, no
infrastructure, and it's *more* accurate than the subgraph, not less.

## Why the subgraph is the wrong tool here

The rule of thumb: **indexing is for history; current state is a contract call.**

An indexer exists because the chain will not hand you the past. Transfer events from six
months ago aren't queryable in any efficient way, so you backfill them into a database
and tail new ones. That's real work, and it's worth it for a feed, a leaderboard, a
volume chart, a P&L curve — anything that needs to know what *happened*.

This panel needs none of that. The spec is explicit: no history, no charts, no P&L, just
"what do you hold right now." Every ERC-20 on Base already exposes that number through
`balanceOf(address)`. Reconstructing it by replaying Transfer events is rebuilding, at
considerable cost, a value the token contract will return on request.

Concretely, what the proposed sprint buys you:

- **A backfill.** Transfer events for 40 tokens across all of Base history, for *every
  holder* — not just your users. Popular ERC-20s have millions of transfers each. You
  index and store all of it to serve the handful of addresses that connect to your dApp.
- **Deployment and hosting that isn't free.** On The Graph, `graph deploy` only gets you
  into Subgraph Studio, which is for testing. The hosted service was sunset in June 2024,
  so there is no free public endpoint. You must *publish* the subgraph to the network to
  get a production endpoint, then query it with a Studio API key. Queries are metered —
  roughly 100K free per month, then about $2 per 100K (figures as of 2026-08-18; check
  the live pricing page before you budget). Self-hosting a Graph Node or Ponder is a fine
  alternative, but then the host, the Postgres instance, and process supervision become
  yours to own and page on.
- **Ongoing correctness risk.** Your running balance is only right if your mapping
  handles every path a balance can change. Mint and burn (Transfer to/from the zero
  address) are usually covered. Rebasing or fee-on-transfer tokens, where the balance the
  contract reports doesn't equal the sum of Transfer amounts, are not. Any token in your
  40 that does something unusual will silently drift, and drift is exactly the failure
  mode you *can't* detect without... calling `balanceOf` to check.
- **A permanent lag.** A subgraph is always some blocks behind head. A user who swaps in
  another tab and reopens your panel sees a stale number.

The engineer's justification was "that way the balances are always accurate." It's
inverted: the subgraph is a derived approximation of a number that has an authoritative
source, and it is the only one of the two approaches that can be wrong.

## What the panel should do instead

Call `balanceOf(userAddress)` on each of the 40 token contracts, and batch them into a
single request with **Multicall3** at `0xcA11bde05977b3631167028862bE2a173976CA11` —
same address on Base as on most chains.

### How many onchain calls: **1**

That's one `eth_call` to Multicall3's `aggregate3`, carrying 40 encoded `balanceOf`
calls, returning 40 results. The node executes all 40 reads against a single block state
and returns one response. Not 40 requests — one.

Two things worth pinning down:

- **Pin the block.** Pass `blockTag` explicitly (or take the `blockNumber` Multicall3
  returns) so all 40 balances are read at the *same* block. Without that you'd be fine in
  practice here, but pinning makes the snapshot internally consistent and gives you an
  "as of block N" line for the UI.
- **Use `aggregate3`, not `aggregate`.** `aggregate3` allows per-call failure
  (`allowFailure: true`), so one misbehaving or self-destructed token returns an empty
  result instead of reverting the whole batch and blanking the panel.

In viem this is a `publicClient.multicall({ contracts: [...40 balanceOf...] })` — viem
routes through Multicall3 automatically. wagmi's `useReadContracts` does the same from
React. Roughly:

```ts
const { data } = useReadContracts({
  contracts: TOKENS.map((t) => ({
    address: t.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress],
  })),
  allowFailure: true,
})
```

Decimals and symbols are static per token — hardcode them in your token list rather than
spending calls on them. If you don't want to maintain the list, a provider balances
endpoint (Alchemy/QuickNode `getTokenBalances`) gets you the same snapshot in one HTTP
call, though you give up control over which 40 tokens appear.

### How this stays accurate as balances change

It doesn't *stay* accurate — it's re-read, which is stronger. There's no cached value to
go stale, because there's no cache. Each time the panel opens, you fetch the current
state from the token contracts themselves and render it. The token contract's storage
*is* the balance; you are reading the source of truth, not a copy of it, so there is
nothing to drift, backfill, or reconcile.

That matches the stated refresh model exactly: "refreshed when they reopen the panel."
Wire it up as:

- Fetch on panel open and on account/chain change.
- Optionally refetch on new blocks (wagmi's `watch`) or a 10–15s interval while the panel
  is visible, if you want it to tick live. Stop when it closes.
- Refetch after any transaction your dApp sends that moves a supported token.

Rebasing and fee-on-transfer tokens, the subgraph's blind spot, are handled for free —
you're asking the contract, and the contract knows.

## When you'd revisit this

Build an indexer when the panel grows a requirement the chain can't answer from current
state: a balance-over-time chart, cost basis or P&L, a "your trades" feed, a holders
leaderboard, portfolio snapshots at past dates. Those need history, and history needs a
backfill into a persistent store that then tails new events — a subgraph, Ponder, or a
provider data API, with its production home named up front.

The spec rules all of that out. Ship the Multicall3 read, spend the sprint elsewhere, and
build the indexer when a feature actually asks for the past.
