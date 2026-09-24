# Chain recommendation: freelance escrow ($2k–$50k per job)

**Recommendation: Base (Ethereum L2), settling in native USDC.**
Arbitrum One is a near-equivalent substitute if you prefer the more mature
permissionless fraud-proof system. Do **not** deploy this on Ethereum L1.

The rest of this document shows how I got there.

---

## 1. What the workload actually looks like

This is the key framing. Escrow is **low transaction count, high value per
transaction, long holding period**. That is the opposite of a trading or
gaming workload, and it flips which costs matter.

A realistic happy path per job is 3 on-chain transactions:

| Step | What it does | Rough gas |
|---|---|---|
| `createAndFund` | Write job record (~3 cold storage slots) + `USDC.transferFrom` | ~145,000 |
| `markDelivered` | One warm storage update | ~30,000 |
| `release` | State update + storage refund + `USDC.transfer` to freelancer | ~75,000 |
| **Total (happy path)** | | **~250,000** |
| Disputed path | + evidence submission + arbiter ruling + split payout | **~350,000** |

Gas-unit assumptions: 21,000 base per tx; cold `SSTORE` 20,000 / warm 5,000;
USDC (an upgradeable proxy) `transfer`/`transferFrom` ~50–60k; ~500–700 bytes
of calldata per tx. These are conservative — a tight implementation using a
packed struct and a minimal-proxy-free factory lands in the same range.

So: **~250k gas per completed job**, plus a one-time contract deployment
(~1.5–2.5M gas, irrelevant when amortized).

## 2. Cost of that gas, by chain

### Ethereum L1

250,000 gas at various conditions (substitute live prices — the shape is what
matters):

| Base fee | ETH @ $2,500 | ETH @ $4,000 |
|---|---|---|
| 3 gwei (quiet) | $1.88 | $3.00 |
| 10 gwei (normal) | $6.25 | $10.00 |
| 30 gwei (busy) | $18.75 | $30.00 |
| 80 gwei (spike) | $50.00 | $80.00 |

### Base / Arbitrum / OP Mainnet (post-blob L2s)

L2 execution gas is typically 0.005–0.05 gwei, and the L1 data component is
paid in blobspace. All-in for the same 250k gas plus data:

**$0.01–$0.15 typical, ~$0.50 in a bad blob-fee spike.**

Call it **$0.10 per completed job** for planning purposes — roughly
**100–300x cheaper than L1**.

## 3. Gas as a percentage of job value

| Job size | L1 @ 10 gwei / $4k ETH | L1 @ 80 gwei / $4k ETH | Base (~$0.10) |
|---|---|---|---|
| $2,000 | 0.50% | **4.00%** | 0.000005% |
| $10,000 | 0.10% | 0.80% | 0.000001% |
| $50,000 | 0.02% | 0.16% | 0.0000002% |

Benchmarks you are competing against:

| Incumbent | Take rate on a $10,000 job |
|---|---|
| Upwork | ~10% → $1,000 |
| Escrow.com | ~3.25% → $325 |
| Stripe (2.9% + $0.30) | ~$290 |
| Wire transfer + FX | ~$25–60 + 1–3% FX |
| **This service on Base** | **~$0.30 of gas for all 3 txs** |

## 4. Why this rules out L1 — and it isn't the average cost

Look at the table again. At $50,000 and normal gas, L1 costs 0.02% — trivially
affordable. The problem is the **$2,000 floor during a fee spike: 4%**, which
is worse than Stripe and destroys your pricing story exactly when you can least
control it. You cannot quote a fee to a client if your floor cost swings 40x
with mempool conditions.

Three further L1 problems that the cost table doesn't show:

1. **Gas abstraction becomes unaffordable.** Neither a client in Berlin nor a
   freelancer in Lagos should have to acquire ETH to use your product. You want
   an ERC-4337 paymaster (or EIP-7702) sponsoring every transaction. Sponsoring
   $10–30 per job on L1 eats your margin; sponsoring $0.10 on Base is a rounding
   error. **This is the single strongest argument for an L2** — it's a UX
   capability you can only afford at L2 prices.
2. **Dispute flows multiply transaction count.** Evidence submission,
   partial-release negotiation, arbiter voting, appeals — a contested job can be
   8–12 transactions. On L1 a disputed $2,000 job could cost more in gas than the
   dispute is worth. On an L2 you can afford to put the whole arbitration
   protocol on-chain instead of faking it off-chain.
3. **Milestones.** Real freelance work is milestone-based. A 5-milestone
   $50,000 contract is ~15 transactions, not 3. L1 pricing forces you into a
   single-payment design that doesn't match how the work is actually done.

