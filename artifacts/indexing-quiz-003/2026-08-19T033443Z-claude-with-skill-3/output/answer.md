# Portfolio panel: do we need a subgraph?

**Short answer: no. Don't build it.** The panel needs current state, not history, and
current state is what a contract call returns on request. The proposed subgraph would
spend a sprint rebuilding — less accurately — a number `balanceOf` already gives you.

The way I'd build it, all 40 balances for one wallet is **one onchain call**: a single
`eth_call` to Multicall3 that batches 40 `balanceOf(address)` reads. One HTTP round trip
per panel open.

---

## 1. Why the subgraph is the wrong tool here

The line that decides this: **historical onchain data comes from an indexer; "as of now"
data comes from a direct contract call.** The panel is entirely on the second side of that
line. There is no feed, no leaderboard, no chart, no P&L — nothing that requires knowing
what happened between two points in time. It asks one question, "what does this address
hold right now," and every ERC-20 on Base answers that question itself.

Indexing `Transfer` events to maintain a running balance is reimplementing the token's own
accounting in TypeScript, in a second system, that then has to stay in sync forever.

### It is not more accurate — it is strictly less accurate

This is the part of the scope I'd push back on hardest, because the stated justification
("that way the balances are always accurate") is backwards. A `balanceOf` read *is* the
token's ledger. A subgraph is a replica of it, and every replica has ways to drift:

- **Indexing lag.** The subgraph is always some blocks behind head. A user who swaps in
  your dApp and reopens the panel sees a stale number, which is exactly the moment they're
  most likely to look. `balanceOf` at head has no lag.
- **Balances that change with no `Transfer` event.** Rebasing and share-based tokens
  (stETH-style), and anything with a rewards/interest accrual model, change a holder's
  balance without emitting a transfer. A Transfer-sum subgraph is simply *wrong* for those
  and there's no mapping code that fixes it. If any of the 40 is such a token — or ever
  becomes one via an upgrade — the panel silently lies.
- **Fee-on-transfer and deflationary tokens.** The amount in the event is not always the
  amount credited. Sum the events and you drift, permanently, in a direction that never
  self-corrects.
- **Upgradeable / proxy tokens.** Any of the 40 can change transfer semantics under you.
  `balanceOf` follows the change automatically; your mappings do not.
- **Reorgs and re-sync.** Handled by The Graph, but they're one more failure mode in a
  system that exists only to compute a number you can just ask for.
- **Drift is silent.** Nothing alerts you. You find out when a user reports a wrong number,
  and then you're debugging mapping logic against onchain truth.

### It's also a real, permanent cost

- A sprint of build time, plus a backfill that has to sync from each token's deploy block
  before the panel works at all — 40 tokens on Base, some with millions of transfers, and
  every holder of every token gets an entity written, not just your users.
- The hosted service is gone (sunset June 2024), so there is no free endpoint. Studio is
  testing-only; you'd have to **publish to the network** to get a production endpoint, then
  query with a Studio API key. Production queries are metered — roughly 100K free per month,
  then about $2 per 100K (checked 2026-08-18; re-read the live pricing page before
  budgeting). A portfolio panel that refetches on open burns queries fast.
- Ongoing ops: every token you add to the supported list is a manifest change, a redeploy,
  and a re-sync. With multicall, adding a token is one line in a JSON array.
- Or you self-host a Graph Node / Ponder — fine, but then the host, the Postgres, the
  backups and the process supervision are yours to own forever, for a read that costs one
  RPC call.

**When a subgraph *would* be right:** the moment the requirements grow the word "history" —
balance over time, cost basis, P&L, a chart, an activity feed. Those genuinely cannot be
answered by a point-in-time read, and then indexing `Transfer` is the correct design. That's
a different project with a different justification; don't pre-build it now, and note that
even then you'd want the live balances to keep coming from `balanceOf`, with the indexer
supplying only the historical series.

---

## 2. What to build instead

### The call count

**1 onchain call per panel open**, for all 40 tokens.

Multicall3 is deployed on Base at the canonical address
`0xcA11bde05977b3631167028862bE2a173976CA11`. You encode 40 `balanceOf(user)` calls into
one `aggregate3` call and send it as a single `eth_call`. The node executes all 40 reads in
one EVM context and returns 40 results.

- 40 `balanceOf` reads → **1** `eth_call` / 1 HTTP request.
- Native ETH balance, if the panel shows it → still **1** call total; Multicall3's
  `getEthBalance(address)` goes into the same batch as call #41.
- Token metadata (`symbol`, `decimals`, name, logo) → **0** calls. These are immutable
  constants for a fixed supported-token list. Hardcode them in a checked-in token list at
  build time. Fetching decimals at runtime is the most common way this turns into 80+ calls
  for no reason.

