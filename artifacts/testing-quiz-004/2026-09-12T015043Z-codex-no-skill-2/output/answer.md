`createSelectFork(url)` does **not** create a fixed test fixture. With no block number, Foundry asks the RPC endpoint for its current `latest` block. The effective input to the tests therefore includes live mainnet state even though the repository and commit have not changed.

That connects the symptoms:

- Chainlink answers and Uniswap reserves change on mainnet, so assertions written against an earlier state can suddenly fail when the live state crosses their expected values.
- A re-run can select a different head (and, around the tip, possibly a different canonical view from a load-balanced RPC service), so the same commit can observe different prices, reserves, timestamps, and block data.
- Each newly selected head is a new fork/cache key. It prevents the fork RPC cache from being a stable reusable snapshot and causes fresh remote state requests. RPC latency and provider throttling therefore leak directly into test duration. The 429s are the explicit sign that the free-tier request budget/concurrency is being exceeded; retries and backoff make the suite slower and can make it fail for transport reasons as well. The long slowdown is evidence of increasing dependence on a constrained live service, not a change in the Solidity code.

Pin a sufficiently old, finalized block and keep that number under version control:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_500_000; // example only: choose a block at which the fixtures/assertions are valid

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The chosen number must be an actual block at which the expected Chainlink feed and Uniswap pool state exist and have the asserted values. Do not continually update it to `latest`; changing it should be an intentional fixture update. Choosing an old finalized block also removes practical reorg sensitivity. Once fetched, Foundry can reuse state cached for that exact chain and block, reducing RPC traffic. Pinning fixes state nondeterminism, although an unavailable RPC service can of course still cause an infrastructure failure.

**This may not work against the stated free-tier `MAINNET_RPC_URL`.** Reading state at a pinned past block requires the provider to serve **historical (archive) state** for that block. Some free-tier endpoints retain only recent state, cap the historical range, or do not expose archive access at all. The fix works unchanged if this endpoint serves the selected block; otherwise use an archive-capable endpoint (or pin a block within the provider's retained range, accepting that it will eventually age out).

Check the endpoint directly with a historical state query, not merely `eth_getBlockByNumber`: fetching an old block header does not prove archive-state support. For example, issue `eth_call` for the Chainlink aggregator or Uniswap pool with the block parameter set to `0x` plus the pinned block number, or run an equivalent `cast call ... --block <number> --rpc-url "$MAINNET_RPC_URL"`. A correct result means the needed state is available. Errors such as `missing trie node`, `historical state unavailable`, `state is not available`, or a provider message requiring an archive/higher-tier plan mean it is not.
