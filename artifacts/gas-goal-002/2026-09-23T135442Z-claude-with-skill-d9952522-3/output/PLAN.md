# Base relayer gas: what we spend, and what to do about it

All figures measured on **2026-09-23**. Every number below is reproducible with
the scripts in this repo — none of them are from memory, and gas prices move,
so re-run `node script/cost-model.mjs` before quoting anything to Finance.

Measurement conditions at time of writing:

| Input | Value | Source |
|---|---|---|
| ETH/USD | $2,716 | Coinbase spot, cross-checked against Chainlink `0x5f4e…8419` ($2,713) |
| Base base fee | 5,000,000 wei (0.005 gwei) | `eth_getBlockByNumber`, p50 **and** p10 over 1,025 blocks |
| Base block utilisation | 14.8% p50, 26.9% max | `script/measure-fees.mjs` |
| L1 data fee, one transfer | ~4.2e9 wei | `GasPriceOracle.getL1FeeUpperBound` at `0x420…000F` |
| USDC transfer, existing recipient | 44,867 gas | real receipts on an anvil fork |
| USDC transfer, first-time recipient | 61,967 gas | real receipts on an anvil fork |

---

## Bottom line for Finance

**We spend roughly $11,600/year — about $32/day, or $0.0008 per transfer.**

That is the honest headline, and it should shape how much engineering we spend
chasing it. The full programme below removes ~69% of it, worth **~$8,000/year**.
This is a real saving but a small one; rank it against other work accordingly.

Two pieces of context worth putting in the same memo:

- **Being on Base is the win, and it already happened.** The same 40,000
  transfers/day on Ethereum mainnet would cost **~$673,000/year** at today's
  mainnet price of 0.378 gwei — 58x more. No optimisation below comes close to
  the decision we already made. There is no cost case for moving off Base.
- **The L1 data fee is only ~1.5% of the bill.** Post-Dencun blob pricing has
  made calldata almost free on Base. Any proposal that starts "we can compress
  the calldata" is optimising ~1.5% of the total and should be rejected on those
  grounds. The cost is L2 execution gas, essentially all of it.

---

## Where the money actually goes

Per transfer today, one transaction per payment:

```
  44,867 gas x 6,000,000 wei  = 269,202,000,000 wei   L2 execution   98.5%
                              +   4,200,000,000 wei   L1 data fee     1.5%
                              = 273,402,000,000 wei   = $0.00074
```

Two things stand out, and they are the whole plan:

1. **21,000 of those 44,867 gas — 47% — is the intrinsic cost of *being a
   transaction*,** paid once per payment and buying nothing. Batching is the
   only way to stop paying it 40,000 times a day.
2. **We volunteer a 1,000,000 wei tip on a 5,000,000 wei base fee — a 20%
   surcharge — and the tip buys us nothing.** In 30 out of 30 blocks sampled, a
   **zero-tip** transaction was included. Base blocks run at 15% of target;
   there is no auction to win.

---

## The plan, ranked by annual saving

| # | Change | Saves/yr | % of bill | Effort | Risk |
|---|---|---|---|---|---|
| 1 | Batch payments through `BatchPayer` (n=50) | **$7,302** | 62.7% | ~2 weeks + audit | Medium |
| 2 | Fix the EIP-1559 fee policy | **$1,911** | 16.4% | ~1 day | Low |
| 3 | Use `payUniform` for equal-amount runs | **$71** | 0.6% | hours | None |

Combined (1+2): **$3,630/yr, down from $11,642 — a 68.8% reduction.**

They are ranked by saving as requested, but **ship #2 first.** It is a
configuration change with no new on-chain surface, it banks 16% of the bill this
week, and it is a prerequisite for #1 paying out fully anyway.

---

### 1. Batch payments — $7,302/yr (62.7%)

Collapsing N payments into one transaction pays the 21,000 intrinsic gas once
per batch instead of once per payment. Measured on an anvil fork of Base against
real USDC, from actual transaction receipts:

| Batch size | Gas/payment | vs one-tx-each | Payout wait | Annual cost |
|---|---|---|---|---|
| 1 (today) | 44,867 | — | 0 | $11,642 |
| 10 | 18,151 | 59.5% cheaper | 0.4 min | $4,671 |
| 25 | 15,416 | 65.6% cheaper | 0.9 min | $3,890 |
| **50** | **14,505** | **67.7% cheaper** | **1.8 min** | **$3,630** |
| 100 | 14,065 | 68.7% cheaper | 3.6 min | $3,503 |
| 200 | 13,850 | 69.1% cheaper | 7.2 min | $3,441 |
| 400 | 13,754 | 69.3% cheaper | 14.4 min | $3,412 |

**Recommendation: batch size 50, flushed on a 2-minute timer.** The curve is
flat past 50 — going from 50 to 400 buys another $218/yr while adding 12 minutes
of delay to every payment. That is a bad trade for a payments product.

Note the batch must also flush on a timer, not only on reaching 50, or a quiet
period strands payments indefinitely.

Caveats that belong in the decision:

- **First-time recipients cost more and batching cannot fix it.** A payment to
  an address with no prior token balance carries a +17,100 gas zero-to-nonzero
  storage write. Batched, those cost 31,605 gas vs 14,505 — still a 49% saving,
  but they dominate the residual bill. The $7,302 assumes **20% of payments go
  to first-time recipients**; this is an assumption, not a measurement. Run
  `script/gas-audit.mjs` against the real relayer to replace it.
- **Batches are all-or-nothing.** One failed leg reverts the whole batch. This
  is deliberate — a half-applied payout run is far worse operationally than a
  retried one — but it means one blacklisted or frozen recipient stalls 49 good
  payments. The relayer needs to catch `TransferFailed(index)`, drop that
  recipient, and resubmit.
