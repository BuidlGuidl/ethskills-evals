# Why the vesting number freezes on `yarn fork`, then jumps

## 1. What makes time stand still: automine
`yarn fork --network base` (Scaffold-ETH 2) starts a local **Anvil** node that copies Base's state (`anvil --fork-url <base rpc> --chain-id 31337`). By default Anvil uses **automine**: it makes a new block **only when a transaction arrives**. No transactions means no new blocks.

`block.timestamp` is the timestamp of a block, not the wall clock. Your page reads `claimable()` with an `eth_call` against the `latest` block. As long as no new block exists, `latest` is the same block with the same timestamp, so the view function returns the same number every time you poll it. The frontend is fine. The chain really is stuck at one moment in time.

(Right after forking, `latest` is the forked Base block or one mined at startup. Its timestamp stays fixed until the next block.)

## 2. Why one transaction un-freezes it in one jump
Any transaction (even an unrelated ETH transfer) makes Anvil mine a block. The new block gets the **current wall-clock time** as its timestamp. The gap between the old block and the new one is however many minutes passed, so `block.timestamp` jumps forward by all of them at once. Vesting is linear in `block.timestamp - start`, so the claimable amount jumps by everything that should have vested during the frozen minutes. The math isn't wrong. It just only runs when a block is made.

## 3. Why the forge tests never caught it
`vm.warp(t)` sets `block.timestamp` directly inside the test EVM. The tests check "given timestamp T, the claimable amount is X", and that math is correct. They never check **how often the timestamp moves** on a real node. That depends on the node's mining settings, not on the contract. Tests control time themselves, so they can't see a node that doesn't move time forward. This is a problem with the local environment, not a contract bug.

## 4. Fixes

### One-off (during the demo, no restart)
Mine a block by hand so `latest` gets a fresh timestamp:
```sh
cast rpc anvil_mine --rpc-url http://127.0.0.1:8545      # or: cast rpc evm_mine
```
You can also send any throwaway transaction, for example with the SE-2 faucet. Each block only gives you a new snapshot, and the number freezes again after it. If you need to jump ahead, use `cast rpc evm_increaseTime 3600` and then `cast rpc evm_mine`.

### Permanent: interval mining
Make Anvil mine blocks on a timer, whether or not there are transactions, so `block.timestamp` moves forward on its own:
```sh
anvil --fork-url <base rpc> --chain-id 31337 --block-time 1
```
In SE-2, add `--block-time 1` (or 2, close to Base's 2s blocks) to the `fork` script in `packages/foundry/package.json`, where the anvil command is built. Transactions are still included in the next interval block.

You can also switch it on at runtime without restarting: `cast rpc evm_setIntervalMining 1`.

If the project uses the Hardhat flavor of SE-2, the same fix goes in `hardhat.config.ts`:
```ts
networks: { hardhat: { forking: { url: ... }, mining: { auto: true, interval: 1000 } } }
```

Optional nice-to-have in the UI: compute the displayed amount from the vesting settings and the client clock (`Date.now()`) so it ticks smoothly between blocks. Always treat the on-chain `claimable()` as the true value.
