# Relayer gas: what we spend, and what to do about it

**TL;DR** — We spend about **$33/day ($12,000/year)** relaying 40,000 ERC-20 payouts on Base.
Batching payouts into one transaction cuts that by **63%**, and dropping a priority fee that
buys us nothing cuts another **16%**. Together: **$12,028 → $3,665/year, a 69.5% reduction.**

The absolute number is small because Base is currently very cheap. The stronger argument for
doing this is insurance: Base's base fee spiked to **920x its floor** inside the last 29 days,
and at a sustained 20x the same workload costs **$200,000/year** unbatched versus $73,000
batched. Batching also takes us from 40,000 transactions a day to 160.

All gas figures below are measured, not estimated — see [Methodology](#methodology).

---

## 1. What we actually spend today

Priced at the live base fee (0.005 gwei) and ETH ($2,721), for 40,000 payouts/day:

| | Gas per payout | $/payout | $/day | $/year |
|---|---|---|---|---|
| Payout to an address that already holds the token | 44,843 | 0.000739 | | |
| Payout to an address that does not yet hold it | 61,943 | 0.001021 | | |
| **Blended at 70/30** | **49,973** | **0.000824** | **$32.95** | **$12,028** |

Two things worth knowing before reading the recommendations:

**The 17,100-gas new-recipient penalty.** Paying someone who already holds USDC rewrites a
non-zero storage slot (2,900 gas). Paying a brand-new holder writes a zero slot (20,000 gas).
That 17,100 difference is the single largest driver of per-payout cost variance, and it is
inherent to how ERC-20 works — no batching scheme removes it. It shows up identically in
every configuration we measured, batched or not.

**The L1 data fee is a rounding error.** On Base today the L1 fee is **about 1% of total cost**
(≈3.0e9 wei against ≈3.0e11 wei of L2 execution). The usual L2 advice — "compress your
calldata, the L1 data fee dominates" — is simply not true here post-Fjord at current blob
prices. Optimising for L1 bytes would be work spent on 1% of the bill. This is why calldata
packing ranks last below rather than first.

---

## 2. Ranked recommendations

Ranked by annual dollars saved. Percentages are against today's $12,028/year.

### 1. Batch payouts into one transaction — saves $7,632/year (63.5%)

Every transaction pays 21,000 gas before it does anything. At 40,000 transactions a day we
pay that 40,000 times. Batching pays it once per batch.

Measured cost per payout, real receipts against real Base USDC:

| Batch size | Existing recipient | New recipient | Blended 70/30 |
|---|---|---|---|
| 1 (today, direct transfer) | 44,843 | 61,943 | 49,973 |
| 2 | 35,848 | 52,948 | 40,978 |
| 5 | 22,190 | 39,290 | 27,320 |
| 10 | 17,640 | 34,740 | 22,770 |
| 25 | 14,908 | 32,009 | 20,038 |
| 50 | 14,000 | 31,100 | 19,130 |
| 100 | 13,548 | 30,648 | 18,678 |
| **250** | **13,286** | **30,386** | **18,416** |

Returns flatten hard after ~50. Going from 50 to 250 saves a further 3.7%, while putting 5x
more payouts behind a single point of failure. **We recommend 250** as a reasonable balance,
but 100 would be a defensible choice and 50 captures most of the win.

Two measured details that shaped the implementation:

- **A batch of 1 costs *more* than a direct transfer** (58,610 vs 44,843): the contract hop
  and the allowance write have nothing to amortise against. The crossover is at 2 payouts
  (35,848), so `run-payouts.mjs` falls back to plain transfers below that.
- **Base blocks are 400M gas** and a 250-payout batch is 3.3M–7.6M (depending on how many
  recipients are new), so block space is nowhere near the binding constraint. Batch size is
  a risk decision, not a capacity one.

**Status: implemented.** `src/BatchTransfer.sol` plus the relayer path in `relayer/`.

### 2. Stop paying a priority fee — saves $1,985/year (16.5%) on its own

Sampled transfers on Base pay ~0.001 gwei on top of a 0.005 gwei base fee: a **20% surcharge**.
Measured over 150 blocks and 30,337 transactions:

- Blocks run **8.7% full** at the median; the fullest block in the sample was **26.7%**
- **9.0% of transactions are included with a zero priority fee**

We are bidding for space in blocks that are 91% empty. `relayer/fees.mjs` therefore defaults
the tip to zero and escalates only when blocks actually fill (40% → 0.001, 70% → 0.01,
90% → 0.1 gwei), so we still have a path through genuine congestion.

Applied *after* batching this is worth $732/year rather than $1,985 — it is a percentage of a
smaller bill. It is still the single cheapest change to make: one config value.

**Status: implemented.** `relayer/fees.mjs`.

### 3. Packed calldata — saves $92/year (2.5% of the batched bill)

Encoding each payout as one 32-byte word (20-byte address + 12-byte uint96 amount) instead of
two 32-byte ABI words halves the per-payout calldata. Measured at 250: 13,286 vs 13,734 gas
for an existing recipient.

Small, but it is free once the contract exists — same code path, denser encoding. Worth taking
*because* we are already building the batcher, not worth building anything for on its own.

The encoder rejects any amount that would overflow uint96 rather than truncating it, since a
truncated amount would corrupt the neighbouring recipient address. Oversized payouts route to
the unpacked entrypoint.

**Status: implemented.** `relayer/encode.mjs`, `batchTransferPacked` in the contract.

### 4. Worth considering, but needs your data: net payouts before settling

Everything above makes each payout cheaper. The only way to do fundamentally better is to have
fewer payouts. If a meaningful share of the 40,000 daily transfers are repeat payouts to the
same recipients within a settlement window, netting them off-chain and settling once per
recipient per window would cut cost roughly in proportion to the collapse in transfer count —
potentially larger than everything above combined.

We cannot size this without payout data we do not have. **What we would need:** a day of payout
records with recipient and timestamp, to measure the repeat rate per window. If 40,000 transfers
resolve to 10,000 distinct recipient-days, this is a 75% reduction stacked on top of batching.

This changes payment semantics (recipients see one settlement instead of several), so it is a
product decision, not just an engineering one. Flagging it rather than recommending it.

---

## 3. Things we checked and are NOT recommending

Closing these off so nobody spends a sprint on them:

- **Compressing calldata beyond the packed layout.** The L1 data fee is ~1% of the bill.
  Even eliminating it entirely would save ~$120/year today.
- **Scheduling payouts for off-peak hours.** There is no off-peak to exploit: the base fee sits
  at its 0.005 gwei floor in **95.3% of blocks** sampled over 29 days. There is no cheaper hour
  to wait for.
- **A finite allowance to limit exposure.** Base USDC decrements the allowance on every
  `transferFrom` even when it is set to max — it has no infinite-approval shortcut (verified
  against the live contract). A finite allowance would need periodic top-up transactions and
  would save no gas. Exposure is instead bounded by the contract's design: it can only ever
  move the caller's own tokens (see below).
- **Gas tokens / refund tricks.** Removed from the EVM years ago (EIP-3529). Not available.

---

## 4. Risks introduced by batching, and how they are handled

Batching couples payouts that used to be independent. This is the real cost of the change and
it deserves to be stated plainly.

| Risk | Mitigation |
|---|---|
| One bad recipient (e.g. USDC-blacklisted) reverts all 250 payouts | Every batch is simulated with `eth_call` first. The contract reverts with `TransferFailed(index)` naming the offender; the relayer quarantines it and retries the rest. A batch is only broadcast after it simulates clean. |
| Quarantined payouts silently disappear | They are returned from `runPayoutCycle` for alerting, never dropped. Amounts too large for the packed layout are quarantined the same way rather than truncated. |
| The contract holds a max allowance from the relayer | Every transfer is `transferFrom(msg.sender, ...)` — `from` is never a caller-supplied parameter. An attacker calling the contract can only spend their own tokens. Covered by `test_AttackerCannotSpendRelayerAllowance`. |
| Funds stuck in the contract | It never takes custody; tokens move relayer → recipient directly. Covered by `test_ContractNeverHoldsCustody`. |
| A batch fails and delays 250 payouts | Failure is detected in simulation, before broadcast. Keep batch size at 250 or lower; the gas curve is nearly flat past 50, so shrinking batches costs little if we want a smaller blast radius. |

The contract is ownerless and immutable — no admin key, no pause, nothing to compromise.
Fee-on-transfer and rebasing tokens are explicitly out of scope.

---

## 5. Sensitivity — why this is worth doing at $12k/year

Base is cheap right now and the base fee is pinned to its floor 95% of the time. But over the
last 29 days it reached **4.6 gwei — 920x the floor**. Batching is what keeps a spike from
being expensive:

| Base fee | Today's method | Batched + zero tip | Avoided |
|---|---|---|---|
| 0.005 gwei (floor, 95% of the time) | $12,028/yr | $3,665/yr | $8,364 |
| 0.025 gwei (5x) | $51,728/yr | $18,295/yr | $33,434 |
| 0.10 gwei (20x) | $200,603/yr | $73,158/yr | $127,445 |
| 0.30 gwei (60x) | $597,602/yr | $219,460/yr | $378,143 |

Also worth weighing, though it is not a gas saving: batching takes the relayer from 40,000
transactions a day to 160. That is materially less nonce contention, RPC load, and monitoring
surface.

---

## 6. Rollout

1. Deploy `BatchTransfer` (ownerless, immutable). Relayer approves it once for max.
2. Ship the zero-tip fee policy first — it is a config change, independent of the contract,
   and immediately worth 16.5%.
3. Route a small share of payouts through `runPayoutCycle` at batch size 25–50 and confirm
   receipts match the table above.
4. Raise to 250 once the quarantine path has been exercised in production.
5. Re-run `node analysis/cost-model.mjs` monthly for finance; it re-prices from live chain data.

---

## Methodology

Gas is measured from **real transaction receipts on a mainnet fork**, against the real Base
USDC contract — not from `forge test`. Foundry meters a top-level call as a pseudo-transaction
and reports ~21,700 gas for a no-op, which silently inflates anything timed with `gasleft()`;
an early version of this analysis overstated the baseline by ~50% for exactly that reason.

The receipt-based baseline reproduces mainnet closely, which is what makes the batched
comparison trustworthy:

| | Measured on fork | Observed on Base mainnet |
|---|---|---|
| Existing recipient | 44,843 | 45,059 (median of 70 real transfers) |
| New recipient | 61,943 | 62,171 (p90 of the same sample) |
| — | — | 45,451 (`eth_estimateGas`, live) |

The baseline reproduced to the gas across three independent fork runs, including one where
recipient balances were seeded as state rather than by prefunding transfers.

**Assumptions you should sanity-check** (all are parameters, not hardcoded):

- **40,000 payouts/day** — from your brief.
- **70/30 existing/new recipient mix** — *inferred* from the bimodal gas distribution of real
  Base USDC transfers, not from your data. Override with `--new-recipient-share`. This matters:
  at a 50/50 mix the blended baseline rises to 53,393 gas.
- **0.001 gwei current tip** — *inferred* from the median tip on Base and from sampled transfers
  paying 0.006 gwei against a 0.005 gwei base fee. **Please confirm your relayer's actual
  setting**; if it already tips zero, recommendation 2 is already done and the total saving is
  63% rather than 69.5%.

Reproduce everything with the commands in [README.md](./README.md).
