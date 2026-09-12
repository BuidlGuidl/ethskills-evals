# The fork is following a moving chain head

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` creates the fork at the node's `latest` block. Therefore, these tests do not run against a fixed input: Chainlink prices and Uniswap reserves can differ whenever the suite starts at a different head block. A value crossing an assertion boundary explains the sudden failures, and later blocks or ordinary state changes explain why the identical commit can pass on a rerun.

The moving fork also ties in the performance symptoms. Because each new head has a different block hash and state, Foundry cannot consistently reuse the same cached RPC responses across runs. As the chain advances and the tests request uncached state, they perform more remote RPC work. That makes the tests slower and increases request volume until a free-tier provider intermittently responds with HTTP 429 rate-limit errors. A 429 can itself make a run fail, but rerunning after the limit window resets can pass.

Pin the fork to one explicit block whose on-chain values satisfy the intended fixtures:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose and document your fixture block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The precise block need not be `19_000_000`; it must be a deliberately selected, fixed block, and all expected Chainlink and Uniswap values should be derived from that block. This makes the external state repeatable and lets Foundry's RPC cache serve the same historical reads on subsequent runs.

This fix does **not necessarily work with the current free-tier `MAINNET_RPC_URL`**. Once the pinned block is older than the provider's retained state, serving contract storage and calls at it requires **archive/historical-state access**, which a free tier may not provide. The URL alone does not establish that capability. Test it by issuing an `eth_call` (or `cast call --block <pinned-block> ...`) against a known contract at the chosen block. If it returns the historical result, the endpoint supports the required depth; errors such as `missing trie node`, `historical state unavailable`, or an archive-plan restriction mean it does not. In that case, use an archive-capable RPC plan/provider, or pin a sufficiently recent block and periodically advance the fixture deliberately (accepting that this requires updating expected values and eventually repinning).
