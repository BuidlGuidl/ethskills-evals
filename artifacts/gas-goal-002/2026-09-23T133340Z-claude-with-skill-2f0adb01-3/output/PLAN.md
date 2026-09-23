# Gas cost review — Base payments relayer

**Date:** 2026-09-23 · **Measured at:** Base block 51,690,700–51,690,989 · **ETH $2,715**

---

## The short answer for Finance

**You are spending about $990 a month on gas — roughly $11,900 a year.**

That is 40,000 USDC transfers a day at about **$0.00081 each**. Gas is not a
material line item at your current volume; it costs less than a single mid-tier
SaaS subscription.

The best available saving is about **$8,600/year (–72%)**, and most of it
requires shipping and securing a new smart contract. One change worth
**$1,750/year** is a config edit that takes minutes and carries no contract risk.

| | Per payment | Per month | Per year |
|---|---|---|---|
| Today | $0.000814 | $991 | $11,884 |
| After the free config change | $0.000694 | $845 | $10,132 |
| After config change + batching | $0.000224 | $273 | $3,273 |

**Recommendation:** do #1 this week. Treat #2 as an *operations* project that
happens to save gas — 40,000 transactions a day becoming 160 is worth more than
the $8k. Do not fund #2 on the gas savings alone; the payback is years.

---

## What the money is actually spent on

This is the finding that determines everything below.

A real USDC transfer on Base, measured from live receipts:

```
gasUsed        40,271 – 45,047        (eth_estimateGas: 45,223)
L2 execution   $0.000744              98.5% of the cost
L1 data fee    $0.0000124              1.5% of the cost
```

**98.5% of your gas bill is L2 execution, not L1 data availability.** This
inverts the advice you will find in most L2 cost guides, which is written for
the pre-4844 world where posting calldata to Ethereum dominated. Since blobs
(EIP-4844) and Fusaka's PeerDAS, L1 data has collapsed to a rounding error.

Consequences, and they matter:

- **Calldata compression is not worth doing.** Shrinking your payload attacks
  1.5% of the bill. We packed the batch encoding anyway because it was free to
  do, but as a standalone project it would save under $180/year.
- **The lever that works is eliminating transactions**, because the cost is
  dominated by the 21,000-gas intrinsic charge every transaction pays plus
  USDC's two storage writes. Batching attacks the 21,000; nothing attacks the
  storage writes.

The irreducible floor is USDC's own bookkeeping: two SSTOREs and a `Transfer`
event, about 12,500 gas per payment. You cannot go below that while paying each
recipient on-chain individually.

---

## Ranked plan

### 1. Cut the priority fee — $1,752/year, zero risk, ship today

**Status: implemented** (`tools/batch.mjs` → `feeOverrides()`)

Your relayer pays a **0.001 gwei tip on a 0.005 gwei base fee — a 20% premium**
on every transaction. We sampled 1,691 transactions across five Base blocks:

```
priority fee paid    p10  0.00000005 gwei
                     p25  0.0005 gwei
                     p50  0.001 gwei      ← what you pay
                     p90  0.019 gwei

included with a ZERO priority fee:   9.2% of transactions
included below 0.0002 gwei:         17.4% of transactions
```

And the reason tips buy so little:

```
Base block fullness (last 20 blocks):  18.1%
Spare capacity per block:              328,000,000 gas
```

**Base blocks are 82% empty.** There is no queue to buy your way to the front
of. A tip is priced for blockspace competition that is not happening.

Dropping the tip to **0.0001 gwei** — still strictly non-zero, so no node treats
the transaction as underpriced — cuts the effective gas price from 0.006014 to
0.005114 gwei, a **15% reduction on 98.5% of your bill**.

Set `maxFeePerGas` generously (we use 0.05 gwei, ~10x base). It is a ceiling,
not a payment: EIP-1559 refunds the difference, so headroom against a base-fee
spike is free.

> **Verify before rolling out fleet-wide.** Run it on a slice of traffic for a
> day and watch inclusion latency. If Base's sequencer policy changes, this is
> the first thing to revisit — it is one constant in one function.

### 2. Batch the transfers — $8,040/year, needs a contract

**Status: implemented** (`src/BatchPay.sol`, `tools/batch.mjs`)

One transaction carrying 250 payments instead of 250 transactions. Measured on a
Base fork against the real USDC contract (`test/GasBenchmark.t.sol`):

| Batch size | Gas/payment, individual | Gas/payment, batched | Saved |
|---|---|---|---|
| 50 | 45,623 | 13,264 | 71% |
| 100 | 45,616 | 12,763 | **73%** |
| 250 | 45,654 | 12,550 | **73%** |
| 500 | 45,740 | 12,625 | **73%** |

For recipients receiving USDC for the very first time, the saving is **53%**
rather than 73% — a first-ever balance pays a 20,000-gas zero-to-non-zero
SSTORE that batching cannot remove. The table above assumes 80% existing
recipients; `--warm-share` adjusts it.

**Savings flatten at ~100 payments per batch.** Beyond that you are paying only
the marginal 12,520 gas per payment. We default to 250, which is 3.14M gas —
0.8% of a Base block, so inclusion is never in question — and keeps a failed
batch cheap to retry. Going to 500 buys nothing and doubles retry cost.

The L1 data fee falls too, from $0.0000124 to $0.0000025 per payment, but that
is $144/year of the $8,040. Effectively all the saving is the amortised 21,000.

