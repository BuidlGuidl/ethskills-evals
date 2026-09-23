# Base gas plan — ~40,000 ERC-20 transfers/day from the relayer wallet

All prices below are **live measurements taken 2026-09-23 ~13:00 UTC**, not priors: Base
gas price **0.006 gwei** (base fee 0.005 + 0.001 tip), ETH **$2,712** (Coinbase spot;
Chainlink $2,717), block gas limit **400M**. Rerun `node scripts/fees.mjs quote/audit`
for current numbers before quoting any of this to finance again.

## TL;DR for finance

| Scenario (40k transfers/day) | Per transfer | Per day | Per year |
|---|---|---|---|
| Today, **if** relayer pays market (0.006 gwei) | $0.00082 | **$33** | **$12.0k** |
| Today, if relayer hardcodes 0.1 gwei (common default) | $0.0135 | **$540** | **$197k** |
| Today, if relayer ports mainnet-style 2 gwei | $0.270 | **$10,790** | **$3.94M** |
| After batching, at market fees | $0.00038 | **$15** | **$5.5k** |
| After batching + correct fees | $0.00038 | **$15** | **$5.5k** |

Two things matter, in this order:

1. **Are we paying the market gas price?** This is one number on our own receipts
   (`effectiveGasPrice`) and it swings the answer by 100x. It must be checked first.
2. **Batching** cuts execution gas 54% (measured below) regardless of what we pay
   per gas — worth $6.4k/yr at market prices, $104k–$2.1M/yr if fees are overpaid.

Everything else (L1 data fees, fee-timing, chain/token switches) was measured and is
**not worth effort today** — details at the bottom.

---

## Step 0 — Read what we actually spend (5 minutes, code shipped)

`scripts/fees.mjs audit` pulls our relayer's recent transfer receipts and compares
what we paid per gas against the live market:

```bash
node scripts/fees.mjs audit --address 0xOUR_RELAYER --token 0xOUR_TOKEN --blocks 2000
```

It prints: avg gasUsed, avg `effectiveGasPrice`, avg L1 data fee, the "you pay Nx
market" ratio, and daily/annual projections at 40k transfers/day. If the ratio is
~1x, skip to change #2. If it's >1.5x, do change #1 first — it's worth more than
everything else combined.

(Demo: run against any busy address — a sample high-volume USDC sender was measured
today paying 0.364 gwei effective on a 0.006 gwei market: a 61x overpay, $75,960/day
projected at our volume. Overpaid fee fields on Base are common, not exotic.)

## #1 — Set EIP-1559 fee fields from the chain, per submission (code shipped)

**Savings: (paid − 0.006 gwei) × 49,694 gas × 40,000 transfers/day.**

| Current effective gas price | Daily spend | Savings after fix |
|---|---|---|
| 0.006 gwei (market) | $33 | — (already right) |
| 0.01 gwei | $54 | $21/day ($7.7k/yr) |
| 0.05 gwei | $270 | $237/day ($87k/yr) |
| 0.1 gwei | $540 | $507/day ($185k/yr) |
| 2 gwei (mainnet-ported) | $10,790 | $10,757/day ($3.9M/yr) |

