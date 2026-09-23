# Which chain for a freelance escrow service?

**Recommendation: Base (an Ethereum L2), with USDC as the unit of account.**
Arbitrum One is an equally defensible substitute. Ethereum L1 is the fallback if
you are low-volume and want the simplest trust story.

The rest of this doc shows the arithmetic, because the headline number people
usually optimize (gas) turns out to be the *third* most important cost in this
design, and the two things that beat it change the answer.

---

## 1. What the contract actually has to do

An escrow job has a fixed on-chain lifecycle. Estimating gas per step for a
straightforward Solidity implementation holding ERC-20 (USDC):

| Step | Operation | Gas |
|---|---|---|
| One-time | Deploy factory + implementation | ~2,000,000 |
| Per job | `permit` or `approve` (USDC supports EIP-2612, so bundle it) | 0–46,000 |
| Per job | `createAndFund`: 21k base + `transferFrom` ~50k + 3 fresh `SSTORE` ~66k + event | ~140,000 |
| Per job | `release`: 21k base + `transfer` ~45k + state clear (with refund) + event | ~90,000 |
| **Per job happy path** | | **~230,000** |
| Dispute path | arbiter call + split payout | +~120,000 |

I'll use **230,000 gas per completed job** throughout. Roughly 85% of jobs
should take the happy path, so the blended figure is ~250,000.

## 2. Gas cost per job, by chain

Assumptions stated up front so you can re-run these: **ETH = $3,000**. Mainnet
base fee of 10 gwei as the typical case, 30 gwei busy, 100 gwei during a spike
(these are the realistic post-blob mainnet bands, not 2021 numbers). L2 costs
are execution gas at ~0.01 gwei plus the amortized blob-data cost of a small
transaction.

| Chain | Cost / job (typical) | Cost / job (bad day) |
|---|---|---|
| Ethereum L1 @ 10 gwei | **$6.90** | — |
| Ethereum L1 @ 30 gwei | $20.70 | — |
| Ethereum L1 @ 100 gwei | — | **$69.00** |
| Base / Arbitrum / OP Mainnet | **~$0.05** | ~$0.50 (blob fee spike) |

Math for L1 typical: `230,000 × 10 gwei = 0.0023 ETH × $3,000 = $6.90`.

L2s come out **roughly 140× cheaper** on a typical day.

## 3. Now put that against the job value

This is the part that decides it.

| Job size | L1 typical ($6.90) | L1 spike ($69) | L2 ($0.05) |
|---|---|---|---|
| $2,000 (your floor) | 0.35% | **3.45%** | 0.0025% |
| $12,000 (midpoint) | 0.06% | 0.58% | 0.0004% |
| $50,000 (your ceiling) | 0.014% | 0.14% | 0.0001% |

Two readings of this table, and they point in the same direction:

- **At $50,000, gas is irrelevant on any chain.** $6.90 on a $50k job is 1.4
  basis points. Nobody chooses a chain over 1.4bp. If your product were only
  large jobs, you should deploy on L1 and stop thinking about it.
- **At $2,000, L1 is genuinely bad** — and it's bad specifically in the moment
  you can't control. A 3.45% fee during a gas spike is worse than Stripe, and
  it lands on your smallest, most price-sensitive customers. You cannot ship a
  $2,000-floor product on a fee that varies 10× with someone else's NFT mint.

Your stated range spans both regimes, so you have to build for the $2,000 end.
That rules out L1 as the primary deployment.

**Annual view** at, say, 5,000 jobs/year: L1 typical = $34,500/yr in gas, L2 =
$250/yr. Real money, but notice it is small next to the payment-processing
spread in §5 — it is not the reason to pick an L2. The *variance* is.

## 4. The risk that dominates: money at rest, not money in motion

An escrow is not a payment. The defining property is that funds **sit** for
weeks. That changes what "chain security" means for you.

At 5,000 jobs/year, $12,000 average, 21-day average hold:

```
concurrent float = 5,000 × $12,000 × (21 / 365) ≈ $3.45M
```

So the real question is not "what does a transaction cost" but **"am I
comfortable leaving ~$3.5M of other people's money sitting in a contract on
this chain for a month at a time?"** Graded that way:

