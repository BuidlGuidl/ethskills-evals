All four symptoms come from the same thing: the fork is not pinned.

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` means "fork mainnet at the
provider's current latest block." That makes the live chain part of the test
fixture. Chainlink answers and Uniswap reserves are stateful mainnet data, so
their values can change from block to block. A test that asserted yesterday's
price or reserve values can fail this morning even though the repo, dependency
lockfile, and CI config are identical.

That also explains why the same commit sometimes passes when re-run: each run may
start from a different latest block, and the oracle/pool state at those blocks may
fall on different sides of the assertion.

The slowdown and 429s fit the same picture. Because every CI run forks a new head
block, Foundry cannot keep reusing one stable fork state forever. It has to ask the
RPC provider for fresh account/storage/code data at new block numbers. Over time,
as the tests touch more live fork state and CI keeps making uncached calls against
moving blocks, the suite gets slower and a free-tier endpoint starts rate limiting
with HTTP 429s. Re-running can then be slower or flaky because the provider is
throttling, retrying, or failing some requests.

The deterministic change is to pin the fork to an explicit block number and make
the assertions match that block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose the real block for the fixture

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), MAINNET_FORK_BLOCK);
}
```

The equivalent CLI/config fix is `--fork-block-number <block>` or a Foundry config
that always supplies the same fork block.

This fix only works against the free-tier `MAINNET_RPC_URL` if that endpoint can
serve historical state for the pinned block. If the block is old, the endpoint may
need archive-node access. You can tell by running the pinned fork tests: if the RPC
cannot serve that block's state, calls will fail with errors like missing trie node,
historical state unavailable, requested state not available, or archive access
required. In that case you either need an RPC plan/provider with archive access, or
you must pin to a recent block that the free-tier endpoint still retains, knowing
that a non-archive provider may stop serving it later.
