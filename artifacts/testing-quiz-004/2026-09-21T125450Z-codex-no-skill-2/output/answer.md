All four symptoms have the same root cause: the tests fork `latest`.

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` does not pin the fork to a
block. Every run executes against whatever Ethereum mainnet block the RPC endpoint
serves at that moment. That means Chainlink answers, Uniswap pool reserves, token
balances, timestamps, and any other live-chain state are test inputs that change
without any repo change.

That explains:

- The sudden reds: the live Chainlink price or pool reserves eventually moved outside
  the values assumed by the assertions.
- The pass/fail behavior on re-run: the same commit is tested against a different
  latest block, so the inputs can differ between attempts.
- The slowdown: unpinned latest-block forks cannot be cached reliably the way a fixed
  block can, so the suite keeps making fresh RPC reads instead of reusing stable fork
  state.
- The HTTP 429s: those extra live RPC reads hit the free-tier provider's rate limits,
  especially as the fork suite grows or loses cache effectiveness.

Make the fork deterministic by pinning a known block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose a block whose state matches the assertions

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), MAINNET_FORK_BLOCK);
}
```

The exact block should be one where the Chainlink answer and Uniswap reserves are the
values the tests expect. Once pinned, the same commit reads the same chain state every
time, and Foundry can cache RPC responses for that block.

This fix may or may not work against the current free-tier `MAINNET_RPC_URL`. It works
only if that endpoint can serve historical state for the pinned block. Many free-tier
RPC plans do not provide archive access, or only provide a limited recent history. You
can tell by running the pinned fork test: if the provider cannot serve that block, the
RPC call will fail with an error such as missing trie node, state unavailable, block
range/history not supported, or a similar archive-data error. In that case the fix is
still the same, but the endpoint must be changed to one with archive/historical state
for the chosen block, or the pinned block must be recent enough for the provider's
available history.
