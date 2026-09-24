# Base gas spend: what it costs, and what to do about it

**Scope:** ~40,000 ERC-20 payouts a day from a single relayer wallet on Base.

Every gas figure below is measured, not estimated. Network figures come from
live Base mainnet; gas figures come from real transactions against real USDC on
a Base mainnet fork, so the 21,000 intrinsic cost, calldata cost and the
EIP-7623 calldata floor are all included rather than modelled. Regenerate
everything with `./scripts/measure-all.sh`.

One input is **not** measured: what share of your payouts go to a first-time
recipient. I had no access to your payout history, so the central case assumes
25%. §6 explains it and gives the measured worst and best cases either side --
the recommendation is the same across the whole range.

Measured at block 51,690,441, ETH $2,715.

---

## 1. The headline, for finance

| | per payout | per day | per year |
|---|---|---|---|
| **Today** (one tx per payout) | $0.000821 | $32.83 | **$11,982** |
| **After the changes below** | $0.000229 | $9.17 | **$3,348** |
| **Saving** | | $23.66 | **$8,634 (72%)** |

Because the recipient mix is an assumption (see §6), here is the guaranteed
band — both endpoints are measured, so the true answer sits inside it:

| Recipient mix | Today / yr | After / yr | Saving |
|---|---|---|---|
| all first-time recipients (worst case) | $15,079 | $5,937 | $9,141 (61%) |
| **assumed 25% first-time (central)** | **$11,982** | **$3,348** | **$8,634 (72%)** |
| all repeat recipients (best case) | $10,950 | $2,485 | $8,464 (77%) |

**Read this before acting on it:** the annual spend is about $12k. The
percentage saving is large; the absolute saving is roughly one engineer-week.
If the only goal is this year's line item, the honest answer is that gas is not
where your money is going, and this work should be scheduled accordingly.

The reason to do it anyway is that **today's cost is a floor, not a norm**. Two
things are unusually cheap right now, and both can move against you:

- Base's L2 base fee is pinned at its protocol floor of 5,000,000 wei
  (0.005 gwei) because blocks are only ~16% full.
- Post-blob L1 data availability is ~1% of the total (see §4).

Batching is insurance against the first. The saving is the same *percentage* of
a much bigger number if Base gets busy:

| Conditions | Today / yr | After / yr | Saves / yr |
|---|---|---|---|
| base fee ×1, ETH ×1 (now) | $11,982 | $3,348 | $8,634 |
| base fee ×1, ETH ×4 | $47,928 | $13,394 | $34,534 |
| base fee ×10, ETH ×1 | $101,216 | $33,361 | $67,855 |
| base fee ×10, ETH ×4 | $404,864 | $133,443 | $271,421 |
| base fee ×100, ETH ×1 | $993,556 | $333,483 | $660,073 |

Base has historically spiked well past ×10 during NFT mints. A ×10 congestion
month costs ~$8,400 unbatched versus ~$2,800 batched.

## 2. Ranked recommendations

Ranked by annual dollars saved. Both of the top two are implemented in this repo.

### #1 — Batch payouts into one transaction · saves ~$7,979/yr (67%) · **implemented**

Every standalone transfer pays 21,000 gas just to exist, plus its own signature
and L1 data cost, before it does any work. At 40,000 payouts a day that is
840M gas/day of pure per-transaction overhead. Batching pays it once per batch.

Measured, USDC on a Base fork, gas per payout:

| | standalone | batch of 25 | batch of 100 | batch of 200 | batch of 400 |
|---|---|---|---|---|---|
| cold recipient | 61,955 | 30,993 | 29,582 | 29,349 | 29,240 |
| warm recipient | 44,855 | 13,893 | 12,482 | 12,249 | 12,140 |
| gas saving (cold / warm) | — | 50% / 69% | 52% / 72% | **53% / 73%** | 53% / 73% |

