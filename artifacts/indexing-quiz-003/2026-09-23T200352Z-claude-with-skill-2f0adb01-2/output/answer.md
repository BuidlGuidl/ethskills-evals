# Do we need a subgraph for the portfolio panel?

**No.** A subgraph is the wrong tool here, and — this is the part worth pausing on —
it would make the panel *less* accurate, not more. Build the panel on a single
batched RPC read instead.

---

## Why the subgraph is overkill

The panel's requirement is: **current balance, 40 known tokens, one wallet, as of now.**

That is a *current state* read. Current state is what an Ethereum node already stores
and serves for free — `balanceOf(user)` is a `view` function, answered by `eth_call`
against the latest block. No scanning, no archive node, no indexer.

Indexers exist to answer questions the node *can't* cheaply answer:

| Question | Needs an indexer? |
|---|---|
| "What do I hold right now?" | **No** — `eth_call` / Multicall |
| "What did I hold last March?" | Yes (or an archive node) |
| "Chart my balance over 90 days" | Yes |
| "Every holder of token X, ranked" | Yes |
| "My P&L / cost basis" | Yes |

The proposal reconstructs, from an event log replay, a number the chain will hand you
directly. It's building a derived cache of `balanceOf` when `balanceOf` is one call away.

And the cost isn't just the sprint:

- **40 tokens = 40 high-volume event streams.** USDC/WETH-class tokens on Base emit
  enormous Transfer volume. You're indexing *every holder's* every transfer to serve
  balances for the handful of wallets that open your panel.
- **It's infrastructure you now operate.** Sync lag, reindexes on schema changes,
  resyncs when you add token #41, indexer costs or hosted-service fees, on-call when
  it falls behind. A `balanceOf` call has none of this — the node operator runs it.
- **Adding a token is a redeploy + full resync.** With RPC it's one line in an array.

## Why the subgraph is also *less* accurate

The engineer's justification was "that way the balances are always accurate." It
inverts the truth:

1. **Indexers lag the chain head.** A subgraph is always some blocks behind. Your user
   swaps, reopens the panel, sees a stale number, and files a bug. `eth_call` at
   `latest` is, by construction, current.
2. **Not every balance change emits a Transfer.** Rebasing and yield-bearing tokens
   (stETH-style, some wrapped/vault share tokens) change `balanceOf` via a supply-index
   update with **no Transfer event at all**. A Transfer-summing subgraph will report a
   permanently wrong number for those and never self-correct. If any of the 40 rebase
   now or in the future, the drift is silent.
3. **Fee-on-transfer / deflationary tokens** move a different amount than the Transfer
   event's `value`. Same silent drift.
4. **Reorgs and mapping bugs** make the derived balance drift from truth, and the only
   fix is a resync. `balanceOf` is the token contract's own authoritative answer — it
   cannot drift, because it isn't a copy.

Summing Transfers is a *reimplementation* of each token's accounting logic, and it's
only correct for tokens whose accounting is plain-vanilla ERC-20.

---

## What to build instead

Read the 40 balances directly, batched through **Multicall3** — deployed on Base (and
50+ chains) at `0xcA11bde05977b3631167028862bE2a173976CA11`.

### How many onchain calls: **1**

One `eth_call` to Multicall3's `aggregate3`, carrying all 40 `balanceOf(user)` calls in
its calldata. The node executes all 40 reads inside a single simulated call at a single
block and returns 40 results in one response.

That's **1 RPC round trip, 1 block height, 40 balances** — not 40 calls, and certainly
not a subgraph. Because all 40 are evaluated at the same block, the panel is also
internally consistent: no chance of showing token A pre-swap and token B post-swap.

```typescript
import { createPublicClient, http, erc20Abi } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({ chain: base, transport: http(RPC_URL) });

const TOKENS = [/* 40 Base ERC-20 addresses */] as const;

async function fetchPortfolio(user: `0x${string}`) {
  const results = await client.multicall({
    contracts: TOKENS.map((address) => ({
      address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [user],
    })),
    allowFailure: true,   // one bad token can't blank the whole panel
  });

  return TOKENS.map((address, i) => ({
    address,
    balance: results[i].status === 'success' ? results[i].result : null,
  }));
}
```

Notes on the implementation:

- `allowFailure: true` so a single reverting/self-destructed token renders as "—"
  rather than failing all 40.
- viem batches into Multicall3 automatically when the client is created with
  `batch: { multicall: true }`; calling `client.multicall` makes it explicit.
- Decimals and symbols are **immutable** — read them once at build time and hardcode
  them in your token list. Don't spend calls re-reading constants every open.
- If the token count ever grows past a few hundred, split into chunks so the calldata
  and gas-limit of the simulated call stay comfortable. At 40, one call is fine.

### How it stays accurate as balances change

It stays accurate because **it never caches anything**. There is no derived state to go
stale, so there is no reconciliation problem to solve:

- **Every panel open re-reads.** The spec says "refreshed when they reopen the panel" —
  so fire `fetchPortfolio` on open. Each open is one fresh call at the current block.
  Whatever happened onchain a second ago is already reflected.
- **The token contract is the source of truth,** not a copy of it. Rebases,
  fee-on-transfer, mints, airdrops, bridge deposits, a balance that changed through a
  mechanism you've never heard of — all of it shows up, because you're asking the
  contract what it thinks, not recomputing what it *should* think.
- **For live updates while the panel is open** (optional, beyond the stated spec):
  poll every ~10–15s, or subscribe over WebSocket to `Transfer` events filtered to the
  connected wallet's address and refetch when one lands. Events as a *trigger* to
  refetch is fine; events as the *source* of the number is what causes drift.

### The one genuine tradeoff

You depend on an RPC provider being up. That's true of the subgraph approach too — plus
the subgraph adds its own indexer as a *second* dependency on top. Mitigate with a
fallback transport:

```typescript
transport: fallback([http(PRIMARY_RPC), http(BACKUP_RPC)])
```

---

## If you want zero token-list maintenance

Alchemy's `getTokenBalances` on Base returns balances for an address in one HTTP
request, and can discover tokens you didn't list. Reasonable if the 40-token list
becomes a chore — but it's a centralized dependency with its own lag characteristics,
where Multicall3 reads the chain directly. For a **fixed, curated list of 40**,
Multicall3 is the better fit: explicit, provider-agnostic, and exactly as current as
the chain head.

---

## Recommendation

Cut the subgraph from the sprint. Ship the panel as one Multicall3 read refetched on
open — that's roughly an afternoon of work, no infrastructure to operate, and strictly
more accurate than the indexed version for rebasing and fee-on-transfer tokens.

Revisit an indexer the moment the product asks for **history**: balance-over-time
charts, P&L, cost basis, "tokens you've ever held." Those genuinely require replaying
Transfer events, and at that point a subgraph (or Ponder) is the right call — but scope
it to the wallets and questions you actually need, and keep the *current-balance* panel
on the direct read regardless. Current state and historical state want different tools;
don't let the historical tool creep into the job the node already does for free.
