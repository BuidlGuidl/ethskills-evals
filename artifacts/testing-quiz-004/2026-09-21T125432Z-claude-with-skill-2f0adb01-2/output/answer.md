# Why all four symptoms are the same bug

## The one line that causes it

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

`createSelectFork` with no block number forks **the chain tip at the moment the call
executes**. That single omission is the common cause of all four symptoms.

Your test inputs are not in your repository. They are whatever mainnet happened to look
like when CI ran. "Nobody touched the code" is true and irrelevant — the code was never
the variable. The tests were never deterministic; for four months they happened to land
inside the tolerance band you hardcoded, and this morning the market walked out of it.

### 1. The sudden reds

The two assertions that broke are exactly the two that read live, continuously-moving
state:

- A Chainlink aggregator's `latestRoundData()` answer changes on every deviation
  threshold breach or heartbeat.
- A Uniswap pool's reserves change on every swap, mint, and burn.

Whatever literal or band you asserted against (`assertApproxEqRel(price, 2000e8, 0.05e18)`,
`assertGt(reserve0, X)`) was a snapshot of a day four months ago. A price move, or one
large LP action, is enough to step outside it. Nothing changed on your side — the
oracle did its job.

### 2. The flakiness on re-run

Two layers of nondeterminism, both from the same omission:

- Between CI runs, the tip advances. A re-run five minutes later forks a different
  block with a different price, and if that block is back inside your band, the test
  goes green. Same commit, different result — because the commit was never the input.
- **Within a single `forge test` run**, `setUp()` re-executes for every test function,
  so each test can fork a *different* block. That's why exactly three tests are red and
  the rest are green, and why the set of red tests can shift between runs.

### 3. The steady slowdown

Foundry's RPC cache is keyed by `(chain id, block number)`, and **caching is disabled
for unpinned/latest forks** — a block that keeps moving can never be a stable cache key.
So every run fetches every touched account, storage slot, and code blob fresh over the
network. You have had a 100% cold cache for four months.

The slowdown is that cold path getting more expensive over time:

- Mainnet state at the tip keeps growing; the contracts you touch have more storage and
  the nodes serving them are slower at the tip than at an old, settled block.
- Your suite has grown. Every new fork test is another full `setUp()`, another fork,
  another few hundred uncached round trips, all serialized behind network latency.

This was never going to level off. It compounds.

### 4. The 429s

Same root cause, one step further along the curve. Uncached fork tests generate a
large volume of `eth_getStorageAt` / `eth_call` / `eth_getCode` requests — easily
thousands per run once you have a handful of tests hitting Uniswap and Chainlink.
Multiply by concurrent PR jobs and you cross the free tier's rate limit. Foundry
retries with backoff, which makes runs *slower still* (feeding symptom 3), and a
request that ultimately fails surfaces as a test error at a moment that has nothing to
do with your code — more apparent flakiness.

So: unpinned fork → no cache → unbounded request volume → 429s → backoff → slower runs,
while the moving block simultaneously moves your assertions' inputs → reds and flakes.
One cause, four symptoms.

---

# The fix

## 1. Pin the block

`foundry.toml`:

```toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"

[rpc_storage_caching]
chains = ["mainnet"]
endpoints = "all"
```

Test:

```solidity
contract PriceTest is Test {
    // Pinned 2026-09-21. Bump deliberately, in its own PR, with expectations re-derived.
    uint256 constant FORK_BLOCK = 21_000_000;

    function setUp() public {
        vm.createSelectFork("mainnet", FORK_BLOCK);
    }
}
```

Use the `"mainnet"` alias rather than `vm.envString` so the endpoint lives in config,
not in twelve test files.

This alone fixes reds, flakes, and — via the now-active cache — most of the slowdown
and the 429s. After the first warm run, a pinned fork test reads from
`~/.foundry/cache/rpc/mainnet/21000000/storage.json` and issues **zero** RPC calls for
state it has already seen.

## 2. Re-derive the assertions against the pinned block, and assert exactly

Once the block is pinned, the Chainlink answer and the pool reserves are *constants*.
Stop writing tolerance bands around a guess — read the real values and assert equality:

```bash
cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 \
  "latestRoundData()(uint80,int256,uint256,uint256,uint80)" \
  --rpc-url "$MAINNET_RPC_URL" --block 21000000
```

```solidity
function test_OracleReadAtPinnedBlock() public view {
    (, int256 answer,,,) = feed.latestRoundData();
    assertEq(answer, 2_431_09876543, "ETH/USD at block 21_000_000");
}
```

A band that can drift is a band that will eventually flake again. An exact value at a
pinned block cannot.

Better still, for the tests that are really about *your* contract: assert on properties
rather than on mainnet's numbers. "My wrapper returns the same value the feed returns,"
"my quote is within 1% of the pool's spot," "a stale round reverts" — those hold at any
block and don't need bumping.

## 3. Two pinned-block gotchas worth knowing now

