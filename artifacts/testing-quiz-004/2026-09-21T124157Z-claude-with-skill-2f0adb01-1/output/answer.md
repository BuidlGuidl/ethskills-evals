# Why all four symptoms are the same bug

## The one line that causes it

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

`createSelectFork` with no block argument forks at **`latest`**. There is no pin. Every
`forge test` invocation — every CI job, every re-run of the *same commit* — resolves
`latest` to whatever block mainnet is on at that second and builds the fork from that
state.

So the input to your test suite is not the commit. It is "mainnet, right now." Nobody
touched the code, the dependencies, or the CI config, and that is exactly consistent
with what you're seeing: the thing that changed is the one input you never pinned.

Everything else follows from that.

## 1. The sudden reds

The two assertions that broke are the two that read values mainnet is *designed* to
change:

- **Chainlink** `latestRoundData()` pushes a new answer on a deviation threshold (0.5%
  for ETH/USD) or a heartbeat (~1h), whichever comes first. The answer is different
  most hours.
- **Uniswap reserves / slot0** change on every single swap, mint and burn in the pool.

Your assertions encode a value — or a tolerance band around a value — sampled from
mainnet on the day the test was written. Four months of drift finally walked the live
value out of that band. That's why it held for four months and then failed all at once
rather than degrading: a band either contains the value or it doesn't. (If it were a
bare `assertEq` on a price it would have failed within the hour of being written, so the
tests almost certainly use `assertApproxEqRel` or a min/max range — those are the shape
that survives for months and then snaps.)

This is not a bug that appeared this morning. It has been there for four months. Today
is just the day the market crossed the line.

## 2. The flakiness on re-run

A re-run is a *new* `latest`. Re-running doesn't retry the same test — it runs a
different test, against a different block, holding different state.

Two mechanisms, both live here:

- **Drift across the boundary.** If the live value is sitting near the edge of your
  tolerance band, consecutive blocks land on either side of it. Green, red, green. Same
  commit, same binary, different chain state.
- **Provider head skew.** A hosted RPC endpoint is a load balancer over many nodes at
  slightly different heights. `latest` from node A and `latest` from node B can differ
  by a few blocks, and a reorg at the tip can retract state you already read. Foundry
  resolves `latest` once and then pins the fork to that number internally, so within a
  run you're mostly consistent — but across runs you're sampling a moving, occasionally
  rewinding, target.

"Sometimes green on re-run" is the signature of a non-deterministic input, not of a race
in your code.

## 3. The steady slowdown

Foundry caches fork RPC responses on disk, under
`~/.foundry/cache/rpc/<chain>/<block-number>/storage.json`. **The cache key includes the
block number.** A pinned block means the second run of the suite replays almost entirely
from disk. An unpinned `latest` means a brand-new cache key every single run — a 100%
miss rate, forever.

So every run cold-fetches every account, every code blob and every storage slot your
tests touch: `eth_getBlockByNumber`, then a long tail of `eth_getStorageAt`,
`eth_getBalance`, `eth_getCode`, `eth_call`. Each one is a network round trip on the
critical path of the EVM's state reads.

Over four months you added tests and integrations. The number of distinct slots touched
grew, the per-run request count grew with it, and since none of it is ever reused the
wall-clock grew in lockstep. (As a side effect, that cache directory has also been
accumulating one dead subdirectory per CI run for four months.)

## 4. The 429s

Same cause, one more step. Request volume per run grew monotonically because the cache
never helps. Free-tier endpoints are rate limited on requests/second and
compute-units/month. You crossed the line last week.

And note the feedback loop that makes 429s *look* like a separate, spookier problem: a
throttled response mid-run can surface as a failed state read, which looks like yet
another mysterious flake unrelated to price drift. Two independent-looking flake sources,
one root cause.

---

# The fix

## Step 1 — Pin the block

Add an alias so the URL still comes from the environment:

```toml
# foundry.toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
```

```solidity
contract PriceFeedForkTest is Test {
    // Pinned mainnet state. Bump deliberately, in a commit, never implicitly.
    uint256 constant FORK_BLOCK = 21_000_000;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("mainnet"), FORK_BLOCK);
    }
}
```

That is the whole determinism fix. The fork state is now a function of the commit.
The same commit produces the same reads forever, so the same commit produces the same
result forever. Re-running becomes pointless, which is the property you want.

Two notes:

- The `--fork-block-number` CLI flag only applies to `--fork-url` runs. It does **not**
  constrain an in-test `createSelectFork`. Pin it in the code.
- Because the fork is now at an old block, `block.timestamp` is that block's timestamp.
  Chainlink staleness checks (`block.timestamp - updatedAt < MAX_AGE`) work correctly.
  Under the current unpinned-`latest` setup, any `vm.warp` forward silently makes every
  oracle look stale — worth checking whether you have tests quietly papering over that.

## Step 2 — Stop asserting on market values

Pinning makes the failing assertions pass again, but it freezes a bad test rather than
fixing it. `assertEq(price, 3012_00000000)` at a pinned block tests that Chainlink's
historical answer is what it was — it tests the chain, not your contract. The day you
bump the pin, it breaks again.

Split by what you're actually trying to prove:

**Integration — does my contract talk to the real thing correctly?** Keep on the pinned
fork. Assert on properties, not numbers:

```solidity
function test_ConsumesFeedWithCorrectDecimals() public {
    (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
    assertGt(answer, 0);
    assertEq(feed.decimals(), 8);
    // my wrapper normalizes 8dp -> 18dp
    assertEq(oracle.priceWad(), uint256(answer) * 1e10);
    assertLe(block.timestamp - updatedAt, HEARTBEAT);
}
```

