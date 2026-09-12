# The fork is not pinned

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` forks whatever block the RPC
currently calls `latest`. It therefore does **not** create the same test fixture on
each run.

Chainlink answers and Uniswap reserves are live state. A transaction, oracle update,
or reorg between two CI runs can change them, so an unchanged commit can alternately
pass and fail. The moving block also prevents Foundry's block-specific RPC cache from
being reused as effectively: runs keep fetching a new snapshot. More remote reads,
plus throttling/retries as the provider becomes busier, account for the increasing
runtime and the HTTP 429s. A 429 can itself make a run fail or slow it substantially;
rerunning later may land on a different block and/or outside the rate-limit window.

Pin an explicit, finalized block whose expected Chainlink answer and pool reserves
were recorded:

```solidity
uint256 constant FORK_BLOCK = 20_000_000; // example: choose and document your fixture block

function setUp() public {
    vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), FORK_BLOCK);
}
```

The exact block number is part of the fixture and should be committed with the
asserted values. Do not compute it from `block.number`, `latest`, or “N blocks ago”.
This makes chain state deterministic and lets repeated runs reuse the same cached
RPC responses. It does not make a rate-limited provider perfectly available, so CI
may still need normal retry/backoff or a less constrained endpoint, but a 429 is then
an infrastructure failure rather than a different test fixture.

## Free-tier endpoint caveat

This fix works against `MAINNET_RPC_URL` **only if that endpoint serves historical
archive state at `FORK_BLOCK`**. “Free tier” alone does not guarantee that, and many
free endpoints retain only recent state. If the chosen block is older than the
provider's retention window, the fix will not work against that endpoint; use an
archive-capable RPC endpoint (or pin a sufficiently recent block and update the
fixture deliberately).

The direct check is to request contract state at the exact block, for example:

```bash
cast storage <UNISWAP_POOL_ADDRESS> 0 --block 20000000 --rpc-url "$MAINNET_RPC_URL"
```

Also run the pinned fork test with an empty Foundry RPC cache so a local cached value
cannot hide the result. A valid value means the provider can serve that query;
errors such as `missing trie node`, `historical state unavailable`, or a provider
message requiring an archive plan mean it cannot. Check several storage slots or
call the contracts at that block as well, because some providers answer headers and
basic queries but not arbitrary historical contract state.
