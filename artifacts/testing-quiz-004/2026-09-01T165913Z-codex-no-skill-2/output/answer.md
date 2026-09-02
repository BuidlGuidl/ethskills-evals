All four symptoms come from forking an unpinned, moving chain head.

`vm.createSelectFork(url)` uses the provider's `latest` block. Therefore the tests have not been running against the same input for four months, even though the Git commit has stayed the same. Chainlink answers and Uniswap reserves are mutable on-chain state. Eventually the live values crossed whatever exact values or assumptions the tests assert, producing the sudden failures. A rerun can observe a later block (and occasionally a different view of the tip during a short reorganization or across provider backends), so the same commit can pass or fail.

The moving block also largely defeats Foundry's persistent RPC cache: each new head is a new block/state key, so successive CI runs cannot keep reusing the same fetched account and storage data. They make fresh RPC requests instead. As that uncached data and request load accumulate, runs get slower; on a rate-limited free endpoint, the extra requests cause throttling (`429`), retries, still more latency, and sometimes failures. Thus the slowdown and 429s are consequences of the same missing snapshot pin, while the value failures are the correctness consequence.

Pin the fork to one explicit block and choose the expected values from that block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 20_000_000; // example; select and record your fixture block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

Commit that block number together with assertions derived from it. Do not compute it from `block.number`, `latest`, a timestamp lookup, or an environment variable that CI silently changes; that would merely move the nondeterminism elsewhere. Pinning also lets Foundry reuse cached RPC responses because the requested state is immutable. It does not guarantee that a severely rate-limited service will never throttle the first cold run, but retries then fetch the same state and cannot change the test result.

This fix does **not necessarily work with the current free-tier `MAINNET_RPC_URL`**. Once the pinned block falls outside the provider's retained recent-state window, the endpoint must support historical state queries—commonly described as **archive-node access** (or an RPC plan with sufficient historical-state retention). Some free tiers provide it and some do not.

Tell by querying contract state at the chosen block, not merely by asking for the old block header. For example:

```sh
cast call <CHAINLINK_OR_POOL_ADDRESS> '<VIEW_SIGNATURE>' \
  --block 20000000 --rpc-url "$MAINNET_RPC_URL"
```

An old `eth_getStorageAt`, `eth_getBalance`, `eth_getCode`, or `eth_call` at that block must succeed. Errors such as `missing trie node`, `historical state unavailable`, `state is not available`, or a provider message requiring an archive/paid plan mean that endpoint cannot back the pinned fork. In that case, use an archive-capable RPC endpoint (or a provider whose retained history includes the selected block). A successful `eth_getBlockByNumber` alone is insufficient: a pruned node may retain headers while discarding the historical state that fork execution needs.

Foundry documents that the block argument is optional and otherwise defaults to `latest`: [createSelectFork reference](https://getfoundry.sh/reference/cheatcodes/create-select-fork).
