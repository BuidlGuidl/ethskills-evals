All four symptoms come from forking an unpinned, moving block:

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

Without a block number, Foundry asks the RPC for `latest`. The Chainlink answer and the Uniswap reserves are therefore test inputs taken from whatever block is at the head when that particular run starts. Those values can change through normal oracle updates and swaps, and the head can also move while jobs are being started. Thus an assertion can begin failing with no repository change and the same commit can pass on a later rerun. A short chain reorganization near the head is another reason not to treat `latest` as a stable fixture.

The moving block also defeats effective reuse of fork/RPC cache entries: each new head is a new fork state, so Foundry must fetch state from the provider again instead of repeatedly using the same block-scoped data. That causes growing/variable remote-I/O cost, slower tests, and enough extra requests or bursts to trigger the free tier's rate limit (HTTP 429). Provider load and throttling then add still more latency and flakiness. A 429 is an infrastructure failure rather than an assertion failure, but it has the same underlying request pattern.

Choose one sufficiently confirmed mainnet block at which the asserted values are known, make the expected values correspond to that block, and pin every test run to it:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 20_000_000; // example only; use the chosen fixture block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The important change is the second argument, not the example number. Commit the selected block number with the tests. Pick an already well-confirmed block so its canonical hash will not change. Pinning makes chain state deterministic and permits cache reuse; it does not make an unreliable or rate-limited provider reliable, so CI should still retry transient RPC failures or use a provider quota appropriate to its concurrency.

This fix does **not necessarily work against the current free-tier `MAINNET_RPC_URL`**. Once the pinned block is old, the RPC must serve **historical (archive) state** at that block. Some free endpoints provide archive access and some retain only recent state or reserve archive queries for paid plans.

We can tell by querying that endpoint for actual state at `MAINNET_FORK_BLOCK`—for example `eth_getStorageAt` for a known contract slot, or simply running the pinned fork after clearing/warming Foundry's cache. Success at `eth_getBlockByNumber` alone is not enough: a non-archive node may return old block headers while being unable to return old account/storage state. Errors such as `missing trie node`, `historical state unavailable`, `state is not available`, or an archive-tier/retention error mean the endpoint cannot support the fixture. In that case use an archive-capable RPC endpoint (or choose a block within the provider's documented historical-state retention window, understanding that such a rolling-window choice will eventually stop working).
