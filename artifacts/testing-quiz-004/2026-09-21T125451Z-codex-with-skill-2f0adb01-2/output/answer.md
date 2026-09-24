All four symptoms come from the same mistake: the fork is not pinned.

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks whatever the RPC says is
the latest mainnet block at that moment. That means the tests are asserting against
live Ethereum state, not a fixture.

That explains the failures:

- The Chainlink answer and the Uniswap pool reserves changed on mainnet, so assertions
  that used to match can suddenly be wrong even though the repo did not change.
- Re-running the same commit can pass or fail because the fork block is different on
  each run. The test is sampling moving state.
- The tests get slower because Foundry's fork cache is least useful when every run uses
  a new block. A pinned fork can reuse cached account/storage reads for the same block;
  an always-latest fork keeps forcing fresh RPC reads.
- The HTTP 429s are the same thing showing up operationally: the test suite is leaning
  on the remote RPC for live fork state, and cache misses plus retries make it easier
  to hit a free-tier rate limit.

Make the fork deterministic by pinning a block number:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose a block whose state matches the assertions

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), MAINNET_FORK_BLOCK);
}
```

After that, update the expected Chainlink answer and Uniswap reserves to the values at
that exact block. The tests are then asserting against a fixed historical snapshot
instead of today's mainnet.

This may or may not work against `MAINNET_RPC_URL` if it is a free-tier endpoint. The
fix requires the RPC provider to serve historical state for the pinned block, usually
archive-node access unless the chosen block is still inside the provider's limited
history window. You can tell by running the pinned fork: if calls such as `eth_call`,
`eth_getStorageAt`, `eth_getBalance`, or `eth_getCode` at that block fail with errors
like "missing trie node", "historical state unavailable", "archive access required", or
"block not available", the endpoint cannot serve that block. In that case use an
archive-capable RPC, or pin to a recent block that the free tier still supports, knowing
that a recent block may stop being available later.
