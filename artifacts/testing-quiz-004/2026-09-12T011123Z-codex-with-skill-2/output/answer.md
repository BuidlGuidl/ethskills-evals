# Root cause and deterministic fix

All four symptoms come from forking an unpinned, moving chain head:

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"));
```

With no block number, each test run selects whatever Ethereum block is latest at that moment. Chainlink prices and Uniswap reserves are live state, so their values can legitimately differ between runs even when the repository is unchanged. A test may therefore fail and then pass on the same commit simply because the two jobs used different blocks (and possibly different state while a new head was arriving).

The moving block also defeats reuse of Foundry's fork/RPC cache: state fetched for one block cannot safely satisfy queries at another block. As the chain head advances, CI has to fetch more uncached account and storage data. That explains the steadily slower tests and the growing request volume that eventually produces HTTP 429 rate-limit responses. The 429s can themselves make runs fail or add retry latency, but they are not the source of the changing price and reserve values.

Pin one known block and make the assertions match the state at that block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_000_000; // choose and record a suitable block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The selected block must be after all deployments and initialization that the tests use. Commit the block number (or pin a committed Foundry RPC alias to that block) rather than deriving it from `block.number`, `latest`, or an environment value that CI silently changes. This gives every run the same Chainlink and Uniswap state and lets the same cached fork data be reused.

**This fix does not necessarily work against the current free-tier `MAINNET_RPC_URL`.** Once the pinned block is older than the provider's retained recent-state window, serving it requires **archive-state access at that historical block**. Some free tiers include limited archive access; others do not, and the URL alone does not reveal that capability.

Check the endpoint by making an `eth_call` for one of the actual Chainlink/Uniswap contracts with the JSON-RPC block parameter set to the chosen historical block (for example, `0x121EAC0` for block 19,000,000), ideally also checking a required storage read. If it returns the historical result, the endpoint supports the needed depth. Errors such as `missing trie node`, `historical state unavailable`, or a plan/archive-access error mean it does not. In that case, use an archive-capable RPC plan/provider (and sufficient rate limits), or choose a still-retained recent block as a temporary pin—knowing that the latter must be advanced periodically and its expected values updated.
