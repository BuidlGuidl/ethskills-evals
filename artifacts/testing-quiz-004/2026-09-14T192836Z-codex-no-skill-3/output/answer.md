`createSelectFork(url)` without a block number means “fork mainnet at whatever the
RPC calls `latest` when this test starts.” It does **not** select a stable mainnet
snapshot. The test inputs therefore include mutable external state even though the
repository is unchanged.

That accounts for the symptoms:

- A new Chainlink round or swaps/liquidity changes in the Uniswap pool can invalidate
  exact assertions. A state transition near the test run can make the same commit see
  different blocks on different runs, so a rerun may pass.
- A fork is lazy: Foundry obtains account, code, and storage data from the RPC as the
  test touches them. Moving to a new head continually creates new snapshots instead
  of reusing one immutable, cacheable snapshot. RPC latency/throttling therefore
  shows up as slower tests, and enough reads against a free-tier service produce
  HTTP 429s. A 429 is an additional source of job failure; it should not be mistaken
  for a contract assertion failure.

Choose a known-good, finalized block and commit that block number with the tests:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 20_000_000; // example; choose and document yours

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

Expected Chainlink answers and Uniswap reserves must be recorded from that same
block. Do not compute the block from `block.number`, a timestamp, or `latest` in CI.
This makes the EVM state used by the assertions deterministic. Keeping Foundry's RPC
cache between CI runs can reduce calls, while provider retries or a higher-rate
endpoint address transport flakiness; neither is a substitute for pinning the block.

This fix does **not necessarily work with the current free-tier
`MAINNET_RPC_URL`**. Once the chosen block is older than the provider's retained
state window, the endpoint must offer **archive (historical state) access** for that
block. Some free plans do; many expose only recent/pruned state or restrict archive
queries. We can tell by querying contract state at the exact pinned block (for
example `eth_getStorageAt`, `eth_getBalance`, or `eth_call` with the block number) or
simply by creating/running the pinned fork. An error such as `missing trie node`,
`historical state unavailable`, `header not found`, or a plan/archive-access error
means that endpoint cannot serve it. In that case use an archive-capable RPC (and,
if 429s persist, adequate rate limits), or deliberately pin a sufficiently recent
block within the provider's documented retention window—with the tradeoff that the
block must periodically be updated along with the fixtures.