(Those are gas reductions from batching alone. The 61%/77% figures in §1 are
total *cost* savings, which also include the fee tuning in #2.)

"Cold" means the recipient has never held the token, so crediting them is a
zero→nonzero storage write costing 20,000 gas. That 20,000 is irreducible —
batching cannot remove it, which is why cold payouts cap at ~53% saving while
warm ones reach ~73%.

**Batch size: use 200.** The curve is flat past ~100; going 200→400 buys another
0.2%. 200 keeps the transaction at ~5.9M gas (Base's block limit is 400M, so
there is ample headroom) and bounds how much is stuck behind one failed send.
At 200, 40,000 payouts/day is 200 transactions/day instead of 40,000.

### #2 — Stop overpaying the priority fee · saves ~$1,945/yr (16%) · **implemented**

`eth_maxPriorityFeePerGas` on Base suggests a 1,000,000 wei tip. The base fee is
5,000,000 wei, so taking that suggestion means paying **17% above the floor** for
every unit of gas.

That tip buys nothing at current utilisation. Measured over 60 blocks
(20,034 user transactions):

- blocks are ~16.3% full
- **1,404 transactions (7.0%) landed with a priority fee of exactly zero**
- the 10th-percentile tip is 50 wei

So we open at a 1,000 wei tip rather than 1,000,000 — still above what 10% of
the network pays, and 1/1000th of the suggestion.

Bidding zero outright would be reckless: it leaves no headroom if the sequencer
backs up. `src/feeStrategy.mjs` therefore escalates
(1,000 → 100,000 → 1,000,000 → 5,000,000 → 25,000,000 wei) only when a
transaction actually fails to land within 3 blocks, so the steady state is
near-free and the tail latency stays bounded.

Note these two changes **compound, not add**: #1 cuts gas units by ~67%, #2 cuts
the price per unit by ~17%. Together they give 72.1%, not 83%.

### #3 — Hold the float in the contract instead of pulling · saves ~$229/yr more · **implemented, not recommended by default**

`payoutFrom` pulls from the relayer wallet via `transferFrom`, which touches an
allowance slot on every payout: 1,134 gas each, ~$229/yr.

`payout` spends a float held by the contract and skips that. It is measurably
cheaper — and it moves custody of the float from your relayer wallet into the
contract. **$229/yr is not worth changing your custody model for.** The code
supports both (`mode: 'float' | 'pull'`); ship `pull`. Revisit only if volume
grows 10× or Base gets congested, which would make the same 1,134 gas material.

### #4 — Measure and eliminate reverted transactions · unknown, possibly large · needs your data

A transaction that reverts still burns its gas. I could not size this without
your relayer's history. Given the default batch of 200, one reverted batch burns
~5.9M gas — as much as ~95 successful standalone payouts — so this matters
*more* after batching, not less.

Two mitigations are already in the code:

- **Preflight simulation.** Every batch is `eth_call`ed first. If it reverts, the
  contract's `TransferFailed(index)` error identifies the offending payout, which
  is dropped and the rest are retried. Without this, one blacklisted USDC
  recipient would block all 199 others in its batch — a real hazard, since USDC
  on Base is freezable.
- **Cost accounting.** `src/gasReport.mjs` totals actual spend from receipts,
  splitting L2 execution from L1 data availability, so finance can see real
  numbers monthly instead of estimates.

Run `reportFromChain()` over last month's relayer transactions to size the waste.

---

## 3. What we are *not* doing, and why

**Compressing calldata — rejected on the numbers.** This is the standard advice
for L2s and it is now obsolete on Base. Since EIP-4844 blobs, L1 data
availability is **~1.0% of a transfer's total cost** (median of 290 sampled live
transfers: 3.39 gwei L1 vs 308 gwei L2). Halving calldata would save ~0.5% of the
bill. It was worth doing in 2023; it is not worth an engineer's week now. We do
use a packed 32-byte-per-payout encoding, but for the *execution* gas it saves,
not the DA — and the amount rides free in a word the recipient address needed
anyway.

**EIP-7623 calldata floors — checked, not binding.** At 32 bytes per payout the
floor works out to ~1,280 gas per payout against ~12,000–29,000 of actual
execution, so it never binds. Confirmed empirically: per-payout gas keeps
falling all the way to batch size 400.

**Access lists (EIP-2930) — no benefit.** Slots are warm after the first payout
in a batch regardless, and the access list itself costs calldata.

**Moving payouts to a Merkle claim.** Users would claim funds themselves, taking
our gas to roughly zero — the largest possible saving. It also stops being a
payments product: recipients need ETH and a wallet interaction. Flagging it as a
product decision, not a gas optimisation. Not recommended for a payments app.

