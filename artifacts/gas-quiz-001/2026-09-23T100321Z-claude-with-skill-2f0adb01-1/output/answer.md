# Which chain for a freelance escrow ($2k–$50k per job)?

**Recommendation: Ethereum mainnet.** Deploy the escrow contract and custody the
funds on L1. Gas is not a meaningful cost at this ticket size, and everything
else that matters for a product that *holds other people's money* points to
mainnet. If you expect very high job volume or want to sponsor gas for
non-crypto-native users, Base is the reasonable second choice — but pick it for
UX reasons, not to save money.

---

## Live numbers used

Measured 2026-09-23, not from memory:

| Input | Value | Source |
|---|---|---|
| Mainnet base fee | **0.338 gwei** | `cast base-fee` via publicnode + drpc (agreed) |
| Priority fee assumed | 0.05 gwei | typical tip in current conditions |
| Effective mainnet gas price | **~0.39 gwei** | base + tip |
| Base L2 base fee | 0.005 gwei | `cast base-fee --rpc-url https://mainnet.base.org` |
| Arbitrum One base fee | 0.020 gwei | `cast base-fee --rpc-url https://arb1.arbitrum.io/rpc` |
| ETH/USD | **$2,734.46** | Chainlink ETH/USD feed on L1, cross-checked vs CoinGecko ($2,734.54) |

Sanity note if you carry a 2021–2023 mental model: mainnet gas is *not* 20–50
gwei anymore. It is routinely under 1 gwei after Dencun/Pectra/Fusaka. That
single fact is what makes mainnet viable here.

## Cost per escrow job on mainnet

Gas estimates for a factory + EIP-1167 clone escrow holding USDC:

| Operation | Gas | @0.39 gwei (now) | @1 gwei (busy) | @10 gwei (spike) |
|---|---:|---:|---:|---:|
| `approve` USDC (client) | 46,000 | $0.049 | $0.126 | $1.26 |
| `createJob` + deposit (`transferFrom`) | 120,000 | $0.128 | $0.328 | $3.28 |
| `release` payout to freelancer | 65,000 | $0.069 | $0.178 | $1.78 |
| **Happy path total** | **231,000** | **$0.25** | **$0.63** | **$6.32** |
| Disputed path (+ arbitrated split) | +95,000 | +$0.10 | +$0.26 | +$2.60 |
| Deploy factory + implementation (one-time) | 1,900,000 | $2.03 | $5.20 | $51.95 |

As a fraction of the job value:

| Job size | Mainnet fee now | % of value | Same job on a 10 gwei spike | Stripe (2.9% + $0.30) | Escrow.com (3.25%) |
|---|---|---|---|---|---|
| $2,000 | $0.25 | **0.012%** | $6.32 (0.32%) | $58.30 | $65.00 |
| $50,000 | $0.25 | **0.0005%** | $6.32 (0.013%) | $1,450.30 | $1,625.00 |

Gas is flat per job; your incumbent competitors charge a percentage. On a
$50,000 job you are underpricing Escrow.com by roughly 6,500x on the settlement
fee alone.

## What an L2 would actually save

Rough per-job lifecycle on Base is **~$0.005–0.01** (L2 execution is near-free;
the L1 blob data component dominates). So:

- Saving per job: **~$0.24**
- At 1,000 jobs/month: **~$240/month** saved
- At 100 jobs/month: **~$24/month** saved

That is a rounding error against the value at risk. At 1,000 jobs/month you are
custodying somewhere between $2M and $50M. Choosing your custody layer to save
$240/month on that is the wrong trade.

## Why mainnet wins on the things that aren't gas

1. **You are a custody product, not a consumer app.** The contract holds up to
   $50k per job for days or weeks. Mainnet has no sequencer, no upgradeable
   bridge holding the canonical assets, and no additional trusted party between
   your users' money and settlement. Every L2 adds at least one of those.
2. **Withdrawal latency cuts the wrong way.** A freelancer paid on Base or
   Arbitrum who wants dollars either waits ~7 days for the canonical bridge or
   pays a third-party fast bridge. On mainnet the USDC they receive is already
   the asset every exchange and off-ramp accepts. Paying $0.24 more to avoid
   putting a bridge in your payout path is obviously correct.
3. **Native USDC depth and off-ramps.** Circle mint/redeem and institutional
   rails are deepest on L1. Escrow disputes sometimes end in partial refunds and
   conversions; you want the most liquid venue.
4. **Dispute/arbitration tooling.** Kleros and comparable arbitration primitives,
   plus multisig/timelock arbitrator setups your users may already trust, are
   most mature on L1.
5. **Low transaction frequency.** You do ~3 transactions per job over a
   multi-week lifecycle. This is the exact profile mainnet is good at. L2s win
   on high-frequency, low-value, latency-sensitive flows — not this.

## The honest case against mainnet

- **Gas spikes.** A 10 gwei event makes a release cost ~$1.78 instead of $0.07,
  and 50 gwei makes the full lifecycle ~$32. Spikes last minutes to hours, and a
  release that is not time-critical can wait. Mitigate by setting
  `maxFeePerGas` around 2 gwei with a `maxPriorityFeePerGas` of ~0.05 gwei, and
  warn in the UI when base fee exceeds ~5 gwei rather than silently overpaying.
- **Users need ETH for gas.** This is the real friction, not the fee amount. Fix
  it with ERC-4337 and a paymaster so you sponsor gas and bill it into your take
  rate — at $0.25/job you can absorb it entirely and market the service as
  "no gas fees."
- **Block time.** L1 confirmation is slower than an L2 soft confirmation. For an
  escrow where the state change is "work accepted, pay out," a few seconds is
  irrelevant.

## When to pick Base instead

Switch if any of these become true:

- Volume goes past ~10,000 jobs/month **and** your average ticket drops toward
  the low end (micro-gigs of $50–500), where $0.25 starts being a visible
  percentage.
- You want in-app micro-actions — milestone check-ins, per-message escrow
  updates, streaming payments — that would be dozens of transactions per job.
- Your users already live on Base (Coinbase onramp, Farcaster-adjacent
  distribution), making it their default wallet network.

If you go that route, the hybrid is also valid: hold long-dated, large balances
on mainnet and run the interaction-heavy job state machine on Base.

## Concrete build plan

- Deploy on **Ethereum mainnet**: one escrow implementation + EIP-1167 clone
  factory (~$2 one-time, ~$0.13 per job to open).
- Denominate in **native USDC**, not ETH — freelancers should not carry price
  risk on a $50k invoice for three weeks.
- Fund jobs with **EIP-2612 `permit`** instead of a separate `approve` where
  USDC supports it; that removes 46,000 gas and one user signature per job.
- Arbitrator as a **timelocked multisig** initially, with a documented path to a
  decentralized arbitration service.
- Add an **ERC-4337 paymaster** so clients and freelancers never touch ETH.
- Emit a base-fee warning above ~5 gwei and let non-urgent releases queue.

---

*Gas prices fluctuate. Re-check before quoting these figures to anyone:*
`cast base-fee --rpc-url https://ethereum-rpc.publicnode.com`
