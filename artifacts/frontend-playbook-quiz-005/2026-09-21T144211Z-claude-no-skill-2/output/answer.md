# Why the vesting number freezes on `yarn fork`, then jumps

## 1. Why time stands still: Anvil only makes a block when a transaction arrives

`yarn fork --network base` starts **Anvil** (Foundry's local node) as a copy of Base. By default Anvil uses **automine**: it builds a new block only when a transaction comes in. It does not make empty blocks on a timer. Real Base makes a block every 2 seconds whether or not anything happens.

`block.timestamp` is part of the block. It is not a live clock. When the frontend calls `claimable()`, the call runs against the **latest mined block**, so `block.timestamp` is that block's timestamp. If nobody sends a transaction, no new block is made. The latest block stays the same, `block.timestamp` stays the same, and `claimable()` returns the same number on every poll. The wall clock keeps going, but the chain's clock doesn't. To the page it looks like time has stopped.

## 2. Why one unrelated transaction makes it jump all at once

When any transaction arrives (a faucet send, an approve, anything), Anvil mines a block for it. It stamps that block with the **current real time**, which is also never earlier than the previous block. So the gap between the last block and the new one might be 7 minutes, all in one step. `claimable()` is roughly `total * (block.timestamp - start) / duration`. It is recomputed against the new block and picks up the full 7 minutes of vesting at once.

Nothing was lost or delayed. The chain just had no block to measure the passing time until the transaction showed up. The contract math is correct. It only got a new timestamp in big jumps instead of small steps.

(Side effect: right after starting a fork, the chain's time is the timestamp of the Base block you forked from, which may already be a little old. The first mined block then catches up to real time.)

## 3. Why the forge tests never caught it

- `vm.warp(t)` sets `block.timestamp` directly inside the test's own EVM. The tests say "pretend it is time t" and check the result. That checks the **math**, and the math is fine.
- Forge tests never run a node that produces blocks. There is no automine, no interval mining, no RPC, no frontend polling. The bug lives in exactly that layer: **how often the dev chain makes new blocks**, and so how often `block.timestamp` moves. `vm.warp` skips that layer on purpose.
- In short, the tests prove "given a timestamp, the answer is right". The demo problem is "the timestamp doesn't move". No test was looking at that.

## 4. Fixes

### One-off, during a demo (unfreeze it now)
Mine an empty block so the latest block picks up the current time:

```bash
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
# or mine several: cast rpc anvil_mine 1 --rpc-url http://127.0.0.1:8545
```

Or turn on timed mining on the running node without restarting:

```bash
cast rpc evm_setIntervalMining 1 --rpc-url http://127.0.0.1:8545   # a block every 1s
```

To show future vesting on purpose, jump time forward and then mine:
`cast rpc evm_increaseTime 86400` then `cast rpc evm_mine`.

### Permanent (so the dev chain acts like a real chain)
Start Anvil with **interval mining** so it makes a block every N seconds even with no transactions. In Scaffold-ETH 2, edit the `fork` script in `packages/foundry/package.json` (the one `yarn fork` runs) and add `--block-time`:

```jsonc
"fork": "anvil --fork-url ${0:-mainnet} --chain-id 31337 --config-out localhost.json --block-time 2"
```

(Keep the rest of your existing command as it is. Just add `--block-time 2`, or `1`. Base makes a block every 2s, so `2` matches it.) Do the same for `yarn chain` if you demo on a plain local chain. Now `block.timestamp` moves forward every couple of seconds, and the claimable balance climbs smoothly, the same way it does on Base.

Optional frontend polish: re-read `claimable()` on every new block (e.g. `useScaffoldReadContract` with `watch: true`). If you want the number to tick between blocks, add a client-side estimate that goes `rate * (Date.now()/1000 - lastBlockTimestamp)` on top of the on-chain value. Always show the on-chain value as the real one.
