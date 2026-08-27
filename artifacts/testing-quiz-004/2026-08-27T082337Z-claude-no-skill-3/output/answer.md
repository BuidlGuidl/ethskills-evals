# Unpinned fork: one root cause, four symptoms

## The single cause

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

The one-argument overload forks at **`latest`**. There is no pinned block anywhere in
the setup, so the block your tests run against is whatever mainnet happens to be at the
moment `setUp` executes. That is not an input you control — it changes every 12 seconds,
and it differs between the CI run and the re-run of the same commit.

The code didn't change. The chain did. Everything below follows from that.

## Symptom by symptom

**The sudden reds.** The three failing tests assert on a Chainlink answer and on a
Uniswap pool's reserves — both are live chain state, both move continuously. Those
assertions were written against whatever the values were four months ago, presumably
with some tolerance band, or with a hardcoded expected number that happened to still
hold. They didn't go red because something broke this morning; they went red because
mainnet finally drifted out of the band. Reserves move on every swap; a Chainlink feed
updates on its deviation threshold or heartbeat. The tests were always going to fail —
the only question was which morning.

**Green on re-run, same commit.** Each run forks at a different `latest`. A re-run five
minutes later picks up ~25 new blocks. If the price is oscillating near your assertion
boundary, or the pool's reserves are near it, you land inside the band on one run and
outside on the next. Same commit, same deps, different chain — so the pass/fail is a
coin flip weighted by how far the value currently sits from your threshold. This is the
tell that the input is the chain, not the code.

**The four-month slowdown.** Foundry caches fork RPC responses on disk, keyed by
**chain id + block number**, under `~/.foundry/cache/rpc/mainnet/<block>/storage.json`.
That cache is only useful if you keep hitting the same block. Forking at `latest` means
every single run is a brand-new cache key, so every run is a 100% cold fetch: every
`eth_getStorageAt`, `eth_call`, `eth_getBalance`, and account load for every slot your
tests touch goes over the network, serially, at whatever your provider's latency is.
The suite has been getting slower because it has grown — more tests, more contracts
touched, more slots — and none of that growth is amortized by the cache. A pinned suite
gets slower in cache-cold runs only; yours is cold every time. (The `~/.foundry/cache`
directory has also been quietly accumulating one directory per block ever seen, which
does nothing for you but consume disk on the runner.)

**The 429s.** Same mechanism, one step further. Cold-cache means a large, bursty volume
of RPC calls per run, and it has been growing monotonically for four months. Last week
you crossed your free tier's rate/compute-unit limit. That is why the 429s appeared
"suddenly" without a code change — it was a slow ramp hitting a hard ceiling.

The 429s then feed back into the flakiness as a *second, independent* failure mode: a
throttled response during a fork read surfaces as a revert, a zero/empty return, or an
outright RPC error mid-test. So some of your red runs are stale-assertion failures and
some are throttling failures, which is why the failures look inconsistent in shape as
well as in timing.

## The fix

Pin the block. Two edits.

**1. Pin the fork.**

```solidity
uint256 constant FORK_BLOCK = 21_500_000; // pick a recent finalized block, then freeze it

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
}
```

Or declaratively, in `foundry.toml`, if every test in the profile wants the same fork:

```toml
[profile.default]
eth_rpc_url = "${MAINNET_RPC_URL}"
fork_block_number = 21500000
```

Prefer the explicit `createSelectFork(url, block)` form if different test contracts need
different blocks (e.g. one pinned before a governance action and one after) — it keeps
the block visible next to the assertions that depend on it.

**2. Re-derive the expected values at that exact block, and assert them exactly.**

Once the block is pinned, the Chainlink answer and the pool reserves are constants.
Stop asserting with a tolerance band around a guess:

```bash
cast call $FEED "latestRoundData()" --block 21500000 --rpc-url $MAINNET_RPC_URL
cast call $PAIR "getReserves()"     --block 21500000 --rpc-url $MAINNET_RPC_URL
```

and write those literals into `assertEq`. A tolerance band on an unpinned fork is not a
test, it's a bet on volatility. A pinned block turns these into ordinary deterministic
unit tests: they can only go red if *your* code changes behaviour.

Add a comment recording *why* that block was chosen (post-upgrade, mid-cycle, whatever),
so the next person knows whether bumping it is safe.

**3. Cache the fork data in CI.** This is what actually kills the 429s. With a pinned
block the cache key is stable, so persist it:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.foundry/cache/rpc
    key: foundry-rpc-mainnet-${{ hashFiles('**/foundry.toml') }}-21500000
