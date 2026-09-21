# The fork block is not pinned

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

That one-argument overload means **fork at whatever `latest` happens to be when the test
process starts**. Every CI run forks a different block. All four symptoms are downstream
of that single fact.

Your test suite has no fixed input. The chain is the input, and it changes every 12
seconds.

---

## How each symptom follows

### 1. The sudden reds

The three tests that broke are exactly the three that assert on *values that move*: a
Chainlink `latestRoundData()` answer and a Uniswap pool's reserves. Those assertions
encode a number (or a tolerance band around one) that was true of mainnet four months
ago when the test was written.

Chainlink aggregators only push a new answer on a deviation threshold or a heartbeat, and
Uniswap reserves change on every swap. For four months the live values stayed close
enough to whatever the assertions allow. This morning ETH — or whatever the feed tracks —
moved far enough that the live answer fell outside the band, and reserves drifted with
the arbitrage that followed. Nothing in your repo changed because the thing that changed
isn't in your repo.

The tests didn't start being wrong today. They have been non-deterministic since the day
they were written; today is just the first day the non-determinism was large enough to
cross an assertion boundary. Four green months were luck, not evidence.

### 2. The flakiness on re-run

Two reasons the same commit passes and fails:

- **Different head per run.** A re-run five minutes later forks a different block. If the
  price oscillates around your tolerance boundary, the result is a coin flip. Re-running
  until green is sampling until you get the answer you want.
- **`latest` is not well-defined across a load-balanced provider.** Your endpoint is a
  pool of nodes behind one URL. They are not all at the same head. Foundry resolves
  `latest` once at fork creation, but subsequent lazy state fetches for that block can
  land on a node that hasn't imported it yet (transient "header not found" / empty
  returns), and the head is unfinalized, so it can be reorged out from under you between
  the resolve and the fetch. That is a second, separate source of non-reproducibility
  layered on top of the first.

### 3. The steady slowdown

Foundry caches fork state on disk, keyed by chain and **block number**, under
`~/.foundry/cache/rpc/mainnet/<block>/storage.json`. That cache is what makes fork tests
fast on the second run.

Because every run pins a different block, **every run is a 100% cache miss**. Each test
pays full network latency for every `eth_getStorageAt`, `eth_getCode`, `eth_getBalance`
and `eth_call` it triggers — a Chainlink read alone walks the proxy, the aggregator and
several storage slots. You have never once benefited from the cache.

It got *steadily* worse rather than being uniformly slow because the suite grew: more
tests, more contracts touched, more cold slots per run, and a cache directory
accumulating a fresh subdirectory per CI run that is never read again. (Check its size —
it is probably alarming.)

### 4. The 429s

Same cause, one step further. A cold-cache fork run issues thousands of JSON-RPC
requests in a burst. Free tiers rate-limit on compute units per second, not just on
monthly totals, and archive-range `eth_getStorageAt` costs more units than a plain call.
As the suite grew, the burst crossed the provider's per-second ceiling and you started
getting throttled.

This also feeds back into symptom 2: a 429 in the middle of a test can surface as a state
read that fails or retries against a different node, which makes the flakiness worse than
price drift alone would explain.

**One root cause, four faces: an unpinned fork block.**

---

## The fix

### Pin the block

```solidity
// test/Fork.t.sol
contract ForkTest is Test {
    // Pinned deliberately. Bumping this block is a code change that
    // re-baselines the price/reserve assertions below. See "Rebasing" §.
    uint256 constant FORK_BLOCK = 23_400_000;

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
    }
}
```

Nicer: name the endpoint in `foundry.toml` so the URL isn't repeated in every test.

```toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
```

```solidity
vm.createSelectFork("mainnet", FORK_BLOCK);
```

Pick a block that is **finalized** (a few thousand blocks back is plenty — not something
from ten minutes ago) so it can never be reorged.

What this buys you, mapped back to the symptoms:

- The Chainlink answer and the pool reserves at block 23,400,000 are the same integers
  forever. Exact-equality assertions become legitimate — you can drop tolerance bands
  entirely and assert the real number.
- Re-runs are bit-identical. A red is a real red.
- The RPC cache hits from the second run onward. First run fetches, every run after that
  reads local JSON.
- Request volume collapses to near zero in steady state, which removes the 429s.

### Assert the right things

With the block pinned, split the assertions by intent:

```solidity
// Regression assertion — exact, pinned, no tolerance needed.
function test_OracleReadsPinnedPrice() public view {
    (, int256 answer,,uint256 updatedAt,) = AggregatorV3Interface(ETH_USD).latestRoundData();
    assertEq(answer, 2_431_09876543, "ETH/USD at FORK_BLOCK");
    assertEq(updatedAt, 1_726_9xx_xxx);
}

// Integration assertion — a property, survives a block bump.
function test_VaultPricesDepositAgainstOracle() public {
    (, int256 answer,,,) = AggregatorV3Interface(ETH_USD).latestRoundData();
    uint256 shares = vault.previewDeposit(1 ether);
    assertApproxEqRel(shares, uint256(answer) * 1e10, 0.001e18);
}
```

