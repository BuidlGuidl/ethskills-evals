# Why the fork tests broke, and how to make them deterministic

## The single root cause

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

The two-argument overload takes a block number. This is the one-argument overload, so
Foundry forks at **`latest`**. There is no pinned block anywhere in the suite.

That means your test fixture is not the repo — it is mainnet, as of whenever the job
happened to run. Every symptom follows from that.

## How each symptom follows

### 1. The sudden reds (nobody touched the code)

Nobody had to. The assertions encode values that were true on mainnet the day they were
written:

- **Chainlink**: the aggregator's `latestRoundData()` answer only changes when a round is
  pushed — on the deviation threshold (e.g. 0.5% for ETH/USD) or the heartbeat. For four
  months your assertion's tolerance band happened to contain every posted answer. This
  morning the price moved far enough that a newly posted round fell outside it. The test
  didn't change; the oracle did.
- **Uniswap reserves**: these change on *every swap*, i.e. many times per block. Any
  assertion on `getReserves()` / `slot0` was drifting continuously from the moment it was
  written and was always going to fail eventually. Four months of green was luck, not
  correctness.

The commit that "passes and fails" was never testing your fork. It was testing mainnet.

### 2. The flakiness on re-run

Re-running the job re-resolves `latest`. A new block lands every ~12s, so a re-run almost
always forks a *different* block with different reserves and possibly a different oracle
round. Whether you pass is a coin flip weighted by how close the live value is to your
tolerance band edge.

Two extra sources of nondeterminism at the tip, both of which you are exposed to and
neither of which you can control:

- Load-balanced providers serve `latest` from several nodes at slightly different heights,
  so consecutive calls in one run can even see the block number go *backwards*.
- The tip can reorg. State you read at `latest` may never have been canonical.

### 3. The slowdown

This is the part that makes the diagnosis airtight, because it is a *direct* consequence
of not pinning.

Foundry caches fork state on disk under `~/.foundry/cache/rpc/<chain>/<block>/storage.json`,
keyed by **chain id + block number**. With a moving block number, every single run writes a
brand-new cache directory and gets **zero cache hits**. Every account touch and every
`SLOAD` your test path performs is a live `eth_getStorageAt` / `eth_getProof` /
`eth_getCode` round-trip to the provider.

So the suite's wall-clock time is (number of state accesses) x (provider latency), paid in
full, every run. As the suite grew and as provider latency crept up under your rising
request volume, it got steadily slower. As a side effect `~/.foundry/cache/rpc/mainnet/`
has been accumulating one directory per distinct block you've ever forked — thousands by
now, on a shared CI runner if you cache it.

### 4. The 429s

Same cause, next stage. Because nothing is cached, request volume per CI job is large and
grows with the test count and PR frequency. Most free tiers throttle softly before they
throttle hard: they add latency first (which *is* symptom 3), then start returning 429
once you cross the limit.

And this closes the loop back to symptom 2: a 429 mid-run is a *second, independent*
flakiness source. Depending on where it lands, Foundry either errors out the run or the
retry/backoff stretches it out. So "flaky on re-run" now has two causes stacked on each
other — drifting chain state and dropped RPC responses.

**One defect, four symptoms.** Pinning fixes all four.

## The fix

### Pin the block

`foundry.toml`:

```toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"

[profile.default]
# leave caching on (this is the default); it only does anything once the block is pinned
no_storage_caching = false
# stay under the free tier instead of getting 429'd
compute_units_per_second = 100
```

Test:

```solidity
// Pinned 2026-09-18. Do not bump without re-deriving the expected values below.
uint256 constant FORK_BLOCK = 23_400_000;

function setUp() public {
    vm.createSelectFork("mainnet", FORK_BLOCK);
}
```

Pick a block that is comfortably finalized — at least a few hours old, ideally a few days —
so it can never be reorged out from under you.

### Make the assertions exact

Once the block is pinned, the Chainlink answer and the pool reserves at that block are
fixed integers forever. Stop asserting tolerance bands; assert the literal values. A
tolerance band is a slow-motion version of the same bug — it just delays the red by a few
months.

Derive them once and record the command in a comment so the next person can re-derive them
when the block is bumped:

```bash
cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 \
  "latestRoundData()(uint80,int256,uint256,uint256,uint80)" \
  --block 23400000 --rpc-url "$MAINNET_RPC_URL"

cast call <PAIR> "getReserves()(uint112,uint112,uint32)" \
  --block 23400000 --rpc-url "$MAINNET_RPC_URL"
```

Bumping the block becomes a deliberate, reviewable commit that changes both the constant
and the expected values together — exactly what you want.

### Cache the fork state in CI

This is what actually kills the 429s. With a pinned block the cache key is stable, so one
job populates it and every later job hits it:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.foundry/cache/rpc
    key: foundry-rpc-mainnet-23400000
```

Key it on the pinned block number so bumping the block naturally invalidates it. After the
first populate, CI makes essentially **zero** RPC calls — which also means the suite gets
dramatically faster, and free-tier rate limits stop mattering.

### One gotcha after you pin

If any code under test checks oracle freshness (`block.timestamp - updatedAt < heartbeat`),
be aware that a pinned fork starts at that block's timestamp. If a test `vm.warp`s forward
by more than the heartbeat, the Chainlink data will correctly look stale and revert. That
is the contract behaving properly, not a new flake — warp relative to `block.timestamp`,
not to an absolute wall-clock value.

## Does this work against a free-tier endpoint?

**Mostly yes, with one real dependency you need to check.**

What pinning needs that `latest` did not: **archive state access.**

Reading state at an old block (`eth_getStorageAt` / `eth_call` with a historical block tag)
requires the node to still have that state trie. A default geth node keeps only the last
~128 blocks of state (~25 minutes). Beyond that you need an archive node. Some free tiers
include archive data; many — especially public endpoints like the free `ankr`/`llamarpc`
style URLs — do not, or cap you at the recent window.

**How to tell, in one command.** Pick a block a few days old and ask for state at it:

```bash
cast balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \
  --block 23400000 --rpc-url "$MAINNET_RPC_URL"
```

- Returns a number → you have archive access. Pin and you're done.
- Errors with `missing trie node`, `state is not available`, `header not found`,
  `archive data not supported on your tier`, or a bare `-32000` → you do not.

Run it against the *exact* block you intend to pin, not just any old block; some providers
serve a limited historical window rather than full archive.

**If your endpoint is not archive**, you have three options, cheapest first:

1. **Commit the RPC cache.** Have one person who does have archive access (a paid key, a
   trial key, a friend's node) run the suite once at the pinned block, then check
   `~/.foundry/cache/rpc/mainnet/23400000/storage.json` into the repo and point Foundry at
   it. It is deterministic JSON. CI then needs *no* RPC access at all for these tests, which
   makes the free-tier question moot and removes the 429s entirely. This is the strongest
   answer if the file size is tolerable for the handful of contracts you touch.
2. **Pin to a recent block within the non-archive window** and bump it on a schedule. Works,
   but it is a treadmill and re-derives the expected values constantly — only worth it as a
   stopgap.
3. **Pay for an archive key.** An archive-capable key used purely to populate a cache that
   CI then reuses costs very little, because after the first populate you stop calling it.

Worth stating plainly: the free tier is *already* failing you today. `latest` needs no
archive access, but it is exactly what produced the reds, the flakiness, the slowdown and
the 429s. Pinning trades a requirement you don't currently meet (maybe) for correctness you
currently don't have (definitely) — and once the cache is warm or committed, it consumes
less of the free tier than what you're doing now, not more.
