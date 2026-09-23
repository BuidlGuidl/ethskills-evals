# Recommendation: Ethereum mainnet

For an escrow service holding $2,000–$50,000 per job with only a handful of
on-chain actions per job (fund, release, maybe refund), **deploy on Ethereum
mainnet**. Gas is not a deciding factor at these numbers — measured mainnet
cost is ~$0.09 per job, i.e. at most 0.005% of the smallest job — so the
decision should be driven by security, finality, and stablecoin liquidity,
where mainnet is strongest.

## Live measurements (taken 2026-09-23, not remembered values)

| Reading | Value | Source |
|---|---|---|
| ETH/USD | $2,730.38 | Chainlink feed `0x5f4eC3...8419`, `latestRoundData` (8 decimals) |
| Mainnet gas price | 0.301 gwei (300,977,915 wei) | `cast gas-price` on `ethereum-rpc.publicnode.com` |
| Base gas price | 0.006 gwei (6,000,000 wei) | `cast gas-price` on `mainnet.base.org` |
| Base effective gas price (real txs) | ~0.084 gwei avg (0.035–0.116 gwei) | `effectiveGasPrice` on 3 recent Base receipts |
| Base L1 data fee | ~0.000000007 ETH (~$0.00002) | `l1Fee` on the same receipts |

The L1 data fee is a separate cost component on OP-stack chains and is not in
the `gas-price` reading, so it was read off real receipts per
`cost = (gas_used × gas_price + l1_fee_eth) × eth_usd`.

## Gas-used assumptions

A minimal escrow (state machine with `fund` / `release` / `refund`, a few
storage writes each, ERC-20/ETH transfer out on release):

- One-time contract deploy: ~1,000,000 gas
- Fund a job: ~60,000 gas
- Release to freelancer: ~50,000 gas
- Per-job total: ~110,000 gas across 2 transactions

## Cost per operation

| Operation | Mainnet | Base |
|---|---|---|
| Deploy (once) | $0.82 | $0.23 |
| Fund job | $0.049 | $0.014 |
| Release | $0.041 | $0.012 |
| **Per job (fund + release)** | **$0.090** | **$0.025** |

## Why mainnet anyway

- **Cost is noise at this scale.** $0.09 of gas on a $2,000 job is 0.0045%;
  on a $50,000 job it is 0.0002%. Saving $0.065/job on Base is irrelevant to
  the business.
- **Low-frequency, high-value fits mainnet.** Each job touches the chain 2–3
  times over days or weeks. There is no throughput or latency requirement that
  would favor an L2.
- **Security of escrowed funds.** Escrow's entire product is trust in custody.
  Mainnet offers the strongest finality and the most battle-tested environment
  for holding five figures of client money, with no bridge or sequencer-risk
  surface for funds sitting in the contract.
- **Liquidity and UX.** Clients funding $2k–$50k escrows most often hold
  USDC/USDT/ETH on mainnet; requiring them to bridge to an L2 to fund a job
  adds friction and bridge risk that dwarfs $0.065 in gas savings.

## When to revisit

Move (or extend) to an L2 like Base if the product shifts toward
high-frequency, low-value activity — e.g. per-milestone releases under ~$100,
streaming payments, or thousands of micro-jobs per day — where the ~3.5× cost
ratio and L2-native UX start to matter. Re-measure gas prices at that time;
do not reuse today's readings.
