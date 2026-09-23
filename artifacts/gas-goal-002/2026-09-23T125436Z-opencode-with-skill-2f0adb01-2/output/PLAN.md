# Relayer Gas Plan — Base Payments (40k ERC-20 transfers/day)

Live numbers used throughout (fetched 2026-09-23, see `npm run cost-report` to refresh):

| Input | Value |
|---|---|
| Base gas price | **0.006 gwei** (base fee 0.005) |
| ETH price | **~$2,700** |
| Standalone ERC-20 transfer tx (measured, first-payout recipient) | **~52,000 gas** |
| Batched transfer, marginal (measured in-loop) | **~24,700 gas** |

Gas figures are measured with instrumented Foundry tests (see *Methodology*), not
hand-waved. Re-run any time: `forge test -vv` (logs gas) and `npm run cost-report` (live USD).

---

## What we actually spend today

**~$34/day ≈ $1,000–1,200/month ≈ $12.4k/year** in L2 execution fees, plus a
small L1 data component (~1–5% at today's blob prices; it spikes 10–100x during
L1 congestion).

Two things worth telling Finance up front:

1. **The big win already happened.** The same 40k transfers/day on mainnet at
   today's 0.31 gwei base fee would cost **~$1,750/day (~$53k/month)** — we're
   already ~50x cheaper by being on Base. Nothing below changes chains.
2. **Our numbers are only valid if we're not overpaying fees.** Verify before
   trusting the $34/day: pull `effectiveGasPrice` from the relayer's last ~100
   receipts and compare to the block `baseFeePerGas` at the same height.

```bash
cast receipt <TX_HASH> --rpc-url https://base-rpc.publicnode.com   # check gasPrice & effectiveGasPrice
cast block <BLOCK> --rpc-url https://base-rpc.publicnode.com      # compare to baseFeePerGas
```

---

## Changes, ranked by what they actually save

### 1. Fix fee hygiene — savings: 0% to 99% of the entire bill (measure first)

This ranks first because if it applies, it dwarfs everything else. Relayers
commonly ship with a hardcoded "safe" `gasPrice` (0.1–1 gwei). On Base that's
**20–200x** the actual base fee of ~0.005 gwei — turning $34/day into
$700–3,400/day. If the relayer already uses dynamic EIP-1559 fees with a
minimal tip, this item costs nothing and saves nothing.

- **Check:** effectiveGasPrice of recent relayer txs vs block base fee (above).
- **Shipped:** `src/fees.ts` — `quoteFees()` computes `maxFeePerGas = 2× base fee
  + 0.001 gwei tip`, i.e. we always pay ~base + minimal tip, with 2x spike
  headroom. Includes a spike gate (skip flushing when base fee > 5x its
  32-block median) so we don't buy gas during transient spikes.

### 2. Batch the transfers — savings: 52% of L2 execution gas, guaranteed: ~$18/day, ~$530/month, ~$6.4k/year at current fees

All sends come from one wallet, so N payouts can share one transaction's
intrinsic cost and L1 data envelope via the shipped `BatchRelayer` contract.

Measured breakdown per transfer (standard token, first-payout recipient):

| | Standalone tx | Batched (N=100) |
|---|---|---|
| Intrinsic (21k) + calldata + dispatch | ~24,400 | ~280 (amortized fixed ~27.6k / 100) |
| Cold token contract access | 2,600 | (once per batch) |
| Token transfer execution | ~27,500 | ~23,900 (relayer slot warm) |
| Batch calldata (addr+amount per item) | — | ~600 |
| **Total per transfer** | **~52,000** | **~24,976** |

- **Savings don't depend much on batch size** (fixed cost amortizes fast): even
  20-transfer batches save ~50%. Pick batch size by latency budget, not gas.
- **Latency math:** 40k/day = 0.46 transfers/sec. A 5-min flush window → ~140
  transfers/batch. A 30s window → ~14/batch (still ~44% saving). Product picks
  the point on this curve; `flushIntervalMs` is the knob.
- **Also cuts:** nonce management from 40k tx/day to ~300–2k tx/day, and L1
  data exposure from ~210B to ~69B per transfer (−67% of the spiky L1
  component — insurance for blob-fee congestion).
- **Shipped:** `contracts/` (audited-style minimal contract + 12 tests + deploy
  script) and `src/batcher.ts` (`TransferBatcher` — queue, size/time flush,
  float top-ups, spike gate, multi-token batches, netting option).

**Cost of doing this:** payouts wait for the flush window (see above); a token
float must sit in the contract (hold ~2 days of payouts; there's an owner-only
`withdraw`); one transfer that reverts reverts the whole batch (contract reverts
with the failing index — validate recipients/amounts before enqueuing;
fee-on-transfer/deflationary tokens are out of scope).

