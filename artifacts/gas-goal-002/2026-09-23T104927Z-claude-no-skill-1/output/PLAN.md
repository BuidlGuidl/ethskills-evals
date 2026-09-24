# Base relayer gas: what we spend, and what to do about it

**Measured 2026-09-23 against Base mainnet at block 51,685,756. ETH = $2,737.43.**

Every number below is measured, not estimated: real mainnet receipts for the cost side,
a forked-USDC Foundry benchmark for the gas side. The benchmark validates itself against
mainnet to the gas unit (`test_00_HarnessMatchesMainnet`).

---

## The short version for Finance

**We are spending somewhere between $11,000 and $38,000 a year on gas.** The range is
that wide because it hinges on one setting I could not read from outside — the priority
fee our relayer bids. Thirty minutes of measurement closes it (see below).

| Change | Saves/yr | Certainty | Effort |
|---|---:|---|---|
| **Batch payments into one transaction** | **$8,047** | **Unconditional** — holds under every assumption tested | contract + relayer change |
| **Stop overpaying the priority fee** | **$0 – $26,007** | Depends entirely on our current tip | config, one afternoon |
| Packed calldata instead of ABI arrays | $100 | already included in the batching work | none |

Two headline facts:

1. **Batching saves ~33,200 gas on every payment, and that number barely moves.** It is
   the same whether payees are new or recurring, whether batches hold 25 or 250, and
   whatever the gas price does. At today's prices that is **$8,047/yr — the one figure
   here I would defend without caveats.**
2. **The fee-policy saving is either the biggest win available or nothing at all.** The
   *mean* Base sender overpays badly; the *median* one does not. Which we are is a
   30-minute measurement, and it decides the whole ranking.

Worth saying plainly: **the entire pot is $11k–$38k/year.** This deserves a week or two
of engineering, not a quarter, and nothing here justifies re-platforming.

---

## Do this first: measure our actual tip (30 minutes)

I sampled 120 real USDC transfers on Base and found a **mean** effective gas price of
18.7 mwei against a 5 mwei base fee — implying ~73% of the price paid is a tip buying
nothing. But the **median** tip on Base is exactly 1 mwei. The mean is dragged up by a
minority of heavy overpayers.

When I pointed the analyzer at a real high-volume USDC sender, it was **already bidding
1 mwei** — already optimal. For that relayer the fee policy would save **nothing**, and
batching is the entire opportunity.

So: **we might be either.** Find out before prioritising.

```bash
BASE_RPC_URL=... node tools/analyze-relayer.mjs 0xOurRelayerAddress --blocks 20000
```

It reports real ETH spent, the L1/L2 split, **what fraction of spend is tip**, mean gas
per transfer, and our real new-payee share — then prints the exact `model.mjs` command
to re-run these projections against reality. Sample output from the real relayer above:

```
  transactions         355
  ERC-20 transfers     355  (1.00 per tx)     <- not batching today
  total spent          0.000097417265282074 ETH
    L2 execution       98.8%
    L1 data             1.1%
    of which is TIP    16.4% of all spend     <- already lean; little to win here
  median priority fee  1.000 mwei
  new-payee share      1.1%
  extrapolated: $10,967/yr
```

That extrapolation ($10,967/yr) lands within 1.5% of what the independent cost model
predicts for the same configuration ($11,132/yr) — two different methods agreeing is
the main reason to trust the tables below.

### The two cases

**Case A — our relayer already bids ~1 mwei** (like the one sampled):

| | gas/payment | $/yr | saved |
|---|---:|---:|---:|
| Today | 45,914 | $11,132 | — |
| Fee policy | 45,914 | $11,132 | $0 |
| **+ batching (n=100)** | **12,744** | **$3,085** | **$8,047 (72.3%)** |

**Case B — our relayer bids the ambient mean (~13.7 mwei):**

