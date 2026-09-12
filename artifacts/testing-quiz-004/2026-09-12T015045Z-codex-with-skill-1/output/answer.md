# The fork is following mainnet head

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` creates the fork at the latest block returned by the RPC. It does not capture the mainnet state that existed when the test was written.

That explains all four symptoms:

- Chainlink prices and Uniswap reserves are live state, so their values change as the head advances. An exact assertion can suddenly fail even though the test commit did not change.
- A rerun may observe another block (and therefore another price or reserve value), so the same commit can alternate between passing and failing.
- Because each run uses new block numbers and state, Foundry cannot keep reusing the same cached fork responses. It must fetch more state from the RPC, making the suite progressively slower and increasing request volume.
- The growing volume of uncached requests eventually encounters the free tier's rate limit, producing the HTTP 429s. Those failures add another source of apparent flakiness.

Pin the fork to a fixed, sufficiently confirmed block and make the expected values correspond to that block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose and record the project's fixture block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The particular number above is illustrative; the team should deliberately choose one block, update the fixtures once for its state, and keep it fixed. Choosing a well-confirmed block also avoids ordinary head reorgs. Now every run sees the same Chainlink round and Uniswap reserves, and Foundry can reuse RPC data cached for that block.

This fix **does not necessarily work against the existing free-tier endpoint**. Once a pinned block is older than the node's retained recent-state window, serving it requires **archive-state access** (and the provider may reserve that for a paid plan). A recent pinned block can appear to work today and then stop working after it is pruned, so that is not a durable solution.

To tell, make a historical JSON-RPC request against that endpoint at the exact chosen block—most directly an `eth_call` to one of the Chainlink or Uniswap contracts using that block number—and verify that it returns data. Running the fork test after pinning is also a practical check; errors such as unavailable historical state or `missing trie node` mean the endpoint lacks the required depth. If the free tier cannot answer the historical call, use an archive-capable RPC plan or a local/archive node. Pinning plus archive access is what makes the tests deterministic over time.
