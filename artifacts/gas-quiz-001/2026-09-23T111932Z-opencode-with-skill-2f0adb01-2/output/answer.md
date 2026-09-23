# Escrow Service for Freelance Payments: Chain Recommendation

## Recommendation: Ethereum mainnet

Deploy on **Ethereum mainnet** — not an L2, and definitely not an alt-L1. Gas cost is a
non-issue for this use case, and everything that actually matters for an escrow product
(security, stablecoin liquidity, user trust, no bridge friction) favors mainnet.

---

## The numbers I used (verified live, 2026-09-23)

| Input | Value | Source |
|---|---|---|
| ETH price | **~$2,732** | CoinGecko API (live) |
| Mainnet base fee | **~0.33 gwei** | `cast base-fee --rpc-url https://ethereum-rpc.publicnode.com` (live) |
| Post-Fusaka typical base fee | 0.1–0.5 gwei | Historical range since Dec 2025 |
| Busy-period fee | ~1 gwei | Occasional |
| Spike fee | ~10 gwei | Rare, minutes-to-hours during major events |

Cost formula: `cost($) = gas_used × gas_price(gwei) × 1e-9 × ETH_price($)`

## What an escrow job actually costs

A typical escrow lifecycle on-chain:

| Operation | Est. gas | @ 0.33 gwei (today) | @ 1 gwei (busy) | @ 10 gwei (spike) |
|---|---|---|---|---|
| Client funds escrow (ERC-20 transfer + logic) | ~100,000 | $0.09 | $0.27 | $2.73 |
| Release to freelancer on delivery | ~80,000 | $0.07 | $0.22 | $2.19 |
| Dispute/refund path (when needed) | ~80,000 | $0.07 | $0.22 | $2.19 |
| **Full lifecycle (fund + release)** | **~180,000–250,000** | **~$0.16–0.22** | **~$0.49–0.68** | **~$4.90–6.83** |
| One-time contract deployment | ~800,000–1,500,000 | ~$0.72–1.35 | ~$2.20–4.10 | ~$22–41 |

## Why gas is irrelevant to this decision

Your jobs hold **$2,000–$50,000**. Compare that to the fees:

| Scenario | Lifecycle fee | % of a $2,000 job | % of a $50,000 job |
|---|---|---|---|
| Today (0.33 gwei) | ~$0.22 | 0.011% | 0.0004% |
| Busy (1 gwei) | ~$0.68 | 0.034% | 0.0014% |
| Spike (10 gwei) | ~$6.83 | 0.34% | 0.014% |

Even in a worst-case fee spike, gas is a fraction of a percent of the *smallest* job.
This is a **low-frequency, high-value** application — a handful of transactions per job,
each securing thousands of dollars. That is exactly the profile mainnet is for.

## Why mainnet over an L2

An L2 (Base, Arbitrum) would cut the ~$0.22 lifecycle cost to ~$0.005 — a saving of
about twenty cents on a $2,000+ escrow. In exchange you would take on real costs:

1. **Security matches the value at risk.** You're custodying up to $50K per job.
   Mainnet gives you Ethereum's full validator set and finality; an L2 adds sequencer
   and bridge trust assumptions to save negligible fees.
2. **Stablecoin liquidity.** Escrow payments will overwhelmingly settle in USDC/USDT.
   The deepest native liquidity, and the tokens your users already hold, are on mainnet.
3. **No bridge friction.** Asking freelance clients to bridge funds to an L2 before
   funding an escrow adds UX failure modes and support burden for zero meaningful benefit.
4. **Composability.** If you later add fiat on-ramps, yield on idle escrowed funds, or
   arbitration integrations, the relevant protocols live on mainnet.
5. **Perception/trust.** "Funds are held in escrow on Ethereum mainnet" reads better to
   a client wiring $30K than an unfamiliar L2.

L2s shine for high-frequency consumer apps (games, social, micropayments) where users
make many small transactions. An escrow does the opposite: rare, large, security-critical
transactions.

## Practical fee settings for the contracts

```javascript
maxFeePerGas: "1-2 gwei"            // headroom; base fee is usually 0.1-0.5 gwei
maxPriorityFeePerGas: "0.01-0.1 gwei"  // enough for quick inclusion
```

Add a spike guard so non-urgent operations (e.g., dispute resolution) don't execute
during a rare 10+ gwei event:

```javascript
const feeData = await provider.getFeeData();
const baseFee = Number(feeData.maxFeePerGas) / 1e9;
if (baseFee > 5) console.warn(`Gas spike: ${baseFee} gwei. Consider waiting.`);
```

## When I'd revisit this

- If you drop your minimum job size below ~$200, per-transaction fees start to matter
  and **Base or Arbitrum** (fees ~5–10x lower, ~$0.001–0.005 per op) become attractive.
- If you move to per-milestone streaming payments (many small releases per job), an L2's
  sub-cent fees and fast blocks (250ms–2s vs 8s) improve UX.

For the stated product — $2K–$50K escrows, a few transactions each — **mainnet, and
don't overthink it**.