| | gas/payment | $/yr | saved |
|---|---:|---:|---:|
| Today | 51,215 | $38,410 | — |
| **Fee policy alone** | 51,215 | $12,403 | **$26,007 (67.7%)** |
| **+ batching (n=100)** | **18,044** | **$4,356** | **$34,054 (88.7%)** |

In **both** cases batching is worth ~$8,047/yr. Only the fee-policy line moves.

---

## Where the money actually goes

A Base transaction costs **L2 execution gas × gas price**, plus an **L1 data fee** to
publish to Ethereum. Measured across 120 real transfers:

| Component | Per transfer | Share |
|---|---:|---:|
| L2 execution | 9.33e-7 ETH | **99.7%** |
| L1 data fee | 3.04e-9 ETH | **0.3%** |

**The L1 data fee is a rounding error**, and this inverts the usual L2 advice. Since
blobs, Base's L1 cost has collapsed, so optimising calldata — the thing most "L2 gas
optimisation" guides lead with — chases 0.3% of the bill. Everything worth doing is on
the L2 execution side, which splits into *gas units used* (→ batching) and *price per
unit* (→ fee policy).

---

## 1. Batching — $8,047/yr, unconditional

### Where the gas goes

A standalone ERC-20 transfer costs (verified against real mainnet receipts):

| Case | Gas | Mainnet-observed |
|---|---:|---|
| Payee already holds the token | **45,059** | 45,059 ✓ |
| Brand-new payee (balance 0 → non-zero) | **62,159** | 62,159 ✓ |

Only ~24,000 of that 45,059 is the transfer itself. The rest is fixed per-transaction
overhead we pay 40,000 times a day:

- **21,000** intrinsic gas, charged once per transaction whatever it does
- **~2,600** cold-account access to the token contract
- **~5,000** for the payer's own balance slot, cold on every single transaction

Batching pays that overhead **once per batch**. The payer's balance slot in particular
goes cold → warm after the first payment, dropping from ~5,000 gas to 100.

### Measured (real USDC on a Base fork, `test/GasBench.t.sol`)

Total transaction gas ÷ payments, at 36% new payees:

| Batch size | Gas/payment | vs 51,215 standalone |
|---:|---:|---:|
| 1 | 70,671 | worse — never batch a single payment |
| 10 | 22,514 | −56% |
| 25 | 19,304 | −62% |
| 50 | 18,463 | −64% |
| **100** | **18,044** | **−65%** |
| 250 | 17,799 | −65% |

**Marginal cost of one more payment in a batch: 11,477 gas** (existing payee) or 28,577
(new payee), against 45,059 / 62,159 standalone. That is a flat **33,582 gas saved per
payment in both cases** — because what batching removes is fixed overhead, which does
not care about the payee's state. This is why the $8,047 is so robust: it survives any
assumption about our payee mix.

### Returns flatten fast — so this need not cost latency

25 → 250 payments per batch buys only 1.4% more. Batching is **not** a reason to make
customers wait:

| Policy | Gas/payment | $/yr (Case B) | Saved |
|---|---:|---:|---:|
| Today | 51,215 | $38,410 | — |
| Batch ≤25 (≈60s flush) + fee policy | 19,304 | $4,662 | 87.9% |
| Batch ≤100 (≈3.6min flush) + fee policy | 18,044 | $4,356 | 88.7% |

At 40,000/day we see ~28 payments/minute, so a **60-second flush with a 100-payment
cap** lands near batch-of-28 and captures essentially the whole saving. Recommend
flushing on whichever comes first.

### Custody: a business decision, so both are implemented

| Mode | Gas/payment (n=100) | $/yr | Where funds sit |
|---|---:|---:|---|
| `payFromBalance*` — contract holds a float | 18,044 | $4,356 | in the contract |
| `payFromRelayer*` — `transferFrom` the relayer EOA | 19,211 | $4,636 | in the relayer EOA |

