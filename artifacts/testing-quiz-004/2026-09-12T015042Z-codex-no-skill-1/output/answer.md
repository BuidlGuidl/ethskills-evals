All four symptoms come from forking an unpinned, moving chain head.

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` uses the RPC endpoint's latest block when the fork is created. "The same commit" therefore does not mean "the same test input": every run can see a different Chainlink answer and different Uniswap reserves. A price update, swap, liquidity change, or reorganization can make an assertion cross its expected value or boundary. A rerun may then use another block and produce a different result.

The moving block also defeats most reuse of Foundry's persistent RPC fork cache. Storage/account data cached for one block is not necessarily valid at the next block, so successive CI runs keep fetching fresh state. As the tests make more uncached RPC requests, they get slower and are more likely to exceed the provider's free-tier rate limit, which explains the sporadic HTTP 429s. A 429 can itself make a run fail, but it does not explain the changing price and reserves; the unpinned block explains both those changing inputs and the extra RPC traffic.

Pin the fork to one explicit block and keep that block under version control, for example:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 20_000_000; // choose and record a suitable block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

Choose a real block at which the contracts and expected values used by the tests are valid, and derive/update the assertions for that block. Do not compute the block dynamically (for example, `block.number - N`) because that merely creates another moving input. Advance the constant only as an intentional fixture update. Pinning also lets Foundry reuse block-specific cached RPC responses across runs, reducing latency and request volume.

This fix does **not necessarily work against the existing free-tier `MAINNET_RPC_URL`**. Querying contract state at an old pinned block requires the provider to serve historical Ethereum state—commonly described as archive or historical-state access. Some free-tier endpoints retain only recent state, impose a historical-block limit, or disable archive queries entirely.

We can tell by making an actual state query at the chosen block through that endpoint, not merely by asking for the block header. For example, call `eth_getStorageAt`, `eth_getBalance`, or `eth_call` for one of the tested contracts with the pinned block number as the block tag (or simply run the pinned fork test from an empty Foundry cache). If it returns the historical value, the endpoint supports that block; errors such as `missing trie node`, `historical state unavailable`, `state is pruned`, or an archive-tier/retention-limit message mean it does not. In that case use an archive-capable RPC endpoint (with sufficient rate limits), or pin a block still inside the provider's documented retention window—though the latter will eventually require deliberately moving the fixture.
