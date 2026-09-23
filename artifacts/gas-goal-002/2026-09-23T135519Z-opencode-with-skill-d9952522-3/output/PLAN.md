# Gas plan — Base relayer, ~40,000 ERC-20 payouts/day

All numbers below were **measured on 2026-09-23** (UTC), not estimated from
memory. Live prices at measurement: ETH **$2,713.60** (Coinbase spot,
cross-checked vs Chainlink `0x5f4e…8419`), Base base fee **0.005 gwei**
(exactly, at the EIP-1559 floor, flat across every sample of the last 30 days),
`cast gas-price` suggestion 0.006 gwei. Reproduce any figure with
`scripts/quote.sh` (live) or the fork test (gas, real USDC) — see Provenance.

Cost model used throughout (OP-stack: the L1 data fee is a **separate**
component from `gas_price`; both were read off live receipts, not estimated):

```
cost_usd = (gas_used × gas_price_gwei × 1e-9 + l1_fee_eth) × eth_usd
```

## 1. What we spend today

Per standalone payout (native USDC on Base, one tx per payment), measured from
live receipts of real single-transfer txs + a Base fork for cold-recipient gas:

| component | measured | USD/payment |
|---|---|---|
| L2 execution gas | 40,259 (recipient already holds USDC) – 57,359 (fresh recipient) from live receipts; 62,647 fully-cold on fork | $0.00077–$0.00085 |
| L1 data fee | 2.8949 gwei, identical on every receipt sampled (68-byte transfer) | $0.0000079 |
| **total** | | **≈ $0.00078–$0.00086** |

At 40,000/day and today's prices (conservative cold-recipient number):

| | today |
|---|---|
| per day | **$34.35** (L2 $34.03 + L1 $0.31) |
| per month | **$1,044** |
| per year | **$12,536** |

If the relayer is currently sending at the 0.006 gwei `cast gas-price`
suggestion rather than the 0.005 gwei base fee, add ~16%: **≈ $41/day**.

**The real story for finance is the exposure, not the level.** Base's base fee
is floor-pinned at 0.005 gwei today, but it was **0.803 gwei ~90 days ago**
(2026-06-25, block 47803221) and 0.0097 gwei a year ago. At 0.803 gwei the
same 40,000 payments/day cost **≈ $5,460/day ≈ $166k/month**. Our bill is
proportional to Base activity, which we don't control — but the multiplier on
it is ours. That's what the changes below cut.

## 2. Changes, ranked by measured savings

### #1 Batch payouts through `RelayBatcher` — cuts 52% of execution gas and 65% of the L1 data fee (code shipped in this repo)

One transaction pays up to 500 recipients via `transferFrom` from the relayer
(pull model: relayer approves the batcher once; only the caller's funds can
ever move, so the contract needs no owner and cannot be upgraded).

Measured on a Base fork against real USDC (same conditions both sides):

