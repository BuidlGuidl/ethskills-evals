`createSelectFork(url)` without a block number forks `latest`. `latest` is not a
fixture: it moves every time Ethereum produces a block. The tests have therefore
been running against production state, not against the same test input.

That explains the apparently unrelated symptoms:

- A Chainlink answer and a Uniswap pool's balances/reserves are live state. A new
  update, swap, liquidity change, or simply crossing an assertion boundary can
  make assertions that happened to pass for months start failing.
- A rerun can select a later head with different state, so the identical commit
  can pass or fail. Several tests may even select different heads if each creates
  its own fork.
- Foundry cannot safely reuse its persistent RPC cache for a moving `latest`
  state in the same way it can for an old, immutable block (recent blocks also
  have reorg risk). Consequently the suite repeatedly fetches account, code, and
  storage data from the remote node. More remote work, provider latency, and
  throttling show up as slower tests; enough requests against a free-tier quota
  show up as HTTP 429s. A 429 or retry can add still more latency. The 429s are
  not what changes the price or reserves, but they are another consequence of
  depending repeatedly on the live RPC rather than a reusable fixed snapshot.

Pin the fork to one explicit block and treat that number as test-fixture data:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 20_000_000; // choose a known-good block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The actual number should be a sufficiently confirmed block whose Chainlink and
Uniswap state is the state the assertions were written for. Record it in source
control; do not derive it from `block.number`, `latest`, a timestamp lookup at
test time, or an RPC call. Pinning also lets Foundry reuse block-keyed cached RPC
responses, reducing calls after the cache is warm. CI's first uncached run can
still make RPC requests, so provider limits can still affect availability, but
they can no longer change the selected blockchain state.

This fix works with `MAINNET_RPC_URL` **only if that free-tier endpoint can serve
historical state at the pinned block**. As the pinned block ages, that normally
requires archive (historical-state) access; some free tiers expose it, some prune
old state or reserve archive queries for paid plans. Being able to fetch the old
block header is not enough. Test the actual state methods the suite needs, for
example an `eth_call` to the Chainlink feed and/or `eth_getStorageAt` for the pool
with the block parameter set to the pinned block (equivalently, use `cast call
... --block 20000000 --rpc-url "$MAINNET_RPC_URL"`). An error such as “missing
trie node,” “historical state unavailable,” or a plan/retention-limit error means
the endpoint does not provide the required archive state. In that case use an
archive-capable RPC endpoint (or a local archived/snapshotted node); changing the
URL while keeping the block number pinned preserves determinism.
