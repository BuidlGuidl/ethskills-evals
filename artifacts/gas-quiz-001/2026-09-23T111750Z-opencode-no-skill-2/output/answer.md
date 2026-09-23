# Recommendation: Base (with Arbitrum One as a close second)

## TL;DR

At $2,000–$50,000 per job, gas fees are **not** what should drive this decision —
even Ethereum mainnet at its most expensive charges ~2% of the *smallest* job.
What matters is that escrow means **parking money for days or weeks**, so chain
security, stablecoin liquidity, and fiat on/off-ramps dominate. Base wins on
that bundle: it's a L2BEAT **Stage 1** rollup (live fault proofs, constrained
security council), it holds the **deepest USDC liquidity of any L2 (~$4.3B)**,
it has the **lowest fees of the major chains (~$0.001–0.005/tx)**, and
freelancers can cash out directly through Coinbase with no bridge and no L1
gas. Arbitrum One is the pick if you want the strongest proof system
(permissionless BoLD fraud proofs) and deeper multi-stablecoin liquidity.

---

## 1. The gas model for an escrow lifecycle

An escrow is not one transaction. Per job (USDC-denominated):

| Operation | Gas (approx) |
|---|---|
| Client approves USDC to escrow | ~46,000 |
| Client deposits (transferFrom + storage write) | ~70,000 |
| Release to freelancer (transfer + storage clear) | ~55,000 |
| **Total per job** | **~170,000** |

Plus a one-time contract deployment: a Solidity escrow with dispute/refund
logic lands around **1.2–1.5M gas** (measured ranges for comparable contracts:
1.3M for an OpenZeppelin-style ERC-20, ~1.6M for a mid-size app contract).

## 2. What that costs on each chain

Fee formula: `gas × gas_price (gwei) × ETH_price / 1e9`. ETH assumed at $2,500.
Mainnet scenarios bracket reality: it has ranged from **0.65 gwei (today,
historically anomalous low)** to **8 gwei (typical active market)** to
**30–100 gwei (bull-market congestion)**.

### Per-job cost (170k gas) and % of escrow value

| Chain | Fee scenario | Cost/job | % of $2,000 job | % of $50,000 job |
|---|---|---|---|---|
| Ethereum L1 | 0.65 gwei (current) | $0.28 | 0.014% | 0.0006% |
| Ethereum L1 | 8 gwei | $3.40 | 0.17% | 0.0068% |
| Ethereum L1 | 30 gwei (bull) | $12.75 | 0.64% | 0.026% |
| Ethereum L1 | 100 gwei (spike) | $42.50 | **2.1%** | 0.085% |
| Base | ~$0.001–0.005/tx | **~$0.01** | ~0.0005% | ~0.00002% |
| Arbitrum One | ~$0.003–0.01/tx | **~$0.02** | ~0.001% | ~0.00004% |
| Polygon PoS | ~$0.002/tx | ~$0.01 | ~0.0005% | ~0.00002% |

### One-time deployment cost (1.5M gas)

| Chain | Cost |
|---|---|
| Ethereum L1 @ 0.65 gwei | $2.44 |
| Ethereum L1 @ 30 gwei | $112.50 |
| Ethereum L1 @ 100 gwei | $375 |
| Base / Arbitrum | **< $1** |

## 3. What the numbers actually say

**The fee argument for L2s is weaker than it looks at first — but it's still
real at the low end of your range.**

- For a $50,000 job, even a 100-gwei mainnet spike costs $42.50 — 0.085% of
  the job. That's less than a credit-card processor would take (Stripe on a
  $50k invoice: ~$1,450 at 2.9%). At the top of your range, **mainnet fees are
  irrelevant**.
- For a $2,000 job, the same spike costs 2.1% of the job value — and escrow
  involves *several* transactions (approve, deposit, release, plus any dispute
  or refund flow), each of which eats that fee again. During a 2021-style
  congestion period, mainnet gas alone would rival traditional payment fees.
