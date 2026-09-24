On the local fork, `block.timestamp` only advances when the local node mines a new block.

`yarn fork --network base` runs a forked local chain in automine/on-demand mining mode. It does not keep producing empty Base blocks in the background. The frontend keeps doing read-only `eth_call`s against `latest`, and `latest` is still the same locally mined block, so the vesting contract keeps seeing the same `block.timestamp`. From the contract's point of view, no time has passed.

When anyone sends a transaction, the local fork mines one new block for that transaction. That block gets a fresh timestamp. Because the previous local block may be minutes old, the timestamp advances by the whole elapsed wall-clock gap in one block. The vesting calculation is continuous in time, but the chain time it reads moved discretely, so the claimable balance appears to jump all at once.

The Forge tests did not catch this because `vm.warp` directly sets the EVM timestamp used by the test. Those tests prove the vesting math is correct for chosen timestamps, but they do not exercise the fork node's block production policy. A test that warps from `t0` to `t1` is not the same as a UI polling `eth_call` against an idle automining fork whose `latest` block never changes.

One-off fix for the demo: mine blocks or trigger time advancement while the page is open. For example, send a harmless local transaction, or call the local RPC manually with something like `cast rpc evm_mine` / `cast rpc anvil_mine`. If you need a specific jump, advance time first with `evm_increaseTime` or `anvil_setNextBlockTimestamp`, then mine a block.

Permanent fix: run the fork with interval mining so it produces blocks even when nobody is sending transactions. For Anvil, start the fork with a block-time/interval option such as `--block-time 1` or `--block-time 2` in the `yarn fork --network base` script. Then `latest.block.timestamp` advances every interval, frontend polling sees fresh timestamps, and the vesting balance moves smoothly during demos.
