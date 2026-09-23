# Which chain for a social feed for AI agents?

**Recommendation: deploy on Base (L2, OP Stack, settles to Ethereum L1).**
Anchor identity and value on Ethereum mainnet; put the feed itself on Base; batch
post-anchoring so per-post cost rounds to zero.

---

## 1. Live numbers I used

All measured on 2026-09-23, not from memory. Sources and commands are shown so you can re-run them.

| Input | Value | How measured |
|---|---|---|
| ETH price | **$2,735.42** | CoinGecko simple/price |
| Ethereum L1 base fee | **0.2955 gwei** | `cast base-fee --rpc-url https://eth.drpc.org` → `295522499` wei |
| L1 block gas limit | **60,000,000** | latest block `gasLimit` = `0x3938700` (confirms post-Fusaka 60M) |
| Base L2 base fee | **0.005 gwei** | `cast base-fee --rpc-url https://mainnet.base.org` → `5000000` wei |
| Arbitrum One base fee | **0.0200 gwei** | `cast base-fee --rpc-url https://arb1.arbitrum.io/rpc` → `20036000` wei |
| OP Mainnet base fee | **0.00000064 gwei** | `cast base-fee --rpc-url https://mainnet.optimism.io` → `640` wei |
| OP Mainnet **all-in** cost incl. L1 data fee | **2.83e-9 $/gas** | sampled 27 real receipts in the latest OP block: `gasUsed × effectiveGasPrice + l1Fee` |

Derived cost per unit of gas:

- L1: `0.2955e-9 ETH/gas × $2,735.42` = **$8.08e-7 per gas**
- Base (execution only): `0.005e-9 × $2,735.42` = **$1.37e-8 per gas**, plus an L1 data (blob) component
- OP Mainnet (measured, execution + L1 data): **$2.83e-9 per gas**

Note on the headline: Ethereum L1 gas is **under 1 gwei**, not the 20–50 gwei figure that
circulates. At 0.2955 gwei an ETH transfer costs $0.017. Mainnet is not expensive anymore —
so "it's too expensive" is *not* the reason to pick an L2 here. The reason is throughput and
latency, below.

## 2. Cost per social action

Assume a realistic gas budget per action (storage write + event, typical for a feed contract):

| Action | Gas | Ethereum L1 | Base | Arbitrum | OP Mainnet |
|---|---|---|---|---|---|
| Post (SSTORE + event) | 80,000 | **$0.0647** | ~$0.0013 | ~$0.0050 | **$0.00023** |
| Like / react | 45,000 | $0.0364 | ~$0.0007 | ~$0.0028 | $0.00013 |
| Follow | 50,000 | $0.0404 | ~$0.0008 | ~$0.0031 | $0.00014 |
| Register an agent account | 120,000 | $0.0970 | ~$0.0019 | ~$0.0074 | $0.00034 |
| Deploy the feed contract | 1,500,000 | $1.21 | ~$0.023 | ~$0.090 | $0.0042 |

Base figures are execution at the live 0.005 gwei plus an L1 data component in line with the
measured OP all-in rate; Base's execution base fee is currently ~7,800x OP's, which is why
Base lands above OP here. Both are well under a cent.

## 3. The number that actually decides it: throughput

Model: **10,000 agents × 50 actions/day = 500,000 actions/day** at 80,000 gas each
= **40 billion gas/day**.

Ethereum L1 total capacity: `60,000,000 gas × ~7,200 slots/day` = **432 billion gas/day**.

> Your app alone would consume **9.3% of all Ethereum block space, every day, forever.**

That is the disqualifier for mainnet — not price. And it is self-defeating: consuming ~9% of
every block pushes the base fee up under EIP-1559, so your own growth raises your own costs.
The $0.0647/post figure is only valid *if you stay small*.

Monthly cost at that volume:

| Chain | Per day | Per month | % of L1 gas |
|---|---|---|---|
| Ethereum L1 | $32,350 | **$970,000** | 9.3% (infeasible) |
| Arbitrum | $2,500 | $75,000 | — |
| Base | $650 | **$19,500** | — |
| OP Mainnet | $115 | $3,450 | — |

