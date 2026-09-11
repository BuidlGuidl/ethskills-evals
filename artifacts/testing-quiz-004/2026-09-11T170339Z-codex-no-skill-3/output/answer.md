# The fork is not pinned

`vm.createSelectFork(MAINNET_RPC_URL)` forks whatever block is `latest` when the RPC request is handled. Thus the same commit is not actually tested against the same input on every run.

That explains the four symptoms:

- Chainlink answers and Uniswap reserves are live state. A new round, swap, liquidity change, or other transaction can invalidate assertions that happened to be true at an earlier head.
- A rerun sees a different head, so it can pass or fail without any repository change. Choosing a very recent block can also expose the test to a reorg.
- Foundry's fetched account/storage data is block-specific. With a moving head, previously cached fork data is not reusable for the new block, so CI keeps going back to the remote RPC. The growing chain/state and provider load can make those uncached requests progressively more expensive.
- Those extra remote reads consume the free tier's request/rate allowance, producing the 429s; throttling and retries add still more latency and flakiness.

Pin the suite to one explicit, sufficiently finalized mainnet block and make all state-dependent expected values correspond to that block:

```solidity
uint256 constant FORK_BLOCK = 19_000_000; // example only; choose and document your fixture block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        FORK_BLOCK
    );
}
```

The important change is the `blockNumber` overload, not the example number. Pick a block whose Chainlink answer and pool reserves have been recorded for the assertions, pin it in source (or in a versioned test configuration), and do not derive it from `block.number`, `latest`, or an unpinned environment variable. Use an old-enough finalized block so an ordinary reorg cannot change the fixture. Once pinned, every run reads the same EVM state and Foundry can reuse its block-scoped RPC cache.

## Free-tier RPC constraint

This fix works with `MAINNET_RPC_URL` **only if that free-tier endpoint serves historical state at `FORK_BLOCK`**. “Free tier” does not by itself answer that: some providers include archive access and others retain only a limited recent window. As the fixed block ages, a non-archive endpoint may stop serving it. The capability needed is an **archive node / historical state access**, including calls such as `eth_getStorageAt`, `eth_getCode`, `eth_getBalance`, and `eth_call` at the pinned block.

We can tell by checking the provider's plan documentation and by issuing one of those RPC calls with the hexadecimal pinned block number. A valid result means that particular historical query is available; errors such as `missing trie node`, `historical state unavailable`, `state pruned`, or an archive-plan/unsupported-block error mean it is not. Running the fork test after clearing its local RPC cache is the practical end-to-end check, because it proves all state the test touches can be fetched. If the endpoint lacks that access, pinning is still the correct test change, but CI must use an archive-capable endpoint (or a local archived/snapshotted fixture) for the pinned block.
