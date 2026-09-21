# Why the vesting number freezes on `yarn fork --network base`, then jumps

## 1. Why time stops on the fork

`yarn fork` starts **Anvil** (Foundry's local node) with no block time set. By default Anvil uses **auto-mining**: it only makes a new block when a transaction comes in. No transactions means no new blocks.

- `block.timestamp` is the timestamp of the **latest block**, not the wall-clock time.
- Your claimable balance is a `view` call. View calls run against the latest block (Anvil runs them in a pending block context tied to that block, not to "now").
- So with no new blocks, every poll from the frontend (`useScaffoldReadContract`, polling every few seconds) runs the same function against the same `block.timestamp` and gets the same number back.

The UI is working fine. It re-reads correctly. The chain's clock just isn't moving.

## 2. Why one unrelated transaction fixes it in a single jump

When anyone sends a transaction, Anvil mines a block for it. Its timestamp is the **current wall-clock time**, not "last block + 1 second". So `block.timestamp` goes straight from the old frozen value to now. The contract's math is linear in time (`elapsed = block.timestamp - start`), so the claimable amount includes the whole gap at once. That's the jump.

The transaction doesn't have to touch the vesting contract. Any block moves the clock forward for every contract. After that, time freezes again until the next transaction.

(Related trap: a `claim()` sent after a long idle period is mined in a new block with a fresh timestamp. So the amount actually paid is larger than the frozen number the UI showed.)

## 3. Why the forge tests never caught it

- `vm.warp(t)` is a cheatcode that **sets `block.timestamp` directly** inside the test EVM. The tests control time themselves, so they never depend on blocks being mined.
- They check the **math** ("given timestamp T, claimable = X"), and that math is correct. The bug is in the **environment**: on the fork, T never moves on its own. A test that picks its own T can't notice that.
- Forge tests run in their own in-memory EVM, not against the running Anvil node, and have no mining schedule at all. Freezing only happens when a live node + frontend + wall-clock time are all in play, which is only true in the browser.

So the passing tests are right, but they test the wrong layer for this bug. You only catch it by watching the running app (playbook Phase 3: browser testing).

## 4. Fixes

### One-off (current session): turn on interval mining

```bash
# new terminal, while `yarn fork` is running
cast rpc anvil_setIntervalMining 1
```

Anvil now mines a block every second even with no transactions. `block.timestamp` moves forward and the claimable balance goes up smoothly at the next poll. This setting is lost when the fork restarts.

### Permanent: add block time to the fork script

Edit `packages/foundry/package.json` and add `--block-time 1` to the `fork` script, e.g.:

```json
"fork": "anvil --fork-url ${0:-base} --chain-id 31337 --config-out localhost.json --block-time 1"
```

(Keep your existing flags/URL. Only add `--block-time 1`.) Every `yarn fork` now starts with 1-second blocks, so time-based logic (vesting, deadlines, expiry, auctions) behaves like on a real chain.

### Also worth doing
- Keep the frontend polling interval (e.g. `pollingInterval: 3000` in `scaffold.config.ts`) so new blocks show up in the UI.
- For demos that need to skip ahead, use `cast rpc evm_increaseTime <secs>` then `cast rpc evm_mine` (or `anvil_setNextBlockTimestamp`) on purpose, instead of relying on a random transaction.
- Optionally show "as of block timestamp X" in the UI so a frozen clock is easy to spot.
