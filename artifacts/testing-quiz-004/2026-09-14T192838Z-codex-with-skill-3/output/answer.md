All four symptoms come from the fork being **unpinned**.

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks whatever block is at the Ethereum head when the test starts. Chainlink prices and Uniswap reserves are live state, so the same commit is actually being tested against different inputs on different runs. A new price update, swap, or liquidity change can make an exact or tightly bounded assertion fail; a rerun at another head can make it pass again.

The moving block also prevents Foundry's fork/RPC cache from being reused effectively. Each new head has a different state root and requires fresh remote state reads. Over time that produces more slow RPC traffic; on a rate-limited free plan, the extra requests eventually surface as HTTP 429 responses. Those throttled or retried requests make the suite slower still.

Pin the fork to a block whose state is known to satisfy the fixtures and assertions:

```solidity
uint256 constant MAINNET_BLOCK = 19_000_000; // choose and document the intended block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_BLOCK
    );
}
```

The exact block should be selected deliberately and then committed with the test. Every run will then see the same Chainlink answer, Uniswap reserves, deployed bytecode, and storage, while Foundry can reuse cached responses for that block.

This fix does **not necessarily work against the current free-tier `MAINNET_RPC_URL`**. As the pinned block gets older, serving its state requires **archive-state access** (or at least historical-state retention deep enough to include that block). Some free-tier endpoints do not provide it. A URL alone does not reveal this capability.

To tell, make a historical `eth_call` through that exact endpoint using `blockNumber = MAINNET_BLOCK` against one of the contracts the tests read (for example, the Chainlink feed's `latestRoundData()`), or simply run the pinned fork after clearing/avoiding the local fork cache. If the provider returns the historical result, it supports the required depth. If it reports missing/pruned historical state, an unsupported block, or a plan restriction, use an archive-capable RPC plan/provider (or operate an archive node). Pinning a very recent block may work temporarily on a non-archive endpoint, but it will stop working once that block falls outside the provider's retained-state window, so it is not a durable CI fix.
