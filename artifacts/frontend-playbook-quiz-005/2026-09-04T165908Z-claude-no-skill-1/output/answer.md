# Why the vesting number freezes on a local fork

**Short version:** nothing is wrong with your vesting math or your frontend. `yarn fork`
starts anvil in its default *auto-mining* mode, which mines a block **only when a
transaction arrives**. `block.timestamp` is a property of a block header, so on an idle
node there is no new header and therefore no new time. Your UI is reading a correct value
from a chain whose clock only ticks when someone pokes it.

---

## 1. The mining behaviour that stops time

`anvil` has three mining modes:

| mode | flag | blocks are produced |
| --- | --- | --- |
| **auto-mine (default)** | *(none)* | one block per transaction, immediately |
| interval | `--block-time N` / `-b N` | every `N` seconds, tx or not |
| manual | `--no-mining` | only on `evm_mine` / `anvil_mine` |

`yarn fork --network base` resolves to something like
`anvil --fork-url <base-rpc> --chain-id 31337 ...` with **no `-b` flag**, so you get
auto-mine. During a demo where nobody submits a transaction, the chain is genuinely
idle: block height stays at N, and block N's header keeps whatever timestamp it was
sealed with.

Everything downstream inherits that frozen header:

- `eth_call` (what `useScaffoldReadContract` / viem's `readContract` issues at
  `blockTag: "latest"`) executes your view function in the EVM environment of the head
  block. `block.timestamp` inside that call **is** the head block's timestamp — not the
  wall clock, not "now".
- So `claimable()` returns a bit-for-bit identical value on every poll. Refetching faster
  cannot help; you are resampling the same block.
- Second-order effect: wagmi's `watch: true` refetch is driven by `eth_blockNumber`
  changing. No blocks means no block-number change means the hook does not even bother to
  refetch. The number is stale *and* the invalidation that would refresh it is asleep.

On real Base this never shows up, because Base seals a block every ~2s, so the head
timestamp advances continuously and your vesting curve looks smooth. The bug is an
artifact of the local node's block production, not of the contract, and not of the
network you forked.

## 2. Why one unrelated transaction un-freezes it in a single jump

Any transaction — a token transfer, a failed call, someone clicking a different button —
triggers auto-mine, and anvil seals block N+1.

