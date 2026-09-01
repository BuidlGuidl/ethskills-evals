# Why the fork tests became flaky

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks at the RPC endpoint's
current `latest` block. It does **not** create a stable snapshot. Therefore the same
commit can test against different Ethereum state on different runs.

That connects all four symptoms:

- Chainlink prices and Uniswap reserves are live, mutable state. Eventually that
  state crossed assumptions embedded in the assertions, causing the sudden failures.
- A rerun can select a different head block, so a state-dependent test can pass or
  fail without any repository change. Head movement and provider load balancing or
  short reorgs can make the boundary especially visible.
- Each new head is a new fork/cache key. Foundry cannot consistently reuse the RPC
  data cached for an earlier block, so it repeatedly fetches account, code, and
  storage state. As the suite/cache grows and runs remain cold with respect to each
  new head, the tests become slower.
- Those repeated lazy state reads increase request volume, which explains the
  free-tier provider's HTTP 429 rate-limit responses. A 429 can itself produce an
  additional intermittent failure.

Pin the fork to one explicit block whose state is known to satisfy the fixtures:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 20_000_000; // example; choose and record a verified block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

Assertions should use the exact expected Chainlink and pool values at that block (or
assert deliberate invariants instead of expectations about today's values). Pinning
makes every run select the same world state and lets Foundry reuse its block-specific
RPC cache, which also reduces latency and rate-limit pressure. It does not eliminate
all possible 429s on a completely cold run, so normal provider retry/backoff or a
higher-rate endpoint may still be needed for transport reliability.

## Free-tier constraint

This fix works with `MAINNET_RPC_URL` **only if that endpoint serves historical state
for the pinned block**. A durable old block generally requires archive-state access;
some free-tier plans do not provide it, or provide only a limited recent-history
window. Pinning a recent block may work today and then stop once it falls outside
that window, so that is not a durable solution.

Test the endpoint by issuing the actual state queries the fork needs with the pinned
block number (hex) rather than `latest`, for example `eth_getCode`,
`eth_getStorageAt`, `eth_getBalance`, or `eth_call` against the relevant contracts.
If it returns the historical result, the endpoint supports that block. Errors such as
`missing trie node`, `state is not available`, `historical state unavailable`, or a
provider message saying archive data requires another plan mean it does not.

If the free endpoint cannot serve that block, use an archive-capable RPC endpoint
(or a self-hosted/archive node). Merely pinning the block number cannot make a
pruned endpoint supply state it no longer has.
