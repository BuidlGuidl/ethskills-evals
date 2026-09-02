# Why all four symptoms are the same bug

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

No block number. That single omission causes all four.

`createSelectFork` with no block forks at **whatever the chain head is at the moment
`setUp()` runs**. Your tests are not running against a fixed snapshot of mainnet — they
are running against live mainnet, re-sampled on every CI job. Everything else follows.

## 1. The sudden reds

The tests that broke are exactly the ones that assert on real-world values: a Chainlink
`latestRoundData()` price and a Uniswap pool's reserves. Those numbers change every
block. Your assertions were written against the values that happened to be true on the
day the tests were authored, and they have been drifting ever since. This morning the
drift crossed whatever bound your assertion uses — a hardcoded expected price, a
`assertApproxEqRel` tolerance, a liquidity threshold, or a Chainlink staleness check
comparing `updatedAt` to `block.timestamp`.

Nothing changed in your repo. Mainnet changed. Your tests were always going to fail on
some morning; you just found out which one.

## 2. The flakiness on re-run

Between two runs of the same commit, the head block is different. Sometimes the new
head's price is back inside the bound, sometimes it isn't — so the same commit passes
and fails. Two extra sources of nondeterminism stack on top:

- **Load-balanced providers.** Your RPC URL resolves to a pool of nodes. They are not
  all at the same height. Two `eth_blockNumber` calls seconds apart can go backwards.
- **Per-test-contract drift.** Every test contract's `setUp()` resolves head
  independently, so within one `forge test` invocation different test files can be
  forked at different blocks.

## 3. The steady slowdown

This is the mechanical tell, and it is the part most people miss.

Foundry caches fork RPC responses on disk under `~/.foundry/cache/rpc/<chain>/<block>/`,
keyed by block number. **The cache is only usable for a pinned block.** When you fork at
latest, every run is a new block number, so every run is a 100% cache miss. Every storage
slot, every account, every code fetch goes over the network, every time.

That baseline cost then grows: as mainnet state grows and as your suite grew over four
months, the number and latency of those uncached `eth_getStorageAt` / `eth_call` round
trips grew with it. A pinned suite gets *faster* over time as its cache fills. An unpinned
one only ever gets slower.

## 4. The 429s

Same cause. Zero cache hits means a sustained burst of hundreds-to-thousands of RPC calls
per CI job, and you have more tests than you did four months ago. You crossed your free
tier's rate limit.

And the 429s feed back into symptom 2: a throttled call mid-test surfaces as a failed
read, a zero value, or a revert from the fork backend — a *different* flaky failure mode
layered on top of the drift.

---

# The fix

## Pin the block

```solidity
contract ForkTest is Test {
    // Mainnet, chosen 2026-08-27. Bump deliberately, in its own PR.
    uint256 constant FORK_BLOCK = 23_400_000;

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
    }
}
```

Optionally register the alias so the URL lives in one place:

```toml
# foundry.toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
```
```solidity
vm.createSelectFork("mainnet", FORK_BLOCK);
```

That one argument fixes all four: the Chainlink price and the pool reserves become
constants, re-runs are byte-identical, the RPC cache starts hitting, and request volume
collapses to near zero after the first warm run.

Do **not** set `no_storage_caching = true` in `foundry.toml`, and do not pass
`--no-storage-caching`. That disables the thing doing the work here.

## Cache the RPC directory in CI

Pinning makes the cache *possible*; caching in CI is what makes it actually free.

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.foundry/cache/rpc
    key: foundry-rpc-mainnet-${{ env.FORK_BLOCK }}
