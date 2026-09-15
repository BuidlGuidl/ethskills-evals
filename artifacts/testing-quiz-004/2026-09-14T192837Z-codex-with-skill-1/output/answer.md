# Diagnosis

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks at the current chain head. The tests therefore do not run against a fixed fixture: each run can see a different Chainlink answer and different Uniswap reserves.

That ties the symptoms together:

- The assertions suddenly fail because mainnet state eventually moved outside the exact values or tolerances assumed by the tests, even though the repository did not change.
- Re-runs are flaky because they may select a later block with different state (and possibly a different oracle update or swap).
- The suite gets slower because a new head means Foundry cannot consistently reuse RPC state cached for the prior fork block, so it must fetch more state remotely as the chain keeps advancing.
- Those repeated cache misses generate more RPC requests, making a rate-limited free-tier endpoint return HTTP 429 responses.

# Deterministic change

Choose a sufficiently confirmed block whose state is known to satisfy the fixture, record it in the repository, and pin every fork to it:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // replace with the chosen block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

Expected Chainlink values and Uniswap reserves should be asserted for that same block. Pinning makes all runs read the same state and lets Foundry reuse its RPC cache. A well-confirmed block should be selected rather than the latest block, to avoid reorganization risk.

# Free-tier constraint

This fix does **not necessarily work with the existing free-tier `MAINNET_RPC_URL`**. As the pinned block ages, serving its state requires **archive/historical-state access** (or at least enough retained history to include that block), which many free-tier endpoints do not provide. Pinning a recent block may work temporarily and then stop once it falls outside the provider's retained-state window; durable CI needs a plan or endpoint that continues to serve the chosen historical block.

We can tell by making a historical `eth_call` through that exact endpoint, against a known contract, with the chosen block number as the JSON-RPC block tag—for example, calling a Chainlink feed's `latestRoundData()` at that block. If the endpoint returns the historical result, it supports the required depth at that moment. If it reports missing/pruned historical state, an unsupported block, or an archive-plan restriction, it does not. The provider's plan documentation should also explicitly promise archive access; a one-time successful call to a recent block is not proof that the free tier will retain it indefinitely.
