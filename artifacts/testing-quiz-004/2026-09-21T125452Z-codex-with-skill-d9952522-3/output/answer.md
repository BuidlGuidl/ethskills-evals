All four symptoms come from the same thing: the fork is unpinned.

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks at whatever the
current mainnet head is when the test starts. That means the tests are not
running against one fixture. They are running against live Chainlink and Uniswap
state.

So:

- The Chainlink price and Uniswap reserves can change between blocks, so
  assertions that used to match can suddenly go red even though the repo did not
  change.
- Re-running the same commit can pass or fail because the fork is created at a
  different block each run.
- The tests get slower because the fork cache is much less useful when every run
  is at a new block and has to fetch fresh account/storage data from the RPC.
- The extra uncached RPC traffic explains the sporadic HTTP 429s from the
  provider, especially on a free-tier endpoint.

Make the fork deterministic by pinning a block number:

```solidity
function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 19_000_000);
}
```

Use a real block number that matches the Chainlink answer and Uniswap reserves
your assertions expect, then keep it fixed. If those expected values need to
change, update them deliberately together with the pinned block.

This fix only works against `MAINNET_RPC_URL` if that endpoint can serve state
for the pinned block. A pinned old mainnet block requires archive, or at least
historical-state, access. A free-tier RPC may not provide that.

You can tell by making a historical request at the exact block before relying on
it in CI, for example an `eth_call` to the Chainlink feed or the Uniswap pool at
the pinned block. If the endpoint returns the historical value, the pinned fork
can work. If it errors with something like missing/pruned state, missing trie
node, historical state unavailable, or only supports recent blocks, then the fix
requires an archive-capable endpoint or a local cached/snapshotted fork source.
