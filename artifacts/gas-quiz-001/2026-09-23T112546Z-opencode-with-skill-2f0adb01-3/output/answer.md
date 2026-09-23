# Escrow for Freelance Payments ($2,000–$50,000 per job): Chain Recommendation

## Recommendation: Ethereum mainnet

For a low-frequency, high-value escrow application, deploy on **Ethereum mainnet**.
Transaction fees are a rounding error relative to the amounts held, and mainnet gives
you the strongest security, the deepest stablecoin liquidity, and zero bridge risk for
funds that may sit locked for weeks.

## Live numbers used (verified 2026-09-23)

| Input | Value | Source |
|---|---|---|
| Mainnet base fee | **~0.33 gwei** (327,079,182 wei) | `cast base-fee` via publicnode RPC |
| ETH price | **~$2,730** ($2,730.38) | Chainlink ETH/USD feed `0x5f4e...8419`, `latestAnswer` |

Cost per 1,000 gas at these values: 0.33 gwei × 1,000 gas = 0.00033 ETH ≈ **$0.0009**.

## What one escrow job actually costs on mainnet

An escrow job lifecycle is roughly 3 transactions (using USDC, ERC-20):

| Step | Est. gas | Cost @ 0.33 gwei | Cost @ 10 gwei (spike worst case) |
|---|---|---|---|
| Client approves USDC | ~46,000 | $0.04 | $1.26 |
| Client deposits into escrow | ~120,000 | $0.11 | $3.28 |
| Release (or refund) to freelancer | ~90,000 | $0.08 | $2.46 |
| **Total per job** | **~256,000** | **≈ $0.23** | **≈ $7.00** |

One-time contract deployment (~1.5M gas): **≈ $1.35** at current prices. Use a
factory + minimal-proxy pattern and each new escrow instance costs only ~150k gas
(~$0.14) instead of a full redeploy.

## Fee as a percentage of funds held

| Job size | Fee @ 0.33 gwei ($0.23) | Fee @ 10 gwei spike ($7.00) |
|---|---|---|
| $2,000 | **0.012%** | 0.35% |
| $50,000 | **0.0005%** | 0.014% |

Even during a rare 10 gwei spike (which post-Fusaka lasts minutes to hours, not days),
fees are under 0.4% of the *smallest* job. At normal conditions they're ~1 basis point
of the smallest job. If a spike hits, you can simply wait an hour before releasing.

## Why mainnet over an L2

An L2 (Base, Arbitrum) would make the same lifecycle cost ~$0.005–0.01 instead of
$0.23 — a saving of about **$0.22 per job**. That saving is not worth what you'd give up:

1. **Security for parked value.** Escrow locks $2k–$50k per job for days to weeks.
   Mainnet is where you want long-held funds; L2s add sequencer-liveness and
   bridge-contract risk for no meaningful benefit at this transaction frequency.
2. **No bridging friction.** Clients paying $2k+ will already hold USDC/ETH on mainnet
   (or can on-ramp there directly). Forcing them to bridge adds cost, steps, and a
   failure mode right at the moment of deposit.
3. **Deepest stablecoin liquidity + tooling.** USDC/USDT native issuance, fiat
   on/off-ramps, custody solutions, and accounting tools are mainnet-first.
4. **Dispute-resolution simplicity.** If a dispute ever escalates to arbitration or
   legal enforcement, mainnet state is the most unambiguous reference.

L2s are the right call for high-frequency, low-value, consumer-facing transactions
(micro-payments, gaming, social). Escrow is the opposite profile: a handful of
transactions per job, each securing thousands of dollars. That is textbook
"high-value, low-frequency → mainnet."

## When to revisit

- If you later add **milestone micro-payouts** (e.g., $20–$100 weekly drips), those
  should live on an L2 — at that size mainnet fees start to matter.
- A **hybrid** design (custody on mainnet, optional cheap milestone payouts on an L2)
  is a reasonable phase two.

## Caveat on data freshness

Gas and ETH price drift. The base fee was verified live (~0.33 gwei); re-check with
`cast base-fee --rpc-url <rpc>` before relying on exact figures. The conclusion is
robust to large drift: fees would need to rise ~100x and stay there before an L2
becomes clearly preferable for this use case.
