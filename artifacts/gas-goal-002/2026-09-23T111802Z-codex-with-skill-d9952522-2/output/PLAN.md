# Base gas plan

Measured on 2026-09-23T11:23:01Z against Base block 51686617.

Baseline inputs:

- Workload: 40,000 ERC-20 transfers/day from our relayer.
- Current Base `eth_gasPrice`: 6,000,000 wei = 0.006 gwei.
- Current Base base fee: 5,000,000 wei = 0.005 gwei.
- ETH/USD from Coinbase spot: $2,722.11.
- Direct Base USDC transfer receipt used for execution gas and OP-stack L1 fee: `0xac0d7d1d61fa171d0fcde010c8759b74ce40f5e4d565a4c048b30e8cab5377b0`.
- Receipt gas used: 40,259.
- Receipt `l1Fee`: 2,873,935,958 wei.

Cost formula:

```text
execution_fee_eth = gas_used * gas_price_wei / 1e18
l1_fee_eth = l1_fee_wei / 1e18
total_usd = (execution_fee_eth + l1_fee_eth) * eth_usd
```

Baseline cost:

| Item | Value |
| --- | ---: |
| Execution fee/transfer | 241,554,000,000 wei |
| L1 data fee/transfer | 2,873,935,958 wei |
| Total/transfer | $0.00066536 |
| Total/day at 40,000 | $26.61 |
| Total/year | $9,714.25 |

Execution gas is the cost to optimize first: the measured L1 fee is about 1.18% of the transfer cost at this snapshot.

## 1. Batch same-token payouts through `PaymentBatcher.distribute`

Ship status: implemented in `contracts/PaymentBatcher.sol`; payout preparation implemented in `src/payouts.js`.

Use this when we can hold payout inventory in the batcher contract, or sweep inventory to it before the payout run. This preserves one ERC-20 `transfer` per recipient, but pays transaction overhead and loop setup once per batch.

Measured with Foundry on a 250-recipient batch:

| Item | Value |
| --- | ---: |
| `PaymentBatcher.distribute` call gas | 6,261,008 |
| Plus one tx intrinsic gas | 21,000 |
| Gas/recipient | 25,128 |
| Saved execution gas/recipient vs direct transfer | 15,131 |
| Execution gas saved | 37.6% |
| USD saved/recipient | $0.00024713 |
| USD saved/day at 40,000 | $9.89 |
| USD saved/year | $3,608.08 |

This estimate does not claim extra L1-data savings because that should be measured from a live batch receipt after deployment. Since L1 data is only about 1.18% of current direct-transfer cost, the ranking is not sensitive to that omission.

Operational notes:

- Chunk batches by token; the script defaults to 250 recipients per batch.
- Use `distribute` for the cheapest path when the contract already has funds.
- Keep the relayer as the only owner, ideally behind the same signing controls used today.
- Run a canary batch and update the model with the real batch receipt via `node src/baseGas.js --receipt <batch_tx> --gas-used <batch_gas_per_recipient>`.

## 2. Aggregate duplicate payouts and drop no-ops before signing

Ship status: implemented in `src/payouts.js`.

This is the highest saving per eliminated transfer: a payout removed before chain submission saves the entire direct-transfer cost, not only transaction overhead.

| Eliminated transfers/day | Saved/day | Saved/year |
| ---: | ---: | ---: |
| 1,000 | $0.67 | $242.85 |
| 2,000 | $1.33 | $485.71 |
| 4,000 | $2.66 | $971.43 |
| 10,000 | $6.65 | $2,428.56 |

Formula: `eliminated_count * $0.00066536`.

This ranks below batching only until the queue has more than about 14,860 duplicate or zero-amount transfers/day. Above that, aggregation saves more than batching. We need one day of actual payout-queue data to replace this sensitivity table with a hard number.

Example:

```bash
node src/payouts.js --batch-size 250 < payouts.json > batches.json
```

Input format:

```json
[
  {
    "token": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "recipient": "0x1111111111111111111111111111111111111111",
    "amount": "1000000",
    "reference": "invoice-123"
  }
]
```

## 3. Use `pullAndDistribute` only if custody in the batcher is not acceptable

Ship status: implemented in `contracts/PaymentBatcher.sol`.

This lets the current treasury/relayer wallet approve the batcher and have the batcher call `transferFrom`. It avoids moving inventory into the contract first, but costs more gas per recipient than the custody path because allowance accounting is involved.

Measured with Foundry on a 250-recipient batch:

| Item | Value |
| --- | ---: |
| `pullAndDistribute` call gas | 6,461,394 |
| Plus one tx intrinsic gas | 21,000 |
| Gas/recipient | 25,930 |
| Saved execution gas/recipient vs direct transfer | 14,329 |
| Execution gas saved | 35.6% |
| USD saved/day at 40,000 | $9.36 |
| USD saved/year | $3,416.84 |

Use this as the fallback when product, accounting, or controls require funds to remain in the existing relayer wallet until the transaction executes.

## 4. Add live gas accounting to finance reports

Ship status: implemented in `src/baseGas.js`.

This does not lower gas by itself, but it prevents stale reporting and lets finance tie daily spend to actual Base fee conditions.

```bash
node src/baseGas.js --receipt 0xac0d7d1d61fa171d0fcde010c8759b74ce40f5e4d565a4c048b30e8cab5377b0
```

The script reads current Base `eth_gasPrice`, current Base block base fee, ETH/USD, and optionally a receipt's `gasUsed`/`l1Fee`. Use it in the relayer dashboard or daily finance job.

## What we should ship first

1. Deploy `PaymentBatcher` with the relayer control address as `initialOwner`.
2. Run `src/payouts.js` on the payout queue before signing.
3. For each same-token batch, submit `distribute(token, recipients, amounts)` if the batcher has funds; otherwise submit `pullAndDistribute(token, relayer, recipients, amounts)` after approval.
4. Record the first live batch receipt and update this plan's batch L1 fee with `src/baseGas.js`.
5. Add a daily finance report using `src/baseGas.js` so gas spend is tracked from live Base and ETH/USD data, not constants.
