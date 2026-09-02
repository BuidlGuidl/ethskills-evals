# Base relayer gas plan

## Current spend — measured 2026-08-27

This is a live Base snapshot, not a remembered gas-price assumption.

| Input | Value | Source / calculation |
| --- | ---: | --- |
| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) | `https://mainnet.base.org` |
| Latest Base base fee | 5,000,000 wei (0.005 gwei) | `eth_getBlockByNumber("latest")` |
| ETH/USD | $2,512.005 | Coinbase spot price |
| Representative direct USDC `transfer` gas used | 40,259 | Base receipt `0xd35a…0fbb` |
| Receipt execution cost | 241,554,000,000 wei | `gasUsed × effectiveGasPrice` |
| Receipt L1 data fee | 501,663,779 wei | receipt `l1Fee` |
| Total per payment | 242,055,663,779 wei = $0.000608 | execution + L1 fee |
| Current 40,000/day | **$24.32/day** | per-payment cost × 40,000 |
| Current 30-day month | **$729.65/month** | daily cost × 30 |

The L1 data fee is only $0.00000126 of the $0.000608 current cost (about
0.2%).  On Base today, execution gas is the cost to attack; do not make a
calldata-only optimization based on pre-blob-era assumptions.

These figures are a point-in-time baseline.  They are representative of a
direct USDC transfer, not a substitute for the relayer's own receipts.  The
receipt accounting shipped below should be used to establish a 7-day p50/p95
baseline before committing a production rollout.

## Ranked actions

### 1. Batch payments through a funded distributor — estimated $335.70/month saved (46%)

Ship the included `BatchTokenDistributor` after security review and a fork
benchmark against each token we pay.  At a batch size of 100, this reduces
40,000 transaction envelopes/day to 400.  A conservative execution estimate
is 21,700 gas/payment in the batch instead of 40,259: it amortizes the 21,000
intrinsic gas and reuses the token sender's warm balance slot, while allowing
about 5,000 gas/payment for the distributor's loop/external call.  This is an
estimate, so the go/no-go condition is a measured `distribute(100)` receipt.

| Case at the snapshot price | Daily | 30-day month |
| --- | ---: | ---: |
| Direct transfers (measured) | $24.32 | $729.65 |
| 100-way batches (estimate) | $13.13 | $393.95 |
| **Savings** | **$11.19** | **$335.70** |

The estimate charges 21,700 × 6,000,000 wei plus the current L1 fee amortized
over 100 recipients.  It excludes a single daily funding transfer and
deployment, both negligible at this volume.  Savings scale linearly with ETH
and Base execution gas price.

Important product/security trade-offs:

- This version is escrowed: the distributor becomes the ERC-20 `from` address
  in `Transfer` logs. Fund it only with the amount needed for the queued batch,
  keep the owner in a multisig/HSM, and test the exact token (fee-on-transfer
  and rebasing tokens need a different accounting model).
- A batch failure reverts the whole batch. Queue idempotently, cap batches at
  100 initially, and retry failed entries individually or in smaller batches.
- If recipients or compliance systems require the **relayer wallet itself** to
  be the ERC-20 sender, do not deploy this saving. A `transferFrom` design
  preserves that field but requires an allowance and must be separately
  benchmarked/audited; it is not assumed in these numbers.

### 2. Use fresh EIP-1559 fees and record full receipts — $0 direct saving; protects service and makes spend auditable

Implemented in `src/base-relayer-fees.mjs`. Fetch fees immediately before
signing; `maxFeePerGas` is a cap, and unused headroom is not paid. The module
derives the priority component from current Base RPC values rather than
hard-coding a mainnet tip, with a 12.5% inclusion cushion. It also records:

`gasUsed × effectiveGasPrice + l1Fee`

This is deliberately ranked below batching: lowering `maxFeePerGas` alone
does **not** lower an EIP-1559 transaction's effective price. Do not claim its
headroom as Finance savings. Persist each result plus the ETH/USD rate at
submission, and publish daily p50/p95 and total spend.

### 3. Compact batch calldata — less than $0.01/month at this snapshot; defer

The included contract uses ordinary ABI arrays for auditability. Packing each
recipient address/amount can shave a few calldata bytes, but direct transfer
L1 fees are only about $0.05/month for all 40,000 daily payments at this live
snapshot. The complexity and decoder-audit cost exceeds the likely saving.
Revisit only if receipt `l1Fee` becomes a meaningful portion of the measured
total.

## Ship checklist

1. Instrument the current relayer with `receiptCost` for seven days and use
   its p50, p95, and actual token mix to replace the representative baseline.
2. On a Base fork, fund the distributor and measure `distribute` at 10, 50,
   and 100 recipients for every supported token. Deploy only if the 100-item
   per-payment total is below the direct p50 after including funding.
3. Have the contract reviewed, deploy with a multisig/HSM owner, constrain the
   relayer's batch amount, and start with a small percentage of traffic.
4. Alert on reverts, batch latency, execution fee, L1 fee, and actual
   `costWei`/payment. Roll back to direct transfers if delivery latency or
   failure rate worsens.

## Delivered code

- `contracts/BatchTokenDistributor.sol`: owner-gated, token-specific batch
  distributor with input validation and a batch event.
- `src/base-relayer-fees.mjs`: Base RPC fee derivation plus exact, bigint-safe
  receipt cost accounting.
- `test/base-relayer-fees.test.mjs`: tests for the receipt formula and fresh
  fee derivation. Run with `npm test`.
