# Why all four symptoms are the same bug

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

No block number. That one omission is the whole story.

`createSelectFork` with no second argument forks from **`latest`** — whatever the chain
head happens to be at the moment the test process asks. So the tests are not run against
a fixed input; they are run against mainnet as it exists right now. Everything else
follows.

## 1. The sudden reds

Chainlink `latestRoundData()` and a Uniswap pair's `getReserves()` are *live mainnet
state*. They change every time someone trades or an oracle round posts.

The assertions passed for four months because they were written against the values that
were live the day they were written, and they were loose enough — or the market was calm
enough — to keep holding. This morning the price moved far enough (or the pool was
rebalanced far enough) to cross whatever bound the assertion encodes. Nobody touched the
code because the code was never the input. Mainnet was.

Note the shape of the failure: exactly the two tests that assert on live values went red,
and everything else stayed green. That is the signature of a moving fork point, not of a
code change.

## 2. Flakiness on re-run — same commit, different result

A re-run forks at a *different* `latest`. Mainnet produces a block every ~12s, so a job
re-run ten minutes later sees a fork point ~50 blocks further along, with a different
price and different reserves. If the true value is oscillating near your assertion
boundary, you get a coin flip. Same commit, different answer — because the commit was
never the only input.

Two aggravators on top of that:

- Most RPC providers are a load-balanced pool of nodes whose heads are not perfectly in
  sync. Two requests in the same test run can land on nodes a block or two apart, so you
  can get an inconsistent view even within a single run.
- If some calls are being served through a partially-populated cache and others aren't,
  you can mix state from different blocks.

## 3. The steady slowdown

This is the part that usually gets misread as "the test suite grew."

Foundry caches fork RPC responses on disk keyed by `(chain id, block number, address,
slot)` — under `~/.foundry/cache/rpc/<chain>/<block>/`. **That cache is only useful when
the block number is pinned.** When you fork at `latest`, every run has a new block number,
so every run is a cold cache: every `eth_getStorageAt`, `eth_getCode`, `eth_call` and
account load goes over the wire, every time.

So as you added tests and touched more contracts over four months, the number of
uncached round-trips grew roughly linearly with the suite, and each round-trip costs a
network RTT plus provider queueing. That is your gradual slowdown. With a pinned block
the first run pays that cost once and every subsequent run is near-local.

## 4. The 429s

Same root cause, one step further. Cold-cache fork tests issue hundreds to thousands of
RPC calls per run, in bursts, with no reuse between runs. Free-tier plans meter on
requests/second and compute-units/month. You crossed the threshold as the suite grew;
now the provider throttles you.

And 429s feed straight back into symptom 2: a throttled or dropped state read surfaces
as a zero/empty account, a revert, or a retry served by a *different* node at a
*different* head. That is a second, nastier flakiness channel layered on the first.

---

# The fix

## Pin the fork block

```solidity
uint256 constant FORK_BLOCK = 20_000_000; // pick a concrete recent block, commit it

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
}
```

Better, move the endpoint into `foundry.toml` so aliases and caching are consistent:

```toml
[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"

[profile.default]
# leave fork caching on (it is the default); do NOT set no_storage_caching = true
```

```solidity
vm.createSelectFork("mainnet", FORK_BLOCK);
```

What this buys you, symptom by symptom:

- **Reds/flakiness:** the Chainlink round and the pool reserves at block N are immutable
  history. `latestRoundData()` returns the same round forever; `getReserves()` returns the
  same reserves forever. The test becomes a pure function of the commit. You can now
  assert exact values rather than bands.
- **Slowdown:** the on-disk cache actually hits. Run one is slow; every run after is fast.
- **429s:** request volume collapses to ~zero for cached blocks. You only pay again when
  you deliberately bump `FORK_BLOCK`.

`block.timestamp` is also pinned, so any Chainlink staleness check
(`block.timestamp - updatedAt < heartbeat`) still behaves correctly at the pinned block —
which is exactly why you must *pin*, not merely *hardcode expected values*. Hardcoding
expected values against a `latest` fork would make the staleness check the new flake.

