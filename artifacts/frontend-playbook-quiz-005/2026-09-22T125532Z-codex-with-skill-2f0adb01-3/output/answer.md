On the local fork, `block.timestamp` is not wall-clock time. It is the
timestamp of the latest block that the local Anvil node has mined.

With the default `yarn fork --network base` setup, Anvil forks Base state but
does not continuously mine empty blocks. It usually mines only when something
causes a local block to be produced, such as a transaction. So if the vesting
page is repeatedly reading `claimable()` with `eth_call`, every read is
evaluated against the same latest local block. The browser can poll for minutes,
but the EVM is still seeing the same `block.timestamp`, so the claimable amount
does not move.

When someone sends any transaction, even an unrelated one, Anvil mines a new
local block. That new block gets a fresh timestamp. Since the previous local
block may have been minutes old, the timestamp advances by the whole elapsed
gap at once. The vesting formula was probably correct the whole time; it just
had no newly mined blocks to observe. Once a block is mined, all of the vesting
that should have accrued during the quiet period appears in one jump.

The forge tests did not catch this because `vm.warp` directly changes the
timestamp in the test VM. Those tests prove the vesting math works for given
timestamps, but they do not exercise the local fork's mining policy. In other
words, the tests simulated time advancing; the demo environment was not mining
blocks, so time was not advancing from the contract's point of view.

For a one-off fix during a running demo, turn on interval mining on the local
Anvil node:

```bash
cast rpc anvil_setIntervalMining 1
```

That makes Anvil mine a block every second, so `block.timestamp` advances and
the vesting UI updates smoothly. If you only need to force a single refresh,
mining one block with an RPC such as `evm_mine`/`anvil_mine` also explains why
an unrelated transaction makes the number jump.

The permanent fix is to make the fork command start Anvil with interval mining
enabled, for example by adding `--block-time 1` to the fork script in
`packages/foundry/package.json`. Then every `yarn fork --network base` demo
starts with regular block production, and timestamp-based UI state behaves like
it is running on a live chain instead of a frozen fork head.
