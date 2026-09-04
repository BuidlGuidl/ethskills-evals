# Base relayer gas plan

## Measured baseline (27 August 2026)

The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.

| Input | Live value | Evidence |
| --- | ---: | --- |
| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
| L2 execution fee | 270,282,000,000 wei | `45,047 × 6,000,000` |
| Total per transfer | 270,770,360,980 wei = $0.00068004 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
| 40,000 transfers/day | **$27.20/day** | 40,000 × per-transfer cost |
| 365-day run rate | **$9,928.58/year** | $27.20 × 365 |

The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. Do not assume a mainnet or another L2 migration saves money. The L1 data component is about 0.18% of this measured transfer, so batching can materially reduce the dominant per-transaction L2 intrinsic gas.

Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.

## Ranked actions

| Rank | Change | Estimated saving | Why / gate |
| ---: | --- | ---: | --- |
| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$9,928.58/year (100%)**; at 80% eligibility, **$7,942.86/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4,388/year (44%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.0003795/payment vs $0.0006800 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | A token-specific change can help, but needs a receipt-level benchmark; changing chains is not justified by this Base-only fee sample. Engineering/review cost may exceed the remaining savings. |

The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It should be adopted only if the projected annual saving exceeds its custody and operational cost.

## Implementation and rollout

1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.

## Shipped artifacts

- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.

Validate locally with:

```bash
XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
  SVM_HOME=/home/damu/.svm forge test --offline
node scripts/receipt-costs.mjs tx-hashes.txt
```