## Persist the cache in CI

Pinning only pays off if CI keeps the cache between jobs:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.foundry/cache/rpc
    key: foundry-rpc-${{ hashFiles('**/ForkConfig.sol') }}   # or just the block number
```

Key it on the pinned block number so a deliberate bump invalidates it. With this, CI
makes essentially no RPC calls on the steady state, which is what actually ends the 429s.

## Bumping the block

Treat `FORK_BLOCK` as a dependency version. Bump it intentionally in its own PR, update
the expected values in the same commit, and let review see the diff. Never let it float.

## Where pinning isn't the right tool

If a test is really about *your* logic and the oracle/pool is just an input, don't fork
for it at all — use a `MockV3Aggregator` and a mock pair, or `vm.mockCall`. That test then
needs no RPC, no archive access, and no block pin. Keep forking for the tests that are
genuinely about integrating with the deployed contracts.

---

# The free-tier question — answered plainly

**Partly. Pinning itself is free; pinning to a block older than the provider's pruning
window needs archive access, and a free tier may or may not give you that.**

Concretely:

- Forking at a pinned block requires historical `eth_call` / `eth_getStorageAt` /
  `eth_getCode` **at that block's state root**.
- A pruned full node keeps only the most recent ~128 blocks of state (~25 minutes). Ask
  it for older state and you get `missing trie node`, `header not found`, or
  `state at block N is not available` — not a clean error you can ignore, the whole fork
  fails to set up.
- An archive node keeps all historical state. **That is the thing you may need and may
  not have.**

Where free tiers actually land, as of writing: Alchemy and Infura both serve archive
data on their free tiers (you are metered on compute units, not on archive access), so
pinning generally works there — and because pinning slashes your request volume, it makes
you *less* likely to hit the free-tier cap, not more. Public/community endpoints
(`eth.llamarpc.com`, `cloudflare-eth.com`, `rpc.ankr.com/eth` and similar) are commonly
pruned, and those are the ones that will break.

**How to tell, in ten seconds — don't guess, measure:**

```bash
# pick a block well outside any pruning window, e.g. a few days old
BLOCK=20000000
cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 "latestRoundData()" \
  --block $BLOCK --rpc-url "$MAINNET_RPC_URL"
```

(that address is the Chainlink ETH/USD aggregator)

- Returns hex data → **archive available, pinning works, you're done.**
- Errors with `missing trie node`, `header not found`, or `state not available` →
  **pruned, no archive.**

A second, blunter check:

```bash
cast balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \
  --block 1000000 --rpc-url "$MAINNET_RPC_URL"
```

Block 1,000,000 is ancient; if that returns a number, you have archive.

## If the check says "no archive"

Three options, best first:

1. **Warm the cache once from an archive source, then commit or CI-cache it.** Foundry's
   fork cache is plain JSON under `~/.foundry/cache/rpc/mainnet/<block>/`. Populate it
   once from any endpoint that does serve archive data (a friend's node, a one-off free
   Alchemy key, a trial), then check it into the repo or seed the CI cache from an
   artifact. After that, CI needs **no** archive endpoint and no network at all for those
   blocks. This is the cleanest answer to "free tier, pinned, deterministic."

2. **Drop the fork for these two tests.** Record the Chainlink round and the pool reserves
   at the chosen block, and replay them through `MockV3Aggregator` / `vm.mockCall`. Zero
   RPC, fully deterministic, no archive requirement. Right call if the tests are about
   your handling of those values rather than about the integration itself.

3. **Pin to a recent block inside the pruning window.** Works, but only until the node
   prunes past it — you would be re-bumping every few hours. Use this only as a stopgap;
   it does not actually end the flakiness, it just moves it.

What I would *not* do is leave the fork unpinned and widen the assertion bounds. That
trades a test that fails loudly for one that passes while asserting nothing, and it leaves
the slowdown and the 429s completely unaddressed — because those come from the cache
misses, not from the assertions.
