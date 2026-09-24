`createSelectFork(url)` forks at the latest block returned by the RPC. Therefore these tests have not been running against one fixed fixture: every run can see a different Chainlink answer and different Uniswap reserves. A previously valid exact-value assertion can suddenly fail when mainnet state changes, and a rerun can pass because it selects another head (or because timing causes a different latest block to be observed).

The moving block also defeats effective reuse of Foundry's fork/RPC cache. As new heads arrive, tests need state for new block identifiers and make more remote requests instead of repeatedly reading the same pinned state. That explains the increasing latency and the growing request load that eventually manifests as HTTP 429 rate limits. The red assertions, rerun flakiness, slowdown, and 429s are consequences of treating live mainnet state as a stable test fixture.

Pin a block whose on-chain values are the fixture the assertions expect:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // replace with the chosen, verified block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The numeric block must be committed with the tests; it must not be calculated from `block.number`, fetched as `latest`, or supplied by a changing CI variable. Update it deliberately along with the expected Chainlink and Uniswap values when refreshing the fixture. All runs will then read the same state, and the cache can be reused.

This fix is **not guaranteed to work against the free-tier `MAINNET_RPC_URL`**. Once the pinned block falls outside a node's retained recent-state window, serving contract state at that block requires **archive (historical-state) RPC access**, which a free plan may not provide. The URL alone does not reveal that capability. Test the actual endpoint with a historical `eth_call` against one of the relevant contracts at `MAINNET_FORK_BLOCK` (for example, `cast call <CHAINLINK_OR_POOL_ADDRESS> <FUNCTION_SIGNATURE> --block 19000000 --rpc-url "$MAINNET_RPC_URL"`). If it returns the expected result, the endpoint currently serves that state; errors such as “missing trie node,” “historical state unavailable,” or a plan/archive restriction mean it does not. For a durable CI fixture, use a plan/provider that guarantees archive access at the pinned block (or operate an archive-capable node).
