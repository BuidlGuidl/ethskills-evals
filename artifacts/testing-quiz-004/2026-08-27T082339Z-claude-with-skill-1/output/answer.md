# Fork tests: one root cause, four symptoms

## The single line that explains all four

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

No block number. Foundry resolves this to **`latest`** — whatever mainnet's head is at
the moment CI runs. Your test inputs are not in the repo. They are the live chain.

Everything below falls out of that.

### 1. Sudden reds (Chainlink price, Uniswap reserves)

Those are exactly the two tests that assert on values mainnet is free to change.
Chainlink ETH/USD pushes a new round on 0.5% deviation or a 1h heartbeat; a Uniswap
pool's reserves change on every swap. Whatever literal or band you baselined four
months ago finally stopped containing the live value — a price move this morning, or
enough cumulative trading to walk the reserves out of range.

Four months green was not correctness. It was the market staying inside your band.
The tests were always going to go red; the only question was which day.

### 2. Flakiness on re-run, same commit

Each re-run forks a *different* head. Between two re-runs 12 minutes apart the
aggregator may or may not have pushed a new round, and the pool may or may not have
been swapped. Pass/fail depends on which block you happened to land on.

Two smaller contributors on top:
- Load-balanced RPC endpoints can serve block N from one node and N-1 from another,
  so even a single run isn't internally consistent if you create more than one fork.
- `latest` is unfinalized. You can fork a block that gets reorged out.

### 3. Steady slowdown over four months

Foundry caches fork RPC responses on disk, keyed by **(chain, block number)**:
`~/.foundry/cache/rpc/mainnet/<block>/`. Pin the block and the second run is nearly
free. Fork at `latest` and the key is new every single run — **the cache never hits.**
Every `eth_getStorageAt`, `eth_getCode`, `eth_getBalance` for every test is a cold
network roundtrip, every time.

So wall time scales with (number of fork tests) × (state each touches). You added
tests over four months; the curve is that growth, uncached. If CI caches
`~/.foundry/cache/rpc`, it also grows a new directory per run forever — restore/save
time climbs monotonically too. Both mechanisms point the same direction.

### 4. HTTP 429s starting last week

Same cause, one step further along the same curve. Cold-cache request volume grew
until it crossed the free tier's rate limit. `forge test` runs test contracts in
parallel threads, so the requests arrive bunched, which crosses a per-second limit
well before you'd cross a per-month quota.

Note the 429s are *mostly* a separate failure mode from the reds: a 429 during
`setUp` fails every test in the contract with an RPC error, not three tests with
assertion mismatches. If your three reds show numeric mismatches, that's drift. If
they show `429`, `Too Many Requests`, or JSON-RPC client errors, that's throttling.
Check the actual failure text — you likely have both, and they share a root cause.

---

## The fix

### Step 1 — pin the block (this is the whole fix; the rest is hygiene)

```solidity
contract ForkTest is Test {
    // Pinned 2026-08-27. Bump deliberately, in its own PR, re-baselining literals.
    uint256 constant DEFAULT_FORK_BLOCK = 21_525_000;

    function setUp() public {
        uint256 forkBlock = vm.envOr("FORK_BLOCK", DEFAULT_FORK_BLOCK);
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), forkBlock);
    }
}
```

`envOr` keeps it pinned by default while letting you probe another block locally
without editing code. Pick a block a few thousand deep, not near head, so it's
final and well past any pruning boundary.

Also confirm CI isn't passing `--no-storage-caching` (or `no_storage_caching = true`
in `foundry.toml`) — that disables the cache the pin exists to enable.

### Step 2 — assert properties, keep literals only where they're the point

At a pinned block, `latestRoundData()` is a fixed tuple and `getReserves()` is a
fixed pair, so exact equality is now *legitimate*. But every literal is a re-baselining
chore the next time you bump the pin. Split it:

```solidity
// Property: true at any block. Survives pin bumps.
function test_OracleIsFreshAndSane() public view {
    (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) =
        AggregatorV3Interface(ETH_USD_FEED).latestRoundData();
    assertGt(answer, 0, "non-positive price");
    assertGe(answeredInRound, roundId, "stale round");
    assertLe(block.timestamp - updatedAt, 1 hours, "older than heartbeat");
}

// Property: pool tracks the oracle. No reserve literals.
function test_PoolQuoteTracksOracle() public view {
    (uint112 r0, uint112 r1,) = IUniswapV2Pair(PAIR).getReserves();
    assertGt(r0, 0);
    assertGt(r1, 0);
    assertApproxEqRel(_quote(r0, r1, 1e18), _oraclePrice(), 0.02e18, "pool vs oracle > 2%");
}

// Literal: this is a fact about FORK_BLOCK, not about "today". Deterministic now.
function test_VaultValuesCollateralCorrectly() public view {
    assertEq(vault.collateralValue(1e18), 3_412_09871234);
}
```

