# Why the vesting number freezes on `yarn fork --network base`

## Why time stops

`yarn fork` runs Anvil, a local test chain. By default Anvil does **not** create blocks on a timer. It only creates (mines) a block when a transaction arrives ("automine").

- `block.timestamp` is the timestamp of the latest block.
- Your page reads `claimable()` with an `eth_call` against the latest block.
- No new transactions means no new blocks. The latest block stays the same, so `block.timestamp` stays the same.
- The contract computes the same claimable amount every time → the number on screen doesn't move, even though real time keeps passing.

Polling the page more often doesn't help. Every read hits the same old block.

## Why one transaction makes it jump all at once

When someone sends any transaction, even an unrelated one, Anvil mines a new block for it. The new block gets the **current wall-clock time**, not "last block + 2s". So `block.timestamp` jumps from the frozen value straight to now. Vesting is linear in time, so claimable jumps by everything that should have vested during the pause. Then there are no more transactions, and it freezes again at the new value.

(The real Base chain makes a block every ~2s no matter what, so this never shows up there.)

## Why the forge tests passed

The tests check the **math**, not the **chain's behavior over time**:

- `vm.warp(t)` sets `block.timestamp` directly inside the test EVM. Each test says "pretend it's time t" and checks the result. The math is correct, so the tests pass.
- They never run against a live node that mines blocks, so they can't see that the node's clock only advances when a transaction arrives.
- In fact `vm.warp` hides the problem: it moves time forward for you, which is exactly what the demo chain was *not* doing.

The contract isn't broken. The demo environment is set up wrong. Unit tests can't catch that. Only watching the running app on the fork over real time would.

## Fixes

### One-off (running fork, right now)

Turn on interval mining so Anvil makes a block every second, even with no transactions:

```bash
cast rpc anvil_setIntervalMining 1
```

`block.timestamp` now moves every second, and the vesting number ticks up smoothly.

Not a fix: `cast rpc evm_mine` (or `evm_increaseTime`). That mines **one** block, so time updates once and freezes again right away. It's only good for controlled step-by-step tests, not a live demo.

### Permanent (every `yarn fork`)

Add `--block-time 1` to the Anvil command behind the fork script (in `packages/foundry/package.json`, the `fork` script), e.g.:

```json
"fork": "anvil --fork-url ${FORK_URL:-...} --chain-id 31337 --block-time 1"
```

Every fork you start now mines a block each second, so time-based UI (vesting, deadlines, expiry) behaves like a real chain. Optionally add a check to your demo checklist: leave the page open for ~30s with no transactions and confirm the number moves.
