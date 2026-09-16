`createSelectFork(url)` forks **the latest block**, not a stable snapshot. The test
code may be unchanged, but its input is not: every run can see a different mainnet
block. Chainlink answers change, Uniswap reserves change whenever swaps or liquidity
updates occur, and different tests (or reruns) can select different heads. That
explains both the sudden assertion failures and why the identical commit sometimes
passes when rerun.

The moving block also defeats effective reuse of Foundry's fork/RPC cache. Cached
state is identified by chain and block; as the head advances, state needed for the
new block must be fetched again. Fork tests consequently make more remote reads
instead of repeatedly using one stable cached snapshot. As mainnet state and the
tests' remote-state working set grow, this shows up as increasing latency and more
requests, eventually exposing the free tier's rate limit as HTTP 429s. The 429s can
then add another intermittent failure mode.

Pin an explicit block number whose expected values have been recorded:

```solidity
uint256 constant FORK_BLOCK = 20_000_000; // example; choose and verify your fixture block

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
}
```

Assertions must use the Chainlink answer and Uniswap reserves at `FORK_BLOCK`.
Keep that number fixed; updating it is an intentional fixture update, accompanied
by updated expected values. This makes the chain state deterministic and allows
the same block's RPC data to be cached. It is also worth retrying/backing off on
429s, but retries alone do not make an unpinned fork deterministic.

This fix does **not necessarily work with the stated free-tier endpoint**. A durable
pinned fork needs the RPC to serve historical state at `FORK_BLOCK`—in practice,
archive-node access once that block is outside the provider's retained recent-state
window. Some free tiers provide it and some do not. Check the provider's plan/docs,
and test an actual state query such as `eth_getStorageAt` or `eth_call` with the
pinned block number (merely fetching the block header is insufficient). Errors such
as “missing trie node,” “historical state unavailable,” or an RPC method/plan error
mean the endpoint cannot support that fork. In that case use an archive-capable RPC
plan/provider or a self-hosted archive node; choosing only a recent block postpones
the problem rather than providing a lasting CI fixture.
