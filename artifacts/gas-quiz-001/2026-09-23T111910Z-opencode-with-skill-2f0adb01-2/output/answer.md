# Escrow service for freelance payments: which chain?

**Recommendation: Ethereum mainnet (L1).**

Not an L2 — despite the reflexive "use an L2 for a consumer app" advice. The
gas math at your ticket sizes ($2,000–$50,000/job) makes fees a rounding
error, while escrow's core product feature is *trust*, and trust is what
mainnet settlement buys you.

## Live numbers I used (checked 2026-09-23)

- **Base fee: ~0.33 gwei** (`cast base-fee --rpc-url https://1rpc.io/eth` →
  326,404,096 wei). Post-Fusaka (Dec 2025) typical range is 0.1–0.5 gwei;
  event spikes reach 10–50 gwei but last minutes-to-hours, not days.
- **ETH: ~$2,500–2,700** (CoinGecko/CoinDesk, 2026-09-23). I use $2,500 below.
  ETH is volatile — recheck before quoting anything.

## What a job actually costs on mainnet

A USDC escrow has a tiny transaction footprint. Per job lifecycle:

| Step                        | Gas (approx) | @ 0.33 gwei (today) | @ 1 gwei (busy) | @ 10 gwei (event spike) |
|-----------------------------|--------------|---------------------|----------------|--------------------------|
| Client `approve()` USDC     | ~46,000      | $0.038              | $0.115         | $1.15                    |
| Deposit into escrow        | ~80,000      | $0.066              | $0.20          | $2.00                    |
| Release / payout           | ~50,000      | $0.041              | $0.125         | $1.25                    |
| **Total per job**          | **~176,000** | **~$0.15**          | **~$0.44**     | **~$4.40**               |

(Cost = gas × gwei × ETH price ÷ 1e9 × 1e9; verified against the known
21,000-gas ETH transfer ≈ $0.004 at 0.1 gwei / $2,000 ETH.)

One-time costs:

- Singleton escrow deploy: ~500,000 gas → **$0.41 today**, $12.50 even at a
  10 gwei spike. A factory of per-job escrow contracts (~350–500k each) is
  also affordable if you want per-job isolation.

**Fee as a fraction of job value (worst realistic case, 10 gwei spike):**

- $2,000 job: $4.40 = **0.22%** of the job
- $2,000 job at today's 0.33 gwei: $0.15 = **0.0075%**
- $50,000 job at 0.33 gwei: $0.15 = **0.0003%**

Even a 50 gwei black-swan mega-spike (~$22/job) is ~1.1% of the *smallest*
job — and you can batch releases or wait an hour for spikes to pass.

## The comparison that decides it

| Chain    | Per-job cost | Savings vs mainnet |
|----------|--------------|--------------------|
| Mainnet  | ~$0.15–0.44  | —                  |
| Base      | ~$0.01–0.02  | ~$0.13–0.42/job    |
| Arbitrum  | ~$0.01–0.02  | ~$0.13–0.42/job    |

You'd save roughly **a quarter per job** by taking on L2 stack risk while
holding five figures of client money. At any volume, the savings never buy
back the added risk: 10,000 jobs/month = ~$3,000 saved vs. a business
holding millions in float on a sequencer/bridge stack.

## Why mainnet

1. **Fees are irrelevant at this ticket size.** L2's economic edge exists for
   micro-payments and high-frequency flows (thousands of txs/day). A job here
   is 3–5 transactions spread over days or weeks.
2. **Security *is* the product.** You're holding $2k–$50k of other people's
   money per job, likely millions in aggregate. Mainnet settlement = full
   validator security, no sequencer risk, no L2 bridge risk, no
   security-council-upgrade headlines. For escrow, that trust posture is worth
   marketing on; "your funds are on Ethereum L1" is a sales argument.
3. **Liquidity + tooling.** Freelancers and clients want USD, not ETH —
   USDC on mainnet has the deepest liquidity, cheapest on/off-ramps, the
   oldest audit trail, and the best explorers/indexers.
4. **Even the worst case is cheap.** Historically 10–50 gwei spikes cost
   $4–22/job for minutes-to-hours. Wait it out or batch.

## When I'd change the answer

- Ticket sizes under ~$100, or thousands of transactions per day → Base or
  Arbitrum (sub-cent fees, 250ms–2s soft confirmations start to matter).
- You want instant UX soft-confirmations → L2.
- Hybrid pattern (value on mainnet, daily ops on an L2) exists but adds
  complexity you don't need at this frequency.

## Caveats

- Gas and ETH price drift — recheck with `cast base-fee` and a Chainlink
  feed before publishing numbers to users. The order of magnitude (fractions
  of a cent to cents per job) has been stable since Fusaka.
- The *real* costs of this business are the audit, the dispute-resolution /
  arbitration design, and fiat rails — not gas. Budget accordingly.
- Use non-upgradeable contracts (or long timelocks) and a per-job factory;
  upgradeability on a money-holding contract is its own trust problem.

**Bottom line:** deploy on Ethereum mainnet. Mainnet's post-Fusaka fees
(0.1–0.5 gwei typical) mean you pay cents per job for L1 security — the
one thing an escrow service should never cheap out on.