Float mode is ~6% cheaper (**$280/yr**) because it avoids touching the allowance slot.
That is a small premium for not moving custody — **relayer-custody mode is a perfectly
reasonable choice.** Either way the owner (a multisig, enforced by the deploy script)
can `sweep()`, so a float is always recoverable without redeploying.

### The failure mode that matters

**Batching makes payments share fate.** USDC maintains a blacklist; one blacklisted
payee reverts a strict batch and blocks 99 good payments.

`payFromBalancePackedLenient` skips the failing payment, reports it via a
`PaymentSkipped` event, and pays the rest. Both behaviours are implemented and tested
(`test_StrictBatch_RevertsOnBlacklistedPayee`,
`test_LenientBatch_SkipsBlacklistedPayeeAndPaysTheRest`).

**Recommendation: run lenient in production**, with alerting on `PaymentSkipped` and
automatic re-queueing. An all-or-nothing batch turns one bad payee into an outage.

---

## 2. Fee policy — $0 to $26,007/yr. Measure first.

### The finding

Base's fee market is not congested and was not once during the sampled window:

| Measurement | Value |
|---|---|
| L2 base fee | **5,000,000 wei (0.005 gwei)** — pinned at the protocol floor, all 60 blocks |
| Block fullness | **8.7% median**, 22.6% peak, against a 400M gas limit |
| Blocks containing a **zero-tip** transaction | **60 of 60** |
| Base node's own `eth_gasPrice` suggestion | 6,000,000 wei (base + 1 mwei) |
| **Median** tip paid | **1 mwei** |
| **Mean** tip paid | **13.7 mwei** |

Zero-tip transactions clear in every block. Any tip above ~1 mwei buys nothing. The gap
between that median and mean is the entire uncertainty in this plan.

### The fix

Bid what the node suggests: **1 mwei**. The critical distinction, easy to get backwards:

> **`maxFeePerGas` is a ceiling, not a price.** You pay
> `baseFee + min(tip, maxFeePerGas − baseFee)`. Raising `maxFeePerGas` buys reliability
> **for free**. Raising `maxPriorityFeePerGas` costs money on every transaction. Set the
> cap generously; set the tip low.

Implemented in **`tools/fee-policy.mjs`**:

- `maxPriorityFeePerGas` = 1 mwei (configurable; 0 is demonstrably includable)
- `maxFeePerGas` = `4 × baseFee + tip` — headroom that costs nothing at the floor
- **circuit breaker** at 0.5 gwei: if Base ever repriced sharply we stall visibly rather
  than quietly draining the float
- tip escalation **only on replacement** (`attempt` doubles it), so a stuck transaction
  can clear the replacement rule without inflating steady-state cost

If the analyzer shows we already bid ~1 mwei, adopt this module anyway for the circuit
breaker and escalation behaviour — but book **$0** of savings against it.

---

## 3. Packed calldata — $100/yr. Already included; not a reason to do anything.

Packing (20-byte address ‖ 12-byte amount = 32 bytes/payment, vs 65 for ABI arrays)
halves calldata: 6,564 → 3,300 bytes at n=100. That is **$100/year**.

It is in the implementation because it was free to write alongside the batching work. It
would never have justified a sprint on its own. Flagged explicitly because calldata
packing is the optimisation everyone reaches for on an L2, and at current blob prices it
is almost worthless.

---

## What we are deliberately *not* doing

- **Further calldata / L1 compression.** L1 is 0.3% of the bill. Driving it to zero saves
  ~$115/yr. Batching already cuts it ~76% as a side effect.
- **Gas tokens (CHI/GST2).** Dead since EIP-3529 removed the refunds they relied on.
- **Chasing the cheap 40,259-gas transfers visible on-chain.** Those are wallets
  *draining themselves to zero*, collecting the 4,800-gas storage-clear refund. A
  float-holding relayer never hits zero and cannot access this. Worth stating because it
  silently biases any naive average of on-chain transfer gas downward — our own first
  pass at the baseline was wrong for exactly this reason.
