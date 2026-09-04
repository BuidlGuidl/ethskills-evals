# Should we build a subgraph for the portfolio panel?

**No. Don't spend the sprint.** For "what does this one wallet hold right now,"
a subgraph is the wrong tool — and the justification given for it ("that way the
balances are always accurate") is backwards. The subgraph would be *less* accurate
than the one-line alternative, not more.

Build it as **a single batched `eth_call` via Multicall3**. That's **1 onchain call
per panel open** for all 40 balances (41 values if you fold in native ETH — still
one call). Roughly half a day of work, zero infrastructure to operate.

---

## 1. Why the subgraph is the wrong shape for this problem

An indexer exists to answer questions the chain does not already store as state.
`balanceOf` is not one of those questions. Every ERC-20 already keeps a
`mapping(address => uint256)` of current balances, and exposes it as a free `view`
function. The proposed subgraph would replay every `Transfer` event ever emitted by
40 tokens in order to reconstruct a number that the token contract will hand you
directly, for free, in one read.

That's the whole argument in one line: **you would be rebuilding a database that
already exists, from its own changelog, in order to read one row of it.**

### The "always accurate" claim is inverted

Reconstructing balances from `Transfer` events is an *approximation* of state.
`balanceOf` *is* state. Here's where the running-balance approach silently drifts:

| Failure mode | What happens to a Transfer-derived balance |
|---|---|
| **Rebasing / share-based tokens** (stETH-style, Aave aTokens, some yield-bearing wrappers) | Balance grows with no `Transfer` emitted at all. Your number freezes and drifts further every day. |
| **Fee-on-transfer / deflationary tokens** | The event says `amount`, the recipient actually receives `amount - fee`. Every transfer injects error that never washes out. |
| **Upgradeable proxies** | The token's accounting logic changes under you; your mapping code doesn't. |
| **Non-standard mint/burn/admin paths** | Any balance mutation that skips the event is invisible to you, permanently. |
| **Reorgs at the chain head** | The indexer must unwind and replay. A user who just swapped and opened the panel can see a number that was never true. |
| **Indexing lag** | Even a healthy subgraph trails the head. Base produces a block every ~2s; the user swaps in *your dApp*, opens the panel, and sees the pre-swap balance. That reads as "the app is broken." |
| **A bug in your mapping handler** | Balances are wrong for everyone, forever, until someone notices and you full-resync. |

`balanceOf` is immune to all seven rows by construction. Whatever the token
contract says is, definitionally, the balance — including for rebasing tokens,
fee-on-transfer tokens, and tokens that do something strange. You inherit
correctness for free instead of re-deriving it and owning the bugs.

### The cost side

- **Build:** subgraph schema, 40 data sources, mapping handlers, tests, deploy.
- **Initial sync:** you must index these tokens' *entire* Transfer history from
  genesis to get correct balances. High-volume tokens on Base (USDC in particular)
  have on the order of tens of millions of Transfers. That's hours-to-days of
  sync, repeated on every schema change, because schema changes force a resync.
- **Forever after:** hosting/query costs (Subgraph Studio free tier, then paid; or
  GRT curation on the decentralized network), sync monitoring, an on-call story for
  "the panel is showing stale numbers," and a redeploy every time you add token #41.

Against: one `eth_call` against the RPC endpoint the dApp already has configured.

---

## 2. What to build instead

**Multicall3 + `balanceOf` × 40, in one call.**

Multicall3 is deployed at the same deterministic address on Base as everywhere else:

```
0xcA11bde05977b3631167028862bE2a173976CA11
```

You call `aggregate3(Call3[])` with 40 encoded `balanceOf(userAddress)` calls. The
node executes all 40 reads inside a single EVM execution against a single block and
returns 40 results in one response.

### Token metadata is static — don't fetch it

`symbol`, `decimals`, `name`, and the token address never change. Put them in a
checked-in constant file. This is not a runtime concern and should cost zero calls:

```ts
// tokens.base.ts
export const TOKENS = [
  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
  // ... 39 more
] as const;
```

### The fetch

```ts
import { erc20Abi } from 'viem';

const contracts = TOKENS.map((t) => ({
  address: t.address,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [account],
} as const));

const balances = await publicClient.multicall({
  contracts,
  allowFailure: true, // one odd token reverting must not blank the whole panel
  batchSize: 0,       // IMPORTANT: see note below — forces a single eth_call
});
```

Or as a hook, which is what the panel actually wants:

```ts
const { data, isFetching, refetch, dataUpdatedAt } = useReadContracts({
  contracts,
  allowFailure: true,
  batchSize: 0,
  query: {
    enabled: Boolean(account) && isPanelOpen,
    staleTime: 4_000, // ~2 Base blocks
  },
});
```

**The `batchSize: 0` detail matters.** viem's multicall defaults to splitting at
`batchSize: 1024` *bytes of calldata*. Each `Call3` element encodes to ~224 bytes
(32 head offset + 32 target + 32 bool + 32 data offset + 32 data length + 64 padded
calldata), so 40 calls is ~9 KB of calldata — with the default you'd silently get
~5 separate `eth_call`s instead of 1. Setting `batchSize: 0` disables splitting.
9 KB of calldata in a single `eth_call` is unremarkable for any RPC provider.

### Native ETH, if you want it

`eth_getBalance` would normally be a second call, but Multicall3 exposes
`getEthBalance(address)` as a regular function on itself — so add it as a 41st entry
targeting the Multicall3 address and it rides along in the same call. Still 1 call.

---

## 3. The number: **1 onchain call**

To be unambiguous about what's being counted:

| Approach | RPC round trips per panel open |
|---|---|
| **Multicall3 `aggregate3`, `batchSize: 0`** | **1** (one `eth_call`) |
| viem multicall at default `batchSize: 1024` | ~5 (avoidable — set `batchSize: 0`) |
| Naive loop of 40 separate `balanceOf` reads | 40 (works, but 40 round trips) |
| 40 reads in one JSON-RPC batch array | 1 HTTP request, 40 node executions, and *no* single-block guarantee |
| Subgraph | 1 GraphQL query — plus a sprint and permanent infra |

Steady state: **one HTTP request, typically 100–300 ms against a decent Base RPC,
comfortably inside free-tier limits.** Token metadata: 0 calls (it's a constant).

Note the naive-loop and JSON-RPC-batch rows aren't just slower — they can be split
across different blocks by a load-balanced RPC, so you can render a torn snapshot
mid-swap (token A post-trade, token B pre-trade). `aggregate3` cannot do that.

---

## 4. How this stays accurate as balances change

This is the part the subgraph was supposed to buy you, and the direct-read approach
does it better:

**Freshness.** There is no cache to invalidate and no indexer to fall behind.
Every fetch reads the canonical state at the latest block, so the panel is by
definition at most one refresh stale — never structurally stale.

**Snapshot consistency.** All 40 reads execute in one EVM call against one block, so
the 40 numbers are mutually consistent — a genuine portfolio snapshot, not 40 reads
smeared across a few blocks.

**Refresh triggers.** The panel refetches on:
- panel open / mount (the requirement as stated),
- connected account change and chain change (wagmi does this by query-key identity),
- **after any transaction the user sends from your dApp** — hang
  `useWaitForTransactionReceipt` off the tx and `queryClient.invalidateQueries` the
  balances key on confirmation. This is the case that makes an app feel broken, and
  it's the case a lagging indexer handles *worst*.
- optionally, while the panel is open, `useBlockNumber({ watch: true })` → invalidate.
  At 2s Base blocks that's fine, but a 5–10s `refetchInterval` is gentler on the RPC
  and indistinguishable to a human reading numbers.

**Reorgs.** Not your problem. You read the head; if the head changes, your next read
reflects the new head. There is no derived state to unwind.

**Degradation.** `allowFailure: true` means a single misbehaving token renders as
`—` in its row instead of taking down the panel. Filter zero balances client-side
(most users hold a handful of the 40) — free, and no different from what you'd do
with subgraph results.

**Adding token #41.** One line in `tokens.base.ts`. No redeploy, no resync.

---

## 5. When a subgraph *would* be right

So this isn't read as "never index." The line is:

> **Current state of a known, bounded set of addresses → read the chain directly.
> Anything across time, or across an unbounded set → index it.**

You'd genuinely need the subgraph (or a similar indexer) the moment the panel grows:

- **History, charts, P&L, cost basis** — past state isn't queryable; archive-node
  `balanceOf` at historical blocks doesn't scale, and cost basis needs the transfer
  log anyway.
- **"Who holds token X" / top-holder lists / holder counts** — unbounded address
  set, genuinely requires indexing.
- **Aggregates across many wallets** — analytics, leaderboards, airdrop eligibility.
- **Events with no state to read** — e.g. "show this user's swap history."

Today's spec — *"just the live numbers as of now, no history, no charts, no P&L"* —
sits squarely on the direct-read side of that line. And if history is on the roadmap
for next quarter, that's a real reason to build an indexer *then*, scoped to the
thing that actually needs it. It is not a reason to build one now for balances,
because even with a subgraph in place you'd still want `balanceOf` for the live
numbers.

---

## Recommendation

1. Ship the panel with a checked-in token list + one Multicall3 `aggregate3` read.
   Half a day, not a sprint.
2. Refetch on open, on account/chain change, and on confirmation of any tx sent
   from the dApp.
3. Revisit indexing when — and only when — someone asks for history, charts, or
   cross-wallet questions. Scope it to those features, not to balances.

One caveat worth naming: if you later need this for *many* wallets at once
(analytics, a dashboard over your user base), the per-wallet-read model stops
scaling and the answer flips. For a connected user looking at their own holdings,
it doesn't.
