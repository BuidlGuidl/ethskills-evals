# Chain recommendation: freelance escrow ($2k–$50k per job)

**Recommendation: Base (OP Stack L2), with funds denominated in native USDC.
Arbitrum One is the close second and a reasonable swap if your users are
DeFi-native rather than retail. Do not settle this on Ethereum L1.**

The short version: at $2k–$50k per job, gas is *not* what decides the chain —
custody risk and where your users' dollars already live are. But gas is what
decides whether L1 is viable at all, and it isn't: on a $2,000 job, L1 gas eats
a majority of a 1% take rate. Once L1 is out, the remaining question is which L2
has the best custody story plus the best USDC on/off-ramp, and that's Base.

---

## 1. Gas modelling

### Gas per operation

An escrow is a singleton contract with a `mapping(jobId => Job)`, not a
contract-per-job. Estimated EVM gas for the happy path:

| Step | Operation | Gas |
|---|---|---|
| 1 | `USDC.approve(escrow, amount)` | ~46,000 |
| 2 | `createJob()` — `transferFrom` + 3 new storage slots (3 × 20,000) + overhead | ~150,000 |
| 3 | `release()` — `transfer` + slot updates/clears + overhead | ~75,000 |
| | **Happy-path total** | **~271,000** |

Dispute path adds `raiseDispute()` (~50,000) plus an arbitrator `resolve()` that
splits funds two ways (~90,000) → **~411,000 gas** worst case.

I use **270,000 gas** for the happy path below. Re-measure against your actual
contract; these are estimates, not measurements.

### Cost per job

Assumptions (as of Sept 2026 — **re-check before you commit**):
ETH = $4,000; L1 base fee 12 gwei typical / 40 gwei busy; L2 costs are
post-EIP-4844, dominated by blob data availability, which is cheap when blob
demand is low and can spike 5–10× when it isn't.

| Chain | Happy-path gas cost | Congested |
|---|---|---|
| Ethereum L1 | 270k × 12 gwei = 0.00324 ETH = **$12.96** | 40 gwei → **$43.20** |
| Base | **~$0.03–0.10** | ~$0.30–1.00 |
| Arbitrum One | **~$0.03–0.12** | ~$0.30–1.00 |
| Polygon PoS | ~$0.01–0.05 | ~$0.20 |

### As a share of job value

| | L1 (12 gwei) | L1 (40 gwei) | Base |
|---|---|---|---|
| $2,000 job | 0.65% | **2.16%** | 0.0015%–0.005% |
| $50,000 job | 0.026% | 0.086% | 0.0001% |

### The number that actually kills L1

Percent-of-job-value is the wrong denominator. Use **percent of your revenue**.
At a 1% take rate:

| | Revenue | L1 gas ($12.96) | Base gas ($0.05) |
|---|---|---|---|
| $2,000 job | $20 | **65% of revenue** | 0.25% of revenue |
| $50,000 job | $500 | 2.6% of revenue | 0.01% of revenue |

On L1, your smallest jobs are barely profitable and go *underwater* whenever
gas spikes above ~18 gwei. You'd be forced into a minimum job size of ~$10,000
purely for gas reasons — which throws away the bottom of your stated range.

Corollary worth designing around: at $0.03–0.10/job you can **sponsor gas via an
ERC-4337 paymaster**, so freelancers and clients never need to hold ETH. That
costs ~0.25% of revenue on your smallest job. The same feature on L1 costs 65%
of revenue and is simply not buildable. This is a bigger product win than the
raw savings.

---

## 2. The number that dwarfs gas: denomination

Escrowed funds sit idle for days to weeks. If you hold ETH instead of USDC:

- ETH realised vol ≈ 65% annualised → 1-month σ = 65% / √12 ≈ **18.8%**
- On a $50,000 job held 30 days, that's a **1σ swing of ±$9,375**

Compare to $0.05 of gas. The volatility exposure is roughly **200,000× larger
than the gas cost**. Whichever chain you pick, this is the decision that matters
most:

