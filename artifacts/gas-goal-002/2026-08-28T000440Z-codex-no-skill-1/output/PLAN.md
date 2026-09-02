# Base relayer gas plan

## What Finance can call “actual”

The prompt gives a volume, not a relayer address, token, transaction hashes, fee cap, or time period. It is therefore not possible to truthfully state the current ETH or USD spend from it alone. On Base, the charged amount has three parts:

`receipt.gasUsed × receipt.effectiveGasPrice + receipt.l1Fee + receipt.operatorFee`

Run the included reporter over a representative 7–30 days of completed relayer hashes before approving a budget:

```bash
BASE_RPC_URL=https://your-base-rpc.example node scripts/gas-report.mjs tx-hashes.txt
```

It prints each component and the average payment cost. Monthly spend is its `TOTAL / transaction count × 1,200,000` (40,000 payments/day × 30). Do not use `gasUsed × gasPrice` alone: Base documents L2 execution and L1 security/data as separate charges, and says the L1 component is typically higher. [Base network-fee documentation](https://docs.base.org/base-chain/network-information/network-fees)

## Changes, ranked by expected recurring saving

The first row is deliberately a conservative execution-only model. L1 savings must be measured from a pilot because Base prices compressed transaction data and the token/payment payload determines compression. The Base GasPriceOracle can estimate the L1 component before signing. [Base fee and oracle documentation](https://docs.base.org/base-chain/network-information/network-fees)

| Rank | Change | Quantified saving at 40k payments/day | Implementation / decision |
|---|---|---:|---|
| 1 | Batch one token’s payments through the supplied distributor | Example measured planning model: direct `transfer` = 51,000 gas/payment; 200-recipient `transferFrom` batch = 35,000 gas/payment. **640,000,000 L2 gas/day**, 19.2bn/month, or **31.37% of L2 execution**. At the Base 0.005 gwei minimum this is **0.0032 ETH/day** / 0.096 ETH/month before L1-data savings. It also replaces 40,000 signed transaction envelopes with 200: 39,800 fewer/day (99.5%), so it should reduce L1 data fees too. | Ship `contracts/BatchERC20Distributor.sol`; pilot with exact token and payload, starting at 50 recipients. The included calculator reproduces the model: `node scripts/estimate-batch-savings.mjs 40000 51000 35000 200`. |
| 2 | Submit non-urgent batches only in empirically cheap L1-data windows | This saves **(observed L1-fee share) × (observed lower-window discount)** of total spend. Example: if receipt reports show L1 is 70% of spend and scheduled windows are 40% cheaper, total saving is **28%**. It is additive to batching. | Record the reporter result by hour/day for two weeks; queue payments within the product’s latency SLA and send only in the cheapest tested windows. Base explicitly notes L1 fees vary and may be lower at quieter times. |
| 3 | Remove priority-fee overpayment | Saves exactly the currently paid priority-fee portion; there is no credible generic number without the existing fee policy. With a 0.01 gwei needless tip on 51k gas direct payments, it is **0.0204 ETH/day** (0.612 ETH/month). | Set a small, bounded `maxPriorityFeePerGas` only after monitoring inclusion latency; never set a fixed high `gasPrice`. This does not reduce Base/L1 base fees. |
| 4 | Use a token-native batch method when the token offers one | Potentially saves the distributor’s `transferFrom` allowance work per recipient, but only after an exact-token benchmark; it can beat rank 1 in execution gas but requires token support. | Inspect each token ABI. Prefer audited `batchTransfer` semantics if available; otherwise use the supplied generic distributor. |

No EIP-4337/paymaster migration is ranked as a saving: it changes who pays and may add overhead; it does not eliminate the ERC-20 state changes. Likewise, recipient deduplication is only a saving if business rules permit netting several payments to the same address before settlement.

## Shipping sequence and controls

1. Export 7–30 days of relayer hashes, run the report, and store the output with the monthly Finance close.
2. On a Base fork, compare `eth_estimateGas` for the current direct transaction and a real 50/100/200-recipient payload for *each* supported token. Use those measured values in the calculator; do not deploy from the illustrative 51k/35k figures.
3. Have the small contract independently reviewed, deploy it, verify its source, and approve only the amount needed for the next batch (or use a tightly controlled allowance rotation). A compromised approved distributor can pull the approved tokens.
4. Shadow-run one batch, reconcile every `Transfer` event and recipient balance, then ramp. A batch is atomic: one failing token transfer reverts all its payments, so the relayer must split and retry failed batches rather than silently dropping payments.
5. Dashboard the receipt components, batch size, failure rate, and payment latency. Keep direct transfers as the rollback path until the batch path has met the agreed SLO.

## Code delivered

- `scripts/gas-report.mjs`: dependency-free, receipt-level actual-cost report, including the L1 and operator fields exposed by an OP-stack/Base RPC.
- `scripts/estimate-batch-savings.mjs`: transparent execution-gas model; it avoids pretending the variable L1 fee is fixed.
- `contracts/BatchERC20Distributor.sol`: atomic, bounded (200 recipient) ERC-20 batch transfer primitive that accepts standard bool-returning and no-return ERC-20s.

The contract deliberately has no owner, custody balance, or upgrade mechanism. It only calls `transferFrom(msg.sender, recipient, amount)`; tokens remain in the relayer wallet until each transfer executes.
