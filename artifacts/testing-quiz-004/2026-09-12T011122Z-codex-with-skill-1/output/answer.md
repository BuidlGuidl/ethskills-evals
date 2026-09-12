# Cause and deterministic fix

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks at the node's current head. The tests therefore do not run against one fixed Ethereum state: each CI run can see a different Chainlink answer and different Uniswap reserves.

That one omission explains all four symptoms:

- The assertions suddenly fail because mainnet state eventually moved outside the values assumed by tests that had happened to pass for months.
- Re-running the same commit can pass because the re-run selects a later head with different oracle and pool state (and possibly a different head from a load-balanced RPC backend).
- The tests slow down because each new head produces a new fork state. Foundry cannot consistently reuse its RPC/state cache, so it has to fetch more state again.
- Those additional uncached RPC requests consume the free-tier quota and cause HTTP 429 rate-limit responses. The 429s can themselves add retries, latency, and another source of intermittent failure.

Pin the fork to a fixed, sufficiently finalized block at which the expected values are known:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose and document the intended block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

Then derive the asserted Chainlink price and Uniswap reserves from that block. Every run now reads the same state, and Foundry can reuse cached responses. Pinning also avoids ordinary head movement; choosing a finalized block avoids relying on a block that could be reorganized.

## Free-tier endpoint constraint

This fix does **not necessarily work against the existing free-tier endpoint**. As the pinned block ages, serving contract state from it requires **archive/historical-state access** (with sufficient retention depth). Some free tiers provide it, many prune old state or restrict archive requests. The URL alone does not tell us which.

Test the exact endpoint with a historical `eth_call` at `MAINNET_FORK_BLOCK` against one of the contracts/storage reads used by the tests. For example, use `cast call ... --block 19000000 --rpc-url "$MAINNET_RPC_URL"`. Merely checking that `eth_getBlockByNumber` returns the old block is insufficient: a node may retain block headers while no longer retaining the historical contract state. If the historical call returns the correct result, the endpoint supports the required depth; errors such as `missing trie node`, unavailable historical state, or an archive-plan restriction mean it does not.

Pinning a recent block might work temporarily on a pruned free endpoint, but it will stop working when that block falls outside the provider's retention window. Durable deterministic CI therefore needs an archive-capable RPC plan/provider (or a controlled local archive/snapshot) that can always serve the selected block.
