# Diagnosis

`vm.createSelectFork(vm.envString("MAINNET_RPC_URL"))` does **not** select a fixed Ethereum state. With no block number, Foundry forks whatever the RPC server calls `latest` when `setUp` runs. The tests therefore have an undeclared input: the mainnet block (and all of its contract state).

That accounts for the apparent mystery:

- Chainlink answers and Uniswap reserves are live state, so an assertion that was correct at one head can be wrong at another. A re-run can use another block and pass again. Near a boundary, different RPC backends can also briefly disagree about `latest`, especially around a reorg.
- Because the fork block keeps changing, Foundry's block-keyed RPC cache cannot reliably reuse the same historical responses between runs. More state must be fetched on demand. That makes runs slower and increases requests to the provider; a free-tier rate limit then shows up as HTTP 429s. A growing or increasingly loaded test suite/provider can amplify this. The 429 itself is a provider-capacity symptom, not evidence of a Solidity regression.
- Retrying a 429 may make a job complete, but it cannot make an unpinned fork deterministic.

# Deterministic change

Choose a block at which the asserted Chainlink answer and pool reserves are known, record it in the repository, and always fork that exact block:

```solidity
uint256 constant MAINNET_FORK_BLOCK = 19_500_000; // example: replace with the reviewed fixture block

function setUp() public {
    vm.createSelectFork(
        vm.envString("MAINNET_RPC_URL"),
        MAINNET_FORK_BLOCK
    );
}
```

The expected values must be captured from that same block. Do not compute the block as `block.number - N`, query `latest`, or use a mutable environment value in CI; commit the number as part of the test fixture. Then Foundry asks for one immutable snapshot, assertions see the same state on every run, and cached RPC results can be reused, reducing latency and rate-limit pressure. CI should persist Foundry's RPC cache if cache reuse between jobs is desired. Pinning does not eliminate all initial RPC calls, so ordinary retry/backoff or a less constrained provider may still be needed for 429s.

# Free-tier constraint

This fix works with `MAINNET_RPC_URL` **only if that endpoint can serve historical state at the pinned block**. A free-tier endpoint may expose only a pruned node or restrict archive access. The required capability is archive/historical-state RPC access for the chosen block (including the methods Foundry needs, commonly historical `eth_getCode`, `eth_getStorageAt`, `eth_getBalance`, and sometimes `eth_getProof`). Merely returning the old block from `eth_getBlockByNumber` is not enough; even pruned nodes retain old block headers.

We can tell by running the pinned fork test, or directly requesting contract code/storage at that exact block. Errors such as `missing trie node`, `historical state unavailable`, `state is pruned`, or an archive-tier/unsupported-method response mean the endpoint cannot provide the snapshot. In that case use an archive-capable RPC endpoint (or pin a sufficiently recent block that the provider explicitly guarantees remains inside its historical-state retention window, understanding that such a rolling window is not a permanent fixture). Once a block is chosen, verify the provider's documented retention and run a historical state query against it before relying on CI.
