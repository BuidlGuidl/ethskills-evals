# Base gas spend: what we pay, and what to do about it

**Measured 2026-09-23 13:03 UTC.** Every figure below is derived from live Base state
and real on-chain receipts, not from priors. Gas price and ETH/USD both move — re-run
`node tools/measure-base.mjs` before quoting any of these numbers to Finance.

Conditions at time of measurement:

| Input | Value | Source |
|---|---|---|
| ETH/USD | $2,717.16 | Chainlink `ETH/USD` mainnet feed |
| Base base fee | 0.005000 gwei | `eth_getBlockByNumber(latest).baseFeePerGas` |
| Base suggested gas price | 0.006000 gwei | `cast gas-price` (base fee + suggested tip) |
| Median USDC `transfer()` gasUsed | 45,059 | 33 successful receipts sampled across 12 blocks |
| Median L1 data fee | 3.097e-9 ETH (~$0.0000084) | `l1Fee` on those receipts |

---

## Headline for Finance

**At 40,000 transfers/day we are spending on the order of $30/day — about $10,800/year —
*if* the relayer sets its fees correctly.**

Per payout that is **$0.00074**. Gas is not a material line item for this business at
current Base prices. The single largest financial risk here is not the chain's price;
it is our own relayer bidding more than it needs to. That is item 1 below, and it is
worth up to ~180x the entire rest of the plan.

For scale: the identical workload on Ethereum mainnet, priced at mainnet's *current*
0.281 gwei, would be **~$502,000/year**. Staying on Base is worth ~$491k/year and
nothing in this plan should be read as a reason to revisit that.

---

## Ranked actions

Savings are annual, at 40,000 payouts/day, holding today's prices.

| # | Action | Annual saving | Effort | Status |
|---|---|---|---|---|
| 1 | Derive EIP-1559 fee fields from the chain per transaction | **$0 – $1,785,000** (see below) | Low | Code shipped |
| 2 | Batch payouts 50–100 per transaction | **~$6,400** (59%) | Medium | Contract + client shipped |
| 3 | Compress calldata / reduce L1 data fee | **≤ $123** | Medium | **Do not do this** |
| 4 | Move off Base | **−$491,000** (a cost) | High | **Do not do this** |

---

### 1. Derive EIP-1559 fee fields from the chain, per transaction

**Saving: between $0 and $1.79M/year. We cannot tell which without auditing the relayer —
do this first.**

This is the one number in the plan I could not measure for you, because I do not have
the relayer's address. It is also, by a wide margin, the one that matters most.

Base's base fee is **0.005 gwei**. A priority fee that is reasonable on Ethereum mainnet
is catastrophic here, because it is not a small adjustment to the price — it *is* the
price, several hundred times over. Sampling live Base traffic, the median sender pays
1.20x the base fee, but the worst sender in a 33-transaction sample paid **10x**, and in
an earlier 45-transaction sample, **81x**. Those senders are almost certainly carrying a
hardcoded mainnet constant.

What a hardcoded tip would cost us at our volume:

| Relayer's priority fee | Effective gas price | Annual spend | Overpayment vs. correct |
|---|---|---|---|
| Derived from chain (correct) | 0.006 gwei | $10,848 | — |
| 0.1 gwei | 0.105 gwei | $187,812 | **$176,964** |
| 0.5 gwei | 0.505 gwei | $902,818 | **$891,970** |
| 1 gwei ("safe default" on mainnet) | 1.005 gwei | $1,796,575 | **$1,785,727** |
| 2 gwei | 2.005 gwei | $3,584,090 | **$3,573,242** |

Even the mild case — paying the p90 tip we observed on-chain (3.22x base fee) — costs
$28,902/year against $10,848, so **$18,054/year for nothing**.

**Do this first:**

```bash
BASESCAN_API_KEY=... node tools/audit-relayer.mjs --address 0xOurRelayer --days 7
```

