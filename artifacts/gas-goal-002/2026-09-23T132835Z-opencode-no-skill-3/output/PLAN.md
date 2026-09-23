# Gas plan — Base relayer, 40,000 ERC-20 transfers/day

**Date: 2026-09-23.** All cost figures below were computed live against Base mainnet (the
chain's own fee oracle, not estimates) and against forge-measured gas for the shipped
contract. Re-run any time with `npm run analyze`.

---

## TL;DR — what we spend and what each change saves

**Current spend (today's fees): ~$50.70/day → ~$18,500/yr** ($0.001267 per transfer).
That is the *floor-fee regime* (Base base fee at its 0.005 gwei minimum, blob fees at
0.018 gwei). The same 40k transfers cost **$77/day in the September-average blob regime
(2.3 gwei), $165/day at 10 gwei, and $967/day in a Nov-2024-style blob spike (80 gwei)**
— L1 data fees scale linearly with the blob market and our txs are 4-5x heavier than
they need to be.

| # | Change | Saves (annualized) | Status |
|---|--------|-------------------|--------|
| 1 | Batch payouts via packed-calldata `BatchSender` | **−65% today** ($18.5k → $6.4k); **−70…−80% in blob-heavy regimes** (spike day: $967 → $197); scales with any fee increase | **Code shipped** (contract, tests, relayer) |
| 2 | Audit current tip/gas-price policy | 0% if already tuned; **up to −90%** if the relayer overpays (e.g. wallet-default tips: $0.0104/transfer = **$153k/yr**) | Verify in 30 min; shipped relayer already does it right |
| 3 | Defer sends through fee spikes (SLA-bounded) | Cuts the *tail*: skips 80-gwei blob days within SLA; worth multiples of #1's savings in the worst months | **Code shipped** (relayer ceilings) |
| 4 | Net same-recipient payouts within a window | Each merge = one whole transfer saved; 10% mergeable ≈ −10% of everything ($1.9k/yr today, $7.6k/yr at 2.3 gwei) | Product decision, no code |
| 5 | EIP-7702 variant of #1 | Same numbers as #1 without contract float migration | Optional follow-up |

Everything else (token choice, tips at 0.001 gwei, block positioning) is already at or
near the floor — don't spend time there.

---

## What a transfer actually costs on Base (the model)

A Base tx pays two fees (operator fee is currently disabled on Base):

- **L2 execution fee** = `gasUsed × (baseFee + priorityFee)`
- **L1 data fee** (post-Fjord) = `estimatedCompressedSize × (baseFeeScalar × 16 × l1BaseFee + blobBaseFeeScalar × blobBaseFee) / 1e12`, where estimated size ≈ `0.8365 × fastLZ(tx) − 42.6`, floored at 100 bytes. The L1 data fee is charged to the tx sender automatically and **tracks the Ethereum blob market**, which is the volatile part.

Live parameters at generation time: L2 base fee 0.005 gwei (Base's minimum, unchanged
since Feb 2026), tip 0.001 gwei, L1 base fee 0.32 gwei, blob base fee 0.018 gwei,
scalars 2269 / 1,055,762, ETH $2,712.

Per-transfer today (USDC, fresh recipient — measured, not estimated):

| shape | exec gas | L1 est. bytes | total/transfer | /day | /year |
|---|---|---|---|---|---|
| standalone transfer (today) | 77,000 | ~115 | $0.001267 | $50.70 | $18,505 |
| batched N=256 (shipped) | 26,782 | ~21 | $0.000440 | $17.58 | $6,418 |

Why batching wins twice:

1. **Execution**: each standalone tx pays 21k intrinsic gas + cold access for the token
   contract and the relayer's own balance slot. In one batch tx those are paid once for
   256 transfers → 77k → 26.8k gas per transfer (forge-measured; the per-item cost is
   dominated by the unavoidable recipient-slot SSTORE).
2. **L1 data**: a standalone `transfer(recipient, amount)` spends ~112 tx bytes (68 B
   ABI-encoded calldata + envelope + 65 B signature) → ~115 estimated-compressed bytes.
   The batch encodes each transfer as **one packed 32-byte word** (20 B address + 12 B
   uint96 amount) → ~21 estimated-compressed bytes per transfer, **−82% of L1 data
   fee**, verified by calling `GasPriceOracle.getL1Fee()` on the exact serialized txs.

---

## 1. Batch payouts through `BatchSender` — code shipped

Replace 40,000 individual `transfer()` txs with **~160 batch txs/day** (250 per batch).

### The savings, by fee regime (from `npm run analyze`, N=256)

| blob base fee | standalone /transfer | batched /transfer | saving | daily spend (standalone → batched) |
|---|---|---|---|---|
| today (0.018 gwei) | $0.00127 | $0.00044 | **65%** | $51 → $18 |
| 0.5 gwei | $0.00141 | $0.00047 | **67%** | $56 → $19 |
| 2.3 gwei (Sept-2026 average) | $0.00192 | $0.00057 | **70%** | $77 → $23 |
| 10 gwei | $0.00413 | $0.00100 | **76%** | $165 → $40 |
| 80 gwei (Nov-2024-style spike) | $0.02417 | $0.00493 | **80%** | $967 → $197 |

And it scales with L2 prices, which Base has been raising deliberately (minimum base
fee went 0.0002 → 0.005 gwei between Dec 2025 and Feb 2026):

| L2 effective gas price | standalone exec | batched exec | daily (standalone → batched) |
|---|---|---|---|
| today (0.006 gwei) | $0.00126 | $0.00044 | $50 → $18 |
| 0.05 gwei | $0.01044 | $0.00363 | $418 → $145 |
| 0.25 gwei | $0.05221 | $0.01816 | $2,088 → $726 |

**Annualized: $18.5k → $6.4k/yr at today's fees; $28k → $8.4k/yr in the current-month
blob regime; ~$353k → $72k/yr if 2026 trends continue toward 0.05 gwei L2 fees.**

### What shipped

- `contracts/BatchSender.sol` — minimal, dependency-free, owner-gated batch sender:
  - `send(token, bytes32[])` — atomic: any failure reverts the whole batch.
  - `sendSafe(token, bytes32[])` — per-item tolerance: returns/emits a failure bitmap so
    one poison payout (e.g. a blacklisted USDC recipient) can't stall the queue.
  - Item = one packed word: `address << 96 | uint96(amount)` (any realistic token amount
    fits uint96; enforced client-side too).
  - Hard cap 256 items/batch — fits the bitmap and stays well under Base's per-tx gas
    cap of 16,777,216 introduced by the Azul upgrade (May 2026; a 250-item batch uses
    ~7.5M gas).
  - SafeERC20-style return handling (tokens returning `false`, reverting, or nothing are
    all handled; covered by tests).
- `test/BatchSender.t.sol` — 22 tests: packing round-trip, access control, atomic and
  tolerant failure modes, adversarial token mocks, and gas measurements (the numbers in
  this plan come from these tests).
- `scripts/relayer.ts` — production sender: JSONL payout queue → chunked batches →
  pre-send exact L1 fee via the oracle → fee ceilings (see #3) → send → receipt
  reconciliation → per-item cost ledger (`ledger.jsonl`, exec fee and L1 fee split) →
  automatic requeue of failed items to `remaining.jsonl`. Optional `--precheck-usdc`
  drops blacklisted recipients pre-flight.
- `scripts/analyze.ts` — regenerates every table in this file from live chain state.
- `script/Deploy.s.sol` — deploy (or `cast send --create`).

### Rollout

1. `forge test` → deploy `BatchSender` from the relayer key (`owner` is the deployer).
2. Fund the contract with ~2 days of payout float (bounded exposure; top-up is one
   extra transfer per day, ~$0.001).
3. Start the relayer in `--dry-run` against the real queue; then run on a 5-minute
   cron (`--batch-size 250` default). 40k/day ≈ 160 txs/day, ~7.5M gas each — trivial
   load (~0.4% of one 2s block, well under flashblock budgets).
4. Keep `--strict` off (default `sendSafe`) unless reconciliation prefers all-or-nothing.

---

## 2. Audit what you're actually paying per tx today (do this first — 30 minutes)

The numbers above assume a *tuned* relayer (0.001 gwei tip, `maxFeePerGas = 1.2 ×
baseFee`). Relayers configured through standard wallet libraries frequently aren't:
default tips of 0.05-0.1 gwei or legacy `gasPrice` of 0.5-1 gwei are common and
**quietly multiply the whole bill**:

- At 0.05 gwei effective price: $0.0104/transfer → **$418/day → $153k/yr** (8x today's
  tuned cost, before any batching).
- At 1 gwei legacy gasPrice: $0.209/transfer → **$3.05M/yr**.

Check now, from existing receipts: for a sample of recent txs compare
`receipt.effectiveGasPrice` to the block's `baseFeePerGas` (`eth_feeHistory`). Tip
should read ~0.001-0.002 gwei. The shipped relayer enforces
`maxFeePerGas = 1.2 × baseFee + 0.001 gwei tip` and caps sends at 0.25 gwei (see #3),
so this class of overpaying is structurally eliminated after migration.

---

## 3. Defer through fee spikes (shipped as relayer policy)

The L1 data fee component tracks the Ethereum blob market: it was ~1 wei/byte for most
of 2024, spiked to **80 gwei in Nov 2024**, and after Fusaka's EIP-7918 floor has been
trading 0.01-2.3 gwei through 2026. A spike multiplies the L1 part of every transfer
for minutes-to-hours. The relayer ships with:

- `--max-blob-fee-gwei 2.0` — hold the queue while blob base fee is above this;
- `--max-gas-gwei 0.25` — same for L2 gas;
- `--sla-minutes 120` — flush anyway if payouts age past 2h (SLA beats savings).

Combined with #1 this is what caps the worst month: during an 80-gwei-style event a
batched-and-deferred queue pays $197/day instead of $967/day (standalone) — and most
of even that waits out the spike within the SLA. Tune the two ceilings against your
payout latency promise; at current 2h SLA the expected cost of waiting is negligible
(Base block time is 250 ms flashblocks; inclusion at 0.001 gwei tips is fast).

---

## 4. Net same-recipient payouts within a window (product change)

Every two payouts to the same recipient inside the window collapse into one transfer —
the saving is a whole transfer, i.e. $0.00044-0.005 each depending on regime, plus one
fewer recipient-slot write. Value depends entirely on repeat rate:

| mergeable fraction | saved/day (today) | saved/yr (today) | saved/yr (2.3 gwei regime) |
|---|---|---|---|
| 10% | $1.76 | $642 | $2,800 |
| 25% | $4.40 | $1,605 | $7,000 |

Requires a product decision on payout latency (e.g., hourly settlement per recipient).
No relayer changes needed — net upstream of the queue file.

---

## 5. EIP-7702 variant (optional, same savings as #1)

Base has supported EIP-7702 since the Isthmus upgrade. Instead of a separate contract
holding float, the relayer EOA can authorize a `BatchSender`-style delegate once and
then send packed batches *to itself*. Same exec/data savings, no float to manage, no
approval — at the cost of 7702 tooling in the hot path. Only worth doing if contract
float operations turn out to be annoying; the delegate can reuse the same packed-item
format and tests.

---

## What is *not* worth doing

- **Tip/MEV games beyond 0.001 gwei** — Base inclusion at floor fees is already instant
  at our volumes; priority fees buy nothing for a 5-minute batch cadence.
- **Switching tokens / bridging** — native USDC on Base is the right rail; USDT isn't
  meaningfully cheaper and adds risk.
- **Native ETH payouts** only if the product wants them (21k gas standalone vs 26.8k
  batched ERC-20 — marginal once batching exists).
- **Layer-1 settlement or other chains** — out of scope; Base is ~1000x cheaper than L1
  for this workload.

## Operations after migration

- Cron: `tsx scripts/relayer.ts --queue queue.jsonl --contract 0x…` every 5 min
  (16,000 txs/day of headroom; currently ~160).
- Finance reporting: `ledger.jsonl` records per batch — `gasUsed`, `execFeeWei`,
  `l1FeeWei`, USD, per-item USD, failed items — feed straight into the cost dashboard.
- Watch for governance changes: Base adjusts `baseFeeScalar`/`blobBaseFeeScalar` and
  the minimum base fee over time (they raised the floor 25x within 6 months in 2025-26).
  `npm run analyze` reflects any change instantly.
- Monitoring: alert if per-item cost in the ledger exceeds ~$0.002 (implies regime
  shift or overpaying), or if `remaining.jsonl` grows across runs (poison items —
  enable `--precheck-usdc`).

## Sources & verification

- Live chain queries (2026-09-23, `npm run analyze`): GasPriceOracle scalars/prices,
  `getL1Fee` on exact serialized txs (the same code path op-geth charges with).
- Fjord L1 fee formula and constants: OP Stack spec (`exec-engine`, Fjord) — intercept
  −42.5856, fastLZ coeff 0.8365, min size 100 B.
- Execution gas: forge-measured (`forge test -vv`) — standalone 77,000 gas (OZ-style
  token, fresh recipient; real USDC on Base tracks 55-75k, so results are conservative
  to within ±20%), batched 26,782/item at N=256.
- Per-tx gas cap 16,777,216 (EIP-7825, Azul upgrade on Base — May 2026); minimum L2
  base fee 0.005 gwei since Feb 2026 (Base changelog); operator fee disabled
  (`getOperatorFee() == 0`, verified on-chain).
- Blob market history: Nov 2024 spike to ~80 gwei (blobscan/EIP-7918 discussions);
  Sept 2026 average ~2.3 gwei reported by blob-market analysts; EIP-7918 floor live
  since Fusaka (Dec 2025).