## 5. Why an L2 is safe enough to hold this money

The honest counter-argument to an L2 is **bridge and sequencer risk**: funds
sit in your contract for days or weeks, and on an L2 the real collateral sits
in an L1 bridge contract you don't control.

Sizing it: 100 concurrent jobs averaging $15,000 = **$1.5M of idle TVL**. That
is a real number, and it's worth being deliberate about.

Why Base and Arbitrum clear the bar:

- Both are **Stage 1** rollups with live fault proofs (Base's permissionless
  fault proofs, Arbitrum's BOLD) — an invalid state root can be challenged by
  parties outside the operator.
- Both bridges secure **billions** of dollars. Your $1.5M is not a
  differentiating target; you inherit a security budget you could never fund.
- Both support **L1 forced inclusion**: if the sequencer censors or goes down,
  you can push a transaction in via L1 after a delay (~24h on Base/OP-stack,
  similar on Arbitrum). Your funds are never hostage to a live sequencer.

**Design mitigations you should build regardless** (these are conditions of the
recommendation, not optional polish):

- **No tight deadlines.** Any auto-release or auto-refund timer must be days,
  not hours, so a multi-hour sequencer outage can never cause a wrong payout.
- **Pause + escape hatch.** An admin-pausable contract with a timelocked
  upgrade path, plus a permissionless `withdrawAfter(t)` that lets each party
  recover their own funds if you disappear.
- **Denominate in USDC, never ETH.** A $50,000 job escrowed in a volatile asset
  for three weeks is a pricing disaster for one side — it turns every job into
  a directional bet neither party agreed to.
- **Cap concurrent TVL early.** Start with a per-job cap at $50k and a global
  cap, and raise it as the contract accrues audit and live time.

## 6. Base vs. Arbitrum vs. everything else

| Chain | Verdict |
|---|---|
| **Base** | **Pick this.** Native Circle USDC + CCTP. Coinbase is a direct on/off ramp with no bridge hop — decisive for a payments product, since a freelancer can go escrow → bank account in one step. Deepest consumer/fintech ecosystem, best paymaster and smart-wallet tooling. |
| **Arbitrum One** | Equally fine. Native USDC, most battle-tested permissionless fraud proofs, larger DeFi depth. Choose it if your users are already on-chain natives; choose Base if they're mainstream. |
| **OP Mainnet** | No advantage over Base; Base has the better distribution. |
| **Ethereum L1** | Rejected above. Reconsider only if you later add an institutional tier where a single counterparty demands zero bridge exposure — and even then, run it as a second deployment, not your default. |
| **Polygon PoS** | Cheap, but it's a sidechain with its own validator set, not Ethereum-secured. You inherit a smaller security budget for the same price as a rollup. No reason to. |
| **Solana** | Cheap and fast, genuinely viable, but: separate toolchain (no Solidity/EVM audit ecosystem), historically weaker liveness record, and a thinner audited-escrow-pattern library to borrow from. Not worth the ecosystem tax unless your team is already Solana-native. |
| **Tron** | Only relevant because of the next point. Don't build here — the contract security ecosystem is comparatively weak for holding $1.5M. |

## 7. The thing that will actually cost your users money

Gas is not your users' main cost. **On/off ramp and FX spread are**, at
roughly 0.5–2% per side — that is **10,000x** the gas cost of a job. Spend
your integration effort there, not on shaving gas.

This has one real product consequence: many freelancers are in corridors
(Philippines, Nigeria, Pakistan, Argentina, Vietnam) where **USDT on Tron is
the liquid local rail**, not USDC on Base. Don't let that pull your escrow
contract onto Tron. Keep the escrow on Base in USDC, and handle it at the
**payout edge** — use CCTP or a payout partner to convert at release time.
Escrow logic and payout rails are separate concerns; only the payout rail needs
to be local.

---

## Summary

| Question | Answer |
|---|---|
| Chain | **Base** (Arbitrum One equally acceptable) |
| Asset | **Native USDC** (never ETH) |
| Gas per completed job | ~250,000 units ≈ **$0.10** |
| Same on L1 | **$6–$80**, i.e. up to **4% of a $2,000 job** |
| Deciding factor | Not average cost — it's that **$0.10/job makes fully sponsored gas affordable**, which is what lets non-crypto users use the product at all |
| Main risk accepted | L2 bridge/sequencer risk on ~$1.5M idle TVL, mitigated by Stage-1 fault proofs, L1 forced inclusion, multi-day deadlines, and a permissionless escape hatch |