- **Changing chain or token.** Not justified by this line item.

### Worth measuring later, not costed here

**EIP-7702** would let the relayer EOA execute a batch directly, plausibly reaching
float-mode gas *without* moving custody or granting an allowance. I have not benchmarked
it, so I put no number against it. If custody turns out to be the blocker for batching,
this is the next thing to measure.

---

## Sensitivity: how much do the assumptions matter?

**New-payee share.** The real relayer I sampled ran at **1.1% new payees** — a payments
app mostly pays recurring users. The tables above assume a conservative 36% (Case B) or
5% (Case A). The saving is barely sensitive to it; only absolute spend moves:

| New-payee share | Today (Case B) | After | Saved |
|---:|---:|---:|---:|
| 0% | $33,808 | $2,880 | 91.5% |
| 25% | $37,003 | $3,905 | 89.4% |
| 50% | $40,199 | $4,930 | 87.7% |
| 100% | $46,591 | $6,980 | 85.0% |

**If Base gets busy.** Today's base fee is at the floor, which is *why* the tip can be
such a large share of the bill. The two savings move in opposite directions:

- the **fee-policy saving shrinks** — a higher base fee makes the tip a smaller fraction
- the **batching saving grows** — it removes ~33,200 gas *units* per payment, and units
  multiply by whatever the price is. At a 10× base fee, batching alone is worth ~$80k/yr

Batching is the durable win; the fee policy is the cheap one *today*. Do both.

---

## Rollout

1. **Run `analyze-relayer.mjs`** against the production relayer. This resolves the
   ranking and gives Finance a measured number rather than a modelled one. *(30 min.)*
2. **If we are overpaying the tip, ship `fee-policy.mjs` first** behind a config flag —
   two-thirds of the saving, reversible instantly. Watch inclusion latency for 24h.
3. **Deploy `BatchPay`** with a multisig owner (the deploy script refuses
   `OWNER == RELAYER`). Fund a small float.
4. **Shadow-run** `send-batch.mjs --dry-run` against real batches; compare its gas
   estimates against the table above.
5. **Cut over a traffic slice** — lenient mode, batch ≤100, 60s flush — with alerting on
   `PaymentSkipped`.
6. **Ramp**, then re-run the analyzer to confirm the saving landed.

---

## Reproducing every number here

```bash
npm test                                                    # 14 tooling + 18 contract tests
forge test --match-test test_00_HarnessMatchesMainnet -vv   # harness == mainnet, to the gas
BASE_RPC_URL=https://mainnet.base.org npm run test:gas      # the full gas benchmark
node tools/model.mjs                                        # the cost tables above
node research/fee-market.mjs                                # base fee, fullness, zero-tip blocks
node research/sample-transfers.mjs                          # real transfer gas + L1/L2 split
```

| File | What it is |
|---|---|
| `src/BatchPay.sol` | Batch payout contract: float/relayer custody, strict/lenient, packed payload |
| `test/GasBench.t.sol` | Forked-USDC gas benchmark; validates itself against mainnet |
| `test/BatchPay.t.sol` | 18 correctness tests — auth, payload validation, blacklist, fuzz round-trip |
| `tools/fee-policy.mjs` | Tip policy + circuit breaker + replacement escalation |
| `tools/batch.mjs` | Payload packing, chunking, amount-overflow and float-coverage guards |
| `tools/send-batch.mjs` | Reference relayer send path wiring both changes together |
| `tools/analyze-relayer.mjs` | **Start here.** Measures our actual spend |
| `tools/model.mjs` | The cost model; all inputs in `tools/measured.json` |
| `tools/measured.json` | Every measured constant, with provenance |
| `research/` | The scripts that produced the mainnet measurements |

**Assumptions that are ours, not measured:** 40,000 transfers/day (given); ETH at
$2,737.43 (spot, Chainlink); our relayer's current tip (**unverified — measure it**);
new-payee share (**unverified — the analyzer reports it**).
