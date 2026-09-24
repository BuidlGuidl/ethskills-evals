# Why the fork tests went red, flaky, slow, and rate-limited

## The single cause

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));   // no block number
```

With no second argument, Foundry resolves the fork to **whatever the chain head is at the
moment the test runs**. The tests are not running against a fixed state — they are running
against live mainnet, re-resolved on every CI job. All four symptoms fall out of that one
fact.

**1. The sudden reds, on untouched code.** The two failing tests assert on a Chainlink
answer and on a Uniswap pool's reserves. Both are live, moving values. Nothing in your
repo changed this morning; the price moved, or the pool got traded against, far enough
that a hardcoded expected value (or a tolerance band tuned months ago) stopped holding.
The test was always going to fail eventually — it was a bet on the market staying inside a
range, and the bet came due today. That is also why it is exactly those two tests and not
the rest of the suite.

**2. Green on re-run, same commit.** Each re-run pins to a *new* head block. Chainlink
feeds update on deviation/heartbeat and Uniswap reserves change per swap, so consecutive
runs sample different states. Some samples land back inside the assertion's range. The
commit is not passing and failing — the input is different each time, and the commit never
had a defined input at all.

**3. The four-month slowdown.** Foundry caches fork RPC responses on disk, keyed by
`(chain id, block number, address, slot)`. A pinned block hits that cache on every run
after the first and the suite runs nearly offline. An unpinned fork asks for a block number
that has never been seen before, so **every state read is a cache miss, every run**. The
cache directory grows without ever being reused, and total wall time is dominated by
round-trips to the provider. The steady slowdown tracks your suite growing more fork reads
over four months, each one now a guaranteed network call.

**4. The 429s.** Same mechanism, one step further. Cache-miss-on-everything means each CI
job issues hundreds of `eth_getStorageAt` / `eth_call` / `eth_getBlockByNumber` requests to
a free-tier endpoint with a compute-unit budget. As the suite grew you crossed the rate
limit. Note the feedback loop: a 429 mid-run can surface as yet another spurious failure,
which prompts a re-run, which spends more budget.

So: unpinned fork → live inputs (reds + flake) → no cache reuse (slow) → request volume
(429s). One root cause, four faces.

## The fix

Pin the block. Every fork test, same block, checked into the repo:

```solidity
uint256 constant FORK_BLOCK = 23_400_000;   // pick and pin; see below

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
}
```

At a pinned block the Chainlink `latestRoundData()` answer and the pool's reserves are
fixed values, forever. You can then assert on them exactly rather than with a tolerance
band, and the assertion becomes capable of failing for a real reason — a change in *your*
integration code — instead of failing because the market moved. After the first run the
Foundry cache serves the whole suite, which takes the slowdown and the 429s with it.

Two things to do alongside the pin:

- **Re-derive the expected values at `FORK_BLOCK`.** Today's hardcoded numbers were written
  against a different state. Read the real values at the pinned block once and write those
  in — or, better, assert a property that does not depend on the exact number (the
  Chainlink round is fresh and positive, the pool's `x*y` is preserved across your swap,
  your quoter output matches the pool's own quote) so the test survives a future re-pin.
- **Treat the block number as a deliberate, versioned choice.** Bumping it is a code change
  that goes through review with the expected values updated in the same commit — not
  something that happens silently in CI at 3am.

## Does this work against a free-tier endpoint? Read this part.

**Honest answer: it depends on whether that endpoint serves archive state, and the URL does
not tell you.**

Pinning an old block turns every state read into an *archive* request. A full node retains
recent state only — geth's default is roughly the last 128 blocks — and answers anything
older with an error such as `missing trie node` or `header not found`, not a wrong number.
Archive depth is a property of the node and the plan behind it. Some free tiers (Alchemy's,
notably) do serve full archive; others cap historical lookback or exclude archive methods
entirely.

**What you need:** historical state access at `FORK_BLOCK` — specifically `eth_call` and
`eth_getStorageAt` against a past block tag — plus enough request budget for one uncached
run.

**How to tell, in ten seconds, before you commit the pin:**

```bash
cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 "latestRoundData()" \
  --block 23400000 --rpc-url "$MAINNET_RPC_URL"
```

(that address is the Chainlink ETH/USD feed). If it returns data, the endpoint serves your
block and the pin is safe. If it errors with `missing trie node`, `header not found`,
`state not available`, or a "archive data not supported on your plan" style message, it
does not — and your tests would then fail for a reason that has nothing to do with your
contract. Re-run the same check with a couple of older blocks to find where the window ends.

**If the endpoint turns out not to serve archive**, in order of preference:

1. **Pin a recent block instead.** The pin's value is determinism, not antiquity. A block
   from a few days ago is as reproducible as one from 2023 and is inside almost any
   provider's retention. You will need to re-pin occasionally as the window slides past it
   — an explicit, reviewed commit each time, which is still strictly better than today.
2. **Use a second endpoint for fork tests.** An archive-capable free tier (Alchemy) or a
   paid key held as a CI secret, separate from whatever `MAINNET_RPC_URL` points at.
3. **Only as a last resort, cache-and-commit.** Foundry's `~/.foundry/cache/rpc` entries can
   be vendored into the repo so CI never calls out. It works and makes CI fully hermetic,
   but it is a bulky, opaque artifact to maintain — reach for it only if 1 and 2 are closed.

Do not resolve this by dropping the fork and mocking Chainlink and Uniswap. A mock encodes
your assumption about the dependency and will answer in the standard shape every time,
which is precisely what a fork test exists to check. The fork is the right tool; it just
needs a fixed block under it.
