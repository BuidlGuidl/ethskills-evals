On the fork, wall-clock time is not the thing the contract sees.
The vesting contract reads `block.timestamp`, and in a local Anvil fork
the `latest` block only changes when Anvil mines a new local block.
With the usual fork command, Anvil is not producing background blocks
every second. If nobody sends a transaction, the fork's latest block
stays the same, so repeated frontend reads/`eth_call`s keep evaluating
the vesting formula against the same timestamp.

That is why the claimable balance appears frozen during the demo. The
frontend can poll all it wants, but it is polling the same latest block.
An unrelated transaction fixes it "all at once" because that transaction
causes Anvil to mine the next local block. The new block gets a fresh
timestamp, so the contract suddenly sees all the real time that passed
since the previous mined block and the vesting math jumps by the whole
accumulated amount.

The Forge tests did not catch this because `vm.warp` directly changes the
test EVM timestamp. Those tests prove the vesting formula is correct for
chosen timestamps, but they do not simulate a running fork where no blocks
are mined while the UI is waiting. In the tests, time advances because the
test explicitly advances it; in the demo, time advances only when the fork
mines.

One-off demo fix: enable interval mining on the already-running fork:

```bash
cast rpc anvil_setIntervalMining 1
```

That makes Anvil mine a block every second, so `block.timestamp` advances
continuously enough for the vesting page to move during the demo. Mining
a single block with `evm_mine`, or sending a dummy transaction, only
unsticks the value once; it will freeze again afterward.

Permanent fix: bake interval mining into the fork command, for example by
adding a block time to the fork script:

```bash
anvil --fork-url <base-rpc-url> --block-time 1
```

For this app, update the `yarn fork --network base` script/config so the
Base fork always starts Anvil with `--block-time 1` or equivalent interval
mining. Then local demos match the mental model the vesting UI assumes:
new blocks keep arriving, and timestamp-based claimable balances update
gradually instead of in transaction-triggered jumps.
