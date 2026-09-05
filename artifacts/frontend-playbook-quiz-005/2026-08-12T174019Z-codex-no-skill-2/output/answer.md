# Why the vesting clock appears to stop

`block.timestamp` is not the computer's wall clock. It is a field of the latest mined block. A local fork started by `yarn fork --network base` normally uses transaction-triggered/automining behavior: it does not continuously import Base blocks or create empty local blocks while nobody is transacting. Repeated `eth_call`s therefore execute against the same latest local block and see the same timestamp, so the contract quite correctly returns the same claimable amount.

When any transaction arrives, the fork mines a new local block. The new block's timestamp is advanced to approximately the current wall-clock time (subject to the node's timestamp rules), rather than replaying one block for every missed second. The vesting formula consequently observes the entire elapsed interval at once, and the displayed amount jumps by the accumulated amount. The unrelated transaction did not affect vesting state; it merely caused a block with a newer timestamp to exist.

The Forge tests prove the vesting formula for the timestamps supplied by the test. `vm.warp(t)` explicitly changes the EVM's next/current block timestamp without waiting for a node to produce blocks. It bypasses the fork's mining scheduler completely. Thus those tests can verify values before and after an elapsed interval while never testing the integration assumption that the demo node will create blocks during idle wall-clock time.

## Fixes

For a one-off demo refresh, force the local node to mine a block, for example:

```sh
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
```

Sending a harmless transaction has the same incidental effect, but explicitly mining a block states the intent more clearly. If a precise simulated time is required, use the local node's timestamp RPC (for example `evm_setNextBlockTimestamp`) and then `evm_mine`.

The permanent fix is to run the fork with interval mining so it emits empty blocks during idle periods. For a Hardhat-backed `yarn fork`, configure the forked `hardhat` network along these lines:

```ts
mining: {
  auto: false,
  interval: 1_000,
}
```

That mines pending transactions, or an empty block, roughly every second. If the fork command is backed by Anvil instead, the equivalent startup option is `--block-time 1` (or `anvil_setIntervalMining` through RPC). Put the option in the `fork` script/configuration so every demo uses it, rather than relying on a presenter to generate transactions. The frontend should also refetch the contract read on each new block; interval mining supplies changing chain time, while block-driven refetching makes that change visible.

This is a local-fork realism issue, not a vesting-math bug. A live Base chain normally produces blocks independently of this application's transactions, whereas a default development fork commonly mines only on demand.