**Logic — what does my contract do at $900? at $4,500? at a negative answer? at a
zero-reserve pool?** Those are not fork tests at all. Mock the feed
(`MockV3Aggregator` / `vm.mockCall`) or deploy a local pool, and drive the price as an
input. These run in milliseconds, hit no network, and cover cases mainnet will never
hand you — a stale round, `answeredInRound < roundId`, a negative answer, a pool drained
to one wei.

Roughly: the fork proves the *wiring*, unit tests prove the *math*. Right now the fork
tests are being asked to do both, and that's why they're pinned to a price.

## Step 3 — Cache the RPC cache in CI

With a pinned block the cache key is now stable, so persist it:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.foundry/cache/rpc
    key: foundry-rpc-${{ hashFiles('test/**/*.sol') }}-21000000
    restore-keys: foundry-rpc-
```

First run populates it; every subsequent run serves from disk and issues close to zero
RPC calls. This is what kills the 429s and reverses the slowdown. Without the pin this
cache entry can never hit.

## Step 4 — Detect drift on purpose, don't discover it in a PR

Pinning means you stop noticing when mainnet changes under you — an upgraded proxy, a
migrated pool, a deprecated feed. Handle that deliberately: a nightly/weekly scheduled
job that runs the same suite unpinned at `latest`, **not** blocking on PRs. When it goes
red, that's real news about mainnet, and you bump `FORK_BLOCK` in a commit and fix the
tests there. PRs stay deterministic; drift becomes a scheduled signal instead of a
random red.

---

# Does this work on a free-tier endpoint? — the honest answer

**Step 2 and Step 4 work anywhere. Steps 1 and 3 need something your endpoint may not
provide, and this is the part to check before you rely on any of it.**

## What it needs: archive state access

Pinning to block 21,000,000 means asking the node for **state** at that block:
`eth_getStorageAt`, `eth_call`, `eth_getBalance`, `eth_getCode` with a historical block
tag. That requires the node to have retained the state trie at that height.

A default full node prunes: it keeps roughly the **last 128 blocks** of trie state,
about 25 minutes. Older than that, the state is gone. Serving arbitrary historical state
is an **archive node**, and it's the single most common thing gated behind a paid tier.

The trap: **blocks and receipts are never pruned, only state is.** So
`eth_getBlockByNumber(0x1406F40)` will happily return a full block header from a pruned
node and tell you nothing. You must probe a *state* method.

Free tiers genuinely differ — Alchemy's free tier does serve archive-depth `eth_call` /
`eth_getStorageAt` on mainnet; Infura gates historical state behind an add-on; most
public and community endpoints are pruned. Don't guess from the brand. Probe it.

## How to tell — one curl

```bash
BLOCK=0x1406F40   # 21,000,000
USDC=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# historical state
curl -s -X POST "$MAINNET_RPC_URL" -H 'content-type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getStorageAt\",
       \"params\":[\"$USDC\",\"0x0\",\"$BLOCK\"]}"

# control: same call at the tip
curl -s -X POST "$MAINNET_RPC_URL" -H 'content-type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getStorageAt\",
       \"params\":[\"$USDC\",\"0x0\",\"latest\"]}"
```

Read it like this:

- **Both return a `0x…` 32-byte word** → you have archive access at that depth. Pin
  freely; Steps 1 and 3 work as written.
- **`latest` works, historical errors** → pruned or plan-gated. That's the diagnosis.
  The error text names which: `missing trie node`, `header not found`,
  `state not available`, `-32000`, or an explicit
  `archive data is not available on your current plan` / HTTP 403.
- **Both error** → you fat-fingered the request, not an archive problem.

Run the same probe against the block you actually intend to pin, and re-run it when you
bump the pin — retention windows and plan limits change without notice.

## If the probe says no archive

Then say it plainly: **a pruned endpoint cannot do reproducible fork testing.** Pinning
inside the ~128-block window is the same non-determinism with extra steps, so don't try
it. Your options, cheapest first:

1. **Lean on Step 2 and mostly stop needing the fork.** The three failing tests are
   price/reserve-math tests wearing a fork costume. Move them to mocked feeds and a
   locally deployed pool and they need no RPC at all — deterministic, instant, and they
   cover the edge cases mainnet won't give you. This is worth doing regardless of the
   probe result.
2. **Prime the cache once from any archive source**, then run CI from the cache. Foundry
   writes `~/.foundry/cache/rpc/mainnet/<block>/storage.json`; populate it from a local
   `reth`/`erigon` archive, a free trial key, or a colleague's endpoint, then commit it
   (it's JSON, usually small for a focused suite) or hand it to `actions/cache`. CI then
   serves every pinned read from disk. Caveat: any *new* slot a test touches is a cache
   miss and will hit the endpoint and fail on a pruned node — so this needs re-priming
   whenever the fork tests grow, and is best treated as an optimization on top of a real
   archive endpoint rather than a substitute.
3. **Get an archive-capable key.** A free Alchemy key that passes the probe above is the
   shortest path, and with Step 3's cache in place CI will barely touch it — which also
   permanently ends the 429s.

## Summary

| Symptom | Cause | Fixed by |
|---|---|---|
| Sudden reds | Assertions on live Chainlink/Uniswap values, drifted out of band | Step 1 + Step 2 |
| Flaky on re-run | Each run forks a different `latest` block | Step 1 |
| Steady slowdown | Cache key = block number; `latest` ⇒ 100% miss rate, growing suite | Step 1 + Step 3 |
| 429s | Same: full cold RPC fetch every run, volume grew past free-tier limit | Step 1 + Step 3 |

One unpinned input, four symptoms. Step 1 is the fix; Step 2 is what keeps it from
breaking again at the next pin bump; Step 3 is what makes it cheap. **Confirm archive
access with the curl above before relying on Steps 1 and 3** — if it fails, Step 2 is
the route that works on the endpoint you have.
