# Gas spend on Base — what it costs and what to do about it

**Scope:** ~40,000 ERC-20 transfers/day from a single relayer wallet on Base (chain 8453).

Every gas number below was measured, not estimated. Execution gas comes from real
transactions sent against an anvil fork of Base at block 51,688,915 using live
USDC (`0x8335…2913`); L1 data fees come from Base's own `GasPriceOracle`
predeploy; fee and tip distributions come from 1,025 and 60 consecutive live
blocks respectively. Reproduce any of it with the scripts in `script/`.

**Measured at:** 2026-09-23, block 51,689,206. ETH $2,722. L2 base fee 0.005 gwei.

---

## The headline for finance

At today's prices, 40,000 ERC-20 transfers a day on Base costs
**roughly $12,000/year** — about **$0.0009 per transfer** — *if the relayer is
already sanely configured*.

That "if" is the whole report. The cost of a transfer on Base is
`gasUsed × (baseFee + tip) + L1 data fee`. The base fee is fixed by the network
at 0.005 gwei and the L1 data fee is about 1.5% of the bill. **The tip is the
only number we choose, and it scales the bill linearly.** A relayer carrying a
1 gwei priority fee — the ordinary default in Ethereum-mainnet-era code and
still what several popular libraries fall back to — pays **$2.14M/year for the
identical work**.

So the first action is not an optimisation. It is a measurement.

| Scenario, 40k transfers/day | $/transfer | $/year |
|---|---|---|
| Relayer carrying a 1 gwei tip | $0.1467 | **$2,141,000** |
| Relayer chasing the p90 tip on Base (0.03 gwei) | $0.0051 | **$74,700** |
| Relayer at the tip Base's node suggests (0.001 gwei) | $0.00089 | **$12,970** |
| Tuned fee policy (0.0005 gwei tip) | $0.00082 | **$11,900** |
| Tuned fee policy + batching | $0.00032 | **$4,700** |