### 3. Net same-recipient transfers per flush window — savings: 0–20%+ (needs product sign-off)

If payments data shows repeat recipients within a window, `netSameRecipient:
true` (shipped, **default off**) nets them into one transfer. Saving = duplicate
rate × everything above. This changes payment semantics (user sees one
consolidated transfer) — only enable if the ledger treats them as one payment.

### 4. Settle on-chain only at withdrawal — savings: potentially 50–90% (product change, not code)

If users hold balances in our ledger (exchange-style), we don't need to move
on-chain funds for every internal payment — only on withdrawal, and withdrawals
themselves batch. This is the only lever that can cut the bill below item 2's
floor, but it's a product/architecture decision, not a relayer change. If the
product is "every payment must be an on-chain transfer from us," skip this.

### 5. Don't migrate chains — savings: 0 (it IS the savings)

Base is already the cheapest credible option for this profile (~$0.001/transfer
all-in). Moving saves nothing and costs an outage. No action; documented so
nobody re-litigates it in a finance meeting.

---

## Projected bill

| Scenario | /day | /month | /year |
|---|---|---|---|
| Today (assuming fees are sane) | $34 | $1,017 | $12,377 |
| + Batching (item 2) | $16 | $486 | $5,945 |
| + Netting at 10% duplicate rate (item 3) | $15 | $437 | $5,350 |
| If item 1 finds a 10x fee overpay today | ~$340 | ~$10,200 | ~$124,000 → drops to $16/day after fix |

All at current gas prices; savings scale linearly with Base gas prices.

---

## What's implemented and how to ship

| Piece | Path | What it does |
|---|---|---|
| Batch contract | `contracts/src/BatchRelayer.sol` | `batchTransfer`, `batchTransferMulti` (owner-gated, non-standard-token-safe, reverts with failing index), `withdraw`, `transferOwnership` |
| Tests | `contracts/test/BatchRelayer.t.sol` | 12 tests incl. gas measurements (12/12 pass) |
| Deploy | `contracts/script/Deploy.s.sol` | `forge script contracts/script/Deploy.s.sol --rpc-url $BASE_RPC --broadcast --private-key $RELAYER_KEY` (deploys with the relayer EOA as owner) |
| Fee module | `src/fees.ts` | dynamic 1559 quote: base+0.001 gwei tip, 2x headroom, 5x-median spike gate |
| Batcher | `src/batcher.ts` | queue + flush-by-size/time, float top-ups, re-queue-safe (items leave the queue only after the batch receipt succeeds) |
| Finance report | `scripts/cost-report.ts` | live `npm run cost-report` — the numbers above, refreshed |

Integration sketch for the payments service:

```ts
const batcher = new TransferBatcher(publicClient, walletClient, {
  relayerAddress: "0xdeployedAddress",
  maxBatchSize: 200,
  flushIntervalMs: 60_000,
});

batcher.enqueue({ token: usdc, recipient: user, amount: 100_000n }); // per payment
batcher.start(); // flushes on timer or call flush() yourself at payout cutoffs
```

Operational checklist:
- Fund the contract with ~2 days of token float per token; alert when below 1 day.
- Keep `skipOnSpike: true`; add alerting on `skipped: "gas-spike"` so payouts
  don't silently stall (queue keeps growing during a spike — cap it by SLA).
- Monitor: per-tx `effectiveGasPrice vs baseFeePerGas`, and daily
  `gasUsed × price` reconciled against the finance report.
- A v2 option to avoid the token float entirely: EIP-7702-delegate the relayer
  EOA to a batch executor — same gas savings, no custody change. Contract-first
  is the lower-risk default today.

## Methodology

- Gas numbers measured via Foundry, instrumented at the EVM level (inside the
  token function and inside the batch loop; harness overhead excluded — naive
  `gasleft()` around external calls in the test harness inflates by ~2.5–30k).
- Raw measurements: standalone token exec 27,350 gas (fresh recipient; 10,250
  existing recipient); batch loop iteration 23,854 gas (warm relayer slot);
  batch marginal via harness diff 24,763 gas. Composed production numbers add
  intrinsic 21,000, calldata (~800B/tx), cold account access 2,600.
- Live prices: `eth_gasPrice` / `baseFeePerGas` on Base RPC, CoinGecko ETH/USD.
- Assumptions: standard ERC-20s (revert-on-failure, return bool); first-payout
  recipients (worst case — repeat recipients are ~17k cheaper in both modes);
  excludes L1 data fee (currently ~1–5% of total, spike-prone).