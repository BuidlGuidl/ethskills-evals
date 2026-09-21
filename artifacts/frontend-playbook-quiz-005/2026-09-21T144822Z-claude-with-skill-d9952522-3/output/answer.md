# Why the claimable balance freezes on the fork, then jumps

## What's happening: Anvil only mines when a transaction arrives

By default, `yarn fork --network base` runs Anvil (Foundry's local node) in **automine** mode. It makes a new block only when a transaction comes in. It does not make blocks on a timer the way Base does (about every 2s).

- The frontend reads `claimable()` with an `eth_call` against the **latest block**.
- A view call runs with that block's `block.timestamp`. It does not use the wall clock.
- No transactions means no new block. The latest block stays the same, so `block.timestamp` stays the same and `claimable()` gives the same answer every time. The UI polls correctly, but it keeps getting the same number back.

So nothing is broken in the vesting math. On this chain, time really does stop between transactions.

## Why one unrelated transaction unfreezes it in a single jump

When any transaction arrives, Anvil mines a block and stamps it with the **current wall-clock time**. The new timestamp is not the old one plus a few seconds. It's the old one plus however many minutes passed with no blocks. The next `claimable()` read uses that timestamp, so all the vesting that built up during the gap shows up at once. After that, time freezes again until the next transaction.

The transaction doesn't have to touch the vesting contract. Any transaction makes a block, and any block moves the time forward.

## Why the forge tests never caught it

`vm.warp(t)` sets `block.timestamp` directly inside the test EVM. The tests check this: "given timestamp T, is claimable correct?" The math is right, so they pass.

They never check whether `block.timestamp` actually moves forward on the chain the demo runs on. That depends on how the node makes blocks, not on the contract, and `vm.warp` skips over it completely. Unit tests with fake time can't catch a problem with the real clock.

## Fixes

**One-off (on the fork that's already running):** turn on interval mining so Anvil makes a block every second whether or not transactions arrive:

```bash
cast rpc anvil_setIntervalMining 1
```

The balance will now go up smoothly. Don't use `evm_mine` or `evm_increaseTime` for a live demo. `evm_mine` makes one block, which updates the timestamp once, and then time freezes again right away. Both are meant for controlled step-by-step tests, not a running demo.

**Permanent:** make the fork script always start with a block time, so every `yarn fork` run behaves like a real chain:

```bash
anvil --fork-url <base-rpc> --block-time 1   # i.e. add --block-time 1 to the fork script in packages/foundry
```

Optionally add an integration check against the running node. It would read `claimable()`, wait a few seconds with no transactions, read it again, and require the value to have gone up. That catches this kind of problem, which `vm.warp` tests can't.
