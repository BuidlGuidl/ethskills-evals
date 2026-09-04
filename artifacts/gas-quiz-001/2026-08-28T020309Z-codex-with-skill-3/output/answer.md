# Recommendation: Ethereum mainnet

Deploy the escrow contracts on **Ethereum mainnet** and settle the jobs in a USD stablecoin (for example, USDC). For $2,000--$50,000 jobs the expected number of on-chain actions is small--an approval, funding, and a release (or an occasional dispute)--and mainnet's current fee is immaterial relative to the money protected. Mainnet also has the deepest stablecoin liquidity and the most established security and operational tooling, which are valuable for custody-like escrow.

This is deliberately a mainnet recommendation, not an assumption that mainnet is always the cheaper option: the numbers below were measured live at 2026-08-28 02:03 UTC and must be refreshed when transactions are sent.

## Numbers used

| Input | Ethereum mainnet | Base (comparison) |
| --- | ---: | ---: |
| Base fee (RPC reading) | 57,806,417 wei = 0.057806417 gwei | 5,000,000 wei = 0.005 gwei |
| Gas price (RPC reading) | 61,930,085 wei = **0.061930085 gwei** | 6,000,000 wei = **0.006 gwei** |
| ETH/USD spot | $2,509.64 | $2,509.64 |

Sources were `cast base-fee` and `cast gas-price` against `ethereum-rpc.publicnode.com` and `mainnet.base.org`, plus Coinbase's ETH-USD spot endpoint. The readings are a point-in-time quote, not a safe fee setting for a later transaction.

For planning, I use conservative gas-use assumptions for a simple, audited ERC-20 escrow: 50,000 gas for a USDC approval, 150,000 for creating a job, 120,000 for funding it, 100,000 for release, and 150,000 for a dispute action. Actual gas depends on storage layout, signatures, and token behavior; estimate the deployed contract method before submitting.

Mainnet calculation:

```
cost (USD) = gas used x 0.061930085 gwei x 1e-9 ETH/gwei x $2,509.64/ETH
```

| Mainnet action | Assumed gas | Estimated fee |
| --- | ---: | ---: |
| USDC approval | 50,000 | $0.0078 |
| Create job | 150,000 | $0.0233 |
| Fund job | 120,000 | $0.0187 |
| Release job | 100,000 | $0.0155 |
| Dispute action | 150,000 | $0.0233 |
| One contract deployment (1,200,000 gas assumption) | 1,200,000 | $0.1865 |

A normal job lifecycle of approval + create + fund + release is therefore about **$0.0653** in mainnet gas at the measured price. That is **0.33 basis points** of a $2,000 job and **0.013 basis points** of a $50,000 job. Even a dispute adds only about $0.0233 at this quote. Contract deployment is a one-time ~$0.19 planning estimate, excluding any verification, audit, or application costs.

## Why not choose Base solely for fees?

Its displayed execution gas price is about 10.3x lower, but that is not its complete transaction price. A live Base receipt sampled at the same time reported an L1 data fee of `0x1faf7f33` wei = **531,332,915 wei** = about **$0.00133**; this was much larger than that receipt's L2 execution component. Base is indeed likely to be cheaper overall, but its L1 data fee varies with calldata and has to be included in a real estimate. It does not change the decision here: mainnet's estimated full normal lifecycle is only about $0.065, or 0.33 basis points on the smallest escrow, while the value at risk is $2k--$50k.

Choose Base instead only if the product expects many low-value or latency-sensitive on-chain interactions, or if users and liquidity are already Base-native. For the stated high-value, low-frequency freelance escrow, Ethereum mainnet is the safer default; use role separation, time-bounded dispute rules, and an independent security audit rather than treating chain choice as the primary escrow safeguard.

Immediately before every production submission, derive EIP-1559 fee fields from the target chain's then-current fee data--do not hardcode the measured gas price above.
