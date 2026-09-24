# Chain recommendation: freelance escrow ($2k–$50k per job)

**Recommendation: deploy on Ethereum mainnet.** Gas cost does not rule it out for this
workload, and everything else about the workload — high value per transaction, low
transaction frequency, irreversible custody of other people's money — argues for the
chain with the deepest settlement assurances, the largest stablecoin float, and no
upgradeable-sequencer / centralized-operator layer between you and the funds.

If you have a specific non-cost reason to want an L2 (your users are already there,
you want sub-second confirmations, you need cheap high-frequency milestone updates),
**Base** is the L2 I'd pick. But don't pick it because you remember mainnet being
expensive — right now it isn't.

---

## Measured inputs (all fetched 2026-09-23, not from memory)

| Input | Value | Source |
|---|---|---|
| ETH/USD | **$2,733.145** | Coinbase spot API |
| Ethereum mainnet gas price | **0.29328 gwei** (293,279,814 wei) | `cast gas-price` @ ethereum-rpc.publicnode.com (cross-checked 0.29331 gwei @ eth.drpc.org) |
| Base gas price | **0.00600 gwei** (6,000,000 wei) | `cast gas-price` @ mainnet.base.org |
| OP Mainnet gas price | **0.00100 gwei** (1,000,574 wei) | `cast gas-price` @ mainnet.optimism.io |
| Arbitrum One gas price | **0.02000 gwei** (20,000,000 wei) | `cast gas-price` @ arb1.arbitrum.io/rpc |
| Base L1 data fee, 182-byte tx | **3.3605e-9 ETH** ($0.0000092) | `GasPriceOracle.getL1Fee` @ `0x420...0F` |
| OP L1 data fee, 182-byte tx | **4.5484e-9 ETH** ($0.0000124) | same oracle on OP Mainnet |

Gas-used sanity check — a real ERC-20 (USDC) `transfer` estimated live on each chain:
mainnet **45,312**, Base **45,223**, Arbitrum **47,123**. The ~1.8k extra on Arbitrum is
its L1-posting surcharge folded into `gasUsed` (Arbitrum is not OP-stack and has no
separate `l1Fee` field), and at 0.02 gwei it's worth $0.0001. So the gas-used
assumptions below are portable across all four chains.

### Gas-used assumptions for the escrow itself

These are estimates for a contract that doesn't exist yet, so they're stated explicitly
rather than measured:

| Operation | Assumed gas | Why |
|---|---|---|
| `approve` USDC to escrow | 55,000 | measured USDC transfer is 45.3k; approve on a cold allowance slot is comparable |
| fund job (`createJob` + `transferFrom`) | 120,000 | one `transferFrom` (~45k) + 2–3 cold SSTOREs for the job struct |
| `release` to freelancer | 80,000 | one `transfer` out + status SSTORE |
| dispute / refund path | 100,000 | release plus arbiter bookkeeping |
| one-time contract deploy | 1,500,000 | escrow with jobs, milestones, disputes, timeouts |
| **happy path per job** | **255,000** | approve + fund + release |

## Cost per job, at the prices measured above

Formula: `cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd`, plus `l1_fee_eth × eth_usd`
on the two OP-stack chains.

| Chain | Fund job | Release | **Happy path (3 txs)** | % of a $2,000 job | % of a $50,000 job | One-time deploy |
|---|---|---|---|---|---|---|
| **Ethereum mainnet** | $0.0962 | $0.0641 | **$0.2044** | 0.0102% | 0.0004% | $1.20 |
| Base | $0.0020 | $0.0013 | **$0.0042** | 0.0002% | 0.00001% | $0.025 |
| OP Mainnet | $0.0003 | $0.0002 | **$0.0007** | 0.00004% | ~0% | $0.004 |
| Arbitrum One | $0.0066 | $0.0044 | **$0.0139** | 0.0007% | 0.00003% | $0.082 |

The L1 data fee on Base/OP is ~$0.00001 per transaction — three to four orders of
magnitude below the execution fee at current L1 base fees. On these chains right now,
**execution cost dominates, not calldata**. If you later optimize L2 fees, re-measure
before assuming calldata packing is where the win is; today it is not.

## Why the numbers point at mainnet

1. **Mainnet is 30–300× more expensive than the L2s in relative terms, and that is
   irrelevant here.** $0.20 versus $0.004 is a 48× ratio, but the absolute delta is
   **$0.20 per job**. Against a job that holds $2,000 at minimum, mainnet fees are
   **one hundredth of one percent**. No escrow business model is decided by 0.01%.
   Your payment-rail costs (fiat on/off-ramp, card, or stablecoin issuance spread) will
   be 100–300× larger than the gas either way.

2. **The workload profile is exactly what mainnet is for.** Three transactions per job,
   each moving $2k–$50k, spread over days or weeks of delivery time. That's
   low-frequency and high-value. Escrow is also the canonical case where settlement
   finality and operator-independence matter: the whole product is "the money is safe
   and nobody can take it." An L2 adds a sequencer you don't control and a 7-day
   withdrawal challenge window (optimistic rollups) between your users and their funds
   if the L2 ever degrades — a real, if unlikely, liability for a custody product.

3. **Deploy cost is a rounding error.** $1.20 on mainnet, once. Even the disaster
   scenario below keeps it under a few hundred dollars.

## Gas-price sensitivity (the honest caveat)

0.29 gwei is a genuinely low reading, and mainnet base fees are volatile. Sensitivity for
the 255,000-gas happy path at $2,733/ETH:

| Mainnet gas price | Happy path per job | % of a $2,000 job | Deploy |
|---|---|---|---|
| 0.29 gwei (now) | $0.20 | 0.010% | $1.20 |
| 3 gwei | $2.09 | 0.105% | $12.30 |
| 10 gwei | $6.97 | 0.348% | $41.00 |
| 30 gwei | $20.91 | 1.045% | $122.99 |
| 100 gwei (crisis) | $69.70 | 3.485% | $409.97 |

Mainnet stays comfortably viable through ~10 gwei. It gets uncomfortable on the
**$2,000 floor** of your range at 30 gwei and up (1%+ of the job), while still being fine
on a $50,000 job even at 100 gwei ($69.70 = 0.14%). So the real risk isn't "mainnet is
expensive," it's "mainnet is occasionally expensive *for your smallest jobs*."

## What I'd actually build

- **Deploy the escrow on Ethereum mainnet.** Settle in USDC.
- **Make the user pay gas, and quote it at funding time** from a live reading —
  the same `cast gas-price` call above, done immediately before you build the tx.
  Never hardcode `maxFeePerGas` / `maxPriorityFeePerGas`, and don't carry a mainnet
  priority-fee constant into any L2 deployment you add later.
- **Write the contract chain-agnostically** (no mainnet-only assumptions, no hardcoded
  chain IDs or token addresses). Then if the small-job-at-high-gas case actually bites,
  or your user base turns out to live on an L2, deploying the same bytecode to **Base**
  costs $0.025 and you can route sub-$5k jobs there. Keep that as a measured decision,
  not a preemptive one.
- **Re-measure before you commit.** Every number here is a snapshot from 2026-09-23.
  Gas price and ETH/USD both move; re-run the readings at build time rather than
  trusting this table.
