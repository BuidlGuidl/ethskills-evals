# Why the vesting balance freezes on a local fork

`block.timestamp` is chain time, not wall-clock time. Anvil's default local-node mode is **transaction (automine) mining**: it creates a block when a transaction is submitted, but it does not continually create empty blocks while the node is idle. Read-only `eth_call` requests from the page do not mine blocks. They repeatedly execute against the same latest block, with the same timestamp, so a vesting calculation based on `block.timestamp` returns the same claimable amount even though real time is passing.

When somebody finally submits any transaction, Anvil mines one new block. The new block timestamp is advanced to the current wall-clock time (subject to the normal requirement that it be later than its parent). The contract is therefore evaluated at the new timestamp and accounts for the entire elapsed idle period at once. No vesting was lost and the unrelated transaction did not modify the vesting contract; it merely caused the fork to produce the next block. The UI consequently appears to jump by several minutes of accrued vesting in one update.

The Forge tests prove the vesting formula at the timestamps chosen by the test, but they do not reproduce the node's mining policy. `vm.warp(t)` directly sets the timestamp used by the next test execution/block. Thus the tests explicitly move chain time forward and never test the integration assumption that an idle fork will mine blocks as wall time passes. This is why correct math and passing tests can coexist with a frozen demo.

## Fixes

For a one-off unblock, mine a block manually (or send any transaction):

```sh
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
```

`anvil_mine` is also available when more control or multiple blocks are wanted. Merely refreshing the page or polling faster will not help, because those are read calls and do not advance the chain.

For the permanent demo fix, run the fork with interval mining so it produces blocks even with no transactions, for example:

```sh
anvil --fork-url <BASE_RPC_URL> --block-time 1
```

In the project, add `--block-time 1` (or another suitable interval) to the Anvil command behind `yarn fork`, then restart the fork; if that script forwards extra CLI arguments, the equivalent is to pass the flag through there. This makes a new local block roughly every second, so `block.timestamp` and the claimable value advance naturally. It changes only the local simulation: on Base, timestamps still advance when the network produces blocks, and the UI should treat the latest block timestamp—not the browser clock—as the authoritative on-chain time.
