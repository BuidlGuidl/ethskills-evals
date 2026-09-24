# Why vesting balance freezes on `yarn fork --network base`

## 1. Mining behavior: time stands still

`yarn fork` runs Anvil (local test chain) in **automine** mode by default: a new block is mined **only when a transaction arrives**. No tx → no new block.

- `block.timestamp` belongs to a block. No new block → the latest block's timestamp stays the same.
- Frontend reads `claimable()` via `eth_call` against `latest` block → contract sees the same `block.timestamp` every poll → same number, forever.
- Wall clock keeps moving; chain clock does not. Fork = copy of Base state, but **not** Base's ~2s block production.

## 2. Why one unrelated tx un-freezes it in one jump

- Any tx (even a 0-value send between random accounts) makes Anvil mine a block.
- New block gets timestamp ≈ **current wall-clock time** (Anvil uses real time, not "previous + 1s").
- So the gap between the old block and the new one = all the minutes that passed idle.
- Vesting math is linear in `block.timestamp - start` → the whole missing amount appears at once. Nothing is "caught up" gradually because no blocks existed in between.

The contract is correct; it's just only asked "what time is it?" at two moments far apart.

## 3. Why forge tests never caught it

- `vm.warp(t)` **sets** `block.timestamp` directly inside the test EVM. Tests say "pretend it's time T" and check the math at T. Math is right → tests pass.
- Tests never exercise *how time advances on a live node*. They skip block production entirely. Freezing is a property of the local dev chain's mining config, not of the contract.
- So: tests verify "given timestamp, correct amount"; the bug is "the timestamp never changes." Different layer, nothing in the test suite touches it.

## 4. Fixes

**One-off (running fork, no restart):**

```bash
cast rpc anvil_setIntervalMining 1
```

Anvil now mines a block every 1s regardless of txs → `block.timestamp` ticks → balance updates live in the UI (with frontend polling, e.g. `pollingInterval: 3000`). Resets when fork restarts.

(Alternative manual nudge for a single catch-up: `cast rpc evm_mine` — same as the "unrelated tx" trick, still a jump.)

**Permanent:** add `--block-time 1` to the fork script in `packages/foundry/package.json`, e.g.

```json
"fork": "anvil --fork-url ${FORK_URL} --chain-id 31337 --block-time 1"
```

(keep whatever flags your script already has; just append `--block-time 1`). Every `yarn fork` now produces a block per second, like a real chain.

## Takeaway

Any timestamp-driven logic (vesting, deadlines, expiries, auctions) needs interval mining on the local fork. Without it, it breaks silently: no errors, just a stuck number that jumps the next time someone sends a tx.
