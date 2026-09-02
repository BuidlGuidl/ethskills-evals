# The fork is following a moving target

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` uses the RPC endpoint's
latest block. It does **not** create a fork at a fixed point in mainnet history.
Consequently, the tests have effectively changed even though the repository has
not:

- Chainlink answers can change from one block to the next.
- Swaps, liquidity changes, and fee collection change a Uniswap pool's state and
  reserves.
- Two CI runs of the same commit can begin from different blocks, so a boundary
  assertion can fail and then pass on a rerun. The RPC provider may also expose
  slightly different heads while nodes synchronize or load is balanced.
- Because every new head is a different fork, requests for that state cannot keep
  benefiting from one stable Foundry RPC cache. As the test suite repeatedly moves
  to new blocks, it must fetch fresh account, code, and storage data. That explains
  the growing cache/work and slower runs, and the extra RPC traffic eventually
  hitting the free tier's rate limit (`HTTP 429`). Rate limiting can add retries
  and latency too, reinforcing the slowdown and flakiness.

Pin the fork to an explicit, finalized block and pin the expected Chainlink and
Uniswap values to the state at that same block:

```solidity
uint256 internal constant MAINNET_FORK_BLOCK = 20_000_000; // example; choose and record a suitable block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The exact number above is illustrative; the project should select a block at
which all required contracts and expected conditions exist. Commit that number
with the tests. Every run will then see the same oracle answer and pool state,
and Foundry can reuse cached RPC responses for that block. This makes the test
inputs deterministic; it also normally makes later runs faster and substantially
reduces RPC calls. It does not eliminate every possible provider outage or rate
limit, so CI concurrency may still need to respect the provider's request quota.

## Does this work with the free-tier URL?

**Only if that endpoint serves historical (archive) state for the pinned block.**
Pinning a block number causes calls such as `eth_call`, `eth_getCode`, and
`eth_getStorageAt` to be requested with that historical block tag. Some free-tier
providers expose archive data; others retain only recent state or restrict archive
access by plan. A normal head-only endpoint is therefore not automatically enough.

We can tell by querying one of the contracts at the chosen block through the same
URL, for example:

```bash
cast call <CHAINLINK_FEED_ADDRESS> \
  "latestRoundData()(uint80,int256,uint256,uint256,uint80)" \
  --block 20000000 \
  --rpc-url "$MAINNET_RPC_URL"
```

If that succeeds and returns the expected historical result, the endpoint can
serve the needed state for that block. Errors such as `missing trie node`,
`historical state unavailable`, `header not found`, or an archive-plan/retention
error mean it cannot. In that case, use an archive-capable RPC endpoint (or choose
a pinned block still inside the provider's advertised historical retention
window). A local archived snapshot/anvil state dump is another way to remove the
remote dependency entirely.
