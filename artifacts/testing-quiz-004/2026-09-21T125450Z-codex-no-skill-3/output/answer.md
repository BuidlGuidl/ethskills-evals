All four symptoms have the same root cause: the fork is not pinned.

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks whatever Ethereum
mainnet block is latest when `setUp` runs. That means the tests are not really
testing a fixture; they are testing live mainnet state.

That explains the failures:

- The Chainlink answer and the Uniswap pool reserves are mutable on-chain state.
  They can change without anyone touching this repository, its dependencies, or
  CI.
- Re-running the same commit can pass or fail because the rerun forks a different
  latest block.
- The suite gets slower because each new latest block gives Foundry less useful
  RPC cache reuse. The tests keep asking the RPC provider for fresh fork state
  instead of replaying stable cached responses for one block.
- The HTTP 429s fit the same pattern: the tests are leaning on a free-tier live
  RPC endpoint for repeated uncached `eth_call`, `eth_getStorageAt`, and related
  fork reads. As the provider throttles, the tests slow down and sometimes fail
  for reasons unrelated to the code under test.

Make the fork deterministic by pinning it to a known block number and asserting
against values from that block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose the block used for the expected values

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), MAINNET_FORK_BLOCK);
}
```

Then update the expected Chainlink price and Uniswap reserves to the values at
`MAINNET_FORK_BLOCK`.

This makes the tests deterministic, but it may not work against the current
`MAINNET_RPC_URL` if that free-tier endpoint does not provide historical/archive
state for the chosen block. A pinned fork needs the RPC provider to answer state
queries at that block, not just at the recent head.

How to tell: run the tests with the pinned block. If the endpoint lacks the needed
history, Foundry/RPC will fail while fetching historical account or storage state,
typically with errors around missing trie nodes, unavailable historical state,
pruned state, unsupported archive data, or failed `eth_getStorageAt`/`eth_call` at
the pinned block. In that case the fix is still the same logically, but the RPC
URL must be an archive-capable endpoint, or the block must be recent enough to be
inside the provider's retained history.