Caveat on the staleness check: it reads `block.timestamp`, which at a pinned block is
that block's timestamp — fine. But if any test does `vm.warp(block.timestamp + 1 days)`
the oracle will correctly look stale. That's the check working, not a bug.

### Step 3 — make the cache actually persist in CI

With the block pinned, the cache key is stable, so this turns runs 2..n into near-zero
RPC calls. Fixes the slowdown and the 429s at once.

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.foundry/cache/rpc
    # run_id in the key so each run saves a fresh entry (GH cache entries are immutable);
    # restore-keys pulls the most recent one back.
    key: foundry-rpc-mainnet-21525000-${{ github.run_id }}
    restore-keys: foundry-rpc-mainnet-21525000-
```

Bump the block → new key → one cold run → warm again.

### Step 4 — throttle the cold run

Only matters for the first run after a pin bump, but it's what keeps that run off the
rate limit:

```bash
forge test --compute-units-per-second 100 --fork-retry-backoff 5
```

Foundry's default CUPS (330) is tuned for a paid Alchemy plan and will blow through a
free tier. Verify exact flag spelling against `forge test --help` for your version.

### Step 5 — move "does mainnet still work" off the PR gate

Add a nightly job that forks at `latest` and is allowed to fail. That's where you want
to learn that a feed got deprecated or a pool drained — as a notification, not as a
red PR on someone else's unrelated change.

---

## Does this work on a free-tier endpoint?

**Partly. Pinning a block requires archive state, and not every free tier serves it.**

A non-archive (pruned) full node keeps state for roughly the last 128 blocks — about
25 minutes. Historical `eth_getStorageAt` / `eth_getCode` / `eth_call` at a block older
than that will fail. Forking at `latest` worked precisely *because* it never asked for
history; that's the same reason it was non-deterministic. So the fix trades a
requirement you were implicitly avoiding.

**What you need, named:** archive-mode historical state reads at an arbitrary past
block — specifically `eth_getStorageAt`, `eth_getCode`, `eth_getBalance`, and `eth_call`
with a numeric block tag well outside the pruning window.

**How you'd tell — 30-second probe, run it before committing the pin:**

```bash
BLOCK=21525000
# WETH totalSupply at the pinned block
cast call 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 "totalSupply()(uint256)" \
  --block $BLOCK --rpc-url "$MAINNET_RPC_URL"

# raw storage read — the one pruned nodes reliably refuse
cast storage 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 0 \
  --block $BLOCK --rpc-url "$MAINNET_RPC_URL"
```

- Returns a value → archive state available. The fix works as written.
- `missing trie node`, `header not found`, `state not available`, `state is not
  available for block`, or an explicit "archive data requires a paid plan" → not
  archive. Do not trust the provider's pricing page over this probe; behavior varies
  by provider, by chain, and by plan generation.

Rate limits are the second free-tier constraint, but they're survivable: after the
Step 3 cache warms, steady-state RPC volume drops to roughly zero, and Step 4 covers
the one cold run.

**If the probe says non-archive**, in order of preference:

1. **Get an archive-capable free key.** Several providers include mainnet archive on
   their free tier; the probe tells you which of yours does. Cheapest fix by far.
2. **Vendor the fork cache.** `~/.foundry/cache/rpc/mainnet/<block>/` is plain JSON.
   Populate it once from any archive endpoint (a colleague's key, a one-off trial),
   commit it, and CI needs no archive access — or network access — at all. Fully
   hermetic. Cost: a few hundred KB to a few MB in the repo, and it must be
   regenerated on each pin bump.
3. **Drop the fork for the oracle tests.** A Chainlink round is five numbers; a
   `MockAggregator` or `vm.mockCall` gives you exact control over stale rounds,
   negative answers, and zero prices — cases you can't reach on a fork at all. Keep
   forking only where you genuinely need real protocol bytecode (the Uniswap
   integration path). This is arguably better testing regardless.

Do **not** work around it by pinning a block inside the 128-block pruning window. That
reintroduces the exact non-determinism you're fixing, plus a hard expiry.

---

## Unresolved

- Do the three reds show numeric mismatches or `429`/RPC errors? Determines whether
  you're fixing drift, throttling, or both.
- Which provider is behind `MAINNET_RPC_URL`? The probe answers the archive question
  regardless, but it also tells us whether option 1 is a one-line change.
- Is CI currently caching `~/.foundry/cache/rpc`? If yes, that directory is likely
  large and part of the slowdown — worth purging on the same PR.