- Mainnet gas is also **unpredictable**: it has swung from ~0.1 gwei to 100+
  gwei, a >100x range. You'd be pricing your product's fee disclosure off a
  market that can move 10–50x in a day. Base's fee floor of 0.005 gwei keeps
  costs at fractions of a cent *permanently*.

So gas eliminates mainnet as the *default*, but the real decision drivers are:

### a) Funds sit in escrow for days to weeks — security is the product

The fee is paid once; the custody risk is held the entire length of the job.
This rules out cheap sidechains/L2s with weak trust models (Stage 0 chains
where a multisig can unilaterally upgrade the contracts holding your escrow —
e.g. zkSync Era and Linea). Base and Arbitrum are both **L2BEAT Stage 1**:
fault proofs live, escape hatches to L1 functional, security councils
constrained. Arbitrum's BoLD is the only fully permissionless fraud-proof set
in production, which is why it's the runner-up.

### b) Stablecoin liquidity and cash-out paths

Freelancers need to get paid in something they can actually spend:

- **Base: ~$4.3B USDC** (native, Circle-issued, CCTP-minted — no wrapped
  token), plus direct Coinbase withdrawals with no bridge and no L1 gas.
- **Arbitrum: ~$4.2B stablecoins** across USDC (~$2.6B native) and USDT —
  deeper if you need multi-issuer support.
- Polygon PoS is comparably cheap but is a sidechain (no L1 settlement, its
  own validator set), which is a meaningfully weaker custody story for
  week-long escrows.

### c) The 7-day L1 withdrawal window is a non-issue for this design

The optimistic-rollup challenge window only applies to *canonical exits to
Ethereum mainnet*. Your escrow never needs to touch L1: deposits and payouts
stay on the L2, and freelancers off-ramp via exchanges (Coinbase for Base;
Binance/OKX/Kraken support direct Arbitrum and Base withdrawals). The window
would only matter if a client insisted on settlement to mainnet — a rare,
one-time ~$0.10 L1-out cost plus patience.

## 4. Caveats

- **Base's sequencer is Coinbase-operated and its security council includes
  Coinbase.** If "one company can be forced to pause the chain" bothers your
  clients, or you expect compliance-sensitive flows that need neutrality,
  Arbitrum's DAO-governed, BoLD-secured chain is the more trust-minimized
  choice at essentially identical cost.
- **Don't deploy a single-chain monopoly.** The escrow contract is EVM, so
  deploying to Base first and adding Arbitrum later (both have native USDC and
  Circle's CCTP for burn-and-mint movement between them) is cheap insurance.
- **If your jobs clustered at the very top of the range** ($50k+, especially
  six figures), mainnet's L1 settlement — no sequencer, no council, no
  upgrade keys — becomes worth the ~$3–40 per job. At $2k–$50k, it isn't.

## 5. Bottom line

**Deploy on Base.** You get Stage 1 rollup security for week-long escrow
custody, sub-cent transaction costs that stay flat regardless of L1 congestion
(~$0.01 per full job lifecycle vs. $0.28–$42.50 on mainnet), the deepest USDC
liquidity outside L1, and frictionless fiat off-ramps for a global freelancer
workforce. Keep Arbitrum One as the second deployment target — it costs under
$1 in gas, and covers clients who want permissionless validation or USDT
support.

### Numbers recap

- Per-job gas: ~170,000 (approve + deposit + release)
- Deployment gas: ~1.5M
- ETH price assumption: $2,500
- Mainnet gas scenarios: 0.65 / 8 / 30 / 100 gwei → $0.28 / $3.40 / $12.75 /
  $42.50 per job
- Base per job: ~$0.01 (0.0005% of the smallest job)
- Deployment: <$1 on Base/Arbitrum vs. $2.44–$375 on mainnet depending on gas
- Fee as % of $2,000 job: 0.0005% (Base) vs. up to 2.1% (mainnet at 100 gwei)
- Fee as % of $50,000 job: negligible on every chain — which is why security,
  liquidity, and off-ramps, not gas, decide this
