`block.timestamp` is not a continuously moving clock. It is a field in the
current block header, so it only changes when the local fork produces another
block.

On `yarn fork --network base`, the local fork is typically running in
on-demand automining mode. It starts from some Base block and then waits. Read
calls from the frontend, including calls that recompute the vesting page's
claimable balance, are just `eth_call`s against `latest`; they do not mine
blocks. If nobody sends a transaction, `latest` stays the same local block for
minutes, and every read sees the same `block.timestamp`.

When someone sends any transaction, even an unrelated one, the fork has to mine
a new local block to include it. At that point the local node chooses a fresh
timestamp for the new block, usually catching up to wall-clock time while still
respecting the parent timestamp rule. The vesting contract then sees all of the
elapsed seconds at once, so the claimable amount jumps by the whole amount that
appeared to be "missing" during the idle period.

The Forge tests passed because `vm.warp` bypasses this mining behavior. Those
tests directly set the block timestamp before checking the vesting math, so they
prove the formula is correct at chosen timestamps. They do not test whether the
dev fork mines empty blocks, whether frontend polling advances chain time, or
whether `eth_call` observes a changing `latest` block while the chain is idle.

One-off demo fix: make the fork produce time while you demo. For Anvil, start
the fork with interval mining, for example `--block-time 1`, or manually mine /
advance time with RPC calls such as `evm_increaseTime` plus `evm_mine`. A
heartbeat transaction also works, but it is a noisy workaround because it only
updates time when the transaction is mined.

Permanent fix: change the local fork script/config so the demo chain mines
periodic blocks by default on forked networks, for example by adding Anvil's
`--block-time 1` or the equivalent Hardhat interval-mining setting. Keep the
vesting math tests, but add an integration or UI-level check that runs against
the configured fork and verifies claimable balance changes over time without
requiring an unrelated user transaction.