- **Base / Arbitrum / OP Mainnet.** Stage-1 rollups with fault proofs, data
  posted to Ethereum. Escrowed funds live in your contract; the sequencer
  cannot spend them. Worst realistic case is censorship or downtime — and both
  chains have L1 forced-inclusion, so a stalled sequencer delays a release by
  hours, it does not lose it. For an escrow whose funds are *supposed* to be
  immobile for weeks, a multi-hour liveness fault is an unusually cheap failure
  mode. This is the key fit: your product's latency tolerance is measured in
  days, so you can afford the one weakness L2s actually have.
- **Ethereum L1.** Strictly the best security. You're paying ~$7/job and
  accepting fee spikes for it. Correct choice if volume is low (say <500
  jobs/yr, where L2 savings are ~$3.5k/yr — genuinely noise) and you want zero
  paragraphs of trust-assumption disclosure in your terms of service.
- **Polygon PoS.** Rejected. It's a sidechain with its own validator set; it
  does not inherit Ethereum's security. You'd be taking a distinct and weaker
  trust assumption to save the *same* ~$7/job that a fault-proof rollup saves.
  That trade has no upside.
- **Tron.** Rejected despite deep USDT liquidity. Highly concentrated
  validation, and the compliance story for a business custodying freelancer
  funds is poor.
- **Solana.** Not unreasonable — fast, cheap, real payments traction. Rejected
  here for practical reasons: you rewrite in Rust, the historical liveness
  record is worse than an L2's (and unlike an L2 there's no L1 escape hatch),
  and you lose the Ethereum tooling ecosystem for arbitration and multisig.
- **Your own L3 / new rollup.** Rejected. You'd be the security budget.

Between Base and Arbitrum, I'd take **Base** for one product reason: native
USDC plus first-party Coinbase on/off-ramp integration. Freelancers need to get
to local currency, and that is the step where your users actually churn.
Arbitrum is the better answer if you need deep DeFi liquidity for yield on the
float.

## 5. The cost that actually beats gas — denominate in USDC

Hold the escrow in **USDC, never in ETH**. The numbers:

ETH's annualized volatility is roughly 60–80%. Over a 30-day hold, a one-sigma
move is about `70% × √(30/365) ≈ 20%`. On a $50,000 job:

```
1σ FX risk on a 30-day ETH-denominated escrow ≈ $10,000
gas cost of the same job on L1                ≈ $6.90
```

**The currency decision is ~1,500× larger than the gas decision.** Anyone
comparing chains on transaction fees before fixing denomination is optimizing
the wrong three orders of magnitude. Both parties agreed a dollar price; hold
dollars.

And for completeness, the fee stack you're competing against and the one you'll
actually pay:

| | Cost on a $2,000 job |
|---|---|
| Upwork (10% freelancer fee) | $200 |
| International wire + 2% FX spread | ~$70 |
| **Your L2 escrow: gas + ~0.5% on/off-ramp** | **~$10** |

Your on/off-ramp spread (0.1–1%) is **100–200× your gas cost**. That is the
line item to negotiate, not gas.

---

## Recommendation, restated

1. **Deploy on Base.** ~$0.05/job means your $2,000 floor works at 0.25 basis
   points, and — more importantly — the fee doesn't move when mainnet gets
   busy. Fault proofs + Ethereum DA + L1 forced inclusion make a multi-week
   hold of a few million dollars defensible.
2. **Denominate in USDC.** Worth ~1,500× more than the chain choice.
3. **Deploy the identical contracts to Arbitrum One** once you have volume.
   Same EVM bytecode, and it removes single-chain liveness from your risk
   register.
4. **Offer an Ethereum L1 deployment for jobs above ~$25,000** if enterprise
   clients ask for it. At that size gas is under 3bp, so you can hand them
   maximal security for free — a good upsell, and it costs you nothing but a
   second deployment target.

**The decision rule underneath all of this:** below roughly $5,000 per job, fee
*predictability* picks the chain, and only rollups clear that bar. Above
roughly $25,000, gas stops mattering entirely and settlement assurance picks
the chain. Your range straddles the crossover, which is why the answer is a
rollup as the default with an L1 option at the top end — not a single chain.
