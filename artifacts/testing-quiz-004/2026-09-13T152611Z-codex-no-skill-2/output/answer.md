# Cause and deterministic fix

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks the node's current
`latest` block. `latest` is not a reproducible fixture: it changes continuously.
Consequently, the Chainlink answer and the Uniswap reserves observed by a test can
change even when the commit does not. The block selected can also differ between CI
runs (and potentially around the head of the chain), which explains both the sudden
failures and why rerunning the same commit sometimes passes.

The moving fork head also defeats Foundry's persistent RPC cache. Every newer block
is a new state snapshot, so successive runs must fetch and cache more state instead
of repeatedly reusing responses for one block. That increases RPC traffic and makes
the suite progressively slower; eventually the extra requests encounter the free
tier's rate limit and produce the sporadic HTTP 429s. Thus the changing external
fixture and the lost cache reuse tie all four symptoms together.

Pin the fork to a fixed block number at which the assertions are known to hold:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 20_000_000; // choose and document a real fixture block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The illustrative number should be replaced with a deliberately selected block and
committed with the tests. Block-dependent expectations should be recorded from that
same block. This fixes both inputs—the code and mainnet state—and lets Foundry reuse
its cached RPC responses.

## Free-tier constraint

This fix works against `MAINNET_RPC_URL` **only if that endpoint can serve historical
state for the pinned block**. Once the block is older than the provider's retained
window, that generally requires **archive-state access** (sometimes called an
archive node or historical-state access), which a free tier may not provide. Pinning
does not bypass that limitation.

We can tell by making an RPC request that reads state at the chosen block—for example
`eth_getBalance`, `eth_getCode`, or the relevant `eth_call` with the block number as
the block tag—or simply by running the pinned test with an empty Foundry RPC cache.
If the provider returns the historical result, it supports that block. Errors such
as `missing trie node`, `historical state unavailable`, `header not found`, or an
archive-plan/upgrade error mean it does not. In that case use an archive-capable RPC
endpoint (or a provider/tier whose retention window covers the block); otherwise the
tests will fail after local cache eviction or on a fresh CI runner.
