# Gas spend & reduction plan — Base relayer (40k ERC-20 transfers/day)

All numbers below were measured live on Base mainnet on **2026-09-23** (ETH $2,720, Base
base fee 0.005 gwei). Re-run `npm run model` any time for fresh numbers.

## TL;DR for finance

We send one transaction per transfer. What that costs depends almost entirely on the
**priority fee (tip) our relayer attaches**, because Base's base fee is pinned at
0.005 gwei and L1 blob data fees are now ~1% of total cost:

| Our tip today (audit this first) | Cost per transfer | Spend |
|---|---|---|
| 0.001 gwei (lean) | $0.000844 | **$34/day · $1.0k/mo · $12.3k/yr** |
| 0.007 gwei (p50 of Base traffic) | $0.0021 | $67/day · $2.0k/mo · $24.5k/yr |
| 0.035 gwei (common relayer defaults) | $0.0056 | $223/day · $6.8k/mo · $81k/yr |
| 0.25 gwei (p99 of Base traffic) | $0.035 | $1,421/day · $43k/mo · $519k/yr |
| 3.6 gwei (one real tx observed this week) | $0.50 | $20,090/day at full volume |

### Changes, ranked by what they actually save

| # | Change | Saves (if tips 0.035) | Saves (if tips already 0.001) | Ships |
|---|---|---|---|---|
| 1 | **Clamp tip to 0.001 gwei + defer during spikes** | **$189/day ($69k/yr)** | $0, but spike insurance (see below) | config only, today |
| 2 | **Batch transfers through a dispatcher contract** | **$18/day ($6.6k/yr)** | **$18/day ($6.6k/yr)** | contract + client, ~1 week |
| 3 | Net same-address payouts within a batch window | ~5% of volume → $1.7/day ($616/yr) per 5% dupes | same | client flag |
| 4 | RPC calls drop ~89% (160k → 17k/day) | plan-dependent (often $100s/mo on metered RPC) | same | free with #2 |
| 5 | (Product decision, not code) pay out in ETH not ERC-20 | 21k vs 40–62k gas/entry → another ~35% | same | product |

End state after #1–#3 at lean fees: **~$15/day ($474/mo, $5.7k/yr)** — a 93–99%
reduction from the 0.035/p99 rows, ~54% below the lean row.

**Why #1 ranks first:** in a single 471-tx Base block this week, tips ranged from
0 (30 txs paid literally zero tip and were included fine) to 0.49 gwei — a 500x
spread for identical 2s-block inclusion. If our relayer is anywhere above p50,
this is free money. And it's insurance: a spike like the 3.6 gwei tx observed
recently, sustained for one hour, costs more at current volume ($837/hr) than
item #2 saves all year.

## Step 0 — Audit which row we're in (5 minutes, do this first)

```bash
# Effective gas price of any of our recent txs (RPC + relayer address):
cast tx <TX_HASH> --json --rpc-url https://mainnet.base.org | jq '.maxPriorityFeePerGas'
# Or from receipts/our DB: effectiveGasPrice - 0.005 gwei = the tip we're paying.
# Also check the spread: our 99th-percentile tip during Base congestion hours.
```

If the relayer's tip is ≤ 0.002 gwei, item #1 saves nothing on the base but still
caps spike exposure. If it's ≥ 0.01 gwei, item #1 is the whole ballgame.

---

## #1 Fee policy — clamp tip, defer on spikes

**Evidence:** Base base fee has been flat at the 0.005 gwei floor across every one of
the last 1,000+ blocks sampled; observed tip distribution p25 = 0.001, p50 = 0.0069,
p90 = 0.02, p99 = 0.25 gwei. Tips ≤ 0.001 gwei get included within a block or two
(Base has 2s blocks + 250ms Flashblocks).

**Policy implemented in `relayer/fees.ts`:**

