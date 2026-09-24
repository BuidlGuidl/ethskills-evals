# Root cause and deterministic fix

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` creates the fork at the node's current head. That means these are not repeated runs against the same input: each run can use a different Ethereum block.

All four symptoms follow from that:

- Chainlink answers and Uniswap reserves are live on-chain state, so they can change at every block. An assertion written for yesterday's (or the previous run's) values can suddenly fail.
- A re-run may select another head with different state, so the identical commit can pass or fail without any repository change.
- Foundry's fork/RPC cache is block-specific. Constantly advancing the fork prevents the suite from consistently reusing one stable cached snapshot, so it keeps fetching state. As the tested call paths and chain state require more remote reads, runs become slower.
- Those cache misses generate more RPC requests; parallel CI jobs amplify them until a rate-limited free-tier provider responds with HTTP 429.

Pin the fork to an explicit block whose expected Chainlink and Uniswap values were used to write the assertions:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose and document the actual fixture block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

Then update the expected values once from that exact block. Every run now has the same state input, and the block-keyed cache can be reused. Pinning also separates two kinds of maintenance: changing the fixture block is an intentional test-fixture update, while ordinary changes continue to run against the old snapshot.

This fix does **not necessarily work against the current free-tier `MAINNET_RPC_URL`**. A block that remains pinned eventually becomes historical, and serving contract state for an old block requires the provider/plan to offer sufficient **archive (historical state) access**. Some free tiers do; others restrict history, prune it, or reserve archive calls for paid plans.

Check the actual endpoint by making a historical `eth_call` at the chosen block, ideally the same Chainlink or Uniswap read used by the test. For example:

```sh
cast call <CHAINLINK_FEED_ADDRESS> \
  "latestRoundData()(uint80,int256,uint256,uint256,uint80)" \
  --block 19000000 \
  --rpc-url "$MAINNET_RPC_URL"
```

It must return the correct result at that exact block, not an error such as `missing trie node`, `historical state unavailable`, or a plan/archive restriction. A successful `eth_getBlockByNumber` is not enough: that proves the provider has the old block header, not the old contract state needed by `eth_call`. If the historical call is unsupported, use an archive-capable RPC plan/provider (or a controlled local archive/snapshot); merely pinning the block number will make the tests consistently fail at fork creation or on the first historical state read.
