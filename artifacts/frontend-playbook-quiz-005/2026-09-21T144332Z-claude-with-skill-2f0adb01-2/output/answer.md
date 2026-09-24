# Why the vesting number freezes on `yarn fork --network base`

## 1. What makes time stand still

`yarn fork` runs Anvil (a local test chain) with its default mining mode: **automine**. In that mode Anvil creates a new block **only when a transaction arrives**. No transactions means no new blocks.

`block.timestamp` belongs to a block, not to the wall clock. The page reads `claimable()` with a read-only `eth_call` against the latest block. With no new blocks, the latest block stays the same, so its timestamp stays the same. The contract keeps computing vesting "as of" that old moment. Polling the RPC every few seconds doesn't help, because each poll just re-runs the same math against the same block.

So the number isn't wrong from the chain's point of view. On the chain, time really has stopped.

## 2. Why one unrelated transaction unfreezes it in one jump

Any transaction (a transfer, an approve, anything) makes Anvil mine a block. The new block's timestamp is the **current wall-clock time**, not "previous block + a few seconds". The chain goes straight from, say, 10:00:00 to 10:07:30.

The vesting math is a function of `block.timestamp - start`, so it covers the whole gap at once. All the time that passed with no blocks is added in that one block, and the page shows one big step instead of a smooth increase. The transaction doesn't have to touch the vesting contract. It just has to cause a block.

## 3. Why the forge tests never caught it

The tests use `vm.warp(t)`, which **sets `block.timestamp` directly**. That checks "given timestamp T, is the claimable amount correct?", and the answer is yes. The math is fine.

The bug isn't in the math. It's in the environment: whether `block.timestamp` moves forward on its own at all. Forge tests never depend on blocks being produced over real time, because `vm.warp` fakes the time you ask for. No test covers "does the local node advance time when nobody sends transactions?" That's a property of how the dev node mines, not of the contract, so a contract test suite can't catch it. It only shows up when you watch the real frontend against the local node.

(Same risk in production: on real Base, blocks come every ~2s, so the problem never appears there. It only affects the local fork.)

## 4. Fixes

### One-off (running fork, right now)

In a new terminal, while `yarn fork` is running:

```bash
cast rpc anvil_setIntervalMining 1
```

Anvil now mines a block every second even with no transactions, so `block.timestamp` moves forward with the wall clock and the claimable balance goes up smoothly. This only lasts until the fork restarts.

### Permanent (every `yarn fork`)

Edit `packages/foundry/package.json` and add `--block-time 1` to the `fork` script's anvil command, e.g.:

```json
"fork": "anvil --fork-url ${FORK_URL:-...} --chain-id 31337 --block-time 1"
```

(Keep whatever flags are already there. Just add `--block-time 1`.) Every fork now starts with a block every second, so any time-based logic (vesting, deadlines, expiry, auctions) behaves like it does on a real chain during demos.

Optional extra: add a frontend or e2e check that reads `claimable()` twice a few seconds apart with no transactions in between and expects it to go up. That catches this class of environment bug, which `vm.warp` tests can't.
