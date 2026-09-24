On the local Base fork, `block.timestamp` is not wall-clock time. It is the
timestamp of the latest block in the local fork.

When the fork is sitting idle, the local node does not keep producing blocks
just because real time is passing. Read-only frontend calls such as
`claimable()` / `eth_call` are evaluated against the current latest block, and
that block's timestamp is unchanged. So the vesting math is being recomputed,
but it is being recomputed with the same `block.timestamp` every time. From the
contract's point of view, time has not moved.

When anyone sends a transaction, the local node mines a new block for that
transaction. At that moment the fork chooses a timestamp for the new block that
reflects the elapsed local time since the previous block. The next read now
sees one newer block whose timestamp has advanced by the whole idle period, so
the claimable balance jumps by all of the accumulated vesting at once.

The Forge tests did not catch this because `vm.warp` bypasses the mining
behavior entirely. The tests explicitly set the EVM timestamp to the desired
value and then check the vesting formula. That proves the math is right for a
given timestamp, but it does not prove that the demo fork is continuously
mining blocks or that the frontend will observe gradually changing timestamps.

One-off fix: manually advance/mine the fork during the demo. For example, mine
a block or increase time and mine:

```sh
cast rpc evm_mine
```

or:

```sh
cast rpc evm_increaseTime 60
cast rpc evm_mine
```

Sending any transaction has the same visible effect because it forces a new
block to be mined.

Permanent fix: run the fork with interval mining so the local chain produces
blocks on a timer. For an Anvil-based fork, add a block time to the fork
command, for example:

```sh
anvil --fork-url "$BASE_RPC_URL" --block-time 1
```

or wire the equivalent option into `yarn fork --network base`. With interval
mining enabled, the latest block timestamp advances regularly, so the vesting
page sees the claimable balance move smoothly instead of staying frozen until
the next transaction.
