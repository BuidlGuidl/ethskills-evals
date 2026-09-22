# Why the vesting balance freezes on a local fork

`block.timestamp` is not wall-clock time. It is the timestamp of the current
block. On a local `yarn fork --network base` setup, the forked chain starts from
real Base state, but it does not keep importing new Base blocks forever. The
frontend is reading from the local Anvil fork, and that local chain only gets a
new `latest` block when Anvil mines one.

By default, the fork is usually in instant/transaction mining mode: a block is
mined when a transaction is submitted, but blocks are not produced every second
in the background. So repeated `eth_call`s from the vesting page keep executing
against the same latest block, with the same `block.timestamp`, even though real
time is passing. The UI can poll perfectly and still show a frozen claimable
amount because the input to the contract calculation has not changed.

When anyone sends any transaction, even one unrelated to the vesting contract,
Anvil mines a new local block. That advances the chain's global latest block
timestamp. The next read of the vesting contract now sees the new
`block.timestamp`, so the formula accounts for all elapsed time since the
previous local block at once. That is why the displayed balance jumps by the
whole missing amount instead of increasing smoothly.

The forge tests passed because `vm.warp` explicitly mutates the test EVM's
timestamp. Those tests prove the vesting formula is correct for the timestamps
they provide, but they do not test whether the local fork mines blocks over real
time. In other words, the tests controlled time directly; the demo depended on
the dev node producing new block timestamps, and it was not configured to do so.

One-off fix for a running demo:

```bash
cast rpc anvil_setIntervalMining 1
```

Run that against the local fork RPC. It tells Anvil to mine a block every second,
so `block.timestamp` advances and timestamp-based UI reads update naturally.

Permanent fix: add interval mining to the fork script, for example by adding
`--block-time 1` to the `yarn fork`/Anvil command in `packages/foundry/package.json`.
That makes every future fork run with one-second block production, so vesting,
deadlines, expiries, auctions, and other `block.timestamp` logic behave during
local demos without needing a manual RPC call.
