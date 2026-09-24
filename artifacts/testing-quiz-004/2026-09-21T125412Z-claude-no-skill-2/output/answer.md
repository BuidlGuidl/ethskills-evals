# Why all four symptoms are the same bug

## The single cause

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

This overload takes no block number, so it forks **whatever `latest` happens to be at the
moment the test runs**. Your test suite has no fixed input. Every CI run is a fresh
experiment against a different chain state, roughly 12 seconds newer than the last one.

Nothing in your repo changed, and nothing needed to. The thing that changed is mainnet.

## Symptom by symptom

**The sudden reds, only on the Chainlink and Uniswap tests.** Those two assertions are the
only ones in your suite that read *live, mutating* state. A Chainlink aggregator's
`latestRoundData()` answer changes on every deviation-threshold or heartbeat update; a
Uniswap pool's reserves change on every swap. Everything else you assert on — ERC-20
decimals, immutable addresses, deployed bytecode — is stable across blocks, so those tests
never noticed the fork was unpinned. Your price/reserve assertions were written against
whatever the values were four months ago, with some tolerance band or hardcoded expectation.
For four months the live values stayed inside that band. This morning they walked out of it.
The tests didn't break; they finally started reporting a mismatch that was always possible.

**Green on re-run, red on the next run, same commit.** A re-run forks a *different* latest
block. If the value has drifted to sit right on the edge of your tolerance — or if the pool
reserves oscillate around the boundary as swaps land in either direction — consecutive runs
land on opposite sides of the assertion. "Same commit passes and fails" is not flakiness in
your code; it's two different inputs being fed to the same code. The commit is fixed; the
block isn't.

**The four-month slowdown.** Foundry caches fork RPC responses on disk keyed by
`(chain id, block number, address, slot)`, under `~/.foundry/cache/rpc/mainnet/<block>/`.
That cache only pays off when you ask for the same block twice. Because your block number
advances every run, **every run is a 100% cache miss** — every storage slot, every account,
every code fetch goes out over the network. So the wall-clock time of your fork tests is
purely a function of how many RPC round-trips they make, and that number has grown as you've
added tests and as the contracts you touch have grown more state-hungry. Nobody made
anything slower; you simply never had the cache working, and the uncached cost has been
climbing. (If CI also has a cold `~/.foundry/cache` each job, a pinned fork would still miss
on the first run — but see the caching note below.)

**The 429s.** Direct consequence of the above. Zero cache hits × a growing test suite × any
parallelism `forge test` gives you = a request rate that finally crossed your provider's
free-tier rate limit last week. The 429s are the network telling you the suite is now issuing
more eth_call/eth_getStorageAt traffic than the plan allows. And note the second-order
effect: a 429 mid-test surfaces as an RPC error, which is yet another way a run flips red
without a code change.

So: one root cause (no pinned block), four faces. Non-determinism in the assertions,
non-reproducibility across re-runs, a dead cache, and rate-limit pressure from the dead cache.

## The fix

Pin the block. Put it in `foundry.toml` so it's reviewable and changing it shows up in a diff:

```toml
# foundry.toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"

[etherscan]
# ...
```

```solidity
// Pinned deliberately. Chainlink answers and Uniswap reserves are asserted against
// this block's state; bumping it means re-deriving the expected values below.
uint256 constant FORK_BLOCK = 21_000_000; // pick a real recent block and record it

function setUp() public {
    vm.createSelectFork(vm.rpcUrl("mainnet"), FORK_BLOCK);
}
```

Two things to do alongside the pin, or the pin only half-helps:

1. **Re-derive the expected values at that exact block and assert them exactly.** Once the
   block is fixed, `latestRoundData()` returns one specific answer and `getReserves()` returns
   one specific pair, forever. Replace tolerance bands (`assertApproxEqRel(price, 3000e8, 0.05e18)`)
   with the literal values. A tolerance band on a pinned fork is just a wider target for a
   future bug to hide in. Get them with:
   ```bash
   cast call <aggregator> "latestRoundData()" --block 21000000 --rpc-url "$MAINNET_RPC_URL"
   cast call <pair> "getReserves()"           --block 21000000 --rpc-url "$MAINNET_RPC_URL"
   ```