```

After the first run, subsequent CI runs make close to zero RPC calls. The suite gets
dramatically faster and stops touching your rate limit at all. This also means the
slowdown and the 429s are fixed by the same change as the flakiness — they were never
separate problems.

Also worth doing while you're here: set `FOUNDRY_FORK_RETRY` / use a provider with
retry-on-429, and drop `--gas-report` on fork runs if you're using it, since it forces
extra state reads.

## Whether this works on a free-tier endpoint — plainly

**Partly. The fix requires archive access, and a free-tier endpoint may or may not give
you it. This is the one thing you need to check before adopting the above.**

Here's the constraint. A pinned block that is more than **128 blocks** old (~25 minutes)
requires historical *state*, not just historical headers. A plain full node prunes state
beyond 128 blocks. So `eth_getStorageAt`, `eth_call`, and `eth_getBalance` **at a pinned
historical block** are archive-node operations. Forking at `latest` never needed this —
which is exactly why your current setup has worked on a free tier for four months, and
why pinning is the first time you'll find out what your endpoint actually is.

What you need, named precisely: **archive state access for `eth_getStorageAt`,
`eth_call`, `eth_getBalance`, and `eth_getCode` at an arbitrary historical block.**

The good news: most managed providers' free tiers *do* serve archive state — Alchemy's
free tier includes archive data, and Infura's free tier serves archive for these methods.
Public/community endpoints (`publicnode`, `cloudflare-eth`, `llamarpc`, a self-hosted
geth without `--gcmode=archive`) frequently do **not**. So it depends on which endpoint
`MAINNET_RPC_URL` points at, and you should not assume.

### How to tell — 30 seconds

Pick a block a few days old and try to read state at it:

```bash
# any block older than ~128; use a well-known contract
cast storage 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 0 \
  --block 21500000 --rpc-url "$MAINNET_RPC_URL"
```

- **Returns a value** → you have archive access. The fix above works as written. Done.
- **Errors** → you don't. The error text is the giveaway; look for any of:
  - `missing trie node`
  - `header not found`
  - `-32000: state not available` / `historical state not available`
  - `-32601 method not found` (some tiers gate archive behind a different method set)
  - a 401/403/upgrade-required message naming your plan

Run the same check against the *actual* block you intend to pin, not just a sample one,
and re-run it whenever you bump the pin.

### If it turns out you don't have archive access

In rough order of preference:

1. **Move the endpoint, not the strategy.** Alchemy/Infura free tiers include archive
   state. A free API key from one of them is a five-minute change to a CI secret and
   costs nothing. This is almost always the right answer — don't contort the tests to
   work around a provider limitation you can remove for free.

2. **Commit the fork cache.** Since a pinned block's RPC responses are immutable, you
   can check `~/.foundry/cache/rpc/mainnet/<block>/` into the repo (or into a small
   artifact repo). After that CI needs *no* archive access and *no* RPC at all for the
   cached slots — it only hits the network for a slot the cache doesn't have, which
   means CI stops depending on the provider entirely. Cost is repo size and a manual
   refresh step when you touch new state; the payoff is a genuinely hermetic suite.
   Warm the cache once locally against an archive endpoint, then commit it.

3. **Stop forking for these three tests.** The assertions are on a Chainlink answer and
   on pool reserves — neither needs a real fork to be a meaningful test of *your* code.
   Deploy a mock aggregator returning a fixed answer, and either a mock pair or a real
   Uniswap pair seeded via `deal`, and test your logic against known inputs. Keep one
   thin fork test as an integration smoke check that the mainnet addresses and interfaces
   are still what you think they are. This is the most robust option long-term and the
   one that scales as the suite grows; it's listed third only because it's the most work.

Not recommended: pinning to a block within the last 128 and hoping. That reintroduces
nondeterminism (the block ages out between the CI run and the re-run) and gives you a
new, more confusing flake.

## The one-line version

Nothing broke — you were never testing a fixed input. `createSelectFork(url)` forks at
`latest`, so the chain is an uncontrolled input: it drifted past your assertion
thresholds (the reds), it differs run-to-run (the flakiness), it makes Foundry's
block-keyed RPC cache useless so every run is fully cold (the slowdown), and the
resulting call volume finally hit your free tier's ceiling (the 429s). Pin the block,
re-derive the expected values at that block, and cache `~/.foundry/cache/rpc` in CI.
Confirm first that your endpoint serves archive state at that block — `cast storage
... --block <pinned>`; `missing trie node` or `header not found` means it doesn't, and
a free Alchemy/Infura key or a committed cache directory is the way around it.
