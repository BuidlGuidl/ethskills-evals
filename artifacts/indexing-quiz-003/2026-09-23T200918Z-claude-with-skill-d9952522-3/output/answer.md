# Does the portfolio panel need a subgraph?

**No. This is the wrong tool for this panel.** The subgraph should not be built.

## The reasoning

The panel's requirement, stated precisely, is: *for one address, the current balance of
40 known ERC-20 contracts on Base, re-read whenever the panel is opened.* No history,
no time series, no aggregation across users, no P&L.

That is a **current-state read**, not historical data. Every one of those 40 tokens
already exposes the exact number the panel wants as a public view function:

```solidity
function balanceOf(address account) external view returns (uint256);
```

The chain will hand you that value on request, at the latest block, for free. Indexing
is how you reconstruct things the chain does *not* answer on request — what happened
over time, who ranked where, how a number moved across blocks. Replaying every
`Transfer` event since each token's deployment in order to maintain a running balance
per holder is rebuilding, at considerable cost, a number that `balanceOf` returns in
one call.

The proposal's own justification — "that way the balances are always accurate" —
actually inverts the tradeoff. A subgraph is *strictly less* accurate here than a
direct read, for reasons in the next section.

## What the subgraph approach actually costs

Worth being concrete about the sprint being proposed:

- **Backfill.** 40 tokens' full `Transfer` history on Base. For anything with real
  volume (USDC, WETH, cbBTC) that is millions of events. Indexing time measured in
  hours-to-days, re-run every time you change the schema or add a token.
- **Storage that grows without bound.** You'd be tracking a balance row for *every
  holder of every supported token* — hundreds of thousands to millions of accounts —
  so that you can serve the handful who connect a wallet to your dApp. The overwhelming
  majority of that data is never read.
- **Correctness edge cases you now own.** Rebasing tokens (stETH-style) and
  fee-on-transfer tokens change balances without a `Transfer` that matches the delta,
  so your derived balance silently drifts from the truth. Any token with a mint/burn
  path that doesn't emit `Transfer` is invisible. You'd be maintaining a
  reimplementation of each token's accounting in your mappings.
- **A production home and a bill.** The Graph's hosted service was sunset in June 2024,
  so there is no free endpoint. Deploying to Subgraph Studio is testing only; you must
  publish to the network to get a production endpoint, and queries are metered
  (roughly 100K free per month, then about $2 per 100K — re-check the live pricing page
  before budgeting). Self-hosting Graph Node or Ponder instead is fine, but then the
  host, the Postgres instance, process supervision, alerting and reindex-on-deploy are
  all yours to operate forever.
- **Ongoing indexing lag.** Someone is on call for the day the indexer falls behind and
  every user's portfolio shows stale numbers.

You'd be taking on a permanent operational surface to answer a question the RPC node
answers for free.

## What to build instead

Call `balanceOf` on each of the 40 tokens, batched through **Multicall3** at
`0xcA11bde05977b3631167028862bE2a173976CA11` (same address on Base as on most chains).

### The call count

**One JSON-RPC request per panel open.**

Multicall3's `aggregate3` takes an array of `(target, allowFailure, callData)` and
executes them all inside a single `eth_call`. You encode 40 `balanceOf(user)` calls,
send one `eth_call` to the Multicall3 address, and get back 40 return values.

So the count is:

| Approach | Requests to the RPC |
|---|---|
| Naive loop, one `eth_call` per token | 40 |
| **Multicall3 `aggregate3`, batched** | **1** |
| Subgraph | 1 query — after a multi-day build and a permanent indexer to operate |

One request, one round trip, all 40 balances, typically well under a second.

With viem this is `publicClient.multicall({ contracts: [...40 balanceOf calls] })`,
which uses Multicall3 under the hood and batches automatically. wagmi's `useReadContracts`
does the same from React. Set `allowFailure: true` so one misbehaving token contract
returns a failure marker instead of reverting the whole batch, and render that row as
"unavailable" rather than blanking the panel.

Two optional refinements, neither of which changes the architecture:

- **Pin the block.** Pass `blockNumber` explicitly so all 40 balances come from the
  same block and the panel is internally consistent — no risk of token 1 being read at
  block N and token 40 at block N+2. Displaying that block number also gives the user
  an honest "as of" marker.
- **Skip the calls entirely.** Providers (Alchemy, and similar) expose a token-balances
  endpoint that returns all balances for an address in one HTTP call. That's also one
  request and saves you maintaining the token list in the client. The Multicall3 path
  has no provider lock-in, so I'd default to it and treat the provider endpoint as a
  convenience alternative.

## How this stays accurate as balances change

This is the part where the proposal has it backwards — the direct-read approach is more
accurate, not less, and it gets there by doing nothing:

1. **There is no cached state to go stale.** The panel holds no balance database. Every
   open issues a fresh `eth_call` against the latest block, so the numbers are the
   chain's own current answer at the moment the user looks. "Refreshed when they reopen
   the panel" — the stated requirement — is satisfied by construction.

2. **It is the token's own accounting, not a reconstruction of it.** `balanceOf` returns
   whatever the token contract itself considers the balance. Rebasing, fee-on-transfer,
   admin mints, unusual burn paths, upgrades that change the accounting — all of it is
   already reflected, because you are asking the contract rather than deriving the
   answer from its event log. The entire class of drift bugs that a running-balance
   mapping introduces simply does not exist.

3. **No indexing lag and no reorg exposure.** There is no pipeline between the chain and
   the panel that can fall behind, and no derived state that needs unwinding when Base
   reorgs a block. The node handles that; you read what it currently reports.

4. **Freshness on demand is one more request.** If you want the panel to update while
   it's open rather than only on reopen, re-issue the same single multicall — on a timer,
   on `block` via a WebSocket subscription, or after the user's own transaction confirms.
   wagmi's `watch`/`blockNumber` options wire this up directly. Still one request per
   refresh.

## When you *would* need an indexer

To be clear about where the line sits, so this doesn't read as "never index." Build the
indexer the moment the panel grows any of these:

- Portfolio value **over time**, a balance chart, or 24h/7d change
- **P&L or cost basis**, which requires each acquisition's price and time
- A **transaction/transfer history** list for the connected wallet
- **Cross-user** views: leaderboards, holder counts, TVL by token, "top holders"
- Token discovery — "show me every token this wallet holds," rather than a fixed
  list of 40

All of those are questions about the past or across accounts, and none of them can be
answered by a contract call. Note that the task explicitly rules every one of them out:
"No history, no charts, no P&L, just *what do you hold right now*."

Ship the multicall. If the roadmap later adds the history chart, that's the sprint where
the subgraph earns its keep — and by then you'll know which events and which tokens
actually matter, so you'll build a smaller and better-targeted one than you would today.

## Recommendation

Cancel the subgraph sprint. The panel is roughly a day of frontend work:

1. A constant array of the 40 token addresses + decimals + symbols for Base.
2. A `useReadContracts` / `multicall` hook issuing **one** batched `eth_call` with
   `allowFailure: true` and a pinned `blockNumber`.
3. Format with the per-token decimals, hide zero balances, show the "as of block N"
   marker, and refetch on panel open.

No indexer, no database, no deploy pipeline, no query bill, no on-call rotation.
