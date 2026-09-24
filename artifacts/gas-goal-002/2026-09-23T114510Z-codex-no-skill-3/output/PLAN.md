# Base ERC-20 Gas Plan

## Executive Summary

We send about 40,000 ERC-20 transfers/day from one relayer wallet. At the live Base fee sample I could reach on 2026-09-23, execution pricing was about 0.005 gwei base fee plus about 0.001 gwei median priority fee, or 0.006 gwei total. With ETH/USD at 2718.95 and a conservative 65,000 gas per direct ERC-20 transfer:

`40,000 transfers * 65,000 gas * 0.006 gwei = 0.0156 ETH/day = $42.42/day = $15,482/year`

That is execution gas only. OP-stack receipts may also expose `l1Fee`; the reporter added in this repo includes it when the RPC returns it. If finance needs the exact bill, run the receipt report against the real relayer instead of relying on this estimate.

## Ranked Savings

| Rank | Change | Expected savings | Why it ranks here |
| ---: | --- | ---: | --- |
| 1 | Product-level netting before chain settlement | Up to $10.60/day, $3,869/year at 25% fewer transfers | Avoiding an entire transfer saves all 65,000 gas. This is the biggest lever if payouts can be delayed or netted safely. |
| 2 | Batch same-token transfers through a relayer contract | $7.83/day, $2,858/year at 12,000 gas saved/transfer | Batching keeps the token balance writes but amortizes the per-transaction envelope and some L1 data. Savings are real but modest at current Base fees. |
| 3 | Coalesce duplicate same-token/same-recipient payouts in a settlement window | $1.06/day, $387/year at 2.5% duplicates | Every 1,000 skipped transfers/day saves about 65M gas/day. Actual value depends on payout distribution. |
| 4 | Failure/retry reduction | $0.42/day, $155/year at 1% failed transfer attempts | This is operational hygiene more than a major gas lever, but failed transactions still burn gas. |
| 5 | Right-size priority fee policy | $0/day if already paying 0.001 gwei; $63.62/day, $23,222/year if currently paying 0.01 gwei priority | At the sampled fee level this is already optimized. If receipts show over-tipping, it becomes the top-ranked fix. |

## Numbers Behind The Ranking

Baseline inputs:

- Transfers/day: 40,000
- Direct ERC-20 gas/transfer: 65,000
- Gas/day: 2,600,000,000
- Base execution gas price used for this plan: 0.006 gwei
- ETH/USD: 2718.95
- Estimated execution cost: 0.0156 ETH/day, 5.694 ETH/year, $15,482/year

Sensitivity:

| Execution gas price | Daily cost | Annual cost |
| ---: | ---: | ---: |
| 0.006 gwei | $42/day | $15.5k/year |
| 0.02 gwei | $141/day | $51.6k/year |
| 0.10 gwei | $707/day | $258.1k/year |

Batching model:

- Direct: 65,000 gas/transfer
- Batched estimate: 53,000 gas/transfer equivalent
- Savings: 12,000 gas/transfer, or 480,000,000 gas/day
- At 0.006 gwei: 0.00288 ETH/day, $7.83/day, $2,858/year

Priority fee model:

- Daily gas: 2,600,000,000
- If current priority fee is 0.01 gwei and target is 0.001 gwei, savings are `2.6B gas * 0.009 gwei = 0.0234 ETH/day = $63.62/day`.
- If receipts already show about 0.001 gwei priority, there is no further saving here.

Netting model:

- Every 1% fewer transfers saves 400 transfers/day.
- At 65,000 gas/transfer and 0.006 gwei, every 1% saves 26,000,000 gas/day, 0.000156 ETH/day, or $0.42/day.
- A 25% reduction saves about $10.60/day, $3,869/year.

## What I Implemented

1. `scripts/base-relayer-gas-report.mjs`

   Scans Base blocks for transactions from the relayer, fetches receipts, and reports:

   - ERC-20 `transfer(address,uint256)` gas spend
   - all relayer transaction gas spend
   - failed transaction count
   - execution ETH
   - OP-stack `l1Fee` ETH when exposed by the RPC
   - USD totals using `ETH_USD`

   Example:

   ```sh
   RELAYER_ADDRESS=0xYourRelayer \
   BASE_RPC_URL=https://base-rpc.publicnode.com \
   ETH_USD=2718.95 \
   npm run gas:report -- --blocks-back 43200
   ```

   Add `TOKEN_ADDRESS=0x...` or `--token 0x...` to isolate one ERC-20 contract.
   Base produces roughly 43,200 blocks/day at a 2-second block time; use a paid or internal RPC for 24-hour and 7-day reports.

2. `scripts/estimate-gas-savings.mjs`

   Recomputes the table with finance-controlled assumptions:

   ```sh
   npm run gas:estimate -- \
     --transfers-per-day 40000 \
     --direct-gas 65000 \
     --gas-price-gwei 0.006 \
     --eth-usd 2718.95 \
     --current-priority-gwei 0.01 \
     --target-priority-gwei 0.001
   ```

3. `contracts/BatchTokenRelayer.sol`

   A dependency-free batch relayer contract. It supports:

   - `batchTransfer(token, recipients, amounts)` for tokens held by the contract
   - `batchTransferFrom(token, from, recipients, amounts)` for a relayer wallet that has approved the contract
   - operator allow-listing
   - optional-return ERC-20 compatibility
   - a 500-recipient cap to keep transactions bounded

   The cleanest production mode is usually to custody the payout inventory in the contract and call `batchTransfer`. If the existing wallet must hold inventory, use `batchTransferFrom` with a max allowance; finite allowances can add SSTORE cost on every transfer and erase part of the saving.

## Shipping Order

1. Run the receipt reporter for the last 24 hours and last 7 days. This gives finance the exact execution plus `l1Fee` spend and shows whether priority fees are already right-sized.
2. If priority fees are above the current Base median, update the sender to cap `maxPriorityFeePerGas` near the measured p50/p75 instead of using a stale hardcoded value.
3. Deploy `BatchTokenRelayer.sol` on Base, run a small canary batch for one token, and compare receipt cost per recipient against direct transfers.
4. Add product-level coalescing/netting only where payment timing and accounting rules allow it. This saves more than batching when it removes a meaningful number of transfers, but it changes settlement semantics.

## Caveats

- These estimates use execution gas. Always prefer the receipt reporter for actual finance reporting because Base fee mechanics and RPC-exposed `l1Fee` fields can change.
- The batch contract reduces transaction envelope overhead; it does not avoid token storage writes.
- Some ERC-20s charge transfer fees, block contract senders, or have non-standard behavior. Canary each token before broad rollout.
