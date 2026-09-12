# Cause and deterministic fix

All four symptoms come from the same omission: the fork is not pinned to a block.

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks mainnet at the provider's current `latest` block. Chainlink prices and Uniswap reserves are live state, so the test input changes even though the repository does not. A price/reserve change can make previously valid exact-value or narrow-tolerance assertions fail suddenly. A re-run may land on another block (and providers can also have slightly different heads behind a load balancer), so the same commit can pass or fail.

The moving block also defeats effective reuse of Foundry's RPC cache: each new head requires state for a new block rather than the already-cached state for one fixed block. That causes progressively more/fresh RPC work as the chain advances, which explains the slowdown and makes free-tier rate limits—and therefore HTTP 429 responses—more likely.

Pin a known block and write the assertions against the state at that block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose and record a suitable block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The exact number is project-specific; choose a finalized block at which the tested deployments and expected oracle/pool state exist. Commit that number and the corresponding expected values. Do not compute it from `block.number`, `latest`, or CI time.

This fix does **not necessarily work against the existing free-tier `MAINNET_RPC_URL`**. Once the pinned block is older than the node's retained state, serving calls at it requires **archive/historical-state access**, which a free-tier plan may not provide. The URL alone does not establish that capability.

Check the endpoint by making a historical `eth_call` at the chosen block against one of the exact contracts/functions used by the tests, for example:

```sh
cast call <CHAINLINK_PROXY> \
  "latestRoundData()(uint80,int256,uint256,uint256,uint80)" \
  --block 19000000 \
  --rpc-url "$MAINNET_RPC_URL"
```

If it returns the historical result, that endpoint can serve the pinned test block. Errors such as `missing trie node`, `historical state unavailable`, or an explicit archive-plan restriction mean it cannot; use an archive-capable RPC endpoint (or a plan with sufficient historical depth). Pinning a very recent block may work temporarily on a pruned free-tier node, but it will stop working as that block ages, so that is not a durable CI fix.
