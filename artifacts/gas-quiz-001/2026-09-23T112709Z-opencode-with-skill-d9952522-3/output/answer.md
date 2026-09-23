# Recommendation: Ethereum mainnet

Deploy the escrow on **Ethereum mainnet**. At current measured gas prices, the full
lifecycle of an escrow job costs about **$0.24** — at most 0.012% of even the smallest
($2,000) job. Cost is a non-factor here, so the decision should be driven by what
matters for a contract that custodies $2k–$50k of other people's money for days or
weeks: security, finality, and stablecoin liquidity, all of which favor mainnet.

## Measured inputs (live, 2026-09-23)

| Input | Value | Source |
|---|---|---|
| Mainnet gas price | 347,002,319 wei = **0.347 gwei** | `cast gas-price` @ ethereum-rpc.publicnode.com |
| Base gas price (execution) | 6,000,000 wei = **0.006 gwei** | `cast gas-price` @ mainnet.base.org |
| Base L1 data fee | **1.3e-8 ETH** (~$0.00004) on a recent 139k-gas receipt | `l1Fee` field, latest Base block receipt |
| ETH/USD | **$2,720.95** | Coinbase spot API |

## Gas-usage assumption

One job touches the chain ~3 times and is low-frequency (days–weeks between actions):

| Action | Estimated gas | Justification |
|---|---|---|
| Create escrow (state writes or minimal-proxy deploy) | ~120,000–180,000 | Proxy deploy + a few storage slots |
| Fund (ERC-20 stablecoin transfer in) | ~50,000–65,000 | ERC-20 transfer + bookkeeping |
| Release / refund (payout + state update) | ~60,000–100,000 | ERC-20 transfer(s) + state |
| **Total per job** | **~250,000 gas** | |

## Cost per job

**Mainnet:** 250,000 × 0.347 gwei = 8.68e-5 ETH × $2,720.95 ≈ **$0.24**
- vs. a $2,000 job: 0.012% — vs. a $50,000 job: 0.0005%

**Base (L2):** execution 250,000 × 0.006 gwei = 1.5e-6 ETH, plus a measured-scale L1
fee of ~1e-8 ETH ⇒ **≈ $0.004** per job

The L2 saves about **$0.23 per job**. Even at 10,000 jobs/year that is ~$2,300/year —
irrelevant next to the risk profile of custodying five figures per job.

## Why mainnet for this workload

- **Low-frequency, high-value** is exactly the profile where mainnet stays viable: a
  handful of transactions per job, each guarding $2k–$50k.
- **Custody risk dominates cost.** Funds sit in the contract for days–weeks. Mainnet
  has the strongest finality, no sequencer/bridge dependency, and the most
  battle-tested escrow and multisig infrastructure.
- **Liquidity and payouts.** Deepest USDC/USDT liquidity and simplest fiat off-ramps
  for paying freelancers.
- The old intuition "mainnet gas is expensive" is stale — measured today, it is
  0.35 gwei.

## When to revisit

- If mainnet gas returns to a high regime: at 20 gwei a job costs ~$13.60 (0.68% of a
  $2k job — borderline); at 50 gwei ~$34 (1.7%). In that regime, route small jobs to
  an OP-stack L2 like Base (measured ≈ $0.004/job today) and keep large ones on
  mainnet.
- If job volume on the small end becomes very high-frequency, the calculus also shifts
  toward an L2.

One caveat that matters more than chain choice: at $50k held per job, spend the
savings on an audit and use battle-tested patterns (pull payments, timelocked
arbitration, reentrancy guards). That risk dwarfs any gas difference.