| batch size N | gas per tx | gas per payment |
|---|---|---|
| 1 (today's pattern) | 62,647 | 62,647 |
| 10 | 344,690 | 34,469 |
| 50 | 1,529,319 | 30,586 |
| **100** | **3,010,124** | **30,101** |
| 200 | 5,971,770 | 29,859 |
| 500 | 14,857,537 | 29,715 |

L1 data fee per payment: 2.8949 gwei → 1.016 gwei (GasPriceOracle
`getL1Fee` on a real 100-item calldata, ÷100; the per-tx envelope is paid once
per batch instead of once per payment).

Savings, at today's prices (ETH $2,713.60, 0.005 gwei, 40k payments/day):

| | today | after (N=100) | saved |
|---|---|---|---|
| per day | $34.35 | $16.46 | **$17.88** |
| per month | $1,044 | $500 | **$544** |
| per year | $12,536 | $6,009 | **$6,528** |

If Base gas returns to the 0.803 gwei level measured 90 days ago: **saves
$2,837/day**. The saving is structural (32.5k gas/payment removed), so it
scales with whatever Base charges.

One-time cost: deploy 502,283 gas + approve 55,785 gas ≈ **$0.008**.

Tradeoffs (all manageable, none blocking):
- **Latency**: at N=100, 400 tx/day ≈ one batch every 3.6 min; at N=500, every
  18 min. Payments queue for the batch window instead of leaving immediately.
- **Failure isolation**: a reverting item (USDC blacklist, frozen token) is
  skipped, not fatal — the batch emits `PaymentFailed(index)`, the relayer
  re-queues that payment. An `batchTransferAtomic` variant is included for
  batches where all-or-nothing matters (costs ~7 gas/item less, measured).
- **Nonce management**: batches are sequential from one key; keep the queue
  single-writer (as today).
- **Gas caps**: N=500 ≈ 14.9M gas, comfortably under per-tx limits.

Ship: `forge create src/RelayBatcher.sol:RelayBatcher --rpc-url … --broadcast`,
approve once from the relayer, then `scripts/relay.sh payments.csv` (or port
the loop into the relayer service — it is 30 lines of shell). Tests:
`forge test` (11 passing, incl. failure/ownership paths);
`BASE_RPC_URL=https://mainnet.base.org forge test --match-path test/BaseFork.t.sol`
pays 100 real-USDC recipients on a fork and locks per-item gas at <33k.

### #2 Send type-2 txs with the market tip (0–500 wei), not the 0.001 gwei suggestion — up to ~$7/day now, free to implement

Measured in a recent full block (289 txs sampled): **8.3% pay tip = 0**, the
typical effective tip is 0.00025–0.0003 gwei (24 txs at 0, 12 at 50 wei, 5 at
500 wei). `cast gas-price` suggests a 0.001 gwei tip — 2–20x the market.
Legacy `gasPrice` txs (most of the sampled receipts) pay their full quoted
price: observed effective 0.005313–0.006 gwei against a 0.005 gwei base fee.

- If we currently send at 0.006 gwei: switching to type-2, tip 50 wei,
  maxFee 1.1× base fee saves 0.001 gwei × 2.506 Ggas/day ≈ **$6.8/day** today.
- After batching (1.204 Ggas/day): **$3.3/day**.
- Also caps damage during spikes: maxFee 1.1× base fee instead of a fat
  hardcoded gasPrice.

`scripts/relay.sh` already does this correctly (derives fee fields from the
chain immediately before each send; tip configurable via `TIP_WEI`, default
50). Watch inclusion; if batches ever stall, bump `TIP_WEI` — it costs cents.

### #3 Measured non-levers — explicitly not worth doing

- **Off-peak scheduling**: base fee = 0.005000 gwei exactly at 1h/2h/4h/8h/12h/
  24h/3d/30d lookbacks (floor-pinned). There is no cheap hour to move batches
  to. Re-check if Base removes the floor.
- **L1 data-fee micro-optimization (packed calldata, zero-byte golf)**: the
  L1 fee is 0.9% of a payment's cost today (2.8949 gwei vs ~313 gwei of L2
  execution at 0.005). Even a 100x blob-price spike leaves it under
  $0.001/payment. Batching already removes 65% of it. Not worth engineer time.
- **Chain/token move**: high-frequency, low-value payouts are exactly the
  workload L2s are for (measured, not priors); native USDC on Base is the
  liquid default. No action.

### #4 Operations (with #1/#2 live)

- Monitor on our receipts: `effectiveGasPrice − baseFeePerGas` (overpay
  detector), `l1Fee` share, `PaymentFailed` rate per batch, relayer ETH buffer
  (after batching, ~$17/day vs ~$35/day burn).
- Re-queue loop: poll batch receipts for `PaymentFailed` events, re-append
  those rows to the next batch; anything failing twice parks for review.
- Rollback: batching is additive — the single-transfer path stays in the
  relayer and can be re-enabled per-payment at any time.

## 3. What's in this repo (ready to ship)

- `src/RelayBatcher.sol` — batcher (permissionless, immutable, two flavors)
- `test/RelayBatcher.t.sol` — 10 unit tests incl. gas regression bound
- `test/BaseFork.t.sol` — real-USDC fork test (gated on `BASE_RPC_URL`)
- `scripts/relay.sh` — CSV → batches, live-derived 1559 fields, dry-run mode,
  failure-event handling notes (verified end-to-end on a fork: 7/7 payments)
- `scripts/quote.sh` — this cost model, live, for finance to re-run any day
- `payments.csv` — example input format

## 4. Provenance (how every number above was produced)

- Prices: `cast base-fee / cast gas-price --rpc-url https://mainnet.base.org`;
  ETH/USD Coinbase spot + Chainlink mainnet feed; 2026-09-23 ~14:05 UTC.
- Per-payment gas: `eth_estimateGas` on an anvil fork of Base
  (`anvil --fork-url https://mainnet.base.org`, block ≈ 51,691,340), relayer
  funded with real USDC from whale `0xb2cc…9DC59`; cross-checked against live
  receipts (block 51,691,213–221: gasUsed 40,259–57,359 across 8 simple
  EOA→USDC transfers).
- L1 fees: `l1Fee` field of live Base receipts (2.8949 gwei per 68-byte
  transfer) and `GasPriceOracle(0x4200…000F).getL1Fee` on the exact batch
  calldata (101.588 gwei for a 100-item batch, 6,564 bytes).
- Historical base fees: `eth_getBlockByNumber` at −1h/−2h/−4h/−8h/−12h/−24h/
  −3d/−30d/−90d/−180d/−365d from block 51,691,221.
- Tip distribution: `maxPriorityFeePerGas` over 289 txs of block 51,691,221.
- Fork gas table & one-time costs: see `test/BaseFork.t.sol` output and the
  deploy/approve receipts on the fork.
- Re-run: `scripts/quote.sh` (costs), `scripts/relay.sh --dry-run payments.csv`
  (per-batch gas), fork test for gas regression.