```

Key it on the block number so bumping the pin invalidates cleanly. After the first warm
run, CI makes essentially no RPC calls — which independently kills the 429s.

## Fix the assertions while you are in there

Pinning makes exact assertions *legitimate* — at a fixed block the price really is one
number. But split them by intent:

```solidity
// Regression guard: exact, valid only at FORK_BLOCK. Update when you bump the pin.
function test_ChainlinkPriceAtPin() public view {
    (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
    assertEq(answer, 3_142_15000000);
    assertEq(updatedAt, 1_756_2xx_xxx); // deterministic once pinned
}

// Property: must hold at any block. Survives a pin bump.
function test_PriceIsFreshAndPositive() public view {
    (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
    assertGt(answer, 0);
    assertLe(block.timestamp - updatedAt, 1 hours); // feed heartbeat
}
```

Same for the pool: one exact-reserves regression test, plus property tests (`k` holds
across a swap, price is inside a sane band, `token0 < token1`) that survive a pin bump.
Right now every one of your assertions is silently in the first category while being
written as if it were in the second.

Also: bumping `FORK_BLOCK` should be its own PR, reviewed, with the exact-value
assertions updated in the same diff. That converts "mainnet moved and CI went red at
09:00" into "we chose to move and here is the diff."

---

# Does this work on a free-tier endpoint?

**Partly. The pinning itself is free. Reading state at a pinned block may not be.**

Be plain about the requirement: forking at a block more than roughly **128 blocks behind
head (~25 minutes)** needs **archive access** — the provider must serve `eth_getStorageAt`,
`eth_call`, `eth_getBalance` and `eth_getCode` at historical block heights. Full nodes
prune state past that window and will refuse.

Free tiers differ, and you cannot reason it out from the plan name — some free tiers
include archive data, some sell it as an add-on, and most public/community endpoints are
pruned. **Test yours**, don't assume:

```bash
# Pick a block a few days old, not a few minutes old.
cast call 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 "totalSupply()(uint256)" \
  --block 23400000 --rpc-url "$MAINNET_RPC_URL"

cast storage 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 0 \
  --block 23400000 --rpc-url "$MAINNET_RPC_URL"
```

- Returns a number → you have archive. Pin and you are done.
- Errors with `missing trie node`, `state is not available`, `header not found`,
  `Unsupported method`, or a bare `-32000` → **not archive**, and this is exactly how you
  would tell.

Note the failure is quiet-ish in Foundry: a non-archive endpoint typically shows up as a
`setUp` failure or as reads returning zero, not as an obvious "archive required" message.
Run the `cast` check directly so you get the real error text.

## If it is not archive

Options, best first:

1. **Move to a free tier that includes archive.** This is the cheapest real fix; several
   providers include historical state on their free plan. Verify with the `cast` command
   above before switching the CI secret.
2. **Warm the cache once from an archive endpoint, then commit or CI-cache it.** Once
   `~/.foundry/cache/rpc/mainnet/23400000/` is populated for every slot your tests touch,
   Foundry serves them from disk and never calls the RPC — so the *steady state* needs no
   archive at all. You only need archive access once, from one machine, to generate it.
   Caveat: the cache must be complete. A new test touching an uncached slot falls through
   to the network and fails on a pruned node. That makes it a real dependency to manage,
   not a free lunch — but for a stable suite it works, and it also makes CI fully offline
   and immune to 429s.
3. **Stop forking for the oracle assertions.** The Chainlink tests mostly do not need real
   mainnet — they need a deterministic feed. Deploy a mock aggregator, or `vm.mockCall`
   the feed, and assert your contract's *handling* of stale rounds, negative answers, and
   decimals. Keep the fork for the Uniswap integration where real pool math matters.
4. **Pin to a recent block within the ~128-block window.** Works on a pruned node but is
   *not* deterministic — the window moves and a block that resolved yesterday is gone
   today. This trades one flake for another. Only as a stopgap.

---

# Summary

| Symptom | Cause |
|---|---|
| Sudden reds | Assertions against live mainnet values that drifted past their bound |
| Flaky re-runs | Head block differs per run; load-balanced nodes disagree on height |
| Slowdown | Unpinned fork ⇒ Foundry's RPC cache can never hit ⇒ every read is a network call |
| 429s | Same — zero cache hits × a growing suite exceeded the free-tier rate limit |

One line changes: add the block number. Then cache `~/.foundry/cache/rpc` in CI, and split
your assertions into pinned-exact regression checks and block-independent property checks.

Confirm archive support with the `cast call --block` check before you rely on the pin.

---

## Unresolved

- Which block to pin to? Suggest a recent-but-settled one (a few days old); tell me and I
  will update the exact-value assertions.
- Who is the RPC provider? Determines whether the free tier has archive without switching.
- Are the three failing tests' expected values hardcoded literals or tolerance-based? Changes
  how much of the assertion rewrite is needed.
