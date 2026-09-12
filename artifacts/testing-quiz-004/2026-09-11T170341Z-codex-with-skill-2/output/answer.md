All four symptoms come from the fork being **unpinned**.

`vm.createSelectFork(MAINNET_RPC_URL)` forks whatever block is `latest` when setup runs. Chainlink prices and Uniswap reserves are live state, so the same commit is actually tested against different inputs at different times. A state update can therefore make an assertion fail, and another update can make the rerun pass. It also means Foundry's RPC cache, whose entries are tied to a particular chain and block, cannot keep serving the test from one stable snapshot. New heads require more remote state reads; that makes the suite slower and increases request volume until a rate-limited endpoint starts returning HTTP 429 responses. The reds, rerun flakiness, slowdown, and 429s are different consequences of following the moving chain head.

Choose a block at which the expected Chainlink and Uniswap values are known, and pin every fork to it:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // use the block matching the fixtures

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The exact number is not important; it must be fixed in source/config and the assertions must be derived from that block. Do not compute it from `block.number` or query `latest` in CI. Once pinned, every run sees the same oracle and pool state, and Foundry can reuse cached reads for that block.

This fix does **not necessarily work on the current free-tier `MAINNET_RPC_URL`**. A durable fixed block eventually requires **archive (historical state) access**. Some free tiers provide it, some restrict its depth, and a normal pruned node may only serve recent state. The URL or the ability to fetch an old block header does not establish archive support.

Test the endpoint with a historical `eth_call` against a known deployed contract at the chosen block, for example:

```sh
cast call <CHAINLINK_OR_POOL_ADDRESS> '<VIEW_FUNCTION_SIGNATURE>' \
  --block 19000000 \
  --rpc-url "$MAINNET_RPC_URL"
```

If that returns the value, the endpoint serves the historical state needed by this fork. If it returns a missing/pruned historical-state error, or the provider documents that the free plan has insufficient archive depth, the pinned test needs an archive-capable endpoint (or a local, reproducible snapshot/archive node). Choosing a merely recent block is only temporary: once it falls outside the provider's retained state window, the test will fail again.
