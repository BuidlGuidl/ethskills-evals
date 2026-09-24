# Why vesting "freezes" on `yarn fork`, then jumps

## Mining behavior: time only moves when a block is mined

`yarn fork` runs Anvil. By default Anvil **auto-mines**: it makes a new block only when a transaction arrives. No transactions means no new blocks.

- `block.timestamp` belongs to the block. Read calls (`eth_call`) run against the **latest mined block**.
- So between transactions the latest block never changes, and its timestamp stays fixed at the moment the last block was mined.
- The vesting page polls `claimable()` via a view call. Every poll runs against the same old block, sees the same `block.timestamp`, and gets the same number. The UI updates fine; the chain's clock is what's stuck.

## Why one unrelated transaction unfreezes it in one jump

Any transaction (to any address, even a plain ETH send) makes Anvil mine a new block. That block gets the current wall-clock time as its timestamp. So `block.timestamp` goes straight from "time of last block" to "now", skipping everything in between. The vesting math is `f(block.timestamp)`, so claimable jumps by everything that vested during the idle gap. Then no more blocks come, and it freezes again at the new value.

The contract math is correct. It just only sees time in the steps where blocks were mined.

## Why the forge tests never caught it

The tests use `vm.warp`, which **sets** `block.timestamp` directly inside the test EVM. They check that "given timestamp T, claimable = X", and that part really is correct.

What they don't test is whether the chain's timestamp **moves on its own** while the app sits idle. That depends on how the node mines blocks (the local node's setup), not on the contract, and unit tests never run a live node or check how a UI's view calls behave over wall-clock time. So all tests pass while the demo still freezes. Nothing in the code was wrong. The problem was in the environment.

## Fixes

**One-off (fork already running, fix it now):** turn on interval mining so Anvil makes a block every second whether or not transactions arrive:

```bash
cast rpc anvil_setIntervalMining 1
```

`block.timestamp` now moves forward every second and the claimable balance goes up smoothly. It lasts until the node restarts.

Don't use `evm_mine` or `evm_increaseTime` for this. They update the timestamp once and it freezes again right away. They're meant for controlled one-step testing, not a live demo.

**Permanent:** start Anvil with a block time every time. Add `--block-time 1` to the fork script (the `fork` script / Anvil command the `yarn fork` target runs in `packages/foundry`, e.g. `anvil --fork-url ... --block-time 1`). Now every `yarn fork` run mines one block per second from the start, and nobody has to remember the `cast rpc` call before a demo.

(Unrelated tip: in fork mode, keep the frontend pointed at the local Anvil chain, `chains.foundry` / chain ID 31337, not Base itself.)