And 500,000 actions/day is a *small* agent network. AI agents do not behave like humans:
they act at machine cadence, continuously, with no sleep cycle. A human posts 3x/day; an
agent polling and responding to a feed can easily do 500x/day. At 50,000 agents × 500
actions/day you are at 2 trillion gas/day — 4.6x the entire capacity of Ethereum L1.

**Latency matters too.** Ethereum L1 is ~12s slots with ~13 min to finality. Base is ~2s
blocks (and moving to sub-second), Arbitrum ~0.25s. A feed where an agent waits 12s for its
reply to land reads as broken.

## 4. Why Base specifically

- **Cheapest credible OP Stack option with the ecosystem attached.** OP Mainnet is measurably
  cheaper right now ($0.00023 vs ~$0.0013/post), but the difference is $0.001 per action —
  economically irrelevant at your scale, and not worth trading away distribution for.
- **Social precedent and tooling.** Onchain-social has already concentrated on Base and the
  OP Stack (Farcaster and its client/frame ecosystem). You get existing social graph
  primitives, indexers, and a user base that already has wallets, rather than bootstrapping
  all of it.
- **Agent onboarding is the hard part, and Base solves it.** Smart Wallet (passkeys),
  ERC-4337 paymasters, and Coinbase's onramp let you **sponsor your agents' gas** so an agent
  needs no funded EOA to post. With EIP-7702 / session keys you can give an agent a scoped,
  revocable posting key. This is a bigger practical win than any gas delta.
- **Ethereum-aligned, which is your stated constraint.** Base is an OP Stack rollup that posts
  data to and settles on Ethereum L1, and is part of the Superchain. Your security root is
  Ethereum. You are not leaving the ecosystem — you are using the part of it designed for
  exactly this workload.

## 5. Recommended architecture (this is where the real savings are)

Don't write one L1/L2 transaction per post. You don't need to.

1. **Off-chain:** agents sign posts (EIP-712). A sequencer/indexer serves the feed and
   accumulates posts into a Merkle tree.
2. **On Base:** anchor the Merkle root once per minute. `1,440 anchors/day × 50,000 gas`
   → at Base's live rate ≈ **$1.00/day (~$30/month)**, *independent of post volume*. Signed
   posts remain individually verifiable against the root, so the feed stays trust-minimised.
3. **On Base, per-transaction:** only the things that need consensus — agent registration,
   payments/tips, staking or reputation slashing, moderation actions.
4. **On Ethereum L1:** the registry of agent identities and any high-value treasury or
   governance contract. These are low-frequency, so L1's $0.097/registration is a non-issue
   and you get L1-grade permanence for the thing that must outlive your L2 choice.

Cost of the whole system at 500,000 posts/day: on the order of **$50–100/month**, versus
$970,000/month for naive on-chain-everything on L1. Per-agent, that's fractions of a cent
per month — you can run it without charging agents for gas at all.

## 6. Caveats, stated honestly

- **Base is a Stage 1 rollup with a centralised sequencer.** Coinbase can, in principle,
  reorder or censor; withdrawals to L1 take ~7 days through the canonical bridge. For a social
  feed this is an acceptable trade; for a high-value treasury it is why step 4 puts assets on L1.
- **Blob market is currently elevated.** `excessBlobGas` on the latest L1 block is 195,658,323,
  meaning blob demand has recently run above target. The L1 data component of L2 fees is the
  volatile part of L2 pricing, so treat the Base per-post figures as ±3x, not precise quotes.
  L2 execution fees (which I measured directly) are stable.
- **Gas fluctuates.** Re-verify before you commit budget:
  `cast base-fee --rpc-url https://eth.drpc.org` and `cast base-fee --rpc-url https://mainnet.base.org`.
- **If you were not building for agents, mainnet would be a defensible answer.** At 0.2955
  gwei, a human-scale social app doing 5,000 posts/day costs $323/day on L1 — annoying but
  survivable. It is specifically the agent-cadence transaction volume (and the 9.3%-of-all-
  block-space figure) that forces an L2.

---

**One-line answer:** Base — because at 0.2955 gwei L1 gas your problem isn't price ($0.065/post),
it's that agent-rate traffic would eat 9.3% of Ethereum's 60M-gas blocks and finalise in 12s;
Base gives you sub-cent posts, ~2s blocks, gas sponsorship for agent accounts, the existing
onchain-social ecosystem, and Ethereum as its settlement layer.
