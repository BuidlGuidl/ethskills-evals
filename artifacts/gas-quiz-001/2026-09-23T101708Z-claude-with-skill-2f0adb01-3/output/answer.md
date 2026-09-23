# Chain Recommendation: Freelance Payment Escrow ($2k–$50k per job)

**Recommendation: deploy on Ethereum mainnet.** Settle in USDC, not ETH.
Use Base as the secondary deployment only if your users already live on an L2.

---

## 1. Live numbers used (verified 2026-09-23)

| Input | Value | Source |
|---|---|---|
| Mainnet base fee | **0.333 gwei** | `cast base-fee` via publicnode + 1rpc (agreed) |
| Priority fee assumed | 0.02 gwei | typical tip, current conditions |
| Effective mainnet gas price | **~0.35 gwei** | base + tip |
| ETH/USD | **$2,734.46** | Chainlink ETH/USD feed `0x5f4e…8419`, `latestAnswer()` = 273445957514 |
| Base L2 gas price | 0.006 gwei | `cast gas-price` @ mainnet.base.org |
| Arbitrum One gas price | 0.020 gwei | `cast gas-price` @ arb1.arbitrum.io |
| OP Mainnet gas price | 0.001 gwei | `cast gas-price` @ mainnet.optimism.io |

Derived: **1 gas = $9.57 × 10⁻⁷** on mainnet → **$0.096 per 100k gas**, **$0.96 per 1M gas**.

Note: gas is ~0.3 gwei, not the 20–50 gwei figure people still quote. Post-Dencun/Pectra/Fusaka
(blobs, PeerDAS, 60M gas limit) mainnet fees dropped ~95%+. Any cost-driven argument for an L2
here has to clear a much lower bar than it did in 2023.

## 2. Cost of one escrow job (mainnet, current conditions)

| Step | Gas | Cost @ 0.35 gwei |
|---|---|---|
| `createJob` (escrow record / minimal-proxy clone) | ~120,000 | $0.115 |
| USDC `approve` | ~46,000 | $0.044 |
| `fund` (client deposits USDC) | ~90,000 | $0.086 |
| `release` (pay freelancer, close job) | ~70,000 | $0.067 |
| **Happy-path total** | **~326,000** | **$0.31** |
| Optional: dispute → arbiter ruling | ~150,000 | $0.144 |
| Optional: refund to client | ~70,000 | $0.067 |
| One-time: deploy factory + escrow logic | ~2,500,000 | $2.39 |

**Fee as a share of the escrowed amount:**

| Job size | Happy-path fee | % of job |
|---|---|---|
| $2,000 (your floor) | $0.31 | **0.016%** |
| $10,000 | $0.31 | 0.003% |
| $50,000 (your ceiling) | $0.31 | **0.0006%** |

**Stress test — what if gas spikes?**

| Condition | Total fee | % of a $2,000 job |
|---|---|---|
| 0.35 gwei (now) | $0.31 | 0.016% |
| 1 gwei (busy day) | $0.89 | 0.045% |
| 10 gwei (major event, lasts minutes–hours) | $8.90 | 0.45% |
| 50 gwei (2021-style, not seen in years) | $44.50 | 2.2% |

Even a 30x spike costs less than 0.5% of your smallest job. Stripe charges 2.9% + $0.30.

## 3. L2 comparison

| Chain | Per-job cost | vs mainnet |
|---|---|---|
| Ethereum mainnet | $0.31 | 1x |
| Base | ~$0.01 (exec $0.005 + L1 blob data ~$0.005) | ~30x cheaper |
| Arbitrum One | ~$0.02 | ~15x cheaper |
| OP Mainnet | ~$0.01 | ~30x cheaper |

At your volume the absolute difference is noise:

| Jobs/year | Mainnet | Base | You save |
|---|---|---|---|
| 1,000 | $312 | $10 | $302/yr |
| 10,000 | $3,120 | $100 | $3,020/yr |
| 100,000 | $31,200 | $1,000 | $30,200/yr |

Saving $300/yr while intermediating $2M–$50M of contract value is not a reason to pick a chain.
The crossover where gas actually matters is somewhere north of ~50,000 jobs/year — and if you get
there, adding an L2 deployment later is straightforward.

## 4. Why mainnet wins on the things that *do* matter

