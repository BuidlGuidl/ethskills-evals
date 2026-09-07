# Why the vesting balance freezes on the local fork

`yarn fork --network base` runs a local Anvil chain containing a snapshot of Base. By default, Anvil uses transaction-triggered (automine) behavior: it mines a block when a transaction arrives, but it does not continuously produce empty blocks while the chain is idle.

The EVM does not have a continuously ticking clock. `block.timestamp` is metadata on the latest mined block. Consequently, repeated frontend `eth_call`s may re-run the vesting view function, but they all run against the same latest block and the same timestamp. The claimable amount therefore stays unchanged no matter how much wall-clock time passes.

When anyone submits an unrelated transaction, Anvil mines the next block. Its timestamp catches up to the current time, so the vesting calculation sees all the elapsed time at once. The display jumps by the accumulated amount rather than increasing gradually. The unrelated transaction does not affect the vesting state; it merely causes a new block, and hence a new `block.timestamp`, to exist.

The Forge tests did not exercise this mining behavior. `vm.warp` explicitly changes the timestamp used by the next EVM execution, so those tests correctly validate the vesting formula at chosen timestamps. They do not test whether the development node creates blocks over wall-clock time. Passing them shows that the contract math is sound, not that an idle Anvil fork advances time.

For the currently running fork, enable interval mining with:

```sh
cast rpc anvil_setIntervalMining 1
```

That makes Anvil mine roughly once per second for this session. Manually mining a block or sending a transaction can also unfreeze the display once, but it does not provide continuous updates.

For the permanent project fix, add `--block-time 1` to the Anvil invocation used by the `fork` script (or its underlying fork command), then restart the fork. Every future `yarn fork --network base` session will produce blocks at one-second intervals. The frontend should remain connected to the local Foundry/Anvil chain (chain ID 31337), not directly to Base; once new blocks arrive, its normal block/watch refetch mechanism can update the displayed claimable balance.