So: **one request, one round trip, ~200ms.** Compare with the subgraph path, which is also
one request but sits behind a system you had to build, publish, pay for and operate.

Gas/size is a non-issue: 40 `balanceOf` reads is well under a hundred thousand gas of
`eth_call` execution, far below any provider's call gas cap. If the list ever grows past a
few hundred tokens, chunk it into batches of ~250 — but at 40 you are nowhere near that.

### Concretely, with viem/wagmi

`viem`'s `multicall` (or wagmi's `useReadContracts` with `batch: { multicall: true }`) does
the Multicall3 encoding for you:

```ts
import { multicall } from "viem/actions";
import { erc20Abi } from "viem";
import { SUPPORTED_TOKENS } from "./tokens"; // 40 × { address, symbol, decimals }

// Pin every read to one block so the 40 numbers are a consistent snapshot.
const blockNumber = await publicClient.getBlockNumber();

const results = await multicall(publicClient, {
  contracts: SUPPORTED_TOKENS.map((t) => ({
    address: t.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [user],
  })),
  allowFailure: true,   // one bad token can't blank the whole panel
  blockNumber,          // consistent snapshot across all 40
});
```

Then filter out zero balances client-side and render. Format with the decimals already in
your token list.

Two details worth keeping:

- `allowFailure: true` so a single reverting or self-destructed token renders as "—"
  instead of failing the panel.
- Pinning `blockNumber` matters: without it a provider behind a load balancer can serve
  different reads from different blocks. Pinning gives you a coherent portfolio as of one
  specific block, and you can show that block/timestamp in the UI.

### The production home

Even this minimal read side has a production home to name, and it's the one thing here that
can silently stay open: **the panel's balances come from our Base RPC endpoint**
(e.g. an Alchemy/QuickNode/Base-mainnet key held in `NEXT_PUBLIC_RPC_URL`, server-proxied so
the key isn't in the bundle). Write that down next to the architecture along with which plan
and rate limit it's on. There is no process to supervise, no database to back up, and no
deploy step beyond shipping the frontend — which is the point.

An alternative production home is a provider "token balances" endpoint (Alchemy
`alchemy_getTokenBalances`, or similar). That's also 1 HTTP call and it discovers tokens you
didn't list. But for a *fixed* list of 40 it buys nothing, adds a vendor-specific dependency,
and those endpoints are themselves backed by an index that can lag. Multicall against your
own RPC reads the chain directly. I'd default to multicall.

---

## 3. How this stays accurate as balances change

It stays accurate by not having any state of its own to keep in sync. That's the whole
mechanism, and it's worth being explicit about why it's stronger than the subgraph's:

- **Every read is evaluated against the chain's current state.** `balanceOf` runs the
  token's own storage lookup at the block you pinned. There is no cached copy that can be
  stale, no mapping logic that can be buggy, no backfill that can be incomplete. Whatever
  changed the balance — transfer, mint, burn, rebase, an upgrade that redefines accounting
  entirely — is already reflected, because you're asking the token, not a model of it.
- **Refetch on open is the refresh policy, and it's sufficient.** The requirement is "live
  numbers as of now, refreshed when they reopen the panel." One multicall on open satisfies
  that exactly. With wagmi/TanStack Query, set a short `staleTime` (~15s, a few Base blocks)
  so a rapid close/reopen serves cache, and let `refetchOnMount` do the rest.
- **Optional freshness upgrades, each still one call:**
  - `refetchInterval` of ~10–15s while the panel is open, if you want it ticking.
  - Invalidate the balances query in the `onSuccess` of any transaction your dApp sends, so
    a swap/deposit updates the panel immediately after it confirms.
  - Or `watchBlockNumber` and refetch on new blocks — same single multicall each time.
- **Failure mode is honest.** If the RPC is down you get an error and can show "couldn't
  load," rather than confidently rendering a stale or drifted number. A wrong balance is
  much worse than a visibly missing one.

---

## Bottom line

| | Proposed subgraph | Multicall reads |
|---|---|---|
| Calls for 40 balances | 1 GraphQL query (behind a system you built) | **1 `eth_call`** |
| Build cost | ~1 sprint + full backfill from token deploy blocks | ~half a day |
| Ongoing cost | Publish to network, metered queries (~100K free/mo, then ~$2/100K), or self-hosted node + Postgres | Existing RPC plan |
| Adding a token | Manifest change, redeploy, re-sync | One line in a JSON list |
| Accuracy | Replica; lags head, drifts on rebasing/fee-on-transfer/upgrades, drifts silently | Chain truth at a pinned block, by construction |

Don't build or operate a subgraph to track a number the chain returns on request. Ship the
multicall version, name the RPC endpoint as its production home, and revisit indexing on the
day someone asks for history, charts or P&L — which is a real indexing problem, and a
different one.
