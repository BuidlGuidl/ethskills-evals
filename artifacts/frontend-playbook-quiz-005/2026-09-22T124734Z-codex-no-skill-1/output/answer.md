On the local Base fork, the frontend is reading from a local Anvil chain, not from a continuously advancing Base chain.

By default, the fork usually runs in automine/on-demand mining mode. That means it does not keep producing empty blocks just because wall-clock time is passing. If no transaction is sent, the local chain's `latest` block stays the same block, with the same `block.timestamp`. Any `eth_call` made by the vesting page is evaluated against that unchanged latest block, so a contract view that computes claimable vesting from `block.timestamp` returns the exact same value over and over.

When someone sends any transaction, even an unrelated one, Anvil has to mine a new local block. The new block gets a fresh timestamp. Because several real minutes may have passed since the previous local block, the timestamp can advance by all of that elapsed time in one block. The vesting formula then sees the whole time delta at once, so the displayed claimable amount jumps by the entire amount that would have accrued gradually if blocks had been mined continuously.

The forge tests did not catch this because `vm.warp` explicitly sets the EVM timestamp inside the test. Those tests prove that the vesting math is correct for the timestamps they provide. They do not exercise the dev node's mining policy, frontend polling against `latest`, or the fact that a forked local chain may stop producing blocks when idle.

The one-off demo fix is to advance the local chain before or during the demo. For example, send a harmless transaction, mine a block, or use an RPC cheat such as `evm_mine` / `anvil_mine` after increasing time. That forces `latest` to move and gives the contract a newer `block.timestamp`.

The permanent fix is to run the fork with interval mining so blocks are produced on a real cadence even when nobody is submitting transactions. For Anvil, start the fork with a block time, for example:

```sh
anvil --fork-url <base_rpc_url> --block-time 2
```

or update the `yarn fork --network base` script/config so it passes the equivalent `--block-time` flag. Then the local fork will mine empty blocks every few seconds, `block.timestamp` will advance continuously, and the vesting page will update smoothly during demos.
