# Why the vesting clock freezes on a local fork

## Short version

Nothing is wrong with your vesting math or your frontend. Anvil is running in
its default **on-demand (auto-mining) mode**: it mines a block *only when a
transaction arrives*. Between transactions there is no new block, so
`block.timestamp` on the latest block never moves, and every `eth_call` your
frontend makes is executed against that same frozen block. The contract keeps
computing the same claimable amount because, as far as the chain is concerned,
no time has passed.

## The mining behavior

`yarn fork --network base` starts Anvil with a forked state root and default
mining settings. In that mode:

- A block is produced when, and only when, a transaction is submitted.
- `block.timestamp` is stamped at block production time, from wall-clock time.
- Read-only `eth_call` / `eth_getStorageAt` requests do **not** produce a block.
  They are evaluated against the current latest block's header — including its
  now-stale timestamp.

Your vesting view calls something like `claimable(address)`, which internally
does `block.timestamp - start` (or `min(block.timestamp, end)`). Your wagmi /
Scaffold-ETH `useScaffoldReadContract` hook is polling every few seconds and
faithfully re-reading the contract — but each poll re-executes against the same
header, so it returns a bit-for-bit identical number. The UI looks stuck
because the chain is stuck, not because polling stopped.

## Why one unrelated transaction un-freezes it in a single jump

When anyone finally sends *any* transaction — a token approval, a faucet
transfer, a wallet's nonce probe — Anvil mines a block to include it. That new
block's timestamp is taken from the current wall clock, which is now minutes
ahead of the previous block. So the chain jumps forward by the entire elapsed
interval in one step.

The next `eth_call` runs against that new header, and `block.timestamp - start`
increases by the whole gap at once. The claimable balance therefore steps up by
exactly the amount that "should" have accrued during the frozen minutes. The
transaction was never related to vesting; it simply acted as the trigger that
advanced the clock.

## Why the forge tests never caught it

`vm.warp(...)` sets `block.timestamp` directly in the EVM cheatcode
environment. Your tests assert the *pure vesting function* — given timestamp
`t`, the contract returns the right amount — and that assertion is correct and
will stay correct.

What the tests never exercise is *how the timestamp advances on a live node*.
`vm.warp` is a manual, explicit step; it models the passage of time by fiat. It
cannot detect that the real fork only advances its timestamp as a side effect of
transaction inclusion. The bug lives entirely in the node's block production
policy — a layer below the contract and outside the test harness. A unit test
suite for the math will pass on a chain that never mines at all.

This is a general trap for anything time-dependent read from the frontend:
vesting/streaming displays, auction and TWAP clocks, deadline countdowns,
permit/signature expiry, cooldown timers. All of them look frozen on a default
local fork and all of them have green `vm.warp` tests.

## The fixes

### One-off (unblock the demo right now, no restart)

Turn on interval mining against the already-running fork:

```bash
cast rpc anvil_setIntervalMining 1
```

Anvil will now produce a block every second regardless of transaction
activity, so `block.timestamp` advances continuously and the claimable balance
ticks smoothly. This takes effect immediately on the live node — you do not
lose your forked state, impersonated accounts, or already-deployed contracts.

Note what *not* to reach for:

- `evm_mine` mines exactly one block. It restamps `block.timestamp` once, the
  number updates once, and then it freezes again immediately. You would be
  hand-cranking the clock for the whole demo.
- `evm_increaseTime` offsets the clock for the *next* block, so it still needs
  a block to be mined and is still a single manual step.

Both are the right tools for deterministic single-step tests, and the wrong
tools for a demo that needs to look like a running chain.

### Permanent (make the project always behave this way)

Bake the block time into the fork script so nobody has to remember the
incantation. In `packages/foundry/package.json`, add `--block-time 1` to the
`fork` script:

```jsonc
"fork": "anvil --fork-url ${FORK_URL} --chain-id 31337 --block-time 1"
```

(Adjust to match your existing script's flags — the point is the added
`--block-time 1`.) Now `yarn fork --network base` starts with interval mining
enabled from the first block, and every time-dependent view in the app behaves
like it will on the real chain.

Keep `yarn chain` and your Foundry tests as they are: deterministic on-demand
mining plus `vm.warp` is exactly what you want for unit tests. The continuous
clock is a property of the *demo/integration* environment, not of the test
environment.

## One thing to double check while you're here

Confirm the frontend is pointed at the local Anvil network (`chains.foundry`,
chain ID 31337) rather than at Base itself while running in fork mode. If the
app reads from upstream Base, the timestamp will advance normally but you will
be reading the real deployed state instead of your fork — a different bug with
a superficially similar "the numbers aren't what I expect" symptom.
