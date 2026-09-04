# Diagnosis

All four symptoms come from forking an **unpinned, moving chain head**:

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

With no block number, each test run forks whatever block the RPC endpoint considers `latest` at that moment. Chainlink answers and Uniswap reserves are live on-chain state, so the same commit is not actually being tested against the same inputs. A new oracle update, swap, liquidity change, or even a provider node being a block or two behind can change the asserted values. That explains both the sudden failures and why rerunning the identical commit can pass.

It also defeats stable fork caching. Foundry fetches fork state lazily through RPC. As `latest` advances, runs address different block state instead of consistently reusing data for one block, causing more cold RPC reads. The growing/less-reusable workload makes the suite slower and increases request volume; on a free-tier endpoint that eventually produces HTTP 429 rate-limit responses. A 429 or inconsistent responses from load-balanced RPC nodes can add still more flakiness, but it is not the underlying determinism problem.

# Deterministic change

Choose an explicit mainnet block whose state has the expected Chainlink price and Uniswap reserves, and keep it in source control:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // replace with the chosen block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

Then derive the expected oracle and pool values from that same block (or assert appropriate properties against that fixed state). Do not periodically replace the number merely to use a recent block; changing it is an intentional fixture update and should be reviewed together with changed expectations.

# Free-tier constraint

**This fix does not necessarily work against the existing free-tier `MAINNET_RPC_URL`.** A permanently pinned block eventually requires the provider to serve **archive/historical state**, not merely old block headers. Some free tiers retain state for only a recent window or do not offer archive access at all.

We can tell by querying contract state at the chosen block through that exact URL—for example, run the fork test or use `cast call`/`cast storage` with `--block 19000000`. If it returns the value, the endpoint currently supports that historical state. Errors such as `missing trie node`, `historical state unavailable`, `header not found`, an unsupported-block-range message, or a plan/permission error mean it does not. A recent pinned block passing today is not proof of long-term archive support; repeat the check with a block older than the provider's advertised retention window or verify the provider's plan documentation.

For durable CI, use an archive-capable RPC endpoint/plan (and enough rate-limit capacity), or run an appropriately retained node. Pinning supplies determinism; archive access ensures the pinned fixture remains retrievable. Foundry's local RPC cache can reduce repeat traffic after a successful fetch, but CI caches are often ephemeral and must not be treated as a substitute for an archive-capable source.
