# Fork tests: one root cause, four symptoms

## The line

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

No block argument. That overload forks at **`latest`**. Every CI run — every *re-run* of the
same commit — forks a different block, minutes or hours of mainnet apart. The tests have no
fixed input. Nothing about them was ever deterministic; you just hadn't drifted far enough
to notice.

All four symptoms fall out of that one fact.

## 1. The sudden reds

The assertions encode values that were true on the day they were written. But at `latest`:

- Chainlink `latestRoundData()` re-publishes on deviation threshold or heartbeat — the answer
  moves whenever the market moves.
- Uniswap `getReserves()` changes on **every swap**, i.e. potentially every block.

Whatever margin those assertions had (exact value, or a hardcoded band), four months of price
drift finally walked outside it. Nothing "broke" this morning. The world moved and the test
was measuring the world.

The tell that this is drift and not a code change: nobody touched the code, the deps, or CI.
The only input that changed is the one you never pinned.

## 2. The flakiness on re-run

Re-running forks at a *new* `latest`. If the live price/reserves happen to land back inside
the assertion's band, it's green; next block, red again. Same commit, different answer —
because the commit was never the whole input.

There is a **second**, independent flakiness channel here too, see §4.

## 3. The slowdown

Foundry caches fork RPC responses on disk, keyed by **chain + block number**:

```
~/.foundry/cache/rpc/mainnet/<block>/storage.json
```

Pin the block and the second run is nearly free. Fork at `latest` and every run resolves to a
block number it has never seen, so the cache hit rate is **0%, permanently**. Every account
load, every `eth_getStorageAt` for every storage slot your tests touch, every `eth_call` — a
cold network round trip, every time.

That cost scales with how much state the suite touches. Over four months you added tests,
added contracts, touched more slots. Request count grew monotonically; wall-clock grew with
it. The suite didn't get slower because the code got slower — it got slower because it was
doing more network I/O, and none of it was ever amortized.

(As a bonus, `~/.foundry/cache/rpc/mainnet/` has been accumulating one write-only directory
per CI run for four months.)

## 4. The 429s

Same curve, one threshold later. Request volume per run climbed until it crossed your
provider's free-tier rate limit. That's why the 429s showed up *last week* and not on day
one — you were under the limit, and then you weren't.

And 429s feed straight back into the reds. Foundry retries a throttled fork request with
backoff (slower still); when the retries are exhausted, the fork read fails and the test
**errors out**. That looks identical to a flaky assertion in the CI log, but it's a different
bug. Both disappear under the same fix, for different reasons.

So the causal chain is:

```
no pinned block
  ├── nondeterministic state ──────────► reds + pass/fail on re-run of same commit
  └── 0% cache hit rate ──► more RPC calls per run
                             ├── slowdown (grows as suite grows)
                             └── crosses rate limit ──► 429s ──► retry backoff (slower)
                                                              └► exhausted retries ──► more reds
```

---

# The fix

## Pin the block

```solidity
// test/ForkBase.sol — one place, all fork tests inherit it
abstract contract ForkBase is Test {
    // Pinned mainnet block. Bump deliberately, in a PR, updating expected values below.
    uint256 internal constant FORK_BLOCK = 23_000_000; // pick a real, finalized block

    function setUp() public virtual {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
    }
}
```

That's the change. Everything else below is making it stick.

## Re-derive the expected values at that block, exactly

Pinned state is exact, so the assertions should be exact too — drop the tolerance bands, they
were only ever papering over the nondeterminism.

```bash
# Chainlink ETH/USD aggregator proxy
cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 "latestRoundData()" \
  --block $FORK_BLOCK --rpc-url "$MAINNET_RPC_URL"

# your pool
cast call $POOL "getReserves()" --block $FORK_BLOCK --rpc-url "$MAINNET_RPC_URL"
```

Paste the results in as constants next to `FORK_BLOCK`. They now change only when a human
bumps the pin.

## Keep the URL in config, not scattered in envString

```toml
# foundry.toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"

[profile.default]
# throttle below the free tier's ceiling; default is 330
compute_units_per_second = 100
```

Then `vm.createSelectFork("mainnet", FORK_BLOCK)`.

## Persist the cache in CI