It reports the relayer's actual `effectiveGasPrice ÷ baseFeePerGas` and converts the gap
straight into dollars. If the median is near 1.1x, item 1 is already solved and our real
spend is ~$10,800/year. If it is 20x, we are burning ~$200k/year on a one-line bug.

**The fix** is `relayer/fees.mjs`. It reads the base fee and suggested tip from Base
immediately before submission, clamps the tip into a sane band, and refuses to bid above
an absolute ceiling:

```js
import { suggestFees } from './relayer/fees.mjs';
const { maxFeePerGas, maxPriorityFeePerGas } = await suggestFees(rpc);
```

Against live Base right now it produces `maxPriorityFeePerGas = 0.001 gwei`,
`maxFeePerGas = 0.011 gwei` (2x base fee of headroom, which covers ~6 blocks of base-fee
growth). The ceiling is the important part: if a bad RPC response or a bad config ever
suggests a mainnet-sized tip, the module caps it rather than paying it. `bumpFees()`
handles stuck-transaction replacement at the EIP-1559-mandated +10% on both fields.

Nothing here is hardcoded except the safety limits, and those are deliberately
Base-specific and commented as such. **Do not port them to another chain.**

---

### 2. Batch payouts, 50–100 per transaction

**Saving: ~$6,400/year (59% of the remaining bill), taking $10,848 → ~$4,456.**

Every standalone transfer pays the 21,000 gas intrinsic cost and a fresh set of cold
storage reads. Batching pays those once per batch instead of once per payout.

Measured on a **forked Base mainnet** against real USDC (`test/BatchTransfer.t.sol`).
The headline figures are *marginal* gas — the cost of one more recipient, taken as
(100-payout batch − 50-payout batch) ÷ 50. Differencing cancels the fixed overhead the
test harness adds, so these are directly comparable to on-chain receipts:

| Path | Marginal gas, new payee | Marginal gas, repeat payee |
|---|---|---|
| Standalone `transfer()` (on-chain median) | ~65,000 | **45,059** |
| `disperseFrom` (pure pull) | 30,073 | 12,976 |
| `disperse` (array args) | 29,137 | 12,042 |
| **`dispersePacked`** (recommended) | **29,001** | **11,904** |

A repeat payee costs **11,904 gas in a batch versus 45,059 standalone — a 74% reduction.**
A first-time payee still pays the unavoidable 20,000 gas cold `SSTORE` to create their
balance slot, so the saving there is ~33%.

Cost per payout at today's prices:

| Scenario | Gas/payout | $/payout | $/day | $/year |
|---|---|---|---|---|
| Today, standalone | 45,059 | $0.000743 | $29.72 | $10,848 |
| Batch of 50, repeat payees | 13,420 | $0.000222 | $8.86 | $3,235 |
| Batch of 50, new payees | 30,517 | $0.000500 | $20.01 | $7,305 |
| **Batch of 50, blended 70/30** | 18,549 | $0.000305 | $12.21 | **$4,456** |

The 70/30 blend is an assumption — I do not know our repeat-payee rate. Swap in the real
figure; the two endpoints above bracket the answer, so the saving is somewhere between
$3,543 and $7,613/year regardless.

**Shipped:**

- `src/BatchTransfer.sol` — owner-only disperser with three entry points.
  `dispersePacked` is the cheapest: one word per payout (address in the high 160 bits,
  amount in the low 96), one `transferFrom` for the batch total, then one `transfer` per
  recipient. It handles both bool-returning and void-returning ERC-20s and leaves no
  residual balance (asserted in tests).
- `relayer/batch.mjs` — `planBatches()` groups pending payouts under a gas/size cap,
  `encodeDispersePacked()` builds the calldata (selector verified against `cast sig`).

**Operational caveats, which matter more than the $6,400:**

- **A batch is all-or-nothing.** One reverting recipient fails the whole batch. USDC
  enforces a blocklist, so a single sanctioned or blocked payee takes down 49 good
  payouts with it. Simulate each batch with `eth_call` before sending, and on revert fall
  back to individual sends to isolate the bad entry. Budget for this — it is the real
  cost of item 2.