- **`vm.warp` breaks Chainlink staleness checks.** At a pinned block, `block.timestamp`
  is frozen at that block's timestamp, so `block.timestamp - updatedAt` is a stable
  small number. The moment you `vm.warp` forward, the feed looks stale and any
  staleness guard in your contract reverts. That's correct behaviour — just don't be
  surprised by it.
- **Bump the block deliberately.** Treat `FORK_BLOCK` like a lockfile: its own PR,
  expectations regenerated, reviewed. Never bump it to make a red test green.

## 4. Cache the cache in CI

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.foundry/cache/rpc
    key: foundry-rpc-mainnet-21000000-${{ hashFiles('test/**/*.sol') }}
    restore-keys: foundry-rpc-mainnet-21000000-
```

Key it on the pinned block number. Bumping the block naturally invalidates it. With
this in place, steady-state CI runs make roughly zero mainnet requests, which is what
actually kills the 429s.

---

# Does this work against a free-tier endpoint?

**Partly. The pinning itself is free; what it needs is archive access, and that is the
thing your endpoint may not provide.**

Forking at block 21,000,000 means asking the node for **historical state** —
`eth_getStorageAt` and `eth_call` *at that block*. A standard (pruned) full node keeps
state for only the last ~128 blocks, roughly 25 minutes. Older than that, it has the
block header but not the state trie, and the request fails.

- Alchemy and Infura free tiers **do** serve archive state, subject to rate and compute
  limits — which is precisely why step 4 matters.
- Public endpoints (Cloudflare, LlamaRPC, `rpc.ankr.com/eth` unauthenticated, most
  chain-list defaults) generally **do not**. They are pruned.

## How to tell, in ten seconds

Pick any block older than ~a day and ask for state at it:

```bash
# Should print a balance. Any error means no archive state at that block.
cast balance 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 \
  --rpc-url "$MAINNET_RPC_URL" --block 21000000

# Stronger check — this needs the state trie, not just an account lookup.
cast storage 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 0 \
  --rpc-url "$MAINNET_RPC_URL" --block 21000000
```

**Archive available:** both return values, and they match what `--block latest` returns
for an immutable slot.

**Not archive:** you get one of
- `missing trie node ...`
- `-32000: state at block N is not available` / `... not found`
- `header not found`
- `Method eth_getStorageAt not supported` (some free tiers gate archive methods)
- a silent `0x` / zero where `latest` returns a real value — the nastiest case, because
  it produces *wrong test results rather than errors*. Always compare against `latest`
  on a slot you know is non-zero.

Run it twice, ~30 seconds apart, at a block that keeps aging. If it works today and
fails on a block from last week, you have a short retention window, not true archive.

## If it turns out you don't have archive access

Three options, best first:

1. **Get a free archive-capable key.** Alchemy or Infura free tier is enough for a
   pinned-block suite, because after the first warm run the cache absorbs nearly all
   the traffic. This is the right answer for almost everyone.
2. **Warm the cache once, then commit or CI-cache it.** Pinned-block fork tests read
   from `~/.foundry/cache/rpc/mainnet/<block>/storage.json`. Generate it once from an
   archive endpoint (a laptop, a one-off job), then restore it in CI via step 4. With a
   fully warm cache the tests never touch the network, so CI's pruned endpoint is never
   asked for historical state. Fragile if a new test touches an uncached slot — that
   one will fail loudly against a pruned node, which is at least an honest failure.
3. **Don't fork for these two tests.** If all you're verifying is "my wrapper handles a
   price correctly" or "my router math matches the pool's," a mock feed and a locally
   deployed pool give you full determinism and zero RPC. Keep fork tests for what only
   a fork can prove: real integration against real deployed bytecode. Fewer, pinned,
   cached.

What you should **not** do is pin to a block within the last 128 and call it fixed. It
works on Monday and fails on Tuesday for exactly the reason you're here.

---

# Summary

| Symptom | Cause |
|---|---|
| Sudden reds | Unpinned fork reads live oracle/reserve values; market left your hardcoded band |
| Flaky on re-run | Tip advances between runs — and between test functions within one run |
| Steady slowdown | Unpinned forks are never cached; every run refetches all state, and the suite keeps growing |
| 429s | Thousands of uncached RPC calls per run × concurrent PR jobs vs. free-tier limits |

**Fix:** pin `FORK_BLOCK`, re-derive assertions at that block as exact values, cache
`~/.foundry/cache/rpc` in CI keyed on the block number.

**Free-tier caveat:** pinning requires **archive state access** for historical blocks.
Verify with `cast storage <addr> 0 --rpc-url "$MAINNET_RPC_URL" --block <old-block>` and
compare to `--block latest`. Errors, or a zero where `latest` is non-zero, mean your
endpoint is pruned and you need an archive-capable key (free tiers from Alchemy/Infura
qualify) or a pre-warmed committed cache.
