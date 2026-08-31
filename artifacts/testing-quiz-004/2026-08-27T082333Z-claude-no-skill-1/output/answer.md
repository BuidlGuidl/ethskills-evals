# Why all four symptoms are one bug

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

No block number. That overload forks at **`latest`**. Your test suite has no fixed
input — it reads whatever mainnet happens to be doing at the moment CI runs. Every
symptom falls out of that one fact.

## 1. The sudden reds

Chainlink `latestRoundData()` and Uniswap `getReserves()` are live state. The ETH/USD
feed updates on a deviation threshold plus a heartbeat, so it moves several times a
day; pool reserves move on every swap.

Your assertions encode values (or a tolerance band) observed on the day you wrote them.
Nothing broke this morning — the drift finally crossed your threshold. The test was
always time-dependent; four months is just how long it took to fail. "Nobody touched
the code" is true and irrelevant: the input to the test isn't in the repo.

## 2. The flakiness on re-run

Re-running picks a *different* `latest`. Between two runs the price can tick, a swap
can land, and you're on the other side of the assertion. Worse, "latest" isn't even a
single value within one run: providers load-balance across nodes that are a block or
two apart, so two RPC calls in the same test can see different heads.

## 3. The slowdown

Foundry caches forked state on disk under `~/.foundry/cache/rpc/<chain>/<block>/`,
keyed **by block number**. A fork pinned to a block is cached and replayed. A fork at
`latest` is not reusable — the key changes every run, so every run re-fetches every
account, code blob, and storage slot over the network, cold.

Four months of added tests and added contracts touched = monotonically more cold
fetches per run. That's your curve.

## 4. The 429s

Direct consequence of 3. Zero cache reuse means the whole suite's state reads go over
the wire, in bursts (Foundry runs test contracts in parallel, each with its own fork
backend). Request volume grew with the suite until it crossed the free tier's limit.

And this closes the loop back to symptom 1: **some of your three reds are probably 429s
in disguise.** A dropped state read surfaces as a failed `eth_call` or a zero/empty
return, which your test reports as a value assertion failure, not as a network error.
Check the CI logs for `backend`, `429`, or `could not instantiate forked environment`
before assuming the price drifted.

# The fix

## Pin the block

```solidity
// foundry.toml
// [rpc_endpoints]
// mainnet = "${MAINNET_RPC_URL}"

uint256 constant FORK_BLOCK = 20_000_000; // pick a real, finalized block

function setUp() public {
    vm.createSelectFork("mainnet", FORK_BLOCK);
}
```

Pick a block a few hundred behind head at the time you pin, so you're past any reorg
depth. Never pin inside the last ~128 blocks (see the archive section — it would work
on any node but reintroduces the non-determinism you're removing).

## Re-derive the expected values at that block, and assert them exactly

Pinning makes the oracle price and the reserves *constants*. Stop using tolerance
bands — a band is only there to paper over drift, and it hides real regressions.

```bash
# Chainlink ETH/USD feed
cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 \
  "latestRoundData()(uint80,int256,uint256,uint256,uint80)" \
  --rpc-url "$MAINNET_RPC_URL" --block 20000000

# Uniswap V2 pair reserves
cast call <PAIR> "getReserves()(uint112,uint112,uint32)" \
  --rpc-url "$MAINNET_RPC_URL" --block 20000000
```

Paste those into the test as exact expected values.

Note: `block.timestamp` becomes the pinned block's timestamp. That's what you want —
any oracle staleness check now evaluates consistently. But audit any `vm.warp` that was
written relative to wall-clock-ish assumptions.

## Cache the fork data in CI

Pinning only pays off if the cache survives between jobs:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.foundry/cache/rpc
    key: foundry-rpc-mainnet-20000000
```

After the first run, the suite replays almost entirely from disk. That fixes the
slowdown and the 429s together.

## Keep a canary, out of the PR path

You lose one real signal by pinning: "does our integration still work against mainnet
*today*." Get it back as a scheduled nightly job that forks `latest` and is allowed to
go red without blocking anyone. Deterministic tests gate PRs; the canary tells you when
the world moved.

# The free-tier constraint — straight answer

**The fix needs archive access, and your free-tier endpoint may not have it.**

Reading state at a historical block — `eth_getStorageAt`, `eth_getCode`, `eth_call`
with a block tag — requires the node to still have the state trie at that block. A
pruned full node keeps roughly the last 128 blocks (~25 minutes) and discards the rest.
Foundry does exactly these calls to build a pinned fork, so pinning to a block from
last week against a non-archive endpoint simply fails.

Free tiers vary by provider and the terms change; don't trust anyone's recollection of
Alchemy's or Infura's current policy, including mine. Probe it:

```bash
cast block-number --rpc-url "$MAINNET_RPC_URL"

# then read state ~1M blocks back
cast storage 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 0 \
  --rpc-url "$MAINNET_RPC_URL" --block 19000000
```

- Returns a value → archive-backed. Pin and you're done.
- `missing trie node`, `-32000`, `state not available`, `header not found`, or an
  explicit "archive data requires a paid plan" → **not archive**. Pinning will not work.

Second, separate thing the free tier may not give you: **enough rate-limit headroom for
the first, cold run.** Pinning removes the *repeated* cost, not the initial one. If CI
can't persist `~/.foundry/cache/rpc`, every job pays full price and you'll still see
429s. Archive access and cache persistence are two independent requirements.

## If the probe says "not archive"

Options, best first:

1. **Get archive access.** Cheapest real fix — entry paid tiers at Alchemy /
   QuickNode / Ankr are in the tens-of-dollars range and remove both constraints. If
   you have any budget at all, stop here.
2. **Don't fork for these two tests.** A Chainlink price and a pair's reserves don't
   need real mainnet. Deploy a `MockV3Aggregator` and a local V2 pair with seeded
   reserves. Fully deterministic, zero RPC, zero 429s, runs offline. Fork tests then
   only need to answer "does our wiring work against real bytecode" — a smaller job you
   run nightly, not on every PR.
3. **Snapshot the state you need once** into a fixture and rebuild it with `vm.etch` /
   `vm.store`. Works, but you now maintain a hand-rolled state dump.
4. **Local anvil**: `anvil --fork-url ... --fork-block-number N`, kept alive across the
   suite. Still needs archive for the initial fetch — this solves rate limits, not the
   archive requirement.

For your case I'd do 2 for the three failing tests regardless of the probe result.
Asserting a real Chainlink price in a PR-gating test is testing mainnet, not your code.

# Unresolved

- Are the three failures actually value drift, or 429s misreported? Check the CI log
  error text before pinning — if it's 429s, the cache fix matters more than the pin.
- Do the reds come from hardcoded expected values or a tolerance band? Changes how much
  test rewriting the pin implies.
- Which provider is `MAINNET_RPC_URL`? Determines whether the archive probe is likely
  to pass.
- Can CI persist `~/.foundry/cache/rpc`? If not, pinning alone won't stop the 429s.
- What are those three tests actually meant to prove — that your integration decodes an
  oracle correctly (mock it), or that mainnet is reachable (canary job)?