- Hold **native USDC** (Circle-issued), not bridged `USDC.e`, not ETH, not a
  wrapped/algorithmic stable.
- Write the contract so the job is denominated in USDC units at deposit time,
  and the exact deposited amount is what gets released. No oracle, no price
  feed, no conversion at release — an oracle here is pure added attack surface
  for zero benefit.

Both Base and Arbitrum have native Circle USDC and Circle CCTP.

---

## 3. Why Base over the alternatives

**vs. Ethereum L1** — ruled out by the revenue math above. L1's stronger
security doesn't buy you enough: your per-job exposure caps at $50k, and Base's
failure modes (below) are already well inside that risk budget.

**vs. Arbitrum One** — genuinely close. Arbitrum has more TVL and deeper DeFi,
and permissionless fraud proofs (BoLD). Base wins on the thing that matters for
*this* product: the Coinbase on/off-ramp. Your users are freelancers and their
clients, who need to get real dollars in and out — not to compose with lending
markets. Base gives you the shortest fiat→escrow→fiat path and the largest
retail funnel. If your users turn out to be crypto-native, swap to Arbitrum;
the contract is identical.

**vs. Polygon PoS** — marginally cheaper gas, which we've established is not the
deciding variable. It buys that with a weaker security model (no Ethereum-backed
fraud/validity proofs for the PoS chain) and a messier bridged-vs-native asset
situation. Trading security for gas is exactly the wrong trade when you're
custodying $50k per job.

**vs. Solana / non-EVM** — fast and cheap, but you give up EVM tooling, the
auditor pool, and the ability to relocate to another EVM chain later by
redeploying the same bytecode. Optionality is worth more than the delta here.

---

## 4. Risks you inherit from Base, and how to handle them

These are real and you should design for them explicitly:

1. **Sequencer downtime / censorship.** Base's sequencer is centralised. If it
   halts, nobody can call `release()`. Mitigate with generous
   timeout-based refunds (e.g. auto-refund window measured in *weeks*, not
   hours, so a multi-hour outage never auto-triggers a wrong outcome), and
   document the L1 force-inclusion escape hatch.
2. **7-day withdrawal window to L1.** Affects the canonical bridge only. Route
   USDC exits through **CCTP** (burn-and-mint, ~15 minutes, native on both
   sides) and the 7 days never touches your users.
3. **Upgradeable L2 contracts.** Base is Stage 1 with fault proofs, but a
   security council retains upgrade powers. This is the residual trust
   assumption. At $50k max per job it's acceptable; if you ever raise the cap to
   seven figures, revisit.
4. **Your own contract is the biggest risk, not the chain.** Aggregate TVL
   across concurrent jobs is what an attacker targets, not one $50k job. Budget
   **$30,000–$100,000 for an audit** — an order of magnitude more than your
   lifetime gas spend, and correctly so. Add a per-job cap and a global TVL cap
   enforced in-contract.

---

## 5. Summary

| Factor | Weight | Verdict |
|---|---|---|
| Gas cost | Decides L1-vs-L2 only | Any L2; L1 excluded (65% of revenue at $2k) |
| Denomination risk | **Largest single number** (±$9,375 on $50k) | Native USDC, no oracle |
| Fiat on/off-ramp | Decides which L2 | Base (Coinbase) |
| Security model | Must clear a $50k bar | Base Stage 1 + fault proofs clears it; Polygon PoS is a downgrade |
| Contract risk | Dominates chain risk | Audit ≫ gas in your budget |

**Deploy on Base. Hold native USDC. Sponsor gas with a paymaster. Spend the
money you saved on an audit.**

---

### Caveat on the figures

Gas-per-op figures are estimates from the operation mix, not measurements —
profile your real contract with `forge test --gas-report`. ETH price, L1 base
fee, and blob fees move constantly; the table above is a snapshot and the
*ratios* (L2 ≈ 100–400× cheaper than L1) are the durable part, not the absolute
dollars. Re-run the revenue-percentage table with live numbers before
committing.
