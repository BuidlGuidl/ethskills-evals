# Unpinned fork: one root cause, four symptoms

## The single cause

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

No block number. That one omission is the whole story.

Without a block argument the fork follows the chain head: every run resolves to
whatever block mainnet happens to be on at that moment. The tests are therefore not
running against a fixed state — they are running against live mainnet, sampled at
CI time. Nothing in your repo changed this morning. Mainnet did.

All four symptoms fall out of that.

**The sudden reds.** The three failing tests are exactly the ones that assert on
live-moving values: a Chainlink answer and a Uniswap pool's reserves. Chainlink
feeds push a new answer on every deviation threshold or heartbeat; Uniswap reserves
change on every swap. Whatever hardcoded expectation (or tolerance band) those
assertions carry was true of the market four months ago and has now drifted outside
it. The code is unchanged and still correct — the *fixture* moved out from under it.
Four months of green were four months of the value happening to stay in range, not
four months of evidence.

**The flakiness on re-run.** Re-running picks up a different head block, with
different reserves and possibly a different oracle round. The same commit passes and
fails because the input is different each time. A retry is a re-roll, not a fix — and
a test whose outcome depends on the roll is not a test, it just has a green-ish prior.

**The slowdown.** Foundry caches fork RPC responses on disk keyed by
(chain, block, address, slot). A pinned block hits that cache from the second run
onward and gets fast. A moving head *never* hits it: every CI run is a fresh block,
so every storage slot, every account, every call is fetched cold over the network,
and the cache directory grows without ever being read. That is why the suite has been
getting steadily slower rather than suddenly slower — it is network round-trips all
the way down, and the suite has grown over four months.

**The 429s.** Same mechanism, one step further. Zero cache hits means the full
`eth_getStorageAt` / `eth_call` / `eth_getBalance` traffic of every test goes to the
provider on every run. As the suite grew, that request count crossed your free-tier
rate limit, so you started getting throttled. The 429s are not a separate incident;
they are the cache miss rate billed back to you. Worse: a 429 in the middle of a run
can itself surface as a spurious failure, which is a second, independent source of
flake layered on the first.

So: one bug, four faces. Unpinned fork → nondeterministic state → drifting
assertions, retry-dependent results, no cache, and unbounded RPC volume.

## The fix

Pin the block.

```solidity
uint256 constant FORK_BLOCK = 19_000_000; // choose per note below

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
}
```

That is the change that makes the tests deterministic. With a pinned block:

- The Chainlink round and the Uniswap reserves are fixed values forever. The
  assertions become reproducible, and a red means your code changed, not that the
  market did.
- Re-running cannot change the answer.
- Foundry's cache hits from the second run on, so the suite gets dramatically faster.
- RPC volume collapses to roughly one cold run per cache, which is what gets you back
  under the free-tier limit and stops the 429s.

Two things to do alongside the pin:

1. **Re-derive the expected values at the pinned block**, don't port the old numbers
   over. Read the actual `latestRoundData()` answer and actual `getReserves()` at
   `FORK_BLOCK` and assert those. Carrying today's hardcoded constants to a block
   where they were never true just converts a flaky red into a permanent one.
2. **Warm the cache in CI.** Cache `~/.foundry/cache/rpc` (keyed on the pinned block)
   between jobs. Pinning makes the cache *usable*; persisting it across CI runs is
   what makes the savings show up in CI rather than only on your laptop.

Consider also asserting properties rather than snapshots where you can — e.g. that
the price is non-zero and the round is not stale relative to the fork timestamp, or
that `reserve0 * reserve1` matches the pool's own invariant. Those survive a
deliberate re-pin later. But pin first; property assertions on a moving head are
still nondeterministic, just less obviously so.

## Does this work against a free-tier endpoint? Read this part.

**Plainly: pinning requires archive access, and a free tier may well not have it.**

Pinning an old block turns every fork read into an *archive* request. A full node
retains only recent state — geth's default pruning window is roughly the last 128
blocks. Ask it for the storage of a Uniswap pool at block 19,000,000 and it does not
give you a stale answer, it gives you an error: `missing trie node`, or a provider
wrapper like "state at block N is not available" / "historical state not available on
this plan". Your tests then fail for a reason that has nothing to do with your
contracts.

Whether an endpoint serves archive depth is a property of the node and the plan behind
it. The URL does not tell you. Many free tiers do serve archive data (Alchemy's and
Infura's free tiers have historically allowed archive `eth_call`, at a higher compute
cost per request); others, especially self-hosted or budget endpoints, do not. Do not
assume either way.

**How to tell — check before you pin, not after:**

```bash
# Replace with your chosen block. Any long-lived contract works; WETH is convenient.
cast storage 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 0 \
  --rpc-url "$MAINNET_RPC_URL" --block 19000000

# Or an eth_call at depth:
cast call 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 "totalSupply()(uint256)" \
  --rpc-url "$MAINNET_RPC_URL" --block 19000000
```

A number back means archive depth is available at that block — pin it. An error
mentioning missing trie node, pruned, or historical/archive state means it is not.
Run the same command against the exact block you intend to pin, since some providers
serve a limited historical window rather than full archive: a block from last week may
work where one from last year does not.

**If archive is not available**, in rough order of preference:

1. **Get an archive endpoint.** A second env var (`MAINNET_ARCHIVE_RPC_URL`) used only
   by fork tests. Free archive tiers exist (Alchemy, Ankr, drpc, Llamanodes among
   others); this is usually a ten-minute fix and it is the right one.
2. **Pin to a recent block within the retention window** and bump it on a schedule.
   This is deterministic *for a while* — good enough to kill the flake today — but the
   pin silently rots when the block ages out of the window, so it needs a calendar
   reminder and it re-fetches cold every time you bump.
3. **Commit the cache.** Run the suite once against an endpoint that does have the
   state, then check `~/.foundry/cache/rpc/mainnet/<block>` into the repo (or a CI
   cache that never expires). CI then serves the pinned block from disk and never
   needs archive at all. Ugly, effective, and it makes CI independent of your provider.

What you should *not* do is leave the fork unpinned because the free tier balked at an
old block. That trades a loud, fixable configuration problem for the exact
nondeterminism you are trying to eliminate — and it leaves the 429s and the slowdown
in place, since those are the same bug.
