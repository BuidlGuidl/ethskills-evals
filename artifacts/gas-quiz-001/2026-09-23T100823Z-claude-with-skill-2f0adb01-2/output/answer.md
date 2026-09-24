# Which chain for a freelance escrow service?

**Recommendation: Ethereum mainnet.** Gas is not a meaningful cost at your ticket
size, and everything else about escrow — settlement finality, dispute credibility,
stablecoin liquidity, custody tooling — favors L1. If you want a second deployment
for a consumer-scale tier later, Base is the one to pick.

---

## Live numbers used (checked 2026-09-23)

| Input | Value | Source |
|---|---|---|
| Mainnet base fee | **0.367 gwei** | `cast base-fee` via publicnode + drpc (agreed) |
| Mainnet gas price (base + tip) | **0.378 gwei** | `cast gas-price` |
| ETH/USD | **$2,733** | CoinGecko |
| Base L2 gas price | 0.006 gwei | `cast gas-price` via mainnet.base.org |
| Arbitrum gas price | 0.020 gwei | `cast gas-price` via arb1 |
| Optimism gas price | 0.001 gwei | `cast gas-price` via mainnet.optimism.io |

I priced mainnet at **0.4 gwei** to leave a little headroom over the live 0.378.

Anchor for anyone carrying an old mental model: mainnet base fee has been under
1 gwei since Fusaka (Dec 2025) raised the gas limit to 60M, on top of EIP-4844
blobs (Mar 2024) and Pectra (May 2025). The "gas is 30-100 gwei" figure is roughly
100x stale.

## Gas per escrow job

Assuming a factory + EIP-1167 minimal-proxy per job, USDC as the payment asset:

| Step | Gas |
|---|---|
| `approve` USDC | ~46,000 |
| `createJob` (clone 55k + `transferFrom` 60k + init storage 50k) | ~165,000 |
| `release` (payout transfer + state update) | ~80,000 |
| **Happy path total** | **~290,000** |
| Disputed path (+ arbiter ruling, split payout) | ~400,000 |

One-time factory deploy: ~2,500,000 gas.

## Cost per job

```
290,000 gas x 0.4 gwei = 116,000 gwei = 0.000116 ETH
0.000116 ETH x $2,733  = $0.32
```

| Scenario | Mainnet | Base L2 |
|---|---|---|
| Happy path, normal fees (0.4 gwei) | **$0.32** | ~$0.01 (exec $0.005 + blob data ~$0.005) |
| Disputed path (400k gas) | $0.44 | ~$0.014 |
| Congestion spike, 5 gwei | $3.96 | ~$0.02 |
| Severe spike, 20 gwei | $15.84 | ~$0.03 |
| One-time factory deploy | $2.73 | ~$0.20 |

## The ratio that decides it

| Job size | Mainnet fee | As % of job |
|---|---|---|
| $2,000 (your floor) | $0.32 | **0.016%** |
| $10,000 | $0.32 | 0.003% |
| $50,000 (your ceiling) | $0.32 | 0.0006% |
| $2,000, during a 20 gwei spike | $15.84 | 0.79% |

For comparison, on a $2,000 job:
- Stripe (2.9% + $0.30): **$58.30**
- International wire: **$25-45**
- Upwork/Fiverr platform take (5-20%): **$100-400**
- Your mainnet escrow: **$0.32**

The chain choice moves your cost by **$0.31 per job**. Your competition's fee
structure moves it by **$58-400**. Optimizing the $0.31 is not where the business is.

At volume this holds: 500 jobs/month = 145M gas = 0.058 ETH = **~$159/month** on
mainnet vs **~$5/month** on Base. A $154/month difference for a service moving
$1M-25M/month in escrowed value.

## Why mainnet wins on the things that aren't gas

1. **Finality matters more than fees when you hold $50,000.** Optimistic rollups
   (Base, Arbitrum, OP) have a ~7-day challenge window for native withdrawals to
   L1. A freelancer who gets paid and wants funds out to a mainnet-settled off-ramp
   either waits a week or pays a liquidity bridge a spread — which is a larger and
   far more variable cost than the $0.31 you saved. On mainnet, released means released.

2. **Sequencer centralization is an escrow-specific risk.** Base and Arbitrum both
   run a single sequencer today. Escrow's entire value proposition is "this contract
   will pay out even if everyone involved, including me, is uncooperative." A
   sequencer outage means a delivered job can't be released on time. Forced-inclusion
   escape hatches exist but take hours and are not something a freelancer will use.

3. **Stablecoin liquidity and off-ramps.** Native USDC, the deepest exit venues, and
   every institutional custody/compliance vendor are mainnet-first. For a payments
   business this is the practical constraint, not throughput.

4. **Dispute credibility.** If you ever need arbitration (Kleros et al.) or want a
   legal argument that the escrow is a real, publicly verifiable instrument,
   mainnet is the venue that needs no explanation to a counterparty or a court.

5. **You have no L2 reason.** L2s win on high-frequency, low-value, consumer-scale
   traffic. An escrow is roughly 3 transactions per job over a multi-week lifecycle.
   Low frequency, high value, latency-insensitive — the exact opposite profile.

## When I'd change this answer

- **If your average job drops to $20-100** (microtasks, bounties, per-hour streaming
  payments), fees start mattering and Base becomes correct.
- **If volume exceeds ~50,000 jobs/month**, the $159/mo becomes ~$16,000/mo and is
  worth engineering around — likely as a hybrid (L2 execution, mainnet settlement
  for large jobs).
- **If your users are already L2-native** and hold funds on Base/Arbitrum, meet them
  there; the bridging friction outweighs the security argument.

## Practical fee settings

```javascript
maxFeePerGas: parseGwei("2")            // ~5x headroom over the 0.378 live price
maxPriorityFeePerGas: parseGwei("0.05") // ample for next-block inclusion
```

Add a spike guard on the *release* path — it's the one transaction that is
time-sensitive to the freelancer:

```javascript
const { maxFeePerGas } = await provider.getFeeData();
const gwei = Number(maxFeePerGas) / 1e9;
if (gwei > 5) console.warn(`Gas spike: ${gwei} gwei — release will cost ~$${(290000 * gwei * 1e-9 * ETH_USD).toFixed(2)}`);
```

Even at 20 gwei, absorbing the fee yourself costs $15.84 on a job you're earning a
percentage of — so consider sponsoring gas (ERC-4337 paymaster) rather than making
the freelancer think about it. That UX win is worth more than the chain choice.

## Caveats

Gas and ETH price are volatile; re-check with
`cast base-fee --rpc-url https://ethereum-rpc.publicnode.com` before quoting these
to anyone. The gas-per-step figures are estimates from typical escrow contract
shapes — profile your actual contracts with `forge test --gas-report` once written.
The order of magnitude (sub-dollar per job on mainnet, and therefore irrelevant
against a $2,000+ ticket) is stable and is what the recommendation rests on.
