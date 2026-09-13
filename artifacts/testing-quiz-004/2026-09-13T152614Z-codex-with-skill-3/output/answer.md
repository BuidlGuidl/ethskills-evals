# Cause and deterministic fix

All four symptoms come from forking an unspecified block:

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

With no block number, Foundry forks whatever mainnet block is latest when that run starts. Chainlink prices and Uniswap reserves are live state, so the same commit is not actually tested against the same inputs on every run. A new oracle update, swap, liquidity change, or simply selecting a different head can make an exact assertion fail. A rerun may select another head whose values happen to satisfy it, which explains the intermittent reds.

The moving head also prevents effective reuse of Foundry's RPC cache: state fetched for one block cannot be reused as state for a different block. The suite consequently makes fresh remote requests over and over. Over time this shows up as slower tests and, on a rate-limited free plan, sporadic HTTP 429 responses; throttling and retries add still more latency and flakiness.

Pin the fork to one explicit block and update the expected Chainlink and Uniswap values to the values at that block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose and document a known-good block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The particular number is an example; the important property is that it is fixed in source (or otherwise fixed identically in CI), rather than derived from `block.number`, `latest`, or a changing environment value. Now every run sees the same oracle answer and pool reserves, and cached reads for that block can be reused.

This fix does **not necessarily work against the existing free-tier `MAINNET_RPC_URL`**. As the pinned block ages, serving its contract state requires **archive/historical-state access**, which some free-tier endpoints do not provide or provide only for a limited recent window. The URL alone does not establish that capability.

Before adopting the block, send the endpoint an `eth_call` to one of the contracts used by the tests (for example, the Chainlink feed's `latestRoundData()` or the Uniswap pool's `getReserves()`) with the chosen block number as the block tag. Run the same call for a sufficiently old block. If it returns the historical result, the plan has the required depth; if it returns errors such as `missing trie node`, `historical state unavailable`, or an archive-range/plan error, it does not. In that case use an archive-capable RPC plan/provider (or a self-hosted archive node). Picking a merely recent pinned block may work temporarily, but it is not a durable CI fix because it will eventually age beyond a pruned endpoint's retention window.
