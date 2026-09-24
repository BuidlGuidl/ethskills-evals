# Cause and deterministic fix

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks at the current chain head. The tests therefore do not run against a fixed fixture: each CI run sees whatever mainnet state exists when that run starts.

That ties the symptoms together:

- Chainlink prices and Uniswap reserves change on-chain, so exact assertions that were true at one head can be false at another.
- A re-run selects a later head, possibly with values that satisfy the assertions again, so the same commit can pass and fail without any repository change.
- Because the fork block keeps changing, Foundry cannot consistently reuse RPC data cached for the previous fork. More state has to be fetched remotely, making the tests slower.
- Those repeated cache misses produce more RPC requests; on a rate-limited free-tier plan they eventually cause HTTP 429 responses. Retries and throttling add still more latency and flakiness.

Pin the fork to an explicit block at which the expected Chainlink and Uniswap values were recorded:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose and document the fixture block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The particular number is only an example; the assertions must be derived from the chosen block. Commit that block number and do not compute it from `block.number`, a timestamp, or “latest.” With the same chain, block, and call inputs, the external state is fixed and Foundry can reuse its fork/RPC cache.

This fix does **not necessarily work against the current free-tier `MAINNET_RPC_URL`**. Once the pinned block is older than the node's retained state window, serving contract storage and calls at it requires **archive (historical-state) access**. Some providers include that on free tiers and others do not.

Check the endpoint by issuing a stateful request at the exact pinned block, for example an `eth_call` to the Chainlink feed's `latestRoundData()` or the Uniswap pool's `getReserves()` with the block parameter set to that block. Merely fetching the block header is not enough: a node may retain old headers but not old contract state. If the historical `eth_call` succeeds and returns the expected result, the endpoint supports the required depth. Errors such as “historical state unavailable,” “missing trie node,” or an archive-plan/depth error mean it does not. In that case use an archive-capable RPC plan/provider (or maintain an equivalent local historical snapshot); pinning alone cannot make a pruned endpoint serve old state.