Gas is not the deciding variable. Custody risk is. This app holds other people's money —
potentially $50,000 of a client's money and a freelancer's entire month of income — for days to
weeks. Optimize for the security of the held funds, not for $0.30.

1. **No bridge risk.** Bridges are the single largest category of crypto loss by dollar value.
   On an L2, every dollar you escrow has crossed a bridge and sits behind it. On mainnet the USDC
   is native, issued by Circle, with no additional trust assumption between the deposit and the
   payout.
2. **No sequencer dependency on time-sensitive logic.** Escrow contracts have deadlines:
   auto-release after N days, dispute windows, timeouts. Every major L2 still has a single
   centralized sequencer and has had multi-hour outages. An outage that straddles a dispute
   deadline is a legal problem, not an availability inconvenience — a freelancer who could not
   file a dispute because the chain was down has a real grievance against you.
3. **No 7-day withdrawal delay.** Optimistic rollups (Base, Arbitrum, OP) have a ~7-day challenge
   period to exit to mainnet. If your freelancer wants dollars in a bank account, "paid" now means
   "paid in a week," or it means paying a liquidity provider to front it. That directly undermines
   the product promise: fast payment on delivery.
4. **Highest-value-per-transaction, lowest-frequency profile.** The rule of thumb is L2s for
   consumer/social/gaming/micropayments — high frequency, low value, UX-sensitive. Your workload
   is the exact opposite: roughly 4 transactions per job, spread over weeks, each carrying
   thousands of dollars. That is mainnet's profile.
5. **Arbitration and integration surface.** Mainnet has the deepest support for the things escrow
   needs: multisig/Safe arbiters, hardware wallets, institutional custody, exchange withdrawal
   addresses, compliance/analytics tooling, and every fiat on/off-ramp. Fewer "my wallet doesn't
   support that network" support tickets, which will cost you far more than $0.30 per job.
6. **Finality for dispute resolution.** ~13 minutes to mainnet finality vs. an optimistic rollup
   state root that is only economically final. When a ruling moves $50,000, you want the
   strongest settlement guarantee available.

## 5. What I would actually build

- **Chain:** Ethereum mainnet.
- **Asset:** native USDC (`0xA0b8…eB48`). Jobs are denominated in dollars; do not make either
  party carry ETH volatility on a 3-week hold. Users still need a few cents of ETH for gas — or
  sponsor it (see below).
- **Architecture:** one deployed escrow implementation + EIP-1167 minimal-proxy clones per job
  (~120k gas each), *not* a fresh full deploy per job. Cheaper, and each job gets an isolated
  address that the client can just send USDC to.
- **Gas UX:** ERC-2612 `permit` to collapse approve+fund into one transaction, and ERC-4337
  paymaster sponsorship so you eat the ~$0.31 and neither party ever sees a gas prompt. Fold it
  into your platform fee; it is ~0.016% of a minimum job.
- **Fee settings:** `maxFeePerGas` 2 gwei, `maxPriorityFeePerGas` 0.05 gwei. That is ~6x headroom
  over the current base fee, so you ride out normal spikes without stuck transactions. Only
  back off on a genuine >10 gwei event — and for a release transaction, just pay it.
- **Revisit trigger:** if you exceed ~50,000 jobs/year, or if your users turn out to already
  transact primarily on Base, deploy a second instance on Base and keep mainnet as the
  high-value tier. A common hybrid is: value settles on mainnet, low-stakes interactions
  (messaging, milestones, attestations) happen on an L2.

## 6. Honest counterargument

If your target users are already Base-native — they hold USDC on Base, they get paid on Base,
they never bridge to mainnet — then deploy on Base. The bridge and withdrawal-delay objections
mostly dissolve when nobody needs to exit, and you get sub-cent fees plus 2s blocks. But that is
a *user-location* argument, not a cost argument. Do not pick an L2 because mainnet sounds
expensive: at $0.31 per job on a $2,000 minimum, it isn't.

---

### Caveats
- Gas and ETH price are live values and move; the recommendation is insensitive to both, because
  it does not turn on cost. The stress table above shows it holds even at a 100x gas increase.
- Gas figures per step are engineering estimates for a typical escrow design (±30%); measure with
  `forge test --gas-report` once the contract exists.
- Not legal advice. Escrow and money transmission are regulated activities in many
  jurisdictions — get counsel before holding customer funds.

*Verify current conditions:* `cast base-fee --rpc-url https://ethereum-rpc.publicnode.com`
