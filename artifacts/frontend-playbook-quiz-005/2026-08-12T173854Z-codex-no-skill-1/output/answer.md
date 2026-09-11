# Why the claimable balance freezes on the local fork

`block.timestamp` is the timestamp of the latest **mined block**, not a clock that changes continuously. The fork node starts from a Base block and, in its default on-demand/automining mode, does not produce empty blocks merely because wall-clock time passes. If nobody submits a transaction, the head block stays unchanged, so repeated frontend reads see the same `block.timestamp` and therefore the same claimable amount.

When any transaction is submitted, the local node mines a block. It chooses a valid timestamp reflecting the time elapsed since the previous block (normally close to the current wall-clock time and greater than the parent timestamp). The vesting formula is evaluated against that single new timestamp. Consequently, all the vesting that accrued during the minutes with no blocks appears at once. The unrelated transaction did not alter the vesting contract; it only caused the chain clock to advance by creating a new block.

The Forge tests do not exercise this node-liveness behavior. `vm.warp(...)` explicitly changes the EVM timestamp used by the test, and Forge then evaluates the contract at that requested time. Those tests establish that the vesting arithmetic is correct when time advances. They do not establish that a separate fork process will autonomously mine blocks, nor can contract code make its own `block.timestamp` advance between blocks.

## Fixes

For a one-off demo fix, force-mine a block after the idle period. For example, call the fork node's `evm_mine` JSON-RPC method (or send any harmless local transaction). A timestamped `evm_mine`/time-increase RPC can be used when an exact demo time is wanted. After the block is mined, refresh or invalidate the frontend's contract read.

The permanent fix is to run the local fork with periodic/interval block production so it mines empty blocks, for example one block every second. Configure the actual fork backend accordingly:

- Hardhat: enable interval mining in the Hardhat-network `mining` configuration (typically `auto: false` with an `interval`, such as `1000` ms), or drive periodic `evm_mine` calls from the fork script.
- Anvil: start it with a block interval such as `--block-time 1` (the equivalent project/Yarn argument is fine).

Put that setting in the `yarn fork` script or fork-network configuration rather than relying on somebody to transact. The UI may also refetch on every new block for smooth updates; polling the same block faster cannot help, because every call within that block must return the same timestamp-derived value.
