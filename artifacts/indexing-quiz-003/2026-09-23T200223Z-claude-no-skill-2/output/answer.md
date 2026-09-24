# Should we build a subgraph for the portfolio panel?

**No. Don't build it.** The subgraph is the wrong tool for this panel, and it is
strictly *less* accurate than the one-line alternative, not more. Ship the panel
with a single batched `eth_call` and spend the sprint on something else.

---

## 1. The core reasoning: this is a state read, not a history query

An indexer exists to answer questions that chain state *cannot* answer, because the
answer isn't stored anywhere onchain. "What did this wallet hold last Tuesday?",
"who are the top 100 holders?", "what's this wallet's realized P&L?" — none of those
are readable from a contract. You have to reconstruct them by replaying events.

The panel asks none of those. It asks: **"what does this wallet hold right now?"**

That number is already stored onchain, in each token's `balanceOf` mapping, and every
ERC-20 exposes it as a free view function. The proposal is to replay every `Transfer`
event since each token's deployment, do the arithmetic ourselves, store the result in
a Postgres table, and serve it over GraphQL — in order to recompute a number the
contract will hand us for free, in one call.

That's the whole diagnosis. **If the data is live contract state, read the contract.
Index only what state doesn't retain.**

## 2. The "always accurate" claim is backwards

The pitch's stated benefit is accuracy. It's actually the proposal's biggest weakness.
A derived-balance subgraph is accurate only if *every* path that changes a balance
emits a `Transfer` you handle correctly. Concretely, it will silently drift on:

- **Rebasing / share-based tokens** (stETH-style, aTokens, yield-bearing wrappers).
  Balances change on rebase with **no `Transfer` event at all**. Your running total is
  simply wrong and stays wrong. `balanceOf` is always right, because for these tokens
  `balanceOf` is a computed function of shares × index — the actual source of truth.
- **Fee-on-transfer / deflationary tokens.** Amount in the event ≠ amount credited.
  Your mapping adds the wrong number.
- **Mints, burns, and admin rescues** that use a non-standard event, or none.
- **Upgradeable tokens.** A proxy upgrade can change transfer semantics under you; your
  mapping keeps applying yesterday's assumptions.
- **Arithmetic/ordering bugs in your own mapping code**, which produce a number that is
  confidently wrong with nothing to reconcile it against.

On top of that, an indexer is always *behind*. You inherit indexing lag (seconds to
minutes, worse after a redeploy), reorg handling, and a full historical backfill across
40 tokens before the panel can show anything. `balanceOf` at latest block has none of
these failure modes: it's the same number the token contract itself would use to
authorize the user's next transfer.

## 3. The operational cost is real and permanent

Building it is a sprint. *Operating* it is forever: a deployed subgraph is a new
production dependency that can fall behind, break on a token addition (re-deploy +
re-sync), and take the portfolio panel down with it. Adding token #41 means editing the
manifest, redeploying, and waiting for a backfill. In the approach below, adding token
#41 means appending one line to a config array.

## 4. What to build instead

Read the balances directly, batched through **Multicall3**, which is deployed at the
same address on Base as everywhere else:
`0xcA11bde05977b3631167028862bE2a173976CA11`.

### Onchain call count: **one.**

One `eth_call` to Multicall3's `aggregate3`, carrying 40 encoded `balanceOf(address)`
calldatas — one per token. One JSON-RPC round trip, one node-side execution, 40 results
back. Not 40 calls, not 41. With `viem`'s `multicall` (or wagmi's `useReadContracts`
with `multicall: true`) this is the default behavior; you write 40 logical reads and the
client emits a single request.

Token metadata — symbol, name, decimals — is immutable and known at build time for a
fixed list of 40. **Hardcode it in a constants file. Zero calls for metadata.** Fetching
`decimals()` at runtime is the most common way teams turn this 1-call design into a
121-call one.

