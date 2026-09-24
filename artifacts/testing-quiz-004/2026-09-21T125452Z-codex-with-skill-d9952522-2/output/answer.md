All four symptoms come from the same mistake: the fork is unpinned.

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks whatever mainnet head the RPC returns at that moment. That means the test fixture is not a fixture. Chainlink answers can advance to a new round, and Uniswap reserves can change every block. A test that asserted yesterday's price or pool state may fail this morning even though the code, dependencies, and CI config did not change.

The re-run flakiness is the same thing in smaller form: every run may be against a different head block, or may observe a different live value, so the same commit can pass and fail.

The slowdown and the 429s are also consistent with this. Fork tests are much cheaper when Foundry can reuse cached RPC reads for a stable block. An unpinned fork follows the head, so the cache is constantly cold or much less useful, and the test suite keeps asking the provider for fresh state. As the suite grows or simply keeps running this way, it does more live RPC work, gets slower, and eventually trips free-tier rate limits.

Make the fork deterministic by pinning the block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose a block whose values your assertions expect

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), MAINNET_FORK_BLOCK);
}
```

Then assert against the Chainlink answer and Uniswap reserves at that exact block, not against moving mainnet head.

This fix works against a free-tier `MAINNET_RPC_URL` only if that endpoint can serve historical state for the pinned block. If the pinned block is old, that is an archive-node requirement, and many free-tier endpoints do not provide it. You can tell by making a historical `eth_call` or `eth_getStorageAt` at the chosen block, or simply by running the pinned fork test. If the provider lacks archive depth, it should fail consistently with a missing historical state error such as unavailable state, missing trie node, header/block not found, or plan/archive access required. In that case the deterministic fix is still correct, but CI needs an RPC endpoint with archive access for that block, or a much more recent pinned block that the free-tier provider still retains.