**The real argument for this project is not the $8,040.** It is that 40,000
transactions a day become 160. Nonce management, stuck-transaction handling,
RPC call volume, reorg exposure, and monitoring surface all shrink by the same
factor. If you fund this, fund it as an operations project.

**What it costs you:** a contract that moves customer money needs an audit.
That is plausibly $10–30k for 120 lines, against $8k/year — a 1.5–4 year payback
on gas alone. The ops simplification is what makes it worth doing, and that case
gets stronger as volume grows.

### 3. Net out internal transfers — potentially the largest, but a product decision

**Status: not implemented — needs your input**

Every payment between two users of your own app is a transaction you are paying
for in order to move value between two accounts you already control the ledger
for. Those can settle on an internal ledger and touch the chain only on net
deposit/withdrawal.

We cannot size this without knowing your internal-vs-external split. The
arithmetic is linear: **each 10% of transfers eliminated saves ~$1,188/year
today, or ~$327/year once batching ships.**

This is ranked third despite potentially being the biggest percentage win
because it is not an engineering change — it alters custody and settlement
semantics and needs compliance and product sign-off. Flagging it, not
recommending it.

### 4. Things we checked and are *not* recommending

- **Compressing calldata.** Attacks 1.5% of the bill. Under $180/year.
- **Moving to a cheaper chain.** You would be chasing a fraction of $11,900/year
  while giving up Base's USDC liquidity and Coinbase integration. Not close.
- **Lowering the gas limit.** A limit is not a charge; you are billed for
  `gasUsed`. We saw a transaction with a 150,000 limit pay for 45,047. No saving
  exists here.
- **ERC-4337 / paymasters.** Adds gas. Solves a UX problem you do not have,
  since you already control the relayer.

---

## Sensitivity — what Finance should actually budget for

The bill is linear in volume, in the ETH price, and in the Base base fee. Today's
$11,900 is small; it is not structurally guaranteed to stay small.

| Scenario | Unbatched/yr | Batched/yr |
|---|---|---|
| Today | $11,884 | $3,844 |
| Volume 10x (400k/day) | $118,844 | $38,437 |
| ETH 3x ($8,100) | $35,653 | $11,531 |
| Base base fee 10x | $99,689 | $32,414 |
| Volume 10x **and** ETH 3x | $356,531 | $115,311 |

Batching is cheap insurance against the rows below the first. At 400k
transfers/day it saves $80k/year and the payback argument stops being close.

---

## What shipped in this directory

```
src/BatchPay.sol              Batching contract — packed calldata, relayer allowlist
test/BatchPay.t.sol           13 safety tests: access control, atomicity, decode bounds
test/GasBenchmark.t.sol       Fork benchmarks; pins the baseline to real receipts
test/CrossCheck.t.sol         JS encoder output decoded by the contract
script/Deploy.s.sol           Deployment
tools/gas-report.mjs          Live cost report + real spend from relayer history
tools/batch.mjs               Encoder, chunking, failure bisect, fee overrides
```

Run the report Finance asked for:

```bash
node tools/gas-report.mjs
# with real historical spend:
BASESCAN_API_KEY=... node tools/gas-report.mjs --relayer 0xYOUR_RELAYER --days 30
```

Reproduce the gas numbers:

```bash
export BASE_RPC_URL=https://mainnet.base.org
forge test --match-path test/GasBenchmark.t.sol -vv --threads 1
```

`test_BaselineMatchesObservedOnchainGas` asserts the modelled baseline still
matches real Base receipts. **If it fails, the savings figures above are stale**
— that is deliberate, so these numbers cannot rot silently.

---

## Before you ship BatchPay

Engineering notes that are not gas questions but will bite:

1. **Approval sizing.** `BatchPay` pulls via `transferFrom`. An unlimited
   approval from the treasury means a bug in the contract can drain it. Approve
   a bounded float, or fund a dedicated hot wallet per run.

2. **Batches are atomic, on purpose.** One reverting recipient fails all 250.
   USDC has a real blacklist and you will eventually pay one. The contract
   reverts with `TransferFailed(index)`, and `payBatchesWithBisect()` in
   `tools/batch.mjs` uses that index to quarantine the bad payment and re-send
   the rest. **Do not paper over this with a try/catch that skips failures** —
   silent partial payment is far worse than a retry.

3. **`uint96` amounts.** Holds 79 trillion USDC, so the bound is not a practical
   limit, but the contract truncates rather than reverting above it. The JS
   encoder rejects oversized amounts; keep that check if you reimplement
   encoding elsewhere.

4. **Owner should be a multisig**, not the relayer key. The owner controls the
   relayer allowlist.

5. **Re-run the benchmark if you change token.** These numbers are USDC's
   storage layout. A token with hooks, fees, or rebasing will differ.

---

## Sources

All figures measured on 2026-09-23, not estimated:

- Per-transfer cost: live Base receipts (`eth_getTransactionReceipt`, OP-stack
  `l1Fee` field) plus `eth_estimateGas` against a live node.
- Batch savings: `forge test` against a Base fork at block 51,690,700, using the
  real USDC contract at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- L1 data fees: Base `GasPriceOracle` at `0x420…000F`, queried with realistic
  incompressible payloads (a compressible test payload understates the fee ~10x
  because Fjord prices via FastLZ — worth knowing if you re-measure).
- Tip distribution and block fullness: 1,691 transactions across recent blocks.
- ETH price: CoinGecko, $2,715.
