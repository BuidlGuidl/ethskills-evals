# Fork tests: one root cause, four symptoms

## The single line that explains all four

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

No block number. That overload forks at **whatever the provider says `latest` is at the
moment `setUp()` runs**. Your test suite has no fixed input — it re-reads live mainnet on
every invocation. Every symptom falls out of that.

### 1. The sudden reds

Chainlink `latestRoundData()` and a Uniswap pool's reserves are *live chain state*. They
change every block. Your assertions were written four months ago against whatever the
values happened to be then, and they've been drifting ever since. They passed for four
months because the drift stayed inside whatever tolerance you used (or the value hadn't
crossed the threshold yet). This morning it crossed.

"Nobody touched the code" is exactly right, and exactly the point: **the code isn't the
input.** Mainnet is. Mainnet changed.

### 2. Flakiness on re-run — same commit, pass then fail

Two mechanisms, both downstream of "no pinned block":

- **Different block each run.** A re-run 5 minutes later forks at a block ~25 blocks
  later. If the value is oscillating around your assertion boundary, you get a coin flip.
  A Chainlink feed that updates on a 0.5% deviation threshold will sit just inside your
  band, then just outside, then back.
- **Provider load balancers aren't height-consistent.** A free-tier endpoint is a pool of
  backends. `eth_blockNumber` may be answered by a node at height N, and the follow-up
  `eth_getStorageAt` by a node still at N-2. Foundry pins the fork to the height it got
  back, then asks for state at that height from a node that may not have it — you get a
  stale read, an error, or an inconsistent mix of the two. Add reorgs at the tip and the
  head you forked from can stop existing seconds after you forked from it.

That is the classic "passes and fails on the same commit" signature. It is not a Foundry
bug and it is not your contracts.

### 3. The four-month slowdown

Foundry caches fork RPC responses on disk, keyed by **chain id + block number**:

```
~/.foundry/cache/rpc/mainnet/<block>/storage.json
```

Pinned to a fixed block, the first run populates that cache and every subsequent run is
served almost entirely from disk — near-zero network. Pinned to `latest`, **the cache key
is different every single run**. Your hit rate is structurally 0%. Every account load,
every storage slot, every `eth_call` is a fresh network round-trip, every time.

Why *steadily* slower rather than just uniformly slow: as the suite grew over four months,
the number of distinct slots touched grew with it, and each new slot is another
uncached round-trip at ~50-200ms of provider latency. Latency cost scales linearly with
suite size when the cache never hits. (The cache directory also accumulates one
never-reused subdirectory per block you ever forked at — thousands of dead folders by now.)

### 4. The 429s

Same arithmetic from the provider's side. Zero cache reuse × a suite that has been growing
for four months × every PR and every re-run = a request volume that has been climbing
monotonically since day one. Last week it crossed your free tier's rate limit.

And the 429s feed straight back into symptom 2: a throttled `eth_getStorageAt` mid-test
surfaces as a revert, a zero return, or a fork error — which is *more* nondeterminism on
top of the block drift. The 429s aren't a separate problem to triage later; they're the
same problem, and they're now amplifying it.

---

## The fix

Pin the block. That is the whole fix; everything else below is hygiene around it.

### Step 1 — pin the fork block

```solidity
contract PriceTest is Test {
    // Pinned mainnet block. Every value asserted below was read at this height.
    // Bumping this constant means re-deriving the expected values (see `cast` cmds below).
    uint256 constant FORK_BLOCK = 20_000_000; // <- pick a concrete recent block

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
    }
}
```

Cleaner, with the endpoint in `foundry.toml` instead of inline env reads:

```toml
# foundry.toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
```

```solidity
vm.createSelectFork("mainnet", FORK_BLOCK);
```

Once pinned:
- The Chainlink round and the pool reserves are **frozen constants**. The test is a pure
  function of your code again.
- Re-runs are byte-identical. No coin flip.
- The RPC cache key stops moving. Run 2 onward is served from disk.
- Request volume to the provider collapses to roughly zero after the first warm run,
  which removes the 429 pressure at the source.

### Step 2 — re-derive the expected values at that exact block

Don't guess or adjust the old numbers. Read them:

```bash
# Chainlink ETH/USD latestRoundData() at the pinned block
cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 \
  "latestRoundData()(uint80,int256,uint256,uint256,uint80)" \
  --rpc-url "$MAINNET_RPC_URL" --block 20000000

# Uniswap V2 pair getReserves() at the pinned block
cast call <PAIR_ADDRESS> "getReserves()(uint112,uint112,uint32)" \
  --rpc-url "$MAINNET_RPC_URL" --block 20000000
```

Now use `assertEq` on the exact values. Counter-intuitively, once the block is pinned
**exact assertions are the correct choice** — a wide tolerance band was only ever a
band-aid over the unpinned block, and it hides real regressions. Keep
`assertApproxEqRel` only where your own code introduces genuine rounding.

### Step 3 — cache the RPC cache in CI

Pinning makes the cache reusable; this makes CI actually reuse it across jobs.

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.foundry/cache/rpc
    key: foundry-rpc-${{ hashFiles('**/*.t.sol') }}-block20000000
