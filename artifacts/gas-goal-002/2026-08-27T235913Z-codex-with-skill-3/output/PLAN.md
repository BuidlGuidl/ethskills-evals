# Base relayer gas plan

## Current run rate

This is a live, reproducible point-in-time estimate, not a stale gas-price
assumption. On 2026-08-28 00:02 UTC, a confirmed plain Base USDC transfer
(`0x0e4ffb9e73f39bb860ead1616795a8dc480ec8e856209034ceb97b462f863c4b`)
had these receipt fields:

| Component | Measured amount | Cost at ETH = $2,509.38 |
| --- | ---: | ---: |
| L2 execution | 45,047 gas × 0.006 gwei = 270,282,000,000 wei | $0.00067824 |
| L1 data fee | 462,707,932 wei | $0.00000116 |
| **One payment** | **270,744,707,932 wei** | **$0.00067940** |
| **40,000 payments/day** | — | **$27.18/day** |
| **30-day month** | — | **$815.28/month** |
| **365-day year** | — | **$9,919.26/year** |

Formula: `gasUsed × effectiveGasPrice + l1Fee`; USD is the result in ETH
multiplied by live ETH/USD. The L1 fee is only 0.17% of this sample, so Base
execution gas—not data availability—is the meaningful lever today. Values move
with the receipt and ETH/USD price.

Run `npm run costs:base -- tx-hashes.txt` against a daily export of relayer
transaction hashes. It calculates the actual total and explicitly includes the
OP-stack `l1Fee`; use that report for Finance's ledger rather than extrapolating
this one transaction forever.

## Ranked actions

### 1. Ship batched payouts in groups of 100 — estimated $397/month saved

This is the largest known saving. Instead of 100 externally submitted ERC-20
transactions, submit one transaction that calls the token 100 times from a
funded payout contract.

The included local benchmark, using new recipient balances (the expensive common
case), measured 2,519,396 gas for `BatchPayer.pay` with 100 recipients. The
same mock token's standalone `transfer` is 49,230 gas, or 4,923,000 gas for
100 payments. That is a 48.82% execution-gas reduction:

```
daily execution spend     = 40,000 × 45,047 × 0.006 gwei × $2,509.38 = $27.13
estimated daily saving    = $27.13 × 48.82% = $13.24
estimated 30-day saving   = $397.34
estimated annual saving   = $4,834
```

The estimate deliberately does **not** take a saving on L1 data fees. Before
rollout, deploy on Base testnet, run the actual token and representative
recipient mix through `eth_estimateGas`, and replace the 48.82% benchmark with
the measured total including `l1Fee`. Use an initial 100-recipient batch; the
contract permits at most 200 only as a safety ceiling, not a default.

Operational trade-off: this requires prefunding the contract, rather than
holding tokens in the relayer EOA. That changes custody and must get a security
review, monitoring, and a staged rollout. It also assumes a conventional ERC-20
that returns `true` or no return value; fee-on-transfer/rebasing tokens require
token-specific payment reconciliation. The deploy itself is negligible at the
observed price: 403,447 gas × 0.006 gwei × $2,509.38 = about $0.006.

Implemented: `src/BatchPayer.sol`, with owner-only payments, token-transfer
checks, a reentrancy guard, recovery, and a 200-recipient ceiling. Tests cover
normal payments, access control, and the 100-recipient case.

### 2. Derive EIP-1559 fees from Base immediately before submission — $0 now; $135/month per excess 0.001 gwei eliminated

The live Base RPC at the measurement time reported a 0.005 gwei base fee and
0.006 gwei suggested gas price. If the relayer already lands at that effective
price, this change saves no money today; it prevents an accidental overbid.

At this workload, every **0.001 gwei** of avoidable *effective* price costs:

```
40,000 × 45,047 × 0.001 gwei × $2,509.38 = $4.52/day = $135.64/30-day month
```

For example, reducing an actually-paid 0.020 gwei to 0.006 gwei would save
about $1,899/month. Verify that from receipts first—`maxFeePerGas` is a cap,
not necessarily what was paid.

Implemented: `npm run fees:base` samples Base `eth_feeHistory`, current base
fee, and `eth_gasPrice` at submission time and emits `maxFeePerGas` plus
`maxPriorityFeePerGas`. Wire those returned wei values into the relayer's
transaction request; do not hard-code a mainnet tip or copy a past Base value.
Set `FEE_URGENCY` to `economical`, `standard` (default), or `urgent`.

### 3. Do not add per-payment approvals or a `transferFrom` batcher — avoids up to $815/month of self-inflicted spend

The relayer currently sends its own ERC-20 transfers. Keep that model or fund
the batch contract once. A design that calls `approve` and then
`transferFrom` for each payment adds another transaction-shaped operation per
payment and largely defeats batching. If an approval were being sent once for
every current payment, the order of magnitude is another current transfer run
rate: about $27/day / $815 per 30-day month. This is a design guardrail, not a
claimed existing saving; no approvals were provided to measure.

### 4. Do not chase calldata micro-optimizations before measuring them — no material demonstrated saving

A direct ERC-20 `transfer(address,uint256)` already has fixed, compact ABI
calldata. The live receipt's L1 fee was $0.00000116, so even eliminating all of
that impossible-to-eliminate fee would save only about $1.39/month at this
volume. Recipient and amount data are required in a batch too. Measure actual
batch receipts before changing encodings or token interfaces.

## Shipping checklist

1. Export one normal day of successful relayer transaction hashes and retain the
   JSON output of `npm run costs:base -- tx-hashes.txt` as Finance's baseline.
2. Integrate `npm run fees:base`'s wei values in the submission path and alert
   on effective gas price above the chosen envelope.
3. Deploy `BatchPayer` first on testnet with the exact production token; test
   normal, duplicate, zero-amount, and failed-token behaviors, then measure
   Base receipts for 1, 10, 50, and 100 recipients.
4. Have the contract reviewed, place ownership in the production custody
   arrangement, fund a small capped float, and canary a small percentage of
   payments. Reconcile every `BatchPaid` event with recipient token balance
   changes before increasing the batch share.
5. Recompute this ranking weekly from receipts. Gas price and ETH/USD are
   variable; the code intentionally reads both at run time.

## Verification performed

`forge test --gas-report` passes: 4 tests, including the 100-recipient batch.
The live receipt reporter and fee-policy command were both run successfully
against Base mainnet.
