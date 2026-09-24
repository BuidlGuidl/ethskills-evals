# Why the vesting balance freezes on a local fork

On the Base fork, the vesting contract is doing exactly what it is supposed to do: it computes the claimable amount from `block.timestamp`. The surprise is the local chain's mining mode.

`yarn fork --network base` runs a local Anvil fork. By default, Anvil usually mines on demand: it does not keep producing blocks every second just because wall-clock time is passing. If no transaction is sent, the fork's latest block remains the same block, with the same block timestamp. Reads against the contract keep evaluating against that unchanged latest block, so any vesting math based on `block.timestamp` returns the same value over and over.

When someone sends any transaction, even one unrelated to the vesting contract, Anvil has a reason to mine a new local block. That new block gets a fresh timestamp. Since several minutes of real time may have elapsed since the previous local block, the timestamp advances all at once. The vesting formula then sees the whole elapsed interval in a single block, so the displayed claimable balance jumps by the whole accumulated amount.

The Forge tests did not catch this because `vm.warp` bypasses the mining behavior that caused the demo bug. In the tests, time is explicitly moved forward by the test harness, then the vesting math is checked at that chosen timestamp. That proves the formula is correct for a given timestamp, but it does not prove the local fork will continuously produce new timestamps during a live demo. The failing assumption was not "vesting math is wrong"; it was "the demo chain's `block.timestamp` advances continuously while idle."

For a one-off frozen demo, turn on interval mining in the running fork:

```bash
cast rpc anvil_setIntervalMining 1
```

That tells Anvil to mine a block every second, so `block.timestamp` advances steadily and timestamp-based reads change naturally. Mining one block manually with `evm_mine` only restamps time once; it will freeze again afterward.

The permanent fix is to make the fork script start Anvil with interval mining enabled, for example by adding a one-second block time to the fork command:

```bash
anvil --fork-url <base-rpc-url> --block-time 1
```

In a Scaffold-ETH 2 project, wire that into the `yarn fork --network base` script/config so demos always run with `--block-time 1`. The vesting page can still compute from the contract, but the local fork will now behave like a live chain that keeps producing timestamps instead of an idle on-demand test chain.
