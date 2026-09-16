# Root cause and deterministic fix

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` does **not** describe a fixed test fixture. With no block number, Foundry forks whatever the RPC endpoint reports as `latest` when the test starts. The same commit is therefore tested against a different mainnet state over time—and potentially against different nearby heads on different reruns or provider backends.

That connects the symptoms:

- Chainlink answers and Uniswap reserves are live, mutable state. An assertion that happened to match for months can fail as soon as a new price/reserve state crosses its assumption. A rerun may see another block and pass again.
- Each new head is a new fork/cache key. Previously fetched fork data cannot fully satisfy a run at the next head, so Foundry repeatedly asks the remote RPC to hydrate account, code, storage, and proof data. As the cache accumulates forks and the chain/state grows, runs tend to get slower instead of repeatedly using one warm, fixed snapshot.
- Those extra uncached requests consume the free-tier request/compute-unit quota. Throttling produces the observed HTTP 429s; retries add more latency, and exhausted retries can independently make a test fail.

Pin the fork to an explicit, sufficiently finalized block and keep that number in source control:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_500_000; // example; choose a block matching the fixture

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The exact number should be a deliberately selected block at which the expected Chainlink answer and Uniswap reserves are known. Do not compute it from `block.number`, `latest`, or “latest minus N”; that only gives a moving fixture. A comfortably finalized block also avoids reorg ambiguity. With the fixed block, every run starts from the same state and Foundry can reuse its fork cache.

## Free-tier constraint

This fix works against `MAINNET_RPC_URL` **only if that endpoint serves historical state for the pinned block**. Pinning a permanently old block generally requires archive-state access, which a free-tier endpoint may not provide. A non-archive endpoint might accept the block today while it is still inside its retained history window, then stop working after that state is pruned; that is not a durable CI solution.

Test the endpoint by issuing state queries at the exact pinned block—for example `eth_getStorageAt`, `eth_getCode`, or `eth_call` against the Chainlink aggregator and Uniswap pool, with the block parameter set to the pinned block number—and compare the returned values with a known archive provider. Errors such as `missing trie node`, `historical state unavailable`, `state is pruned`, or `archive access required` show that the tier is insufficient. `eth_getBlockByNumber` succeeding is **not** enough: old headers can be available when old account/storage state is not.

If those state calls are unsupported, use an archive-capable RPC plan or an archive node (and keep the fixed block). Merely switching to another unpinned free endpoint may reduce 429s, but it does not make the tests deterministic.