```

After the first CI run populates it, subsequent runs do essentially **no RPC at all**.
That is what makes the 429s go away permanently rather than just get quieter.

### Step 4 — a throttle as a seatbelt

For the cold first run, cap request rate so you degrade gracefully instead of 429ing:

```bash
forge test --compute-units-per-second 100
```

This is a safety net, not the fix. If you still need it after step 3, something is still
re-forking at `latest` somewhere.

### Step 5 — assert properties, not just snapshots, where it makes sense

A pinned snapshot test is deterministic but brittle in a different way: bump the block and
every literal breaks. Where you actually care about behaviour rather than a specific
number, assert the property:

```solidity
// Snapshot — deterministic, but must be re-derived on every block bump
assertEq(uint256(price), 3_412_11000000);

// Property — survives block bumps, catches real breakage
assertGt(price, 0, "oracle returned non-positive price");
assertLt(block.timestamp - updatedAt, 3600, "oracle round is stale");
assertGt(reserve0, 0);
assertGt(reserve1, 0);
```

Keep both kinds. The snapshot catches "the integration changed shape"; the property
survives maintenance. Your three red tests are probably better off as property tests with
one pinned snapshot test alongside them.

---

## The constraint you asked about: does this work on a free-tier endpoint?

**Plainly: it requires archive access, and a free-tier endpoint may or may not have it.**

Here is the exact mechanic. Forking at a historical block means asking for *state* at that
block — `eth_getStorageAt`, `eth_getProof`, `eth_call` with a historical block tag. A
plain full node prunes historical state and typically retains only the last ~128 blocks
(roughly 25 minutes of mainnet). Pin to a block older than that on a non-archive endpoint
and the state reads fail. **Archive access is what you need, and it is the one thing your
current unpinned setup never exercised** — forking at `latest` only ever reads state at
the tip, which every node has. So this constraint has been invisible to you until now.

### How to tell, in ten seconds

Probe it directly. Pick your intended block and ask for state that only an archive node
can serve:

```bash
cast storage 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 0 \
  --rpc-url "$MAINNET_RPC_URL" --block 20000000
```

Read the result:

- **Returns a value** → you have archive access at that depth. Steps 1-5 work as written.
  Nothing further needed.
- **Errors** → not archive at that depth. The error text is diagnostic, and the wording
  varies by client:
  - `missing trie node` / `missing trie node ... state is not available` (Geth)
  - `header not found`
  - `state at block N is not available` / `Block ... not found`
  - `-32000` with any of the above, or a provider-branded "archive data requires a paid
    plan" / "method not available on your tier" message
  - a **402 or 403** rather than a 404 → the node *has* the data, your plan doesn't
    entitle you to it. That distinction matters: it means an upgrade fixes it, not a
    different provider.

Sanity-check the probe by running the same command with `--block latest`. If `latest`
works and `20000000` doesn't, you've confirmed it's an archive limitation and not a bad
URL, a dead key, or a network problem.

### If the probe fails

In rough order of preference:

1. **Move to an endpoint with free archive access.** Alchemy's free tier has historically
   included archive data on mainnet; dRPC and Ankr also offer archive on free/public
   tiers. Verify with the same probe above rather than trusting the marketing page — tiers
   change. This is a one-line env change and it is the cleanest outcome.
2. **Pre-warm the cache once, then run CI with no archive at all.** Populate
   `~/.foundry/cache/rpc/mainnet/20000000/` from *any* machine that does have archive
   access (a teammate's paid key, a one-off trial), then commit it or seed the CI cache
   with it. Once warm, Foundry serves those slots from disk and never asks the provider.
   CI then needs no archive — and no network — for those tests. The cache files are JSON
   and diff-reviewable; check the size before committing (typically low single-digit MB
   for a handful of tests, but check).
3. **Pin to a recent block and bump it on a schedule.** Choose a block inside your
   provider's retention window, and bump it deliberately in a PR — monthly, or whenever
   you're touching those tests. Strictly worse than 1 or 2: you re-derive expected values
   on every bump, and there's a window where the pin ages out of retention and CI breaks
   for a reason unrelated to your code. But it is still **enormously** better than
   unpinned, because the block changes only when a human changes it, in a reviewable diff,
   rather than silently on every run. Determinism-per-commit is the property that matters,
   and this preserves it.

Option 3 keeps the cache mostly useless (new key on every bump), so the slowdown and 429s
only partially improve. Options 1 and 2 fix all four symptoms completely.

---

## Summary

| Symptom | Cause | Fixed by |
|---|---|---|
| Sudden reds | Asserting live oracle/reserve values that drifted | Pin block + re-derive expected values |
| Flaky re-runs | Different block each run; LB height skew; tip reorgs | Pin block |
| Steady slowdown | RPC cache key changes every run → 0% hit rate | Pin block (+ CI cache) |
| HTTP 429s | Zero cache reuse × growing suite × every re-run | Pin block + CI cache (+ CUPS throttle) |

One root cause. One fix. The only thing standing between you and it is whether your
free-tier endpoint serves archive state — and the `cast storage --block` probe above
answers that in ten seconds.
