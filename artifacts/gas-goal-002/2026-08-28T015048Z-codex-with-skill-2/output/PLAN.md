# Base relayer gas plan

## What the baseline costs

This is a measured *Base network* snapshot, captured 2026-08-28 01:52 UTC:

| Input | Measured value |
| --- | ---: |
| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) |
| Base pending base fee | 5,000,000 wei (0.005 gwei) |
| Base suggested priority fee | 1,000,000 wei (0.001 gwei) |
| ETH/USD spot | $2,516.805 |
| Representative direct USDC `transfer` receipt | 45,071 gas + 435,682,045 wei L1 fee |

The receipt was a public Base USDC transfer (`0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac`), not the app's relayer; no relayer address or receipts were supplied. It is therefore the best currently measurable proxy, not a claim about the app's exact costs. The code below produces the exact answer once its receipts are exported.

Formula: `fee = gasUsed × effectiveGasPrice + l1Fee`. On this receipt that is `45,071 × 6,000,000 + 435,682,045 = 270,861,682,045 wei`, or **$0.00068171 per transfer**. At 40,000/day: **$27.27/day, $818/month, and $9,953/year**. Execution is $27.224/day; the L1 data fee is only $0.0439/day (0.16%). Do not estimate a Base payment as `gasLimit × maxFeePerGas`: those are not amounts paid.

## Ranked changes

Ranked by savings at the measured price. The first item has a much larger upside if the present relayer hard-codes an above-market price, but its actual saving must be read from the relayer receipts.

| Rank | Change | Savings at 40,000/day | Basis and decision |
| --- | --- | ---: | --- |
| 1 | Quote EIP-1559 fields immediately before each send; remove a fixed `gasPrice`, fixed priority tip, or excessive max fee. | **$0 to $681/day** | The shipped policy targets the live 0.006 gwei. A public direct-transfer sample in the same block paid 0.156 gwei; replacing that rate saves `(0.156 - 0.006) × 45,071 × 40,000 × ETH/USD = $681/day` ($249k/year). If our receipts already have an effective price of 0.006 gwei, this change saves $0 today, while protecting against future overpayment. Alert if the receipt's effective price exceeds the just-quoted value. |
| 2 | Move homogeneous, non-urgent payouts into a relayer-owned token-float batch contract. Start with 100 recipients/batch. | **at least $9.71/day ($3,543/year)** | Conservative model: 29,000 execution gas/payment in a batch versus 45,071 direct, at the live price. It removes nearly all but one 21,000-gas transaction envelope per batch, while allowing ~8,000 gas/payment for loop and call overhead. This is a 35.7% execution reduction. It excludes L1-data savings, so it is a floor. Benchmark each supported token on Base before rollout. |
| 3 | Reduce token-specific transfer gas after receipt profiling (for example, stop writing avoidable bookkeeping in a token you control). | **$0.604/day per 1,000 gas removed** | `1,000 × 40,000 × 0.006 gwei × $2,516.805`; $220/year per 1,000 gas. Third-party ERC-20 bytecode cannot be optimized by the relayer. |
| 4 | Eliminate reverted/replaced submissions using balance checks, nonce queueing, and receipts alerts. | **$0.000682 per avoided 45,071-gas failure** | Multiply that amount by the measured daily failed/replaced transaction count. Failed transaction and replacement counts have not been supplied, so do not invent a saving. |

Timing transactions, lowering the gas limit below `eth_estimateGas`, and setting a zero/hand-picked priority fee are **not** savings plans: Base has a fee floor and underpriced transactions risk delayed payments or replacement fees. The dynamic policy intentionally takes Base's current priority-fee suggestion instead.

## Shippable implementation

- `src/base-fees.mjs` supplies BigInt-safe EIP-1559 fields from the pending Base block and a rounded 20% `eth_estimateGas` buffer. Use `getBaseFeeFields()` immediately before signing and `bufferedGasLimit(await estimateGas(...))`; do not set `gasPrice` at the same time.
- `src/analyze-receipts.mjs` computes actual execution and L1 spending from exported receipt JSON. Run `npm run analyze-receipts -- receipts.json 2516.805`. Re-run with the current ETH/USD rate for finance reporting. Required receipt fields are `gasUsed`, `effectiveGasPrice`, and (on Base) `l1Fee`.
- `contracts/RelayerBatcher.sol` is the batch-payment implementation. It holds a prefunded per-token float; only the configured relayer can send, and an owner separate from the relayer can rotate that key or recover a float. Batches are atomic, capped at 500, reject non-contract tokens, and handle ERC-20s that either return `true` or no value. Deploy and security-review it before funding it; pilot one token and 100 recipients, then compare actual receipts with the direct-transfer control group.

## Measurement and rollout

1. Export 7 days of successful and failed receipts for the relayer, along with every replacement transaction. Run the analyzer by token and day; this replaces the proxy baseline.
2. Deploy the batcher with a multisig owner and the relayer as `initialRelayer`; fund it only with the pilot token. Reconcile each `BatchPaid` transaction against the internal payment ledger. Atomic batches mean any invalid recipient or token-level failure reverts all recipients, so prevalidate every payment.
3. Send a 100-payment pilot beside 100 direct payments. Keep batching only if the receipt-derived average is below 29,000 execution gas/payment and operational reconciliation succeeds. Scale the batch size gradually without approaching Base's block gas limit.
4. Report daily `sum(gasUsed × effectiveGasPrice + l1Fee)`, effective gas price, L1-fee share, gas/payment, failure rate, and batch size. Finance should use the actual receipt sum, not a static gwei assumption.