With the block pinned, the cache is finally reusable across runs — but only if CI keeps it.

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.foundry/cache/rpc
    key: foundry-rpc-${{ hashFiles('test/ForkBase.sol') }}
```

Keying on the file that holds `FORK_BLOCK` means bumping the pin invalidates the cache
automatically. **A fully warm pinned fork makes essentially zero RPC calls.** That is what
actually kills the slowdown and the 429s — not the throttle, which is just a seatbelt for the
cold run.

## Do NOT

Do not "fix" this by widening the assertion bands, or by pinning to `block.number - 100` at
runtime. The second one looks like pinning and isn't — it's still a moving input, and it also
walks into the archive problem below within ~25 minutes.

---

# Does this work on a free-tier endpoint?

**Partly yes, and the caching/rate-limit half is strictly better on free tier than what you
have now.** But pinning introduces one requirement your current setup never had, and free
tiers are exactly where it bites.

## What it needs: archive state access

Reading `latestRoundData()` or `getReserves()` at a pinned historical block is an `eth_call`
*at that block*, and Foundry's slot loads are `eth_getStorageAt` *at that block*. Both need
the **state trie** at that block, not just the header.

A default full node (geth) prunes state and keeps only roughly the last **128 blocks** —
about 25 minutes of mainnet. Serving your pin requires an **archive node**. Forking at
`latest` never needed this, which is why the problem is invisible until you pin.

Some free tiers include mainnet archive; some don't; some gate it behind a plan flag and
return a confusing error rather than a clear one. Don't trust the pricing page — probe it.

## How you'd tell — run this

Pick a block that is safely older than 128 blocks (weeks old is ideal, so you're testing
archive and not luck):

```bash
# 1. historical state read — this is the one that matters
cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 "latestRoundData()" \
  --block 19000000 --rpc-url "$MAINNET_RPC_URL"

# 2. cheaper confirmation
cast balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \
  --block 19000000 --rpc-url "$MAINNET_RPC_URL"
```

- **Both return values** → you have archive. Pin and you're done.
- **Either fails** → not archive (or it's gated). Signatures to expect:
  - `missing trie node ...`
  - `-32000: header not found`
  - `missing state for block` / `state is not available, lowest is <N>`
  - `-32601 method not supported` or an HTTP 402/403 → archive exists but your plan is
    excluded from it

Sanity check on the probe itself: run the same two commands with `--block latest`. If those
work and the historical ones don't, it's the archive requirement, not a broken URL or a dead
key.

## If it turns out not to be archive

Two options, in order of preference.

**A. Warm the cache once from an archive endpoint, then run CI without one.** Cache is keyed
by block, so once `~/.foundry/cache/rpc/mainnet/23000000/` is populated, a pinned run needs no
network at all. Warm it locally against any archive endpoint (a free archive tier, or one
throwaway paid call), commit it or seed the CI cache, done.
*Caveat:* the cache must be **complete**. The first test that touches a storage slot not in
the cache goes to the network and fails on a non-archive provider — so this breaks loudly on
new tests rather than silently. Re-warm whenever you add fork tests. Sharp edge, but a visible
one.

**B. Stop needing live state.** Mock the price feed (`vm.mockCall` on `latestRoundData`, or a
`MockV3Aggregator`) and deploy a local pool with reserves you choose. Fully deterministic,
zero RPC, works on any endpoint or none. The tradeoff is real: you're now testing your
integration wiring, not real mainnet state. Good for the price-assertion tests; worth keeping
one pinned real-fork test as a smoke check if you can get archive at all.

---

# Unresolved

- Which block to pin? Wants to be recent enough to reflect current mainnet deployments, old
  enough to be finalized and archive-safe. Suggest a specific one and I'll derive the expected
  values.
- `FORK_BLOCK` as a hardcoded constant vs `vm.envOr("FORK_BLOCK", ...)`. Hardcoded is more
  honest — bumping it should be a reviewed diff, not an env var someone sets in CI. Say if you
  want it configurable.
- Are the three failing tests asserting *exact* values or *bands*? Changes whether the fix is
  "re-derive constants" or "delete the band and re-derive constants".
- Which provider is behind `MAINNET_RPC_URL`? Determines whether the archive probe is a
  formality or the crux of this.