**Changing chains, or gasless/Permit2 relaying.** Permit2 shifts who pays; it
does not reduce the gas. Not a saving.

---

## 4. Where the money actually goes

Per standalone payout today, at current conditions:

| Component | Gas | Share |
|---|---|---|
| Intrinsic transaction cost | 21,000 | 43% |
| Recipient balance write (cold 20,000 / warm 2,900) | 2,900–20,000 | 6–41% |
| Sender balance write, event, token logic, calldata | ~21,000 | 43% |
| **L1 data availability** | — | **~1.1% of total cost** |

The first row is the entire case for batching: **43% of what you pay is the
transaction existing, not the payment happening.**

---

## 5. Rollout

1. Deploy `BatchTransfer` with `OWNER` set to a **multisig**, not the relayer
   (`script/Deploy.s.sol`). The relayer key is hot; it can only move funds to
   recipients named in a batch. Only the owner can add relayers or sweep.
2. Approve `BatchTransfer` from the funding wallet for the payout token.
3. Wire `BatchRelayer` into the payout path (`src/batcher.mjs`, viem adapter in
   `src/adapters/viem.mjs`). Start at `maxBatchSize: 20`, then raise to 200.
4. Roll out the fee ladder (#2) first and independently — it is a config change,
   carries no contract risk, and banks 16% on its own.
5. Report monthly with `src/gasReport.mjs`.

### Risks

- **Batch failure blast radius.** 200 payouts ride on one transaction. Preflight
  plus the escalating retry ladder cover the common cases; alert on
  `batch_retry` and `payout_dropped` events.
- **Custody.** Recommended `pull` mode keeps funds in your wallet; the contract
  only ever holds an allowance. Bound that allowance to a daily limit rather than
  approving `type(uint256).max` if treasury policy requires it.
- **Settlement latency.** Batching adds up to `maxWaitMs` (default 15s) before a
  payout is sent. If any payout class has a tighter SLA, route it around the
  batcher.
- **uint96 amounts.** The packed encoding caps a single payout at ~7.9e28 raw
  units — 7.9e22 USDC at 6 decimals. Fine for USDC; re-check before using a
  token with 18 decimals and very large payouts.

---

## 6. Key assumption, and how to correct it

The central figures assume **25% of payouts go to a first-time recipient** — one
who has never held the token, so crediting them costs an extra 17,100 gas for
the zero→nonzero balance write.

**This is a stated assumption, not a measurement.** It is the single largest
driver of the result, and it is the one number here I could not measure for you.

An earlier version of this model inferred it from where the network-wide median
transfer gas fell between the measured cold and warm extremes. I removed that:
re-sampling minutes apart produced cold fractions of 0.23 and 0.01, which moved
the headline saving by five percentage points. It was measuring what the rest of
Base was doing, not your payout mix, while looking authoritative. A declared
default is more honest.

The assumption only moves the answer within a band whose endpoints *are*
measured, so the decision does not hinge on it:

- all payouts to first-time recipients: **61%** saving, $9,141/yr
- all payouts to repeat recipients: **77%** saving, $8,464/yr

Every case saves 61–77%, so the recommendation holds regardless. Once you know
your real mix from payout history, re-run with it:

```bash
COLD_FRACTION=0.4 node scripts/cost-model.mjs
```

## 7. Reproducing the numbers

```bash
forge test                                    # 14 contract tests
node --test "test/*.test.mjs"                 # 13 unit tests
./scripts/with-fork.sh node --test test/relayer.integration.mjs   # 3 end-to-end, real USDC
./scripts/measure-all.sh                      # regenerate every figure in data/
```

| File | What it measures |
|---|---|
| `scripts/sample-transfers.mjs` | live ERC-20 transfer costs on Base, L1 vs L2 split |
| `scripts/priority-floor.mjs` | real priority-fee distribution and block fullness |
| `scripts/sweep.mjs` | gas per payout vs batch size, on a fork, against real USDC |
| `scripts/cost-model.mjs` | the tables above, from live chain state + measurements |

Outputs land in `data/`. `data/cost-model.json` carries the block number, ETH
price and every input it used, so any figure can be traced back.
