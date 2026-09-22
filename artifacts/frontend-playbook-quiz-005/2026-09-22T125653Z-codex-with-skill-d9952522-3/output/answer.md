# Why the vesting balance freezes on `yarn fork --network base`

The vesting contract is doing its math from `block.timestamp`, and on a local Anvil fork that timestamp only changes when the local fork mines a new block.

By default, Anvil does not keep producing empty blocks every second. In the usual fork/automine mode, it waits until a transaction arrives, mines a block for that transaction, and only then gives the chain a new latest block with a new timestamp. Calls from the frontend are just `eth_call`s against the latest block; they do not mine anything and they do not advance time. So the UI can poll the contract for minutes, but every read is still evaluated against the same latest block timestamp.

That is why the claimable balance sits still. The contract is not seeing wall-clock time pass. It is seeing the same `block.timestamp` over and over.

When someone sends any unrelated transaction, Anvil mines the next local block. That block gets a timestamp advanced to account for the elapsed time since the previous block, so the contract suddenly sees all the missing time at once. The vesting formula then releases the whole accumulated amount in a single jump. The transaction does not have to touch the vesting contract; it only has to cause the fork to mine a new block.

The Forge tests passed because they tested the vesting math, not the fork's mining cadence. `vm.warp` explicitly sets `block.timestamp` in the test VM, so the tests exercised "if time advances, does the math work?" They did not exercise "will time advance continuously during a forked frontend demo with only read calls?" Those are different behaviors.

For a one-off fix on a running fork, enable interval mining:

```bash
cast rpc anvil_setIntervalMining 1
```

That tells Anvil to mine a block every second, so `block.timestamp` keeps moving even if nobody sends a transaction.

The permanent fix is to bake interval mining into the fork script, typically by adding a block time to the Anvil command behind `yarn fork --network base`:

```bash
anvil --fork-url <base-rpc-url> --block-time 1
```

or the equivalent change in the project's `package.json`/fork task. Avoid relying on `evm_mine` for the demo: it mines one fresh block and then time freezes again. Manual mining and `vm.warp` are useful for controlled tests, but a live vesting display needs interval mining.
