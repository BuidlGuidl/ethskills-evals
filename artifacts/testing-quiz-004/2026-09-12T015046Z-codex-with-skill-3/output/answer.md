# Diagnosis and fix

All four symptoms come from forking `latest` rather than a fixed block. This overload of `createSelectFork` resolves the current mainnet head whenever the test starts:

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

Chainlink answers and Uniswap reserves are live on-chain state. A new price update, swap, liquidity change, or simply selecting a different head can therefore invalidate an assertion that used to pass. Re-running can select another head (and possibly another transient state), which explains why the identical commit sometimes passes. Because the fork's block changes continually, Foundry cannot consistently reuse the RPC cache entries associated with one fixed block. It must make more remote state requests; that makes the suite progressively slower as the chain advances and eventually runs into the provider's free-tier request/rate limits, producing HTTP 429s.

Pin the fork to an explicit block whose state matches the expected values:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose and record the intended block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The exact number should be a deliberately selected block, committed with the tests; expectations must be derived from that same block. Every run then sees the same Chainlink answer and pool reserves, and Foundry can reuse block-specific cached responses. Do not replace the constant with `block.number`, `latest`, or a block fetched dynamically in CI, since that merely recreates the nondeterminism.

This fix does **not necessarily work against the current free-tier `MAINNET_RPC_URL`**. Once the pinned block is older than the node's retained state, serving contract storage and calls at that block requires **archive (historical-state) RPC access**, which a free tier may not provide. A non-archive endpoint may work immediately while the chosen block is recent and then stop working as that block ages; that is not a durable CI setup.

To tell, send the endpoint an `eth_call` against one of the actual Chainlink or Uniswap contracts with the pinned block number as the block parameter. If it returns the historical result, the endpoint has sufficient history for that block. If it reports missing/pruned historical state (or the provider documents that archive calls require a paid plan), it does not. In that case use an archive-capable endpoint/plan, or operate an archive node. Merely checking that `eth_getBlockByNumber` returns the old block is insufficient: a node can retain old block headers and bodies without retaining the historical contract state needed by `eth_call`.