```ts
import { createPublicClient, http, erc20Abi } from 'viem'
import { base } from 'viem/chains'

const client = createPublicClient({ chain: base, transport: http(RPC_URL) })

// TOKENS: hardcoded { address, symbol, decimals }[] — 40 entries, no calls needed.
export async function fetchPortfolio(wallet: `0x${string}`) {
  const results = await client.multicall({
    contracts: TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [wallet],
    })),
    allowFailure: true, // one bad token can't blank the whole panel
  })

  return TOKENS.map((t, i) => ({
    ...t,
    balance: results[i].status === 'success' ? results[i].result : null,
  }))
}
```

Rough shape of the work: **an afternoon**, versus a sprint plus indefinite operations.

### How it stays accurate

- **Atomic snapshot.** All 40 `balanceOf` calls execute inside a *single* EVM execution
  at one block. There is no skew where token A is read at block N and token B at N+2 —
  the panel always shows a mutually consistent portfolio. (Pin it explicitly with
  `blockNumber` if you want the block stamped in the UI.)
- **Zero staleness by construction.** The read hits the canonical state trie at the
  chain head. There is no cache, no derived table, and no lag to reconcile — the number
  is the token contract's own number, so rebases, fee-on-transfer, mints, burns, and
  upgrades are all correct for free, because you never modeled them in the first place.
- **Refresh is just re-running the call.** The requirement is "refreshed when they
  reopen the panel," so: refetch on panel open. In wagmi/TanStack Query, set a short
  `staleTime` (~10–15s) and `refetchOnMount`. That's the entire freshness story.
- **Optional, if you want live updates while the panel is open:** poll the same single
  call every N blocks (`watchBlockNumber`), or subscribe to `Transfer` logs filtered on
  the connected address in the `from`/`to` topic across the 40 token addresses and use
  a hit purely as a *cache-invalidation signal* — then re-run the one multicall to get
  the authoritative number. Note the key difference from the subgraph: events trigger a
  re-read, they never become the balance. A missed event costs you a few seconds of
  freshness, not a permanently wrong number.
- **Reorgs are a non-issue.** You read the head each time; if the head changes, the next
  read reflects it.

### Failure handling

Use `allowFailure: true` so a single reverting or self-destructed token renders as "—"
instead of blanking the panel. Behind a reliable Base RPC (Alchemy/QuickNode/Base's
public endpoint), a 40-call multicall is a small, cheap request well inside normal
`eth_call` gas limits — but keep an eye on response size if you ever grow the list into
the hundreds, at which point chunk into 2–3 multicalls rather than reaching for an
indexer.

## 5. When the subgraph *would* be the right call

Keep the proposal on file. Build it the moment the product asks for anything the chain
doesn't currently store:

- balance **history** / charts over time
- **P&L**, cost basis, realized gains
- **cross-holder** queries: top holders, holder counts, distribution
- transaction/activity feeds, or "tokens this wallet has *ever* touched" (open-ended
  discovery, as opposed to our fixed list of 40)

Every one of those requires replaying events, and for those the indexing cost is
justified. The current spec — "just the live numbers as of now" — deliberately excludes
all of them.

---

## Bottom line

| | Proposed subgraph | Recommended |
|---|---|---|
| Onchain calls per wallet | 0 (but full historical backfill + ongoing sync) | **1** batched `eth_call` |
| Build time | ~1 sprint | ~1 afternoon |
| Ongoing ops | Permanent service to run & monitor | None |
| Freshness | Indexing lag, reorg handling | Chain head, always |
| Rebasing/FoT tokens | Silently wrong | Correct by construction |
| Adding token #41 | Manifest edit, redeploy, re-sync | One line in a config array |

The engineer's instinct — "an index makes it accurate" — is a good instinct applied to
the wrong question. Indexing is how you make *historical and aggregate* data accurate.
For current balances, the contract is already the index, and it's perfectly maintained
by the chain itself. Ship the multicall.
