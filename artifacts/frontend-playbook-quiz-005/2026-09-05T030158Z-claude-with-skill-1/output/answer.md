# Why the vesting clock freezes on a Base fork

## Short version

Nothing is wrong with your vesting math. Anvil is running in **on-demand
mining** mode: it mines a block only when a transaction arrives. Between
transactions there is no new block, so `block.timestamp` on the latest block
never changes — and your page is reading a `view` function that is evaluated
against that frozen latest block.

## The mining behavior

`yarn fork --network base` starts Anvil as a local fork (chain ID 31337) with
automining on transaction receipt and **no block interval**. The consequence:

- No transactions → no new blocks → the head block's `block.timestamp` is
  whatever it was when the last block was mined.
- Your frontend polls `claimable(address)` every few seconds. `eth_call`
  executes against the head block, so every one of those polls runs with the
  *same* `block.timestamp`. The contract is a pure function of that timestamp,
  so it returns the identical number every time. Wagmi/React sees an unchanged
  value and re-renders nothing.

The wall clock is moving. The chain's clock is not. The number on screen is
correct — it is just the answer to "what is claimable as of block N", and N is
not advancing.

## Why one unrelated transaction un-freezes it in a single jump

When any transaction finally arrives, Anvil mines a block for it. That new
block gets a timestamp taken from real (host) time, not "previous timestamp +
1". So a block that was 4 minutes stale is immediately replaced by a head block
4 minutes newer.

The next poll evaluates `claimable()` at that new head — and the whole 4
minutes of vesting materializes in one step. The transaction is irrelevant to
vesting; it is just the thing that forced a block to be mined. Any transaction
from anyone would do it, which is exactly why it looked like an unrelated
action was "triggering" the vesting.

So the two symptoms are one mechanism: time only exists on the fork at block
boundaries, and blocks only happen when someone pays for one.

## Why the forge tests never caught it

The tests and the demo exercise different things.

- `vm.warp(...)` *sets* `block.timestamp` directly in the test EVM. The tests
  assert "given timestamp T, `claimable` returns X" — and that assertion is
  true. The vesting formula is correct and the tests prove it.
- What the tests never assert is **that the timestamp advances on its own**.
  In a test, time advancing is something you do explicitly. On a live chain, it
  is something the block producer does for you. On an idle Anvil fork, nobody
  does it at all.

That gap is invisible to unit tests by construction: `vm.warp` is a substitute
for block production, so a test suite built on it can never detect that block
production is missing. Only a running node with a polling client sees it — i.e.
exactly your demo. Anything with a live clock has this exposure: vesting
displays, auction countdowns, deadline/expiry checks, TWAP staleness, streaming
payments.

## The one-off fix (fork already running, don't restart)

In a second terminal, turn on interval mining. Anvil then mines a block every N
seconds whether or not there are transactions:

```bash
cast rpc anvil_setIntervalMining 1
```

Takes effect immediately, no restart, no redeploy — the page starts ticking
within a second or two. This is the right move mid-demo.

## The permanent fix

Bake the block time into the fork script so nobody has to remember the manual
step. In `packages/foundry/package.json`, add `--block-time 1` to the `fork`
script:

```jsonc
{
  "scripts": {
    // before
    "fork": "anvil --fork-url ${0:-https://mainnet.base.org} --chain-id 31337 --config-out localhost.json",
    // after
    "fork": "anvil --fork-url ${0:-https://mainnet.base.org} --chain-id 31337 --block-time 1 --config-out localhost.json"
  }
}
```

(Match your repo's existing flags — the only addition is `--block-time 1`.)
From then on `yarn fork --network base` produces a chain whose clock runs, and
the demo behaves like the real network.

## What *not* to reach for here

`evm_mine` and `evm_increaseTime` are not lesser versions of this fix — they
are a different tool:

- `evm_mine` mines exactly one block, restamping `block.timestamp` once. The
  display updates once and then freezes again immediately.
- `evm_increaseTime` jumps the clock by a chosen offset on demand.

Both are correct and preferable for deterministic, controlled single-step tests
where you *want* time pinned. Neither substitutes for interval mining under a
live demo, because both require you to keep poking the chain by hand.

## Sanity check after applying either fix

```bash
cast block-number                       # run twice, ~3s apart — should differ
cast block latest --field timestamp     # should track real time
```

If the block number advances while you sit idle, the vesting number will too.
