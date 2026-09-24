All four symptoms come from forking "latest" mainnet:

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

With no block number, every test run forks whatever block the RPC reports at that moment. The Chainlink price and Uniswap reserves are live mainnet state, so they can differ between CI runs on the same commit. The tests went red when live state moved outside the assumptions baked into the assertions; they are flaky because a re-run lands on a different block. They have also gotten slower because each run targets a new block, so Foundry cannot reuse a stable fork-state cache effectively and keeps asking the remote RPC for fresh state. The sporadic HTTP 429s are the same story from the provider side: the tests are making lots of uncached RPC calls against a free-tier endpoint.

Make the fork deterministic by pinning a block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // pick a known-good block

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), MAINNET_FORK_BLOCK);
}
```

or equivalently configure/run the tests with a fixed `--fork-block-number`.

This makes the Chainlink answer, Uniswap reserves, and all other forked state the same on every run. It also lets Foundry cache state by a stable block, which reduces RPC traffic after the first fetch.

Plainly: this only works against the free-tier `MAINNET_RPC_URL` if that endpoint can serve historical state for the pinned block. For an old pinned block, that usually means archive access. If the endpoint does not provide it, the test will fail during setup or first state read with errors like `missing trie node`, `header not found`, `historical state not available`, `state unavailable`, or an RPC/provider message saying archive data is required. You can tell by running the pinned fork test once, or by issuing an `eth_call`/`eth_getStorageAt` against the target contract at the chosen block. If the free tier lacks archive support, use an archive-capable RPC endpoint or pin to a block that the provider still retains, understanding that a recent non-archive block may stop working later.
