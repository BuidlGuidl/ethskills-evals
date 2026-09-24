# Base gas spend: what it costs, and what to do about it

All figures below were measured on 2026-09-23, not estimated from priors.
Sources: live Base receipts, a forked-Base benchmark that sends real
transactions, the Base `GasPriceOracle`, and the Chainlink ETH/USD feed.
Re-run `npm run report` to regenerate everything against current prices.

Measurement conditions: Base base fee **0.005 gwei** (its floor), our relayer's
effective gas price **0.006 gwei**, ETH **$2,730.38**.

---

## 1. What we actually spend

**≈ $33 / day, ≈ $12,000 / year** at 40,000 transfers/day.

Per transfer: **$0.000823**, made up of

| component | share |
|---|---|
| L2 execution gas (49,675 gas × 0.006 gwei) | 98.9% |
| L1 data fee (3.4e9 wei, from `GasPriceOracle.getL1Fee`) | 1.1% |

**The single most important number here is that 1.1%.** The usual L2 advice is
to shrink calldata. On Base today that is worth almost nothing — post-Dencun
blob pricing has made the L1 data fee a rounding error, and essentially all of
our cost is L2 execution gas. Any plan that starts with calldata compression is
optimising the wrong 1%.

Measured gas per transfer is bimodal, because the recipient's balance slot
dominates:

| case | gas | share of our traffic |
|---|---|---|
| repeat payee (non-zero balance slot) | 45,057 | 73% |
| first-ever payout to an address (zero → non-zero SSTORE, +19.2k) | 62,159 | 27% |

Both figures reproduce live Base receipts almost exactly (observed median
45,059, max 62,183), so the model is sound. The 73/27 split is from a live
sample of USDC transfers network-wide — substitute our own ledger's split and
re-run; the conclusions do not change.

### Should we be on Base at all?

Yes, and it isn't close. The same 40,000/day on Ethereum mainnet, priced live
at 0.3415 gwei and 45,528 gas, is **$0.0424/transfer → $620,000/year**, about
**52× more**. Note mainnet gas is currently *cheap* by historical standards and
Base is still 52× better. No action needed; recorded so Finance has the number.

---

## 2. Ranked actions

| # | change | saves/yr | effort | ship? |
|---|---|---|---|---|
| A | Batch 100 transfers per transaction | **$8,190** (68%) | contract + custody review | yes, if volume grows |
| B | Stop overpaying the priority fee | **$1,980** (16%) | config change | **ship now** |
| — | A + B together | **$8,822** (73%) | | |
| C | Compress calldata | ~$100 | — | already folded into A; not worth doing alone |

### B. Stop overpaying the priority fee — ship this first

We pay a **0.001 gwei tip on a 0.005 gwei base fee**: one sixth of every
transaction's cost buys priority we do not need for a payments flow.

Measured on live Base: the base fee sat at its **0.005 gwei floor in every
block sampled across 24 hours** — the chain is nowhere near capacity. In our
sample of 1,724 user transactions, **9.3% landed paying a zero tip** and 59%
paid ≤ 0.001 gwei.

Dropping to a nominal tip saves **16% of the entire bill for a config change**.
This is the best effort-to-saving ratio available and it carries no custody or
contract risk.

Implemented in `relayer/fees.ts`: a flat 0.0001 gwei tip, `maxFeePerGas` derived
from the live base fee (4× headroom, which is free — you are only charged the
base fee that actually applies), and an absolute cap so a spike cannot drain the
relayer. Fees are read from the chain immediately before submission; nothing is
hardcoded.

### A. Batch transfers — the real saving, but it has a cost

Per-transfer gas, measured by sending real transactions on a Base fork and
reading `gasUsed` off receipts:

| batch size | warm recipient | cold recipient |
|---|---|---|
| 1 (today) | 45,057 | 62,159 |
| 10 | 14,839 | 31,940 |
| 50 | 11,657 | 28,758 |
| **100** | **11,258** | **28,358** |
| 200 | 11,060 | 28,160 |
| 400 | 10,961 | 28,061 |

Batching saves a **flat ~33,800 gas per transfer** in both the warm and cold
cases. That is not a coincidence: the saving is entirely amortisation of fixed
per-transaction overhead — the 21,000 gas intrinsic cost, the cold access to
the token contract, and the cold access to the payer's own balance slot, which
stays warm for the rest of the batch. The per-recipient storage write is
irreducible and is what remains.