2. **Persist `~/.foundry/cache/rpc` in CI.** Now that the key is stable, caching actually
   works. In GitHub Actions:
   ```yaml
   - uses: actions/cache@v4
     with:
       path: ~/.foundry/cache/rpc
       key: foundry-rpc-${{ hashFiles('foundry.toml') }}-21000000
   ```
   After the first warm run, your fork tests make close to zero RPC calls. That is what kills
   both the slowdown and the 429s. You can even commit the cache directory for a small suite;
   most teams cache it in CI instead.

If different tests need different blocks (e.g. one test needs a post-upgrade state), give each
its own `createSelectFork(url, blockN)` — multiple pinned blocks are fine, multiple *unpinned*
ones are the problem.

A pin is a dependency. Bump it on purpose, in its own PR, re-deriving the expected values in
the same diff — never as a drive-by.

## Does this work against a free-tier endpoint?

**Partly, and the part that might not work has a name.** Be clear-eyed about this.

Pinning a block requires the node to answer `eth_call`, `eth_getStorageAt`, `eth_getCode` and
`eth_getBalance` **at a historical block number**. That is an *archive* capability. A
non-archive (full) node keeps state trie data for only the most recent ~128 blocks — roughly
25 minutes of mainnet. Beyond that, the state is pruned and the node cannot reconstruct it.

So the outcome depends on your provider's free tier:

- **Free tier includes archive access** (Alchemy's free tier historically does; some others
  do too, subject to compute-unit limits) → the fix works as written, unchanged.
- **Free tier is full-node only** → forking a block from last week fails outright, and forking
  "recent enough" is useless because the pin expires within the hour.

**What you need, named:** archive-node state access — historical `eth_call` / `eth_getStorageAt`
at an arbitrary past block. Not `debug_traceTransaction`, not `trace_*`; Foundry forking doesn't
need those. Just historical state reads.

**How to tell, in ten seconds.** Pick a block that is definitely older than 128 blocks — say
1000 blocks back — and ask for state there:

```bash
LATEST=$(cast block-number --rpc-url "$MAINNET_RPC_URL")
cast balance 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --block $((LATEST - 1000)) --rpc-url "$MAINNET_RPC_URL"
```

- Returns a number → **you have archive access.** Pin freely.
- Returns `missing trie node`, `header not found`, `state at block ... not available`,
  `Node is not an archive node`, or a `-32000`-class error mentioning archive/pruned →
  **you do not.** That message is the signal.

Repeat it against the block you actually intend to pin, since some providers cap archive
depth rather than refusing outright.

**If you don't have it,** the honest options, best first:

1. **Upgrade the endpoint.** Archive access on a free/cheap tier is available from several
   providers; this is a five-minute fix and the only one that keeps your tests as fork tests.
   Given that you're already hitting 429s, you likely need a plan change regardless.
2. **Stop forking for these two assertions.** Replace the live Chainlink feed with a mock
   aggregator returning a fixed answer, and deploy a Uniswap pair locally seeded with known
   reserves. This is the better test anyway: you almost certainly want to verify *your*
   contract's math given a price, not that mainnet's price is a particular number. Determinism
   for free, zero RPC calls, no archive requirement. Keep a small pinned-fork smoke test
   (integration-gated, allowed to be skipped when the RPC is unavailable) for genuine
   integration coverage.
3. **Check in the fork cache.** If you can pin *once* right now while the state is still
   within the pruning window, run the suite, and commit `~/.foundry/cache/rpc/mainnet/<block>/`
   to the repo, CI replays from disk and never queries the node again. Fragile — any new
   storage slot a future test touches is a miss against a node that can no longer serve it —
   but it does unblock you today.

Option 2 is what I'd reach for on the price/reserve assertions specifically, independent of
what your endpoint supports. Pinning makes those tests deterministic; mocking makes them
deterministic *and* stops them depending on an external service at all. The pin is still worth
doing for the rest of the fork suite.