- tip = clamp(baseFee × 10%, floor 0.001 gwei, cap 0.05 gwei)
- maxFeePerGas = baseFee × 1.25 + tip
- if maxFeePerGas > 0.25 gwei (50x today's base fee): **defer and retry** — payout
  queues tolerate minutes of delay; we don't bid into spikes

**Cost:** ~20 gas per tx extra. **Savings:** up to ~98% of L2 fees (0.255 → 0.006
gwei effective), or zero if already lean. No contract needed — works on today's
per-transfer pipeline too.

## #2 Batch through the dispatcher contract

**Why it saves:** every individual transfer pays 21,000 intrinsic gas + cold storage
reads (token address, paused flag, blacklists, sender balance — ~10.5k of cold
SLOADs for USDC). One call to `BatchRelayer.batchTransfer(token, recipients[], amounts[])`
pays those once for the whole batch:

| Batch size N | Implied window* | Gas per entry | Gas saved | Cost/day (lean) |
|---|---|---|---|---|
| 5 | 11s | 29,456 | 42% | $19.32 |
| 10 | 22s | 25,006 | 51% | $16.42 |
| 25 | 54s | 22,336 | 56% | $14.67 |
| 50 | 108s | 21,446 | 58% | $14.09 |
| 100 | 216s | 21,001 | 59% | $13.80 |

*at 40k transfers/day = 0.46/s. Blended 50% fresh / 50% existing recipients;
existing recipients save ~65%, fresh ~50%.

Measured head-to-head (live USDC receipts vs forge-harnessed batch runs):
individual transfer = **40,259 gas** (existing) / **62,183 gas** (fresh recipient —
the +17,100 is the zero→nonzero balance SSTORE); batch marginal entry = **11,689 gas**
(existing) / **28,789 gas** (fresh) once per-batch fixed costs amortize.

**Fresh-recipient note:** first-ever payouts to an address cost +54% more gas,
batched or not. If our fresh ratio is high (new-user cash-outs), the blended saving
is closer to 50%; if most recipients are existing holders, closer to 70%. Model flag:
`--fresh-ratio=0..1`.

**Latency tradeoff:** most of the win comes from batches of ~10+ (51%+ saved);
going from N=25 to N=200 only buys 3 more points. Recommended default:
**30s window / 100 max entries → typical batch ≈ 14 entries → 54% gas cut**, with an
instant tier (short window, still ≥ 42% saved) if the product needs sub-10s payouts.

**Contract behavior (implemented & tested):**
- Failed entries are isolated (try/catch): a blocklisted USDC address emits
  `TransferFailed(index, recipient, amount)` and the other 99 payouts still land.
  No whole-batch revert, no nonce deadlock. The off-chain retry loop re-queues
  only failed indices.
- `BatchExecuted(token, count, total, failedCount)` per batch for reconciliation;
  alert on `failedCount > 0`.
- Owner = relayer EOA, two-step ownership transfer, `setPaused` kill-switch,
  `withdraw`/`withdrawETH` for treasury ops. No external dependencies, 0.8.28,
  via-ir, ~$0.01 one-time deploy cost (389,958 gas).

## #3 Netting duplicate recipients

If customers cash out multiple times a day to the same address, sum the amounts
within the batch window (`netDuplicates: true` in the queue). Every netted entry
saves a full per-entry cost (~11.7k gas existing). At 5% duplicate volume: ~$616/yr
at lean prices. Data-dependent — check payout table for same-day repeat addresses.

## #4 RPC side-effects (free with #2)

Per-transfer pipeline: ~4 RPC calls per payout (estimate, send, receipt polls) =
~160k calls/day. Batched at N=14: ~17k calls/day, **−89%**. On metered RPC plans
this is often worth more than the gas savings. Nonce management also collapses
from 40k to ~2.8k txs/day.

## #5 (Product lever, not code here) — ETH payouts

A native ETH transfer is 21k gas (32k with account creation) vs 40–62k per ERC-20
entry. If any payout tier could settle in ETH instead of USDC, it's ~35–50% cheaper
than even the batched ERC-20 path. Requires product/finance signoff.

---

## What ships from this repo

```
src/BatchRelayer.sol          dispatcher contract (no deps, via-ir, 11 forge tests)
test/BatchRelayer.t.sol       correctness tests + gas-measurement harness
                              (writes relayer/gas-points.json)
script/Deploy.s.sol           forge script (deploy from the relayer EOA)
relayer/                      dependency-free TS client, drops into existing relayer:
  fees.ts                     tip clamp + spike defer policy
  encoder.ts                  ABI encoding for batchTransfer/withdraw/admin +
                              log parsers for TransferFailed/BatchExecuted
  batch-queue.ts              queueing, per-token grouping, netting, size/time flush
  flusher.ts                  wiring: due batches -> fee quote -> send (with
                              singleton fallback to direct transfer)
  gas-model.ts                measured constants + gas limit estimator
scripts/cost-model.ts         this document's numbers, re-runnable
```

Integration: implement the app's `RelayerSigner` interface (one method:
`sendTransaction`) and `BaseFeeSource` (base fee from the RPC's `eth_gasPrice`
minus tip, or `eth_feeHistory`), point the flusher at the deployed dispatcher,
and replace the per-transfer send call with `enqueue()`. Recommended settings:
`maxEntries: 100, maxWaitMs: 30000, netDuplicates: true`, fee policy defaults.
For USDC, wire `validatePayout` to an `isBlacklisted()` eth_call so blocklisted
addresses never enter a batch.