- **It introduces a standing approval.** The relayer grants `BatchPayer` an
  infinite USDC allowance. A bug in `BatchPayer` therefore reaches the relayer's
  whole balance. The contract is deliberately tiny and holds no funds, and
  `pay` always pulls from the immutable `owner` rather than from `msg.sender`,
  so a stolen relayer key cannot redirect a third party's approval — but this
  wants an audit before it carries production volume.
- **Latency.** Every payment now waits up to 2 minutes. If any product surface
  promises faster settlement, that surface needs a single-payment fast path,
  which should keep using the existing code.

### 2. Fix the EIP-1559 fee policy — $1,911/yr (16.4%)

We currently volunteer whatever `eth_maxPriorityFeePerGas` suggests, which on
Base is **1,000,000 wei** on top of a 5,000,000 wei base fee. That is a flat 20%
tax on every transaction, and it buys nothing: **30 of 30 blocks sampled
included a zero-tip transaction**, and blocks run at 15% utilisation.

The fix rests on a distinction that is easy to get backwards:

- `maxFeePerGas` is a **cap**, not a price. You pay `baseFee + tip` and the rest
  is refunded. Setting it generously costs *nothing* and protects against
  getting stuck.
- `maxPriorityFeePerGas` is **paid in full, every time**. It is the only fee
  field where a too-large number becomes spend.

So `src/relayer/fee-policy.mjs` sets the cap at **4x base fee** (absorbing ~12
consecutive full blocks) and the tip at a **1,000 wei floor** — a safety margin
over the measured requirement of zero, capped at 2,000,000 wei so a bad oracle
reading cannot turn into a 100x overpay across 40,000 daily transactions.

Do not port a mainnet tip constant here. Mainnet tips are measured in gwei;
Base needs roughly a millionth of that.

Two things to verify against the live relayer before banking this number, both
of which `script/gas-audit.mjs` reports directly:

- **Whether we are overpaying far worse than 20%.** In a sample of 36 real USDC
  transfers on Base, the worst paid **405,000,000 wei/gas — 81x the base fee**.
  If our relayer has a hardcoded tip or a mainnet-derived constant anywhere,
  the saving here is much larger than $1,911.
- **Whether we are paying for reverts.** Failed transactions burn gas and
  produce nothing. The audit reports this as its own line.

### 3. `payUniform` for equal-amount runs — $71/yr (0.6%)

Where every recipient in a batch gets the same amount, `payUniform` halves the
calldata and drops a bounds check per leg: 13,814 vs 14,029 gas/payment. It is
in the contract because it was nearly free to add. **It is a rounding error —
do not let it justify any restructuring of the payment pipeline.**

---

## Explicitly not worth doing

- **Compressing calldata.** It is ~1.5% of the bill. Batching already cuts the
  per-payment L1 fee by 53% as a side effect; there is nothing left to chase.
- **Moving off Base to a cheaper L2.** We spend $32/day. Even a chain with zero
  fees saves less than the engineering and custody cost of the migration.
- **Timing transactions for cheaper gas.** Base's base fee sat at exactly the
  5,000,000 wei floor for the p10 *and* p50 of 1,025 consecutive blocks. There
  is no cheap window to wait for, because there is no expensive window.
- **A custom minimal-gas token or a Permit2 flow.** We do not control the
  token — recipients expect USDC.

---

## What shipped in this repo

| Path | What it is |
|---|---|
| `src/BatchPayer.sol` | Batch payout contract. `pay` and `payUniform`, owner-only, all-or-nothing, tolerates no-return-data tokens. |
| `src/relayer/fee-policy.mjs` | Drop-in EIP-1559 fee derivation for the relayer, plus `bumpFees` for stuck transactions. |
| `script/gas-audit.mjs` | **Run this first.** Points at the real relayer address and reports actual spend: L2 vs L1 split, tip overpay, gas burned on reverts, annual run rate. |
| `script/measure-gas.mjs` | Reproduces the gas table above from real receipts on an anvil fork. |
| `script/measure-fees.mjs` | Re-derives the tip floor from live Base blocks. |
| `script/cost-model.mjs` | Recomputes this whole plan against live prices. |
| `test/BatchPayer.t.sol` | 8 tests: access control, all-or-nothing rollback, no-return-data tokens, funds-always-from-owner. |

### Running it

```bash
# 0. Dependencies (lib/ is not committed).
forge install foundry-rs/forge-std

# 1. What we actually spend — replace with the real relayer address.
#    Public RPCs prune; use a provider with history for a full month.
RPC_URL=<archive-rpc> node script/gas-audit.mjs 0xOurRelayer --blocks 43200

# 2. Re-price the plan against live gas and ETH.
node script/cost-model.mjs --transfers 40000 --first-time 0.20 --batch 50

# 3. Contract tests.
forge test

# 4. Reproduce the gas table (needs a Base fork).
anvil --fork-url https://mainnet.base.org --silent &
node script/measure-gas.mjs
```

## Suggested sequence

1. **This week.** Run `gas-audit.mjs` against the real relayer. It replaces the
   two assumptions this plan carries — the first-time-recipient share and the
   current tip — with measurements, and it may reveal the fee overpay is far
   worse than 20%.
2. **This week.** Ship `fee-policy.mjs`. One day of work, banks 16%, low risk.
   Watch inclusion latency for 48h; `MIN_TIP_WEI` is the dial if it regresses.
3. **Next sprint.** Integrate `BatchPayer` behind a flag at batch size 50 with a
   2-minute flush. Keep the single-payment path for anything latency-sensitive.
   Audit before it carries full volume.
4. **Ongoing.** Re-run `cost-model.mjs` quarterly. Base's fee floor and the L1
   blob market both move, and the ranking of these levers can move with them.
