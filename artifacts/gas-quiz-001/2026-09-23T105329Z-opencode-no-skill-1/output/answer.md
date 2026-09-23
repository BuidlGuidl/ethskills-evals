# Chain Recommendation: Base (Ethereum L2)

**Recommendation: deploy the escrow contract on Base.** Arbitrum One is an
acceptable second choice with nearly identical properties; the reasoning below
applies to both.

## The workload

A freelance escrow job touches the chain a small number of times:

1. Client deposits funds into escrow (1 contract call)
2. On delivery, funds are released to the freelancer (1 call), or
3. Refund / dispute resolution in the failure path (1 call)

So roughly **2–3 state-changing contract calls per job**. These are not simple
transfers — an escrow deposit or release updates storage, moves an ERC-20, and
emits events, so a realistic budget is **~120k–200k gas per call** (a plain
USDC transfer alone is ~55k gas; the escrow logic roughly triples that).

Job sizes: **$2,000–$50,000**, held for days to weeks.

## The numbers

Fee data below reflects mid-2026 conditions (growthepie/L2 fee feeds, Spark's
stablecoin cost comparison, and live fee trackers, Sept 2026).

### Cost per job (2–3 contract calls @ ~150k gas each)

| Chain | Typical fee/call | Cost per job | % of a $2,000 job | % of a $50,000 job |
|---|---|---|---|---|
| Ethereum L1 (historic-low gas, ~0.1–0.2 gwei) | ~$0.05–0.25 | ~$0.10–0.75 | 0.005–0.04% | negligible |
| Ethereum L1 (normal congestion, ~10–50 gwei) | ~$2–10 | ~$4–30 | **0.2–1.5%** | 0.01–0.06% |
| Ethereum L1 (spike, >100 gwei) | ~$15–45 | ~$30–135 | **1.5–6.8%** | 0.06–0.27% |
| **Base** | ~$0.003–0.03 | **~$0.01–0.09** | **<0.005%** | negligible |
| Arbitrum One | ~$0.006–0.06 | ~$0.02–0.18 | <0.01% | negligible |
| Solana | ~$0.001–0.01 | ~$0.003–0.03 | <0.002% | negligible |
| Polygon PoS | ~$0.002–0.01 | ~$0.006–0.03 | <0.002% | negligible |

Key point: gas fees are value-independent. The cost profile that matters is
the *worst case on the smallest job* — a $2,000 job during an L1 congestion
spike could lose several percent to gas, and L1 fees are volatile enough that
you can't quote users a stable fee. On Base the fee is under ten cents in
essentially all conditions, i.e. <0.005% of even the smallest job.

### Security for held funds

Escrow is a custody product: the contract may hold many jobs at once, so
aggregate TVL can be 10–100x the $50k single-job max.

- **Ethereum L1**: strongest settlement security, but you pay L1 gas
  volatility (above) for every deposit and release.
- **Base / Arbitrum (optimistic rollups)**: inherit Ethereum's security via
  fraud proofs and L1-settled state; user funds are ultimately recoverable
  via the L1 bridge even if the sequencer misbehaves. This is the right
  security tier for five-figure custody.
- **Polygon PoS**: equally cheap, but it's a sidechain — funds depend on
  Polygon's own validator set and its bridge, not Ethereum consensus. Not the
  right trade when holding up to $50k per job to save fractions of a cent.
- **Solana**: cheap and fast with a healthy USDC ecosystem (~$16B stablecoin
  supply), but a different execution stack (fewer battle-tested EVM escrow
  patterns/auditors) and a history of outages — acceptable, but no advantage
  over an L2 for this use case.

### Stablecoin rails (you'll be escrowing dollars, not ETH)

- Base has **native, Circle-issued USDC** (no bridged "USDC.e" wrapper) with
  ~$4.4–4.9B USDC on-chain and ~86% of Base's stablecoin supply in USDC.
- **Fiat off-ramp for freelancers**: Base is Coinbase's chain — freelancers
  can move USDC to Coinbase and out to a bank account with free/cheap
  transfers. This is a real product advantage for a payments product.
- CCTP enables native USDC burns/mints to other chains if you later expand.

## Why not the alternatives, in one line each

- **Ethereum L1**: gas is cheap *right now* (~$0.01 median) but historically
  spikes to $5–15+ per transfer; unpredictable fees and 0.2–1.5%+ overhead on
  small jobs during congestion make it the wrong default for routine escrow
  operations. Keep L1 in reserve for the settlement/bridge layer.
- **Polygon PoS**: cheap, but sidechain trust assumptions are the wrong
  trade-off for custodying up to $50k per job.
- **Solana**: viable, but weaker EVM tooling/audit ecosystem and no
  integrated fiat off-ramp story as strong as Base/Coinbase.

## Bottom line

Deploy on **Base**: ~$0.01–0.09 total gas per job (<0.005% of the smallest
escrow), Ethereum-inherited security appropriate for five-figure custody,
native USDC, and the best fiat off-ramp for freelancers via Coinbase. If you
want to hedge sequencer/ecosystem risk, the contract ports to Arbitrum One
with zero changes.
