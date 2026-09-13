# Diagnosis

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks at `latest`. Thus these tests have not been running against one fixed input: every run may select a different mainnet block.

That ties the symptoms together:

- Chainlink answers and Uniswap reserves are live state. They eventually changed enough that assertions written for earlier state failed.
- A rerun can select a different head block, so boundary-sensitive assertions can pass or fail on the same commit. Provider load, head propagation, and reorgs can add more variation, but the moving block is already enough to make the tests nondeterministic.
- Foundry's RPC cache is block-specific. As `latest` advances, previously cached state cannot satisfy requests for the new block, so the suite makes remote calls instead of repeatedly reusing the same fork data. That accounts for the growing slowdown and increased request volume.
- Those extra uncached calls consume the provider's free-tier quota/rate limit and produce HTTP 429 responses. The 429s can themselves make runs slower or fail, but they are not the underlying reason that price/reserve assertions drift.

# Deterministic change

Choose a known block at which the fixtures and expected Chainlink/Uniswap values are valid, and pin every fork to it:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // replace with the reviewed fixture block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

Commit that block number and the expectations derived from it. Do not calculate the block from `block.number`, a timestamp, or `latest`, since that merely hides the moving input. With a stable RPC URL and block number, Foundry can also reuse its cached responses, reducing latency and request count.

# Free-tier constraint

This fix does **not necessarily work against the current free-tier `MAINNET_RPC_URL`**. A fixed block becomes historical, and serving contract state at an old block requires **archive/historical-state access at that depth**. Some free-tier plans do not provide it, or retain only a limited recent window. Being able to fetch the old block header is not sufficient.

Test the endpoint with a real `eth_call` against one of the test's deployed contracts at the chosen block, for example:

```sh
cast call <CHAINLINK_OR_POOL_ADDRESS> '<VIEW_FUNCTION_SIGNATURE>' \
  --block 19000000 \
  --rpc-url "$MAINNET_RPC_URL"
```

Use a view call that the tests actually make and verify its expected result. If the endpoint returns historical state, the pin will work. Errors such as `missing trie node`, `historical state unavailable`, or a provider message saying archive data is unsupported mean that it will not. In that case, use an archive-capable endpoint/plan (and verify that its rate allowance is adequate). Pinning to a merely recent block may work temporarily on a pruned free-tier endpoint, but it is not a durable CI fix because that block will age out of the retention window.
