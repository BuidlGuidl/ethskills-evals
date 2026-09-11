# Why the vesting balance freezes on the local fork

`block.timestamp` is not the computer's continuously ticking wall clock. It is a field on the latest mined block. On the Anvil instance started by `yarn fork --network base`, the default behavior is to mine on demand: Anvil creates a new block when a transaction arrives, but it does not continuously create empty blocks between transactions.

Consequently, repeated frontend reads (`eth_call`) keep executing against the same latest block. Reads do not mine blocks, so they see the same `block.timestamp` and the contract returns the same claimable amount even while real-world minutes pass.

When somebody finally sends any transaction, Anvil mines a new block. That block's timestamp catches up to the current time. The vesting calculation therefore observes all the elapsed time at once, and the displayed claimable balance jumps by the accumulated amount. The unrelated transaction did not alter the vesting state; it merely caused a block with a newer timestamp to exist.

The Forge tests did not catch this because `vm.warp` explicitly changes the timestamp used by the next EVM execution. Those tests verify the vesting formula at selected timestamps, but they do not test how the development node produces blocks or whether timestamps advance while the chain is idle. Correct time-dependent contract math and a frozen transaction-mined development chain are fully compatible.

For the running demo, enable interval mining once through Anvil's RPC API:

```sh
cast rpc anvil_setIntervalMining 1
```

This makes Anvil mine a block every second, so `block.timestamp` and timestamp-based reads advance regularly. Manual `anvil_mine` calls or explicit time manipulation can also advance a controlled test once, but they are not the right solution for a continuously updating demo.

For the permanent fix, change the project's fork command/script so Anvil always starts with interval mining enabled, for example by adding:

```sh
--block-time 1
```

to the Anvil invocation used by `yarn fork`. After restarting the fork, it will mine every second without needing the one-off RPC call. The frontend should remain connected to the local Anvil chain (normally Foundry chain ID `31337`), not directly to Base; the issue is the local node's mining policy, not the upstream Base vesting contract.