**Batch size 100 is the recommendation.** Returns flatten hard past it: going
from 100 to 400 buys a further 2.6% while quadrupling how many payouts are
stranded when one batch reverts. Base's block gas limit (400M) is not the
binding constraint — operational blast radius is.

Batching also cuts the L1 data fee from 3.40e9 to 0.75e9 wei per transfer
(measured via `getL1Fee` on the real oracle), because one transaction header and
packed 31-byte records replace 40,000 separate transactions. That is a genuine
4.5× reduction on a component that is only ~1% of the bill — worth having, never
worth pursuing on its own. This is why C is not a separate line item.

---

## 3. The honest recommendation

**Ship B this week. Do not build A to save money today.**

A saves $8,190/year. Building, reviewing and operating a contract that custodies
the payout float will cost more than that in year one — and it converts a
stateless relayer into a contract holding a live balance, which is a real
security and custody obligation, not just an engineering ticket.

The case for A is not today's bill, it is exposure. Savings scale linearly with
both base fee and volume:

| base fee | volume/day | today | with A+B | saved/yr |
|---|---|---|---|---|
| 1× (floor, today) | 40,000 | $12,017 | $3,194 | $8,822 |
| 1× | 200,000 | $60,084 | $15,972 | $44,112 |
| 10× | 40,000 | $101,126 | $31,672 | $69,454 |
| 10× | 200,000 | $505,630 | $158,362 | $347,268 |
| 50× | 40,000 | $497,167 | $158,242 | $338,925 |

We are currently at the cheapest point on this table — base fee at the floor.
That is the correct time to have batching *built and tested* and the wrong time
to be measuring its value. The code is ready (below); the trigger to deploy it
is 5× volume growth or a sustained base fee above the floor, whichever lands
first.

---

## 4. What is implemented here

| path | what it is | status |
|---|---|---|
| `relayer/fees.ts` | Action B. Live-derived EIP-1559 fields, flat small tip, spike cap. | ready to ship |
| `relayer/batch.ts` | Action A client side. Packs 31-byte records, chunks at 100. | ready |
| `src/PayoutBatcher.sol` | Action A contract. Assembly transfer loop, all-or-nothing batches, owner/relayer split. | ready, **needs external audit before it custodies funds** |
| `script/Deploy.s.sol` | Deployment. | ready |
| `script/bench.py` | The benchmark behind every gas number above. Sends real txs on a fork, reads receipts. | — |
| `script/gas_report.py` | The cost model. Fetches prices live; hardcodes none. | — |

`npm test` (15 relayer tests) and `npm run test:contracts` (14 fork tests) both
pass. Contract tests cover amount/recipient transposition, all-or-nothing revert
on both a reverting and a `false`-returning token, authorisation, payload
validation, and that the assembly loop leaves the free-memory pointer intact.

### Before A goes anywhere near production

- **Audit.** `PayoutBatcher` holds the float and its hot path is hand-written
  assembly. It has not been audited.
- **Owner must be a multisig,** not the relayer key. The relayer can only pay
  out; only the owner can sweep or change relayers.
- **Float sizing.** Keep only a working balance in the contract; top up on a
  schedule rather than parking the treasury there.
- **Amounts are capped at uint88** (3.09e26 base units, ~3.09e20 USDC). Far
  above any payout we send, and `packPayouts` throws rather than truncating —
  but it is a real bound, so it is written down here.
- **Retry policy.** A batch is all-or-nothing by design, so one bad recipient
  (e.g. a USDC blacklisted address) fails 100 payouts. The relayer needs to
  bisect-and-retry, and that logic does not exist yet.

---

## 5. Explicitly not worth doing

- **Calldata compression as its own project** — targets 1.1% of the bill.
- **Moving to another chain** — Base is already 52× cheaper than mainnet and its
  base fee is at the floor; there is under $12k/year of total headroom to chase.
- **Access lists (EIP-2930)** — the payer's slot is already warm after the first
  transfer in a batch, so there is nothing left to pre-warm.
- **Raising the gas limit / tuning gas estimation** — unused gas is refunded;
  this changes nothing.
