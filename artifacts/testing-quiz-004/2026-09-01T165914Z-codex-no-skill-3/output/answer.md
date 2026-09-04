# Why the fork tests became flaky

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks whatever block the RPC endpoint reports as `latest` when `setUp` runs. The tests therefore do not have a fixed input: the Chainlink answer, Uniswap reserves, and any other mainnet state can change from block to block even when the repository and commit do not change.

That ties the symptoms together:

- The sudden failures mean live mainnet state eventually stopped matching values or assumptions captured by the assertions.
- A rerun can pass because it creates a new fork at a different head block, where the observed state is different again. The same commit is not actually running against the same input.
- The gradual slowdown is consistent with repeatedly forking an ever-later, ever-larger live state and fetching uncached account/storage data from the remote RPC. With no fixed block, Foundry's fork cache is also less reusable between runs because each new head is a different fork.
- Those extra remote state requests, especially when cache reuse is poor or CI jobs run concurrently, consume the provider's free-tier quota and explain the sporadic HTTP 429 rate-limit responses. A 429 can itself make a test fail, but retries then make the result appear flaky.

Pin the fork to an explicit block whose state is known to satisfy the fixture, and make assertions relative to the state at that block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_500_000; // choose and document a verified block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The example number is illustrative; the project should select a block, verify the expected Chainlink and Uniswap values at it, and commit both that number and those expectations. Pinning also lets Foundry reuse cached RPC responses for the same block, reducing network traffic, runtime, and 429 exposure. It does not make a provider outage or rate limit impossible, but it removes changing chain state as a test input.

This fix does **not necessarily work against the current free-tier `MAINNET_RPC_URL`**. The endpoint must provide historical state for the pinned block—normally described as **archive-node access** (or an archival-data/history plan). Some free endpoints expose only recent history; a newly pinned block may work now and then fail after it falls outside their retention window.

We can tell by making an RPC request for state at the exact pinned block, such as `eth_getStorageAt`, `eth_getBalance`, or an `eth_call` against the Chainlink feed or Uniswap pool with the block number as the block parameter. Running the pinned fork is itself a practical check. Errors such as `missing trie node`, `historical state unavailable`, or `header not found` indicate that the endpoint cannot serve it. Provider documentation/account limits should also explicitly confirm archive or historical-state access. For durable deterministic CI, use an archive-capable endpoint (possibly a paid tier) and keep the pinned block fixed.
