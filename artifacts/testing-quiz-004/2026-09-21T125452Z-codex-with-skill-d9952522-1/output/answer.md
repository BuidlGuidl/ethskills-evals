All four symptoms come from the same mistake: the fork is unpinned.

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks `latest`. That means the
test fixture is the current mainnet head, not a fixed snapshot. Chainlink answers,
Uniswap reserves, pool balances, oracle rounds, and any other live state can differ
between two CI runs of the exact same commit.

That explains the symptoms:

- The sudden red tests are asserting against live Chainlink and Uniswap state that
  moved.
- Re-running sometimes passes because the next run may fork a different block whose
  state happens to satisfy the old assertion again.
- The suite gets slower because an unpinned fork keeps using new block numbers, so
  Foundry's RPC cache cannot be reused effectively across runs.
- The 429s follow from that: with poor cache reuse, the tests make many more RPC
  calls, and the free-tier provider starts rate-limiting CI.

Make the fork deterministic by pinning the block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose the block your assertions target

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), MAINNET_FORK_BLOCK);
}
```

Then update the expected Chainlink price, Uniswap reserves, and any related values to
the values at that exact block. From then on, every run tests the same state.

One important caveat: pinning an old mainnet block requires the RPC endpoint to serve
historical state for that block. A free-tier `MAINNET_RPC_URL` may not provide archive
access, so this fix only works against it if that endpoint can answer historical
`eth_call` / storage reads at the pinned block.

How to tell: run the tests, or make a simple `eth_call` against Chainlink or the
Uniswap pool at `MAINNET_FORK_BLOCK`. If the provider returns errors like missing
trie node, state unavailable, historical state not available, or archive access
required, the endpoint is not sufficient for that block. In that case either use an
RPC plan with archive support, run your own archive-capable node, or pin to a recent
block that the provider still retains, knowing that a recent block may stop working
once it ages out of the provider's retention window.
