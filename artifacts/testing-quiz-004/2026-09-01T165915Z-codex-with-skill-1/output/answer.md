# The fork is tracking a moving target

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks at the RPC endpoint's current `latest` block. Therefore these tests have not been running against the same input for four months: every run sees a different mainnet state.

That ties the symptoms together:

- Chainlink answers and Uniswap reserves are live state. An assertion can suddenly cross a threshold or cease matching a hard-coded value even though the test commit did not change.
- A re-run can select a later head, and provider backends can briefly report different heads. The same code can consequently pass or fail. A shallow reorg is another reason not to pin the newest block.
- Latest-block RPC reads are not safely reusable as immutable cached responses. Repeated fork runs therefore keep fetching state, while a fixed old block gives Foundry and the provider a stable cache key. Cache misses, provider congestion, and throttling account for increasing latency and the sporadic HTTP 429 responses. Forking does **not** replay every block from genesis; chain growth itself is not the explanation.

Pin the fork to one explicit, already-finalized block and pin the expected oracle/pool values from that same block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 20_000_000; // choose and document a suitable finalized block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The particular number above is illustrative; the repository should choose a block at which all required contracts and desired state exist. The block number must be a source-controlled constant (or an equally pinned CI value), not calculated as `block.number - N` at run time. This fixes the test input, avoids head/reorg variation, and allows repeated historical reads to be cached. It should also substantially reduce RPC traffic after the cache is warm, although pinning is a determinism fix rather than a guarantee that a rate-limited service will never return 429.

## Free-tier endpoint constraint

This fix works against `MAINNET_RPC_URL` **only if that endpoint can serve historical state for the pinned block**. As the pinned block ages, that generally requires archive-state access (or a provider that retains the required historical state); some free-tier endpoints do not provide it or retain only a limited window.

Test the exact endpoint with an `eth_call`, `eth_getStorageAt`, or `eth_getBalance` request using the pinned block number rather than `latest`, and run the fork test once with an empty Foundry RPC cache. If it succeeds, the endpoint provides the state needed for that block. Errors such as `missing trie node`, `historical state unavailable`, `header/state not found`, or a message saying archive access requires another plan show that it does not.

If the free tier lacks that capability, merely pinning the code will not make it work against that endpoint. Use an archive-capable RPC endpoint, or host a local node/snapshot that contains the pinned state. Moving the pin forward to remain inside a free provider's retention window can make calls work temporarily, but changing the pin also changes the test fixture and expected values, so it is not long-term determinism across runs unless that update is deliberate and reviewed.
