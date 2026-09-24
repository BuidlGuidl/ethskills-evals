# Recommendation: deploy the core escrow on Ethereum mainnet

Use Ethereum mainnet for the escrow contract and denominate jobs in USDC. Base is a strong second deployment later for lower-friction consumer UX, but for $2,000-$50,000 jobs the mainnet gas premium is too small to justify making an L2 the only custody venue.

The reason is simple: this is not a micropayment product. Users are trusting the contract with thousands of dollars per job, so settlement credibility, USDC liquidity, auditability, and avoiding L2 withdrawal/bridge assumptions matter more than saving a few cents per escrow.

## Inputs checked

Checked on 2026-09-23 UTC:

| Input | Value used | Source/check |
| --- | ---: | --- |
| ETH/USD | $2,736.04 | CoinGecko simple price API |
| Ethereum gas price/base fee | 315,278,443 wei = 0.315278443 gwei | `cast gas-price` and `cast base-fee` via `https://ethereum-rpc.publicnode.com` |
| Base gas price | 6,000,000 wei = 0.006 gwei | `cast gas-price` via `https://base-rpc.publicnode.com` |
| Arbitrum gas price | 20,016,000 wei = 0.020016 gwei | `cast gas-price` via `https://arbitrum-one-rpc.publicnode.com` |

Formula:

```text
transaction cost in USD = gas_used * gas_price_gwei * 1e-9 * ETH_USD
```

## Escrow transaction cost estimate

Assumed a simple ERC-20 USDC escrow:

| Action | Gas estimate |
| --- | ---: |
| USDC approve | 46,000 |
| Fund/create escrow with `transferFrom`, storage writes, event | 180,000 |
| Release escrow with state update, USDC transfer, event | 104,000 |
| Normal happy-path total | 330,000 |
| Dispute/admin path total allowance | 500,000 |
| One-time contract deployment | 2,500,000 |

Mainnet costs using the live 0.315278443 gwei gas price:

| Item | Cost |
| --- | ---: |
| Normal job lifecycle, 330k gas | $0.28 |
| Dispute path allowance, 500k gas | $0.43 |
| One-time deploy, 2.5M gas | $2.16 |

Sensitivity:

| Gas price | 330k gas lifecycle | Share of $2,000 job | Share of $50,000 job |
| ---: | ---: | ---: | ---: |
| 0.315 gwei, current check | $0.28 | 0.014% | 0.00057% |
| 1 gwei, busy but normal | $0.90 | 0.045% | 0.0018% |
| 10 gwei, spike/event | $9.03 | 0.45% | 0.018% |

Even at a 10 gwei spike, mainnet gas is still under 0.5% of the smallest escrow size, and non-urgent creates/releases can wait out spikes.

## L2 comparison

Base and Arbitrum are cheaper, but the absolute savings are small for this ticket size.

Execution-only arithmetic for the same 330k gas lifecycle:

| Chain | Gas price checked | Execution-only cost |
| --- | ---: | ---: |
| Base | 0.006 gwei | $0.005 |
| Arbitrum | 0.020016 gwei | $0.018 |
| Ethereum mainnet | 0.315278443 gwei | $0.28 |

Actual L2 fees also include L1 data costs, so I would treat a Base escrow lifecycle as roughly cents rather than fractions of a cent. That is still cheaper than mainnet, but the current saving versus Ethereum mainnet is only on the order of a quarter per normal job lifecycle.

That saving is not worth making every $2,000-$50,000 escrow depend on L2-specific operational tradeoffs: sequencer availability, L2 upgrade/governance risk, bridge/liquidity assumptions, and the 7-day official optimistic-rollup withdrawal window if users need to exit back to Ethereum mainnet.

## Why mainnet wins for this product

Ethereum mainnet gives the strongest default custody story for high-value escrow: deepest USDC liquidity, broad wallet/exchange support, the cleanest settlement assumptions, and the least explanation burden for clients who ask where their $50,000 is sitting.

Gas is now cheap enough that mainnet does not break the business model. At today's checked price, the normal on-chain lifecycle is about $0.28. Compared with a $2,000 job, that is effectively noise; compared with the platform fee on a freelance marketplace, it is even smaller.

I would still design the contracts so they can be deployed to Base later. Base is the best L2 candidate for a freelance-payment front end because it has native USDC, Coinbase distribution, low fees, and fast confirmations. I would choose Base first only if the product needs very frequent milestone edits, many small sub-$500 jobs, gas-sponsored consumer onboarding, or Coinbase/Base-native users as the primary market.

For the stated $2,000-$50,000 escrow range, deploy the core escrow on Ethereum mainnet first. Add Base as a convenience rail after the contract and dispute process are proven.
