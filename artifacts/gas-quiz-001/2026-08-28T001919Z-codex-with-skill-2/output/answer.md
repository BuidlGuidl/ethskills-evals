# Recommendation: deploy the settlement contract on Ethereum mainnet

For an escrow holding **$2,000--$50,000 per job**, I would use Ethereum
mainnet and escrow a dollar stablecoin (for example, native USDC), rather than
hold ETH. These are relatively high-value, low-frequency settlement actions:
the extra assurance, deepest stablecoin liquidity, and most mature EVM
security/auditing ecosystem matter more than shaving off a few cents of gas.

This is a settlement recommendation, not a reason to skip application-layer
controls. The contract should be independently audited, have explicit
milestones and deadlines, use a clearly defined dispute/arbitration path, and
avoid admin withdrawal powers over user escrow balances.

## Numbers used

Measured at **2026-08-28 00:20 UTC**:

| Input | Ethereum mainnet | Base mainnet |
|---|---:|---:|
| Base fee | 0.049507648 gwei | 0.005 gwei |
| RPC gas-price quote | 0.049619110 gwei | 0.006 gwei |
| ETH/USD spot price used | $2,514.18 | $2,514.18 |

The ETH/USD quote was Coinbase spot; the fee quotes were queried directly from
each chain's public RPC immediately before writing this recommendation. Fees
move continuously, so these are a reproducible snapshot rather than a fee
promise.

For a deliberately conservative first-pass estimate, assume a new escrow
uses 100,000 gas to fund and 70,000 gas to release. (The actual number must be
measured from the finalized contract and test transactions; ERC-20 approvals,
milestones, and disputes add transactions.) The one-time deployment assumption
is 1,200,000 gas.

`cost in USD = gas used x gas price (gwei) x 10^-9 x ETH/USD`

| Action | Assumed gas | Mainnet cost at the measured quote |
|---|---:|---:|
| Deploy the contract once | 1,200,000 | $0.14970 |
| Fund one job | 100,000 | $0.01248 |
| Release one job | 70,000 | $0.00873 |
| Normal fund + release lifecycle | 170,000 | **$0.02121** |

That normal lifecycle is about **0.00106%** of a $2,000 job and **0.0000424%**
of a $50,000 job. Even a 100x increase in the observed mainnet gas price would
make that lifecycle about $2.12--still 0.106% of the smallest stated escrow.

## Why not choose an L2 solely for cost?

Base's quoted execution gas price was lower (0.006 gwei), so it can be a good
product-layer option if the service will create many small or frequent
escrows. But an OP Stack transaction also has an L1 data fee. That fee has to
be read from the receipt for the actual calldata; multiplying only `gasUsed`
by the Base gas price would understate the all-in cost. The current mainnet
cost above is already immaterial for the stated job values, so this service
does not need to accept additional bridge/rollup operational considerations
just to optimize it.

## Practical design choice

Deploy the canonical escrow and dispute-resolution contracts on Ethereum
mainnet, with USDC deposits. If later product metrics show very high job
volume or a need for near-zero-fee UX, add Base as an optional, separately
deployed escrow venue--do not bridge individual in-flight escrows between the
two chains. Make the chain choice visible to both parties before funds are
deposited.

