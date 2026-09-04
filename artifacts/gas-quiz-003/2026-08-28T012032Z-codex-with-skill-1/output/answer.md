# Recommendation: deploy the agent-feed protocol on Base

Base is the best default chain for an Ethereum-native social feed for AI agents. A feed has potentially frequent, low-value actions (posting attestations, following, reacting, paying small rewards, and updating reputation). That is an L2-shaped workload: it benefits more from low per-action fees and fast, inexpensive iteration than from Ethereum mainnet's settlement layer directly.

Keep the protocol Ethereum-aligned by deploying the contracts on Base and using Ethereum mainnet only for infrequent, high-value settlement or governance if the project later needs it. Do not put post bodies or model output on-chain; store that content off-chain (for example, content-addressed storage) and put hashes, permissions, payments, and reputation state on Base.

## Fee snapshot and assumptions

Measured on 2026-08-27 using `eth_gasPrice` (and, on Base, the OP Stack GasPriceOracle) immediately before this recommendation:

| Item | Ethereum mainnet | Base |
| --- | ---: | ---: |
| RPC gas price (raw wei) | 57,078,817 | 6,000,000 |
| RPC gas price (gwei) | 0.057078817 | 0.006 |
| Base fee (gwei) | 0.056336496 | 0.005 |
| ETH/USD spot price | $2,529.82 | $2,529.82 |

Sources queried: `https://ethereum-rpc.publicnode.com`, `https://mainnet.base.org`, and Coinbase's ETH/USD spot endpoint. Gas prices change continuously, so these are a decision snapshot, not a promise of a future fee.

I used an 80,000-gas publish/interaction transaction and a 500,000-gas contract deployment as transparent planning assumptions. Actual gas must be estimated from the final contracts before launch.

For Base I also measured the L1-data component rather than assuming it is zero:

* 100 bytes of non-zero feed calldata: `getL1GasUsed` returned 1,600 and `getL1Fee` returned 504,288,008 wei.
* A deliberately conservative 24,000-byte, non-zero deployment payload: `getL1Fee` returned 1,274,330,249 wei.

## Calculations

The calculation is:

`cost in ETH = (gas used × gas price in wei + Base L1 data fee in wei) / 1e18`

`cost in USD = cost in ETH × $2,529.82`

| Operation | Mainnet calculation | Mainnet cost | Base calculation | Base cost |
| --- | --- | ---: | --- | ---: |
| Feed publish / interaction (80,000 gas) | `80,000 × 57,078,817` | 0.000004566305 ETH = **$0.011552** | `80,000 × 6,000,000 + 504,288,008` | 0.000000480504 ETH = **$0.001216** |
| Contract deployment (500,000 gas) | `500,000 × 57,078,817` | 0.000028539408 ETH = **$0.072200** | `500,000 × 6,000,000 + 1,274,330,249` | 0.000003001274 ETH = **$0.007593** |

At this snapshot, Base makes the representative interaction about 9.5x cheaper and the representative deployment about 9.5x cheaper. The exact ratio will move with both networks' fees, but the workload fit remains: many agent actions should have a small enough marginal cost that experimentation and automation are not artificially constrained.

## Why not deploy the whole feed on mainnet?

Mainnet is the stronger choice for low-frequency, high-value settlement, but its fee advantage is not relevant here. Even with mainnet unusually inexpensive in this snapshot, a social feed compounds transaction count. Base preserves Ethereum security alignment while making routine agent activity economically practical. Use mainnet selectively later for a governance timelock, a high-value treasury, or periodic settlement—not for every feed event.

Before each production deployment or transaction submission, refresh the target chain's EIP-1559 fee fields and re-estimate the final transaction. For Base, inspect a real receipt's `gasUsed × effectiveGasPrice` and `l1Fee`; the L1 data charge is a distinct part of the bill.
