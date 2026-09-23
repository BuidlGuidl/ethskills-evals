# Chain recommendation for the escrow service

**Recommendation: deploy on an Ethereum L2 — specifically Base (Arbitrum One is an
equally good fallback). Not Ethereum mainnet, not Solana.**

The reasoning below uses one shared escrow contract holding USDC (with a per-job
record), not a fresh contract deployment per job.

## The cost profile of one escrow job

A typical job touches the chain ~3 times:

| Step | Approx. gas |
|---|---|
| Payer `approve` (first time only) | ~46k |
| `createJob` + deposit | ~120k |
| `release` (or dispute + resolve, ~150k worst case) | ~80–150k |
| **Total per job** | **~200–250k gas** |

## What that costs per chain (September 2026 data)

| Chain | Typical fee per tx | Est. cost per escrow job (~250k gas) | Fee stability |
|---|---|---|---|
| Ethereum L1 | ~$0.01–0.05 at current ~0.1–1 gwei | **~$0.04–0.60 today, but $5–60 in congestion (30–100 gwei)** | Poor — base fee ranged ~0.1 to 100+ gwei over the past 2 years |
| Base | ~$0.0003–0.002 (USDC transfer ~$0.002) | **~$0.001–0.01** | High; spikes even under extreme L1 load stay < ~$1 |
| Arbitrum One | ~$0.001–0.05 | **~$0.002–0.03** | High |
| Optimism | ~$0.00007–0.003 | **~$0.001–0.01** | High |
| Solana | ~$0.0005 | ~**$0.001** | High |
| Polygon PoS | ~$0.0002–0.007 | ~$0.01–0.05 | High |

Sources: Etherscan gas tracker & ycharts (L1 average gas ≈ 0.84 gwei,
2026-09-14, ETH ≈ $2,500); arxiv 2606.22206 Table 2 (Q1 2026 median fees:
L1 $0.012, Base $0.0016, Arbitrum $0.0022, OP $0.000027, Solana $0.0005);
spark.money L2 fee comparison (USDC transfer: Base ~$0.002, Arbitrum ~$0.05,
L1 $2–15); gasfeepredictor.com live L2 fee tracker.

## Why the L2 wins for *this* use case

1. **The values being secured ($2k–$50k) don't justify L1 fee variance.**
   A chain should be chosen so transaction costs stay negligible against the
   smallest job. Budget: keep lifecycle fees under 0.1% of a $2,000 job = **$2**.
   - L1 passes *today* (~$0.6/job at sub-gwei prices) but fails the moment gas
     returns to even 30 gwei (~$19/job ≈ 1% overhead, and worse with a dispute).
   - Base/Arbitrum/OP pass at ~$0.01/job **at all times** (~0.0005% of a $2k job),
     including during mainnet congestion spikes.

2. **Security is not traded away.** Base and Arbitrum are optimistic rollups:
   funds settle to, and are ultimately secured by, Ethereum. For $2k–50k escrows
   that is the same security budget L1 would give you — which is exactly what an
   escrow contract (a pure custody primitive) needs.

3. **The asset and the tooling are already there.** USDC is natively issued on
   Base/Arbitrum (avoiding bridged-token risk for the escrowed asset), and the
   EVM stack gives you battle-tested primitives for the dispute layer: Safe
   multisigs for an arbiter, Kleros for decentralized arbitration, Circle's
   freeze/court-order compliance on USDC.

4. **Exit costs favor Base.** Freelances need to off-ramp; Coinbase offers
   direct, cheap USDC withdrawals to Base, which meaningfully lowers the
   "exit cost" leg of the total-cost equation for the payee side.

5. **Why not Solana, though it's cheapest?** The fee delta (~$0.0005 vs
   ~$0.002/job) is in the noise at these amounts, while Solana costs you the
   EVM escrow/multisig/arbitration ecosystem and most fiat off-ramps for
   freelancers. Not worth it for sub-cent savings.

6. **Why not mainnet?** Mainnet makes sense when the secured value per
   interaction is large enough that a worst-case ~$50–150 gas bill is trivial
   (say, $1M+ per escrow). At $2k–$50k it isn't, and you get nothing in return
   — an L2's funds are settled by L1 anyway.

## Answer

Deploy on **Base** (keep the contract chain-agnostic so Arbitrum/OP are one
config change away). Per-job cost ~**$0.01 or less = under 0.0005% of even the
smallest $2,000 escrow**, with Ethereum-grade settlement security, native USDC,
best-in-class fiat off-ramps via Coinbase, and stable fees independent of
mainnet gas spikes. Reserve Ethereum mainnet only if individual escrows grow
into the seven figures, where L1's fee spikes become irrelevant.