The crucial detail is **how anvil picks that block's timestamp**. It does not use
`parent.timestamp + 1`. It keeps a time manager holding an offset between the chain clock
and the host system clock (initialised at fork time from the forked block's timestamp), and
by default computes the next block's timestamp as *system clock + offset*. So the new
block's timestamp reflects **all the wall-clock seconds that elapsed while the chain was
idle**, and it lands in one header.

Result: your vesting function, which is continuous in `t`, is being sampled as a step
function at block boundaries. Ten minutes of idle demo, then one stray transaction, and
`claimable()` advances by ten minutes' worth of tokens in a single step. It is not a
rounding bug or a re-entrancy issue or a caching issue — it is one sample of a correct
curve at a point that jumped.

The same mechanism explains the *first* jump after startup: a fresh fork's head is the
real Base block you forked at, so the very first locally mined block already absorbs the
gap between fork time and now.

## 3. Why the passing forge tests never caught it

`vm.warp(x)` **writes the timestamp directly into the EVM environment.** There is no block
producer inside `forge test` — no mempool, no auto-mine, no wall clock. Each test is
effectively a single synthetic block whose timestamp you dictate by hand.

So your tests assert:

> given a timestamp `t`, `vested(t)` is correct

…and that assertion is true. It was true before the demo and it is true now. What the demo
exposed is a different proposition:

> the node keeps supplying fresh values of `t`

which is a property of **block production**, not of the contract. `vm.warp` supplies `t`
unconditionally, which is exactly what papers over the failure: the tests hardcode the
thing that is broken. A unit test of `f(t)` can never fail because the environment stopped
delivering new `t`.

Two coverage gaps stack here:

1. No test exercises the real read path (`eth_call` at `latest` against a live node) — only
   the in-process EVM.
2. No test asserts liveness of the chain clock at all.

The smallest test that would have caught it is an integration test, not a unit test:
against a running anvil, read `claimable()`, wait ~5 seconds, read again, assert it
increased. That test fails against default auto-mine anvil and passes with `-b 1`.

## 4. Fixes

### One-off, right now, without restarting the node

Turn on interval mining at runtime over RPC:

```bash
cast rpc anvil_setIntervalMining 2 --rpc-url http://127.0.0.1:8545
```

From then on anvil seals a block every 2 seconds (matching Base) whether or not anyone
transacts, and the UI ticks smoothly. Related one-shot escape hatches:

```bash
cast rpc evm_mine --rpc-url http://127.0.0.1:8545                  # seal one block, catch the clock up
cast rpc anvil_mine 0x0a --rpc-url http://127.0.0.1:8545           # seal 10 blocks
cast rpc evm_increaseTime 3600 --rpc-url http://127.0.0.1:8545 && \
cast rpc evm_mine --rpc-url http://127.0.0.1:8545                  # deliberately skip an hour of vesting
```

(`evm_increaseTime` + `evm_mine` is also the right tool for *demoing* the cliff or the end
of the vesting schedule without waiting for it.)

### Permanent

Add interval mining to the fork script so nobody has to remember. In
`packages/foundry/package.json`:

```diff
-"fork": "anvil --fork-url base --chain-id 31337",
+"fork": "anvil --fork-url base --chain-id 31337 --block-time 2",
```

(That is the literal command line your `yarn fork --network base` is running right now —
see below — so the only change needed is the added flag.)

`--block-time 2` mirrors Base's ~2s cadence, so local behaviour matches production. Use
`--block-time 12` if you would rather match an L1-ish feel; the exact number matters less
than it being non-zero. Do the same for the plain `yarn chain` script — the freeze is not
fork-specific, it hits any default anvil.

If your local chain is Hardhat rather than anvil, the equivalent is in `hardhat.config.ts`:

```ts
networks: {
  hardhat: {
    mining: { auto: true, interval: 2000 },
  },
},
```

Trade-offs worth knowing before you commit it:

- Interval mining produces empty blocks forever, so a long-lived node grows block height
  (and log noise) steadily. Harmless for local dev; it is why it is not the default.
- Deploy scripts or tests that pin timestamps with `evm_setNextBlockTimestamp` can now race
  the interval miner. If you have any, either set the timestamp and mine explicitly, or
  disable interval mining (`cast rpc anvil_setIntervalMining 0`) for the duration.
- Timestamps still cannot go backwards, so `evm_increaseTime` is one-way — restart the fork
  to undo a big jump.

### What *not* to do

Do not "fix" this in the contract, and do not extrapolate the balance client-side from
`Date.now()`. Client-side interpolation is a legitimate UI polish trick on a real network
(where blocks are regular), but adding it now would hide this class of local-node problem
instead of fixing it, and it would drift from the value the contract will actually pay out.

## 5. Reproduction

Default anvil, no fork needed — the behaviour is identical:

```bash
anvil &                                     # auto-mine, the default
cast block latest --field timestamp         # t0
sleep 12
cast block latest --field timestamp         # identical to t0; block number unchanged
cast send <anything>                        # any transaction at all
cast block latest --field timestamp         # t0 + ~12, in one step
cast rpc anvil_setIntervalMining 2
sleep 8
cast block latest --field timestamp         # advanced ~8s, several new blocks, no txs
```

Measured on anvil 1.5.1 with exactly that script:

```
t0                        = 1788541226   block 0
t1  (after 12s idle)      = 1788541226   block 0   <- clock frozen, zero blocks produced
t2  (after 1 unrelated tx)= 1788541241   block 1   <- +15s absorbed into a single block
t3  (interval mining, 8s) = 1788541249   block 5   <- 4 blocks, no transactions, clock ticks
```

Line 2 is the frozen demo. Line 3 is the jump. Line 4 is the fix.

## 6. Confirmed on your actual running node

The fork from this session is still up as
`anvil --fork-url base --chain-id 31337` — note the absent `--block-time`. Querying it:

```
$ date +%s                                 -> 1788541294   (wall clock)
$ cast block-number                        -> 50875808     (still the forked Base block)
$ cast block latest --field timestamp      -> 1788540999   (295s = ~5 minutes stale)
```

Zero blocks mined since the fork started, and the head timestamp is ~5 minutes behind the
wall clock. Every `claimable()` read your page makes right now is being evaluated at
`block.timestamp = 1788540999`. The next transaction anyone sends will mine one block at
~`1788541294`, and the balance will jump by ~5 minutes of vesting in one step.