The second style is what most of your suite should be. Your integration logic does not
care what ETH costs; it cares that it consumes the oracle correctly. Property assertions
survive a block bump without a re-baseline, so bumping stops being painful.

Two traps to avoid at the same time:

- Don't `vm.warp()` far past `FORK_BLOCK`'s timestamp if your contract enforces oracle
  staleness (`block.timestamp - updatedAt < heartbeat`). The pinned feed will look stale
  and revert. Warp forward only in small, deliberate increments, or mock `updatedAt`.
- Don't `deal()` into a Uniswap pool and then read `getReserves()` — reserves come from
  the pool's own storage accounting, not its token balances. `sync()` or swap properly.

### Rebasing the pin

Bump `FORK_BLOCK` on a schedule you choose (quarterly, or when you integrate something
new), as its own PR. Exact-value tests get re-baselined in that PR; property tests should
pass untouched. The point isn't that the block is new, it's that changing it is a
reviewed, intentional act rather than something the clock does to you.

### Belt and braces for the 429s

In `foundry.toml`, throttle Foundry to stay under the free tier and back off instead of
failing:

```toml
[profile.default]
# Alchemy free tier is 330 CU/s; stay well under it.
compute_units_per_second = 200
fork_retries = 5
fork_retry_backoff = 1000  # ms, exponential
```

And cache the RPC cache in CI so even the first run of a job is warm:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.foundry/cache/rpc
    key: foundry-rpc-${{ hashFiles('**/ForkBlock.sol') }}-23400000
```

With a pinned block that key is stable, so the cache actually hits. That is only possible
*because* the block is pinned — it is the same fix again, not a separate one.

Also make sure you are not passing `--no-storage-caching` or setting
`no_storage_caching = true`, which would defeat all of this.

---

## Does this work on a free-tier endpoint? — the honest part

**Pinning to a historical block requires archive state access. A free-tier endpoint may
not have it.**

Here is the distinction that matters. A pruned/full node keeps the *headers* of all
blocks but only the recent **state trie** — typically the last **128 blocks** (~25
minutes) for a default geth node. Fork testing does not read headers; it reads state:
`eth_getStorageAt`, `eth_getBalance`, `eth_getCode` and `eth_call` **at your pinned
block**. Against a pruned node, anything older than ~128 blocks fails.

So:

- **If your endpoint serves archive state, the fix works as written, for free.** Alchemy's
  free tier includes archive access. So do several public endpoints (drpc, LlamaRPC, some
  Ankr tiers).
- **If it doesn't, you'll get an error — not a wrong answer.** Typically
  `missing trie node`, `state is not available`, `header not found`, or a bare
  `-32000`. Foundry surfaces it as a fork setup failure. This will be loud, not silent.
  Infura's free tier is the usual case here; historical state is a paid add-on.

Pinning to a block inside the 128-block window is **not** a workaround. The window is 25
minutes; your pin would go stale between merging the PR and the next CI run, and you'd be
back to non-determinism with extra steps.

### How to tell, in ten seconds

```bash
# Pick a block a few days old, then ask for state at it.
cast storage 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 0 \
  --rpc-url "$MAINNET_RPC_URL" --block 23400000
```

(That address is the ETH/USD aggregator proxy — the thing your failing test reads.)

- Returns a 32-byte hex word → **archive available, you're done.** Use that block.
- Errors with `missing trie node` / `state is not available` / `-32000` → **no archive.**

Cross-check with a balance read, which some providers gate separately:

```bash
cast balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \
  --rpc-url "$MAINNET_RPC_URL" --block 23400000
```

And confirm the pruning boundary directly — this should succeed even on a pruned node,
and its success alongside the failure above is the proof that pruning, not auth, is the
problem:

```bash
cast balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \
  --rpc-url "$MAINNET_RPC_URL" --block $(( $(cast block-number --rpc-url "$MAINNET_RPC_URL") - 20 ))
```

### If the answer is "no archive"

In rough order of effort:

1. **Switch to a free tier that includes archive** (Alchemy is the straightforward one).
   Zero cost, and you get the CU/s headroom that also fixes the 429s.
2. **Warm the cache once from an archive source and commit it to CI.** Run the suite
   locally against any archive endpoint, then commit `~/.foundry/cache/rpc/mainnet/23400000/`
   into the repo (it's JSON, usually a few hundred KB for a handful of contracts) or push
   it to your CI cache. After that, CI reads state from disk and **never calls the RPC at
   all** — which makes the archive question moot and the 429 question moot along with it.
   This is the most robust option and I'd take it regardless of #1.
3. **Only if neither is possible:** move the Chainlink/Uniswap tests off the live fork and
   onto recorded state — `vm.mockCall` on `latestRoundData()` and `getReserves()` with the
   values you captured at the pinned block. You keep determinism but lose the integration
   coverage that is the entire reason to fork-test, so this is a fallback, not a plan.

Note that options 1 and 2 also need to happen for the 429 relief to be real. Pinning alone
fixes correctness and determinism immediately; the request-volume collapse only arrives
once the cache is actually being reused across runs.