Run everything:

```bash
npm run build        # forge build
npm test             # forge test (11) + node --test (24)
npm run model        # regenerate every table above with live inputs
```

## Migration order & risks

1. **Day 0:** fee clamp in the existing pipeline (item #1 works without the contract).
2. **Day 1:** deploy BatchRelayer (~$0.01), fund with a day of USDC inventory,
   transfer ownership to the relayer EOA.
3. **Days 2–7:** cut over volume gradually (5% → 50% → 100%) via the flusher;
   index `BatchExecuted`/`TransferFailed` for reconciliation; alert on failedCount.
4. **Week 2:** turn on netting after measuring duplicate rate; retire the
   per-transfer code path.

Risks & mitigations:
- **Payout `from` address changes** (relayer EOA → dispatcher contract). Notify
  support; explorer links and customer-facing receipts must be updated. Events
  make reconciliation easier than EOA sends.
- **Pause key** = relayer EOA. If it's compromised, funds in the dispatcher are
  drainable — keep only ~1 day of payout inventory in the contract and sweep the
  rest (withdraw) to cold storage.
- **USDC blocklist** still reverts individual entries — isolated by try/catch,
  but pre-check `isBlacklisted` to keep batches clean.
- **Batch-too-large** txs simply fail estimation (no funds at risk); the queue
  caps at maxEntries anyway.
- **Not doing:** leaving Base (it's already the cheapest tier; DA is 1% of our
  cost), calldata micro-packing (saves ~$0.000002/entry — irrelevant post-blobs),
  deploying to L1 (10x more expensive for no benefit).

## Methodology (so the numbers are defensible)

Live measurements, 2026-09-23, blocks ~51,690,800–51,690,852:
- USDC transfer gasUsed from four receipts: 40,259/62,183 gas
  (e.g. tx `0x3763418e…`, `0xac5733a6…`; fresh-recipient ones pay the zero→nonzero
  SSTORE at 17,100 extra gas).
- L1 data fee: 2.87e9 wei per transfer (receipt `l1Fee`), $0.0000078 — 0.9% of
  cost at lean fees. Batched 100-entry calldata (6.5KB): $0.00023 total, measured
  via the GasPriceOracle predeploy `getL1Fee()`.
- Tip distribution: 471-tx block sample; base fee flat at 0.005 gwei over a
  1,025-block `eth_feeHistory` sample; ETH price from CoinGecko.
- Batch per-entry gas: forge harness with a USDC-pattern mock (paused + blacklist
  reads), cold storage reset between runs (`vm.cool`), slopes taken by differencing
  runs at N = 1…200 (perfectly linear; fresh−existing delta = 17,100 gas, exactly
  the SSTORE delta — see `relayer/gas-points.json`). Fixed per-batch overhead is
  stated conservatively (+2,500 cold-access allowance); the model slightly
  *overstates* batch costs, if anything.
- Sensitivity: all tables re-generate via `npm run model -- --fresh-ratio=… --tip-gwei=… --window-sec=…`.

Caveats: gas prices and ETH move — refresh before budgeting; fresh-recipient mix is
the biggest model uncertainty (50% assumed); measure the real ratio from payout
history (`--fresh-ratio`).
