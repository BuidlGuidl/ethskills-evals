# Why time freezes on `yarn fork`, and how to fix it

## 1. Why time stands still

`yarn fork --network base` (Scaffold-ETH 2) starts a local Anvil node that copies Base's state. By default Anvil uses **auto-mining**:

- It only mines a block **when a transaction arrives**. One tx = one block.
- If no tx arrives, **no blocks get mined**. The chain just sits on the same latest block.

`block.timestamp` is not a clock. It's a field stored in the block. Your page reads `claimable()` with a view call (`eth_call` on the `latest` block), so the contract runs with the **latest block's timestamp**. That block doesn't change, so neither does the timestamp, so the result is the same on every poll. Wall-clock time keeps moving, but chain time stays put.

(Real Base makes a block every 2 seconds whether or not there are txs, so the number there goes up smoothly. Your local fork doesn't do this.)

## 2. Why one transaction un-freezes it in a single jump

Any tx, even an unrelated one, makes Anvil mine a new block. Anvil stamps that block with the **current wall-clock time** (plus any offset from earlier warps), not "last timestamp + a little". So in one step the new `latest` block's timestamp goes from "when the last block was mined" to "now". The vesting formula is linear in `block.timestamp - start`, so all the vesting from the idle period appears at once. The math is right. It was just using an old timestamp until then.

## 3. Why the forge tests passed

- `vm.warp(t)` **sets** `block.timestamp` straight away inside the test EVM. The tests check "given timestamp T, is `claimable` correct?", and that part is right.
- The tests never check whether **time actually moves** in the environment the app runs in. That's a node-config problem, not a contract problem. Forge's in-process EVM has no mining at all, so the "no tx → no block → no new timestamp" behavior can't show up there.
- Put simply, the tests prove the function is right. The bug is in what gets passed to it: an old block.

## 4. Fixes

### One-off (during the demo, no restart)

Mine a block, or turn on interval mining on the running node:

```bash
# mine one block now → timestamp jumps to "now"
cast rpc evm_mine --rpc-url http://127.0.0.1:8545

# or: from now on, mine a block every 1 second (lasts until the node restarts)
cast rpc evm_setIntervalMining 1 --rpc-url http://127.0.0.1:8545
```

(A 0-ETH self-transfer from the burner wallet also works. That's the same "unrelated tx" trick, just done on purpose.)

### Permanent (fix the fork script)

Turn on **interval mining** so Anvil makes blocks on a timer even with no txs, like a real chain. In `packages/foundry/package.json`, add `--block-time` to the anvil command used by `fork`:

```jsonc
// before
"fork": "anvil --fork-url ${0:-mainnet} --chain-id 31337 --config-out localhost.json",
// after
"fork": "anvil --fork-url ${0:-mainnet} --chain-id 31337 --config-out localhost.json --block-time 2"
```

Use `--block-time 2` to match Base's 2s blocks, or `1` for a smoother demo. Auto-mining on txs still happens along with it, so txs confirm right away.

On the Hardhat flavor of SE-2, the same fix goes in `hardhat.config.ts`:

```ts
networks: {
  hardhat: {
    forking: { url: ... },
    mining: { auto: true, interval: 2000 }, // ms
  },
}
```

### Nice-to-have for the frontend

- Make sure the claimable read refetches on every new block (SE-2's `useScaffoldReadContract` with `watch: true`, which is the default). Once blocks come every 1 to 2s, the UI then updates on its own.
- Optional: show a live estimate computed off-chain from `Date.now()` and the vesting params, and use the on-chain value only when actually claiming. Then the display never depends on how often blocks are mined.

## TL;DR

Local Anvil only mines when a tx arrives. No tx means no new block, so `block.timestamp` is frozen and the view result doesn't change. The next tx mines a block stamped with the real current time, so all the missed vesting shows up at once. `vm.warp` tests set the timestamp directly, so they never test whether time advances. One-off fix: `cast rpc evm_mine` / `evm_setIntervalMining 1`. Permanent fix: `--block-time 2` in the `fork` script (or `mining.interval` in Hardhat).
