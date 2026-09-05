# Why the vesting balance freezes on the local fork

`yarn fork --network base` runs a local Anvil chain initialized from Base state. By default, Anvil uses transaction-triggered (automine) mining: it creates a block when it has a transaction to include, but it does not continuously create empty blocks while the chain is idle.

`block.timestamp` is the timestamp of the latest mined block, not a wall-clock value that changes between blocks. Therefore, repeated frontend reads during an idle period execute against the same latest block and see exactly the same timestamp. The vesting contract consequently returns the same claimable amount, even though real time is passing.

When anyone submits an unrelated transaction, Anvil mines the next block. That block receives a timestamp advanced to the current time. The next contract read now evaluates the vesting formula at that newer timestamp, so all vesting accrued during the idle interval appears at once. The unrelated transaction does not affect the vesting state; it merely causes the block—and thus chain time—to advance.

The Forge tests did not detect this because `vm.warp(...)` explicitly sets the EVM timestamp before exercising the vesting calculation. Those tests establish that the formula is correct at selected timestamps, but they do not test whether the development node produces blocks over time. In effect, the tests supply the time progression that the idle Anvil fork lacks.

For a one-off fix on the currently running fork, enable interval mining through Anvil's RPC:

```sh
cast rpc anvil_setIntervalMining 1
```

This makes Anvil mine a block every second, so `block.timestamp` and timestamp-derived reads advance continuously. For a controlled single-step check, manually mining a block or manipulating the node time also works, but it does not provide an ongoing live demo.

For the permanent fix, change the project's fork script/configuration so Anvil always starts with interval mining, for example by adding:

```sh
--block-time 1
```

to the Anvil invocation used by `yarn fork`. Then every fork session mines at a one-second cadence without requiring the RPC command after startup. The frontend should remain connected to the local Foundry/Anvil chain (chain ID 31337), not directly to Base; the issue is the local node's mining cadence, not the upstream Base network or the vesting math.
