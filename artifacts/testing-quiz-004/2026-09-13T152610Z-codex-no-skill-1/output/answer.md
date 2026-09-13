All four symptoms come from forking an unpinned chain head.

`vm.createSelectFork(url)` means “fork whatever block is `latest` when this call is made.” The Chainlink answer and Uniswap reserves are therefore not test fixtures: they are live mainnet state. A new oracle update, swap, liquidity change, or simply a different head block can make an assertion fail. A rerun can select another block (and another state), which explains why the identical commit can pass later. The failures appeared “suddenly” only because live state eventually crossed assumptions that had happened to hold before.

The moving block also defeats effective reuse of Foundry's fork/RPC cache. Fork state is block-specific, and Foundry fetches account, code, and storage data lazily. Continually selecting new heads continually creates cold state to fetch instead of repeatedly using one snapshot. That increases RPC traffic and latency; once the free-tier rate limit is hit, the provider returns HTTP 429. Throttling and retries then add more variable delay and can also make failures intermittent. Mainnet's continuing state growth may add provider-side cost, but it is not necessary to explain the behavior: the moving, cold fork plus a constrained endpoint ties the slowdown and 429s to the same mistake that makes the assertions flaky.

Pin one explicit block and treat it as part of the test fixture:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 20_000_000; // choose a verified block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The actual number should be a block at which the asserted Chainlink answer and pool reserves have been recorded and the contracts are in the expected state. Commit that number and the corresponding expectations. Do not compute it from `block.number`, a timestamp, or `latest`; those merely move the nondeterminism elsewhere. Reusing the same block also lets the fork cache become warm, substantially reducing calls and exposure to the rate limit.

This fix is **not guaranteed to work against the stated free-tier `MAINNET_RPC_URL`**. A pinned fork requires the RPC service to provide historical state for that block—commonly called archive-node or archive-data access—not merely old block headers. Some free tiers provide it, some retain only a recent window, and some reserve it for paid plans. A recent pinned block might work today and stop working after it falls outside a provider's retention window, so durable CI needs archive access (or a local snapshot/node that preserves that state).

We can tell by querying the endpoint at the chosen block number with a state-dependent method such as `eth_getStorageAt`, `eth_getBalance`, or `eth_call` (ideally for one of the exact contracts/storage slots the test uses). If it returns the historical result, the endpoint can serve that snapshot; errors such as “historical state unavailable,” “missing trie node,” “header/state not found,” or an archive-plan/retention error mean it cannot. `eth_getBlockByNumber` succeeding alone is insufficient because a provider may retain old headers while pruning the state needed by the fork.
