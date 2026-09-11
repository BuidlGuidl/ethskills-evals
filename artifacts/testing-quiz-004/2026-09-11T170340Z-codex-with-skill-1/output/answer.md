All four symptoms come from forking an unpinned chain head. `createSelectFork(url)` resolves the fork at `latest`, so each run can see a different mainnet block. Chainlink prices and Uniswap reserves are live state, so exact assertions can suddenly fail as that state changes; a rerun can pass because it selects another head. Because the selected block and requested state keep changing, Foundry cannot consistently reuse the same fork/RPC cache. As mainnet grows, setup needs more uncached remote reads, making the tests slower and increasing request volume until the provider intermittently rate-limits it with HTTP 429 responses.

Pin one specific, known-good block and keep the assertions/fixtures matched to that block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose and record your fixture block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The particular number is an example; the team should choose a block at which all required deployments exist and regenerate the expected Chainlink and Uniswap values once for that block. Every CI run will then execute against identical chain state, and Foundry can reuse cached responses.

This does **not necessarily work with the current free-tier `MAINNET_RPC_URL`**. Once the pinned block is outside the provider's retained recent-state window, the endpoint must support **archive (historical state) access at that block**, and free-tier plans often do not. A URL alone does not establish that capability. Test it by issuing an `eth_call` for one of the relevant deployed contracts with the pinned block number as the block tag (not `latest`), or simply run the pinned fork test after clearing/bypassing any local cache. If the RPC returns the correct result, the endpoint has the required depth; errors such as `missing trie node`, `historical state unavailable`, or an archive/plan-required response mean it does not. In that case, use an archive-capable RPC plan/provider (or a self-hosted archive node). Pinning a merely recent block may work on the free tier today, but it is not a durable CI fix because that block will age out.