Assumes 50% of transfers go to a recipient with no prior balance; see
[Sensitivity](#sensitivity) for the range.

---

## Step 0 — Measure what we actually pay (do this first)

Nothing below can be ranked until we know which row of that table we are on, and
the spread between rows is 450x.

```bash
RELAYER=0x<relayer> BASE_RPC_URL=<paid-rpc> npm run audit -- --hours 24
```

`script/relayer-audit.mjs` reads every transaction the relayer sent in a window
and reports, straight from receipts: total spend split into L2 execution and L1
data, average gas per transaction, **average tip actually paid**, and how much
was burned on transactions that reverted. Extrapolates to a daily and annual
figure for finance.

Use an RPC you pay for. It prefers `eth_getBlockReceipts` (two calls per block)
and falls back to per-transaction receipts; the public endpoint rate-limits
either way at this volume.

**The number to read first is `avgTipGwei`.** Everything else is secondary.

---

## Ranked actions

### 1. Fix the priority fee — saves up to $2,129,000/year

*Conditional on what the audit finds. If `avgTipGwei` is already ≤0.001, this
saves ~$1,000/year and you should skip to action 2.*

**What we measured.** Over 1,025 consecutive Base blocks the base fee was at the
protocol floor of **0.005 gwei for 97.5% of blocks**; the 99th percentile was
0.005012 gwei and the maximum was 0.005079. Base does not have gas spikes in any
sense that matters to us. Over 16,699 live transactions, 6.8% landed with a
**zero** tip, 27.4% below 0.001 gwei, and 79.8% below 0.01 gwei. The median tip
paid was 0.001 gwei, which is exactly what Base's own node returns from
`eth_maxPriorityFeePerGas`.

**The trap.** On EIP-1559 you pay `baseFee + tip`; you never pay `maxFeePerGas`.
Headroom in `maxFeePerGas` is free insurance. The tip is the only part that costs
money. Most relayers are tuned exactly backwards — a tight `maxFeePerGas` that
strands transactions during a wobble, and a fat tip inherited from mainnet that
bills on every single send. `test/feePolicy.test.mjs` asserts this directly:
raising `maxFeePerGas` 80x produces an identical bill.

**Shipped:** `src/feePolicy.mjs`.

- Opening tip **0.0005 gwei** — half Base's suggestion, still clear of the ~7% of
  traffic that lands on zero.
- `maxFeePerGas = baseFee × 12 + tip`, floored at 0.1 gwei. Costs nothing,
  removes stuck-transaction risk entirely.
- Escalation ladder 0.0005 → 0.0015 → 0.0045 → 0.0135 → 0.0405 → 0.1 gwei,
  capped. Each rung clears the 10% replacement threshold nodes enforce (tested).
  Inclusion is bought by the *ladder*, not by the opening bid.
- Circuit breaker at 2 gwei base fee (400x the floor): a payments queue should
  wait a minute rather than pay that.

**Risk:** a lower opening tip means slightly more replacements. At 0.005 gwei
base fee and 2-second blocks with blocks running ~14% full (55M of a 400M gas
limit), inclusion is not contended. The ladder covers the tail; the circuit
breaker covers the pathological case.

### 2. Batch transfers — saves ~$7,100/year (60% of the remaining bill)

**What we measured**, cold recipients, real USDC, per transfer:

| Batch size | L2 gas/transfer | L1 fee/transfer (gwei) | vs. single |
|---|---|---|---|
| 1 per tx (today) | 62,159 | 4.756 | — |
| 10 | 34,702 | 1.255 | −44% |
| 25 | 31,846 | 0.904 | −49% |
| 50 | 30,895 | 0.789 | −50% |
| 100 | 30,422 | 0.748 | −51% |
| 200 (packed) | 29,896 | 0.682 | −52% |

The saving is the 21,000 gas intrinsic cost of a transaction plus the repeated
2,600 gas cold-account access, amortised across the batch. **It is essentially
complete at 25 and flat past 100** — there is no reason to build huge batches.

**Shipped:** `src/BatchTransfer.sol` (2,160 bytes deployed, 12 tests) and
`src/sender.mjs` (a queue that flushes on size or a latency deadline, 7 tests).

- `disperse(token, recipients[], amounts[])` and `dispersePacked(token, entries[])`,
  which packs each `(address, uint96 amount)` into one word.
- `onlyOwner`, so the token approval granted to it cannot be drained by anyone else.
- Tolerates tokens that return nothing from `transferFrom` (USDT-style).
- **Reverts the entire batch if any single transfer fails**, so a batch can never
  settle partially.

**Costs, honestly:**
- **Latency.** This is what we are trading for the saving. At 40k/day (~28/min), a
  100-transfer batch takes ~3.5 minutes to fill. Set `maxWaitMs` to the longest
  delay the product tolerates and let `batchSize` be whatever fills in that
  window — at 25 you already have 49% of the 52% available.
- **Blast radius.** One reverted batch fails 100 payments at once. The all-or-
  nothing revert makes this safe to reconcile, but retry and alerting need to
  handle it.
- **Approval.** The relayer must approve `BatchTransfer` for the token. That is a
  standing approval on a contract holding relayer funds — hence `onlyOwner` and
  the ownership tests.
- One-off deployment, ~$0.01.

### 3. Packed calldata — saves ~$120/year

`dispersePacked` halves calldata (6,500 vs 12,964 bytes at n=200) and is ~1.7%
cheaper per transfer. **Not worth a project on its own**; it is already written
and `src/sender.mjs` uses it by default. Note the 96-bit amount ceiling —
7.9 × 10²⁸, ample for a 6-decimal stablecoin; `packEntry` throws rather than
truncating, and `disperse` is there for tokens that need the full width.

### 4. Eliminate reverted transactions — saves 100% of whatever we currently waste

A reverted transaction pays full L2 execution and full L1 data and delivers
nothing. The audit reports `wastedOnRevertsUsd` directly. For calibration, one
real high-volume Base sender we scanned while validating the script had a **100%
revert rate**, burning ~$99,000/year for zero settled transfers. We have no
reason to think ours is anything like that, but it is a line item worth knowing
rather than assuming.

Once batched, this matters more, not less: one revert now wastes a whole batch.
Simulate with `eth_call` before sending and drop the offending transfer.

---

## Not worth doing

- **Waiting for cheaper gas.** There is no cheap hour. The base fee was at its
  floor in 97.5% of 1,025 consecutive blocks, and the p99 was 0.2% above the
  minimum. Any scheduling logic is complexity for zero saving.
- **Calldata compression as a standalone project.** The L1 data fee is **1.5% of
  the bill** for single transfers and **0.6%** when batched. Post-4844 blobs
  moved the cost centre to L2 execution; advice written before that gets this
  backwards. Halving calldata saves less than 1%.
- **Micro-tuning gas limits.** Unused gas is refunded. A generous limit costs
  nothing and prevents out-of-gas failures, which cost everything.
- **Moving off Base.** At $0.0003–0.0009 a transfer, the migration cost exceeds
  any conceivable saving. Base is the right chain for this workload.

---

## Sensitivity

The largest thing we do not control is whether a recipient already holds the
token: that balance write costs 20,000 gas when it goes from zero and 2,900 when
it does not — a 17,100 gas swing, which is 28% of a single transfer.

| New-recipient share | Tuned singles | Tuned + batched |
|---|---|---|
| 0% (all repeat) | $10,040/yr | $2,820/yr |
| 25% | $10,970/yr | $3,760/yr |
| 50% | $11,910/yr | $4,690/yr |
| 75% | $12,840/yr | $5,630/yr |
| 100% (all new) | $13,780/yr | $6,560/yr |

`npm run model -- --cold-share 0.3 --transfers-per-day 60000` to re-run against
our real mix once the audit reports it.

ETH price scales everything linearly. At ETH $10,000 the tuned+batched figure is
~$17,000/yr; the ranking of every action is unchanged.

---

## Suggested sequence

1. Run the audit. Take the `avgTipGwei` number to the next finance conversation —
   it decides whether this is a $2M problem or a $12k one.
2. Ship `src/feePolicy.mjs` into the relayer's send path. Small, reversible,
   and where nearly all the risk-adjusted saving is.
3. Deploy `BatchTransfer`, approve it, and route through `src/sender.mjs` with a
   `maxWaitMs` the product team signs off on. Start at `batchSize: 25`.
4. Add pre-send `eth_call` simulation to kill reverts.
5. Re-run the audit after a week and compare.

---

## Reproducing the measurements

```bash
npm run setup                                   # npm deps + forge-std
npm test                                        # 12 Solidity + 17 JS tests

anvil --fork-url https://mainnet.base.org --silent &
npm run bench                                   # -> script/bench-results.json
npm run survey                                  # -> script/network-survey.json
npm run model                                   # the cost table above

RELAYER=0x... BASE_RPC_URL=<paid-rpc> npm run audit -- --hours 24
```

| File | What it is |
|---|---|
| `src/feePolicy.mjs` | Fee policy and escalation ladder. **Action 1.** |
| `src/BatchTransfer.sol` | Batch dispersal contract. **Action 2.** |
| `src/sender.mjs` | Batching queue that uses both. **Action 2.** |
| `script/relayer-audit.mjs` | Actual spend from chain. **Step 0.** |
| `script/bench.mjs` | Gas measurements against a Base fork. |
| `script/network-survey.mjs` | Base fee and tip distributions. |
| `script/cost-model.mjs` | Measurements → annual cost, ranked. |

Numbers drift. The base fee floor, the L1/L2 cost split and the batching curve
are structural and stable; ETH price and our own volume are not. Re-run
`npm run survey && npm run model` before quoting these figures more than a month
from now.
