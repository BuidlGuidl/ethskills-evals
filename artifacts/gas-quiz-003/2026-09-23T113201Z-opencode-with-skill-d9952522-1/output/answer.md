# Recommendation: Deploy on Base (Ethereum L2)

For a social feed for AI agents — a **high-frequency, low-value, latency-sensitive** workload — deploy on **Base**, an OP-stack L2 that settles to Ethereum mainnet. You stay fully inside the Ethereum ecosystem (EVM-equivalent, ETH as gas token, Ethereum-grade settlement security) while paying ~50x less per action and getting ~6x faster block times (2s vs 12s).

## Measured numbers (queried live, 2026-09-23)

| Reading | Value | Source |
|---|---|---|
| ETH/USD | $2,724.39 | Coinbase spot API |
| Ethereum mainnet gas price | 0.3036 gwei (303,559,640 wei) | `cast gas-price` via ethereum-rpc.publicnode.com |
| Base gas price (execution) | 0.006 gwei (6,000,000 wei) | `cast gas-price` via mainnet.base.org |
| Base L1 data fee (representative post calldata) | 4,038,253,558 wei (~4.04e-9 ETH) | `GasPriceOracle.getL1Fee` at `0x4200...000F` with ~172 bytes of `post(string)` calldata |

## Cost model

Representative operation: one feed post — a contract call that writes a storage slot and emits an event.

- **Gas-used assumption: 50,000 gas.** Justification: 21,000 intrinsic + ~20,000 for one new storage slot + event emission and call overhead. Stated as an assumption since no target contract exists yet; it should be re-measured against the real contract before launch.

Formulas used:

```
mainnet_cost = gas_used x gas_price_gwei x 1e-9 x eth_usd
base_cost    = (gas_used x gas_price_gwei x 1e-9 + l1_fee_eth) x eth_usd
```

## Results (per post)

| Chain | Execution | L1 data fee | Total per post |
|---|---|---|---|
| Ethereum mainnet | $0.04135 | — | **$0.0413** |
| Base | $0.000817 | $0.000011 | **$0.00083** |

**Mainnet is ~50x more expensive per post.** At 1M posts/day (plausible for autonomous agents): ~$41,350/day on mainnet vs ~$828/day on Base. Likes, follows, and other interactions multiply this gap further.

## Reasoning

1. **Workload fit.** Social feeds are high-frequency, low-value, latency-sensitive — the textbook case for an L2 over mainnet. Mainnet's strength (low-frequency, high-value settlement) isn't what a feed needs.
2. **Measured, not remembered.** Mainnet gas is actually cheap right now (~$0.04/post), but it is still ~50x Base, and mainnet fees are historically volatile — a single congestion spike would make agent-scale posting uneconomical. Base's fee floor is structurally low.
3. **Fee structure understood.** On Base the L1 data fee is a separate component, so I measured it directly via the GasPriceOracle rather than estimating it. At ~1.3% of the total, execution gas dominates, so optimizing contract gas usage matters more than calldata tricks on this workload.
4. **Latency.** 2-second blocks on Base vs 12 seconds on mainnet gives a snappier feed.
5. **Ecosystem commitment preserved.** Base is EVM-equivalent, settles to Ethereum, uses ETH for gas, and shares tooling (`cast`, Foundry, standard bridges) — no compromise on the Ethereum-ecosystem requirement.

## Caveats

- Re-run these measurements at launch time; gas prices and ETH/USD drift, and EIP-1559 fee fields should be derived from the live chain immediately before submission, never hardcoded.
- Re-estimate `gas_used` against the actual post contract once written.
- If the product later involves high-value actions (e.g., paid agent-to-agent settlements), those specific flows can reasonably live on mainnet while the feed stays on Base.
