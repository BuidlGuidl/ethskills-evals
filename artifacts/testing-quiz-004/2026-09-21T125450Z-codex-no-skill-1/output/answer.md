All four symptoms have the same root cause: the tests fork "latest" mainnet.

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` does not make a stable test fixture. It asks the RPC for the current head block at the moment the test starts. That means every CI run may execute against different Chainlink aggregator state and different Uniswap pool balances. Prices, observations, liquidity, token balances, and reserves are live production state, so an assertion that was true for months can suddenly become false without any code, dependency, or CI change.

The re-run flakiness is the same issue in smaller form: the same commit can pass or fail because the fork block has changed between attempts, or because different workers start from slightly different heads.

The slowdown and 429s are also connected. Because each run forks a new latest block, the fork cache is much less reusable: Foundry has to fetch fresh account, storage, block, and call data from the RPC instead of repeatedly using the same pinned block data. As the suite grows or the cache misses accumulate, the tests make more RPC requests, get slower, and eventually hit the free-tier rate limit, which shows up as sporadic HTTP 429s.

The deterministic fix is to pin the fork block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose a known-good block

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), MAINNET_FORK_BLOCK);
}
```

or configure the same thing in Foundry config / CI so all tests use one fixed mainnet block.

This makes the Chainlink price and Uniswap reserves part of the fixture instead of live inputs. The same commit will run against the same state every time, and Foundry can reuse cached fork data for that block.

The free-tier caveat: this fix only works against `MAINNET_RPC_URL` if that endpoint can serve historical state for the pinned block. For an old, stable block, the provider may need archive-node support, sometimes called archive data or historical state access. A normal non-archive endpoint may know the old block header but fail when asked for account/storage state at that block.

We would tell by running the pinned fork test against the free-tier URL. If the endpoint lacks the needed historical state, the failure is usually an RPC error such as missing trie node, state unavailable, header not found, requested block out of range, or an `eth_call` / `eth_getStorageAt` failure at the pinned block. In that case the choices are: use an RPC plan with archive access, pin to a recent block still inside the provider's retention window, or refresh the pinned block periodically. For long-term deterministic CI, use an archive-capable endpoint and a fixed block number.