- **Batch size is capped by blast radius, not by gas.** Cost per payout keeps falling as
  batches grow, and a 100-payout batch is ~2.1M gas against a Base block limit far above
  that. Keep batches at 50–100 anyway so a retry is cheap. At 50, the fixed overhead is
  already amortised to under 1,600 gas per payout — going bigger buys very little.
- The contract holds funds only for the duration of one transaction and is owner-gated,
  but it is new code in the payment path. **It needs an audit before it handles real
  volume**, and that audit will cost more than the $6,400/year it saves. Ship it for the
  latency and nonce-contention benefits — one transaction instead of fifty also means far
  less relayer nonce management — and treat the gas saving as a secondary benefit.

---

### 3. Do not compress calldata or optimise the L1 data fee

**Maximum possible saving: $123/year. Not worth engineering time.**

This is the intuition most teams get wrong on an OP-stack chain, so it is worth stating
explicitly with the measurement behind it.

I checked the split on real Base receipts:

```
avg L2 execution fee:  4.17e-7 ETH
avg L1 data fee:       3.10e-9 ETH
L1 share of total:     1.13%
```

**Execution gas is 98.9% of what we pay.** The entire L1 data fee across 40,000
transfers/day for a year is $123. Even eliminating it completely — which is impossible —
would not fund an afternoon of work. Post-Dencun blob pricing has made calldata on
OP-stack chains effectively free; any advice to pack calldata to save L2 money is
pre-Dencun advice.

The packed encoding in `dispersePacked` is in there anyway, because it happened to be
free to write — but what it actually buys is *L2* calldata gas, not L1 fee. Measured, it
saves **136 gas per recipient** over the array-argument `disperse` (29,137 → 29,001),
worth about $30/year. That is already counted in item 2's numbers. It is a rounding
error, and it is the correct size for this kind of optimisation on Base.

---

### 4. Do not move off Base

Base at 0.006 gwei costs **$0.000743** per transfer. Ethereum mainnet, measured at its
current 0.281 gwei, costs **$0.034379** per transfer — **46x more**, or ~$502,000/year at
our volume. For 40,000 low-value, high-frequency payouts a day, Base is the correct
venue and this is not close.

I am not recommending a cheaper L2. The spend is ~$10,800/year; a migration would cost
more than a decade of gas, and would re-open bridging, liquidity, and custody questions
for no financial return.

---

## What to do, in order

1. **Audit the relayer** (`tools/audit-relayer.mjs`). This determines whether our real
   spend is $10,800/year or $200,000+/year. Everything else is noise until this is known.
2. **Ship `relayer/fees.mjs`** into the send path regardless of what the audit says. It
   costs nothing and it caps the downside permanently.
3. **Check the reverted-transaction rate** — the audit tool reports it. Reverted
   transactions pay full gas and buy nothing; at our volume a 2% revert rate is ~$220/year,
   but it is also a signal that something upstream is wrong.
4. **Then** decide on batching, weighing ~$6,400/year against an audit of new contract
   code in the payment path. The latency and nonce-contention wins are a better argument
   for it than the gas saving is.
5. Re-run `tools/measure-base.mjs` quarterly, or whenever ETH moves sharply. Every number
   in this document is a function of two inputs that change.

---

## Reproducing everything here

```bash
# Live chain conditions + the cost model (re-run before quoting any figure)
node tools/measure-base.mjs --transfers-per-day 40000

# What our relayer actually paid
BASESCAN_API_KEY=... node tools/audit-relayer.mjs --address 0xOurRelayer --days 7

# Batching gas measurements, on a fork of real Base with real USDC
forge test --fork-url https://mainnet.base.org -vv
```

Fork tests are pinned to Base block 51,689,400 in `foundry.toml` for reproducibility;
bump it when re-measuring.