**The fix (shipped):** `node scripts/fees.mjs fields` returns ready-to-use
`maxFeePerGas` / `maxPriorityFeePerGas` derived from the chain at call time —
base fee from the latest block, tip from `eth_gasPrice − baseFee` (cross-checked
against `eth_maxPriorityFeePerGas`), plus a >5x-vs-10-block-median spike warning.
Never hardcode these; on Base the floor has been 0.005 gwei, so a "safe" mainnet
constant is a pure 300x overpay. The relayer should call this before every batch
submission (it's two RPC reads).

## #2 — Batch transfers through the BatchSender contract (code shipped)

**Savings: 54% of execution gas, measured. At market fees: $17.6/day ($6.4k/yr).
At 0.1 gwei: $288/day ($105k/yr). At 2 gwei: $5,758/day ($2.1M/yr).**

Today every transfer is its own transaction, so each one pays 21,000 intrinsic gas,
cold contract/slot access, and its own L1 data fee. A batch pays those once.

Measured on a live-state Base fork (methodology in appendix):

| Per-transfer cost (USDC) | Individual tx | In batch of 100 |
|---|---|---|
| Recipient already holds the token (66% of live traffic) | ~40–45k gas | **19,082** |
| Fresh recipient, zero balance (34% of live traffic) | ~57–62k gas | **31,194** |
| Live-traffic blend | **49,694** (mean of 80 receipts) | **~23,200** |
| L1 data fee | 3.9 gwei ($0.000011) | 0.36 gwei |

- Cost per transfer at market prices: **$0.00082 → $0.00038**.
- Daily: **$32.78 → $15.14**; annual: **$11,963 → $5,527**.
- Batch fixed overhead amortizes fast: N=10 costs 35.4k/transfer, N=100 31.2k,
  N=250 31.0k. Marginal cost is flat at ~21.3k (existing balance) / 31.4k (fresh).
- 40,000 txs/day (one every 2.16s, a sustained nonce stream) becomes **400 txs/day**
  at N=100 — a 100x cut in tx count, submissions, and nonce management.
- N=250 uses 7.7M gas = **1.9% of Base's 400M block gas limit**. Headroom is huge.

**What shipped:** `src/BatchSender.sol` + full test suite + deploy/encode tooling.
Design points that matter to payments:

- `send((token, to, amount)[])`, owner-only (owner = the relayer wallet, set at
  deploy). No custody: tokens move via `transferFrom(relayer, ...)`, so **every
  Transfer event still shows `from` = the relayer wallet** — event-based
  reconciliation/indexing keeps working. Only the tx `to` changes (to the batcher).
- One-time setup: relayer approves the batcher once; after that zero extra calls.
- **Atomic:** one bad item reverts the whole batch with `TransferFailed(index)`.
  Ops policy: on failure, drop/reschedule item `index` and resubmit the rest
  (`fees.mjs encode` rebuilds calldata from a payments JSON file).
- Guards: empty-batch revert, EOA-as-token rejection, false-return-token rejection,
  no-return tokens (USDT-style) accepted.
- Immutable owner, not upgradeable, holds no funds, no reentrancy surface
  (owner-only entry point).

## #3 — Batch sizing & flush policy (ops decision, not much code)

Recommended: **flush every 30–60s or 100–250 payments, whichever first**. Smaller
batches = lower revert blast radius and retry cost; larger = marginally cheaper
(31.9k → 31.0k/transfer from N=100 → 250 — diminishing). Payments semantics:
batching adds up-to-one-flush-interval latency; individual-recipient settlement
inside a batch is still one transfer event, same as today.

USDC-specific caveat: Circle can blacklist recipient addresses; a blacklisted
recipient reverts the batch (caught as `TransferFailed(i)`). Keep batches modest
and retry-minus-failed — same code path as any other failing item.

## #4 — Measured and rejected (do not spend time here)

- **L1 data fee games:** all 40k transfers/day pay a combined **$0.42/day** in L1
  data fees today (blob base fee 0.019 gwei — post-Dencun, calldata is nearly
  free). Batching already cuts it ~10x (3.9 → 0.36 gwei/transfer) for free.
  No further work is rational.
- **Fee-aware timing:** a 500-block sample shows base fee **pinned at the 0.005
  floor** (p10 = p50 = p90 = 0.005 gwei). Spikes exist (a receipt from ~7h earlier
  shows 0.034 gwei) but waiting them out saves cents at our volume. The `fields`
  command's spike warning covers the tail risk for free.
- **Chain/token switches:** at 0.006 gwei a transfer costs $0.0008 — for a
  latency-tolerant payments flow Base is already near the floor of what exists.
  Nothing meaningfully cheaper for 40k transfers/day.
- **Micro-optimizations** (deposit-vs-approve patterns, per-item events,
  packing): <1% effects; not worth contract surface area.

---

## Appendix — measurements and how to reproduce

**Live reads (2026-09-23 ~13:00 UTC):** `cast gas-price` / `cast base-fee` on Base =
0.006 / 0.005 gwei (both `mainnet.base.org` and `base.publicnode.com` agree;
`eth_maxPriorityFeePerGas` = 0.001 gwei). ETH/USD: Chainlink mainnet feed answer
$2,717, Coinbase spot $2,712. Base block gas limit 400M (`eth_getBlockByNumber`).

**Individual transfer cost (ground truth, no simulation):** sampled every USDC
`Transfer` log over ~20 recent minutes on the native token
(`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), kept txs where `tx.to` = token and
calldata is `transfer(address,uint256)`, then pulled receipts. 80 plain transfers:
gasUsed modes 40,259 (19%) / 45,059 (47.5%) / 57,359 (5%) / 62,171 (29%), median
45,059, **mean 49,694**; l1Fee ≈ 3.8–3.9 gwei each. Cross-checked with
`cast estimate` on live state: 62,772 to a fresh recipient, 45,439 to an
existing-balance holder — matching the receipt modes.

**Batched cost (real `eth_estimateGas` against deployed BatchSender on an anvil
fork of Base, whale sender):** N=1: 76,208; N=10: 35,413; N=100: 31,194;
N=250: 30,953 per transfer (fresh recipients); N=100 existing-balance holders:
19,082. Marginal per item from fork-test deltas: 31,384 fresh / 21,323 existing /
14,293 repeat-in-batch. L1 fees via `GasPriceOracle.getL1Fee` (0x420…000F):
3.59 gwei individual calldata (3.8–3.9 on receipts incl. tx wrapper) vs 35.6 gwei
per 100-item batch = 0.36 gwei/transfer.

Reproduce:

```bash
cast gas-price --rpc-url https://mainnet.base.org          # what a tx pays
node scripts/fees.mjs fields                                # fee fields, live
node scripts/fees.mjs audit --address 0xRELAYER ...        # what we actually pay
forge test                                                  # unit tests (offline)
forge test --match-path test/BaseForkMeasure.t.sol \
  --fork-url https://mainnet.base.org -vv                  # rerun gas measurements
# (the free public RPC rate-limits the whole fork suite at once; if a test 429s,
# rerun it individually with --match-test — all five pass solo)
```

Assumptions: traffic modeled on native USDC (dominant payments token; contract is
token-agnostic and other ERC-20s land within the same bands — 45k/62k modes are
SSTORE-driven, not token-driven). "40,000/day, one relayer wallet" per finance.
Live gasUsed distribution (fresh vs existing-balance recipients) is from public
traffic; our own mix may differ — the `audit` command reports ours once pointed at
the real relayer.

## What shipped where

| Path | What |
|---|---|
| `src/BatchSender.sol` | Batched ERC-20 sender (owner-only, transferFrom-based, atomic) |
| `test/BatchSender.t.sol` | 9 unit tests: auth, atomicity, edge-case tokens, events |
| `test/BaseForkMeasure.t.sol` | Fork-based gas measurements (skips unless run against Base) |
| `scripts/fees.mjs` | `fields` (1559 fields), `encode` (batch calldata), `audit` (spend), `quote` (projections) |

## Ship checklist

1. `node scripts/fees.mjs audit --address 0xRELAYER` → decide if fee fields are
   change #1 (they usually are when this is asked for).
2. Deploy `BatchSender(owner = relayer wallet)` from the relayer (one ~$0.01 tx).
3. Relayer: one `approve(token, batcher, max)` per token it pays.
4. Relayer loop: queue payments → flush at 100–250 items or 30–60s → fetch
   `fields` → `estimateGas` → submit → on `TransferFailed(i)`, retry minus item i.
5. Alerting: `audit` ratio > 1.5x market = page someone.
