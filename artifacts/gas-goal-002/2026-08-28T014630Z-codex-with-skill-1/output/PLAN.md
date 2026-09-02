# Base relayer gas plan

## Current cost model (measured 2026-08-27)

This is a live point-in-time model, not a price assumption:

- Base latest base fee: `5,000,000 wei` = **0.005 gwei** (`cast base-fee --rpc-url https://mainnet.base.org`).
- Base suggested gas price: `6,000,000 wei` = **0.006 gwei** (`cast gas-price ...`). The 0.001 gwei difference is the discretionary tip.
- ETH spot: **$2,520.43** (Coinbase spot endpoint).
- Three recent direct `USDC.transfer` receipts on Base used 45,047, 45,047, and 57,371 gas. Their `l1Fee` was 492,720,836 wei; execution fees were 270,282,000,000 and 344,226,000,000 wei. Thus L1 data was only **0.18% and 0.14%** of the total in these samples.

At 40,000 transfers/day (1,200,000 per 30-day month), a 45,047-gas transfer at 0.006 gwei costs $0.00068123 in execution gas ($0.00068247 including the sampled L1 fee), or **about $817.47/month** before L1 data. A 57,371-gas transfer is **about $1,041.12/month**. The formula is:

`monthly USD = transfers × gas used × effective gas price (wei) / 1e18 × ETH-USD`

The samples are a useful baseline only. Finance's source of truth must be our relayer's receipts, separated by token and success/failure, because recipient balance state and token code materially change gas used.

## Ranked changes by recurring savings

1. **Batch payments where the product can settle a group atomically — estimated $274–$318/month after the tip change; validate before rollout.**

   A separate transaction pays 21,000 intrinsic gas each time. A large batch pays that once, so the gross upper bound is 21,000 gas saved for every payment after the first. At the current 0.005 gwei base fee that is $0.00026465/payment, or **$317.57/month** at this volume. The supplied `BatchERC20Relayer` uses `transferFrom`, which typically adds allowance handling versus a direct `transfer`; using a conservative 2,900-gas allowance update reduces the estimate to **about $273.70/month**. Batch calldata, loop overhead, deployment, approval, and failed-batch operational cost also reduce the result.

   Ship only after a fork simulation for each supported token and a 50/100-recipient production canary proves the all-in cost per payment is lower. Keep batches bounded by simulation, alert on reverts, and treat the whole batch as atomic. The contract is included, but deployment and a treasury allowance are separate approvals: it must be reviewed and audited in the application's normal release process.

2. **Remove the 0.001 gwei priority fee — proven from the current price quote: $136.25–$173.52/month (16.67% of execution cost).**

   On the 45,047–57,371 gas range, the tip alone costs $0.00011354–$0.00014460 per transfer. Setting `maxPriorityFeePerGas` to zero changes the monthly execution model from $817.47–$1,041.12 to **$681.23–$867.60**. The new fee policy does this by default and gets a fresh Base base fee before each submission. Run an inclusion-SLO canary; if zero-tip transactions miss the SLO, increase only the configurable priority fee and measure the tradeoff.

3. **Net duplicate/same-recipient payments in the application window — savings equal to every eliminated transfer.**

   This is only valid if product, accounting, and user-visible settlement semantics allow it. Each eliminated typical direct transfer saves about **$0.000682–$0.000869** at the sampled all-in price. Eliminating 1% of transfers (400/day) saves **$8.19–$10.43/month**; 10% saves **$81.90–$104.30/month**. Do not replace separate legally or operationally meaningful payments with netting.

4. **Instrument and remove failed/replaced/duplicate sends — savings are exactly the current cost of the avoided receipts.**

   This cannot be honestly priced without the relayer's history. The code now records execution and `l1Fee` separately; aggregate it by token, status, retry reason, and gas-price policy for a seven-day baseline. A failed 45,047-gas transfer at the sampled price wastes approximately **$0.000682**; 1,000 avoidable failures/day would be about **$20.47/month**. Use idempotency keys and nonce-aware retrying in the app layer.

## Changes deliberately not counted as savings

- Lowering a transaction's `gasLimit` does **not** lower a successful transaction's fee; the fee uses `gasUsed`. It only reduces the maximum temporary balance requirement and can cause out-of-gas failures.
- A larger EIP-1559 `maxFeePerGas` cap does **not** by itself increase the charged price; the receipt is charged the effective price. The policy retains a 2x-base-fee cap for inclusion headroom.
- Calldata/L1 compression is not the first priority for these direct-transfer samples because the measured L1 component is below 0.2%. Re-rank it if our own receipt telemetry shows otherwise.

## Release and measurement sequence

1. Deploy the fee-policy code with a zero-tip canary, monitor confirmation latency and receipt costs for 24 hours, then set it for all relayer sends if the SLO holds.
2. Write receipt records to the finance ledger and publish daily p50/p95 by token, `gasUsed × effectiveGasPrice`, `l1Fee`, failures, and total USD using the day's ETH-USD rate.
3. Fork-test the batch contract for every supported token, including non-standard ERC-20 return values, then compare total batch receipt cost / successful payments to the direct baseline. Deploy only when it beats the direct path after operational overhead.
