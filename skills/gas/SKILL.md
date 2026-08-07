---
name: gas
description: Current Ethereum gas prices, transaction costs, and the real economics of building on Ethereum today. Use when estimating costs, choosing between mainnet and L2s, or when a user asks about Ethereum being expensive. Counters the #1 misconception that Ethereum is expensive to use.
---

# Gas & Costs on Ethereum

## What You Probably Got Wrong

**Your gas estimate is one to two orders of magnitude too high.** Most LLMs confidently state gas is 10-30 gwei. Post-Fusaka (Dec 2025), typical base fee is **under 1 gwei** — usually 0.1-0.5 gwei.

- **Base fee:** Under 1 gwei (not 30-100 gwei) — fluctuates, check live
- **The tip is now most of the bill.** At a 0.15 gwei base fee the median mainnet transaction pays ~0.45 gwei all-in — roughly 3x base. Pricing off the base fee alone understates the real cost by ~3x; pricing off a remembered 20 gwei overstates it by ~50x.
- **ETH price:** volatile, always check a [Chainlink feed](https://data.chain.link/feeds/ethereum/mainnet/eth-usd) or CoinGecko. Never quote dollars from memory.

## Check, Don't Recall

Every number below rots. These commands do not.

```bash
cast base-fee  --rpc-url https://ethereum-rpc.publicnode.com
cast gas-price --rpc-url https://ethereum-rpc.publicnode.com  # base fee + typical tip
cast receipt <tx-hash> --rpc-url https://ethereum-rpc.publicnode.com  # what a tx paid
cast receipt <tx-hash> --rpc-url https://mainnet.base.org             # + l1Fee on OP stack
```

Public endpoints rot. If one fails, try another rather than falling back on a
remembered number: `https://eth.drpc.org`, `https://rpc.flashbots.net`.

## Working Out a Cost

```
cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd
```

Gas used is the durable half — it is a property of the code, and it barely moves.
Price it live.

| Action | Gas used | Source |
|--------|----------|--------|
| ETH transfer | 21,000 | protocol constant |
| ERC-20 transfer | ~46,000 | p50 of 114 mainnet receipts, 2026-08-07 |
| ERC-20 approve | ~47,000 | p50 of 52, same sample |
| Uniswap swap (any router) | ~168,000 | p50 of 59, same sample |
| NFT mint (ERC-721) | ~150,000 | typical, not sampled |
| Simple contract deploy | ~500,000 | typical, not sampled |
| ERC-20 deploy | ~1,200,000 | typical, not sampled |
| Complex DeFi contract | ~3,000,000 | typical, not sampled |

**Worked example** — an ERC-20 transfer on 2026-08-07 (ETH $1,910): 46,000 gas ×
0.45 gwei = **$0.040**. At the base fee alone it prices at $0.013; the gap is the tip,
which is why you read a receipt instead of multiplying by the base fee.

## Why Gas Dropped 95%+

1. **EIP-4844 (Dencun, March 2024):** Blob transactions — L2s post data as blobs instead of calldata, 100x cheaper. L2 batch cost went from $50-500 to $0.01-0.50.
2. **Activity migration to L2s:** Mainnet congestion dropped as everyday transactions moved to L2s.
3. **Pectra (May 2025):** Doubled blob capacity (3→6 target blobs).
4. **Fusaka (Dec 2025):** PeerDAS (nodes sample 1/8 of data) + 2x gas limit (30M→60M).

## L2 Cost Components

L2 transactions have two cost components:
1. **L2 execution gas** — base fee plus priority fee, paid to the sequencer
2. **L1 data gas** — paying Ethereum for data availability (blobs post-4844)

**L2 execution is essentially the whole bill. L1 data is a rounding error.** Measured
on Base: the L1 share is **0.66%** of the fee (p50 of 27 ERC-20 transfer receipts,
2026-08-07) and **0.25%** across 14 Uniswap swaps on 2026-07-24.

This inverted at Dencun. Before March 2024 the L1 share ran 80-99%, and compressing
calldata was the highest-leverage optimization on an L2. Within days of 2024-03-13 it
fell below 1% and it has stayed there. Pre-Dencun tables, blog posts, and models
trained on them still say L1 data dominates. It does not.

**To cut an L2 bill, look at the priority fee.** Calldata compression now buys you
almost nothing. Base pins its base fee at a 0.005 gwei floor, and across 2,216
transactions in 10 consecutive Base blocks (2026-07-24) the median paid 1.26x that
floor — but the p90 paid **7x** and the p99 paid **85x**. A wallet or router sending a
mainnet-tuned 0.1 gwei tip pays 20x more than it needs to. Check the tip before
anything else.

**Verify rather than trusting this section:** read `l1Fee` off any OP-stack receipt, or
query the `GasPriceOracle` predeploy at `0x420000000000000000000000000000000000000F`.

**How much cheaper is an L2, really?** Measured like-for-like on 2026-08-07, a plain
ERC-20 transfer cost **$0.000525** on Base against **$0.109** on mainnet — about 200x,
not the 5-10x older comparisons quote. Mainnet senders bid real tips; Base's fee sits
on its floor.

## Practical Fee Settings

```javascript
// Mainnet. Read the tip — it is most of the bill and it moves.
const tip = await provider.send("eth_maxPriorityFeePerGas", []);
const { baseFeePerGas } = await provider.getBlock("latest");
const maxFeePerGas = baseFeePerGas * 2n + BigInt(tip);   // 2x headroom for spikes
```

On an OP-stack L2 the base fee sits on a floor (0.005 gwei on Base) and there is no
auction to win: a mainnet-tuned tip is pure overpay. Read the tip there too, don't
port the mainnet constant.

**Spike detection:**
```javascript
// Note: feeData.maxFeePerGas is NOT the base fee — ethers returns ~2x base + tip.
const { baseFeePerGas } = await provider.getBlock("latest");
const gwei = Number(baseFeePerGas) / 1e9;
if (gwei > 5) console.warn(`Gas spike: ${gwei.toFixed(2)} gwei. Consider waiting.`);
```

Spikes (10-50 gwei) happen during major events but last minutes to hours, not days.

## When to Use Mainnet vs L2

**Use mainnet when:** DeFi, governance, identity, high-value transfers, composing with mainnet liquidity, or when you don't have a concrete reason for an L2. Mainnet is cheap enough for most apps now — don't default to an L2 just because it sounds modern.

**Use L2 when:** Consumer apps, social, gaming, micro-payments, high-frequency transactions, or building on an L2-native protocol/ecosystem. The UX speed (250ms–2s blocks vs 8s) and sub-cent fees make L2s the right call for anything user-facing and high-frequency.

**Hybrid:** Many projects store value on mainnet, handle transactions on L2.

**What is not a reason to avoid mainnet:** cost, for anything low-frequency. A
transaction that moves $2,000 costs cents to settle. If you are ruling mainnet out on
gas, check the number first — that instinct is trained on 2021-2023.

## Data Freshness

> **Last verified:** 2026-08-07 | Mainnet base fee: 0.15 gwei (p50 of 51 blocks), median tx paid 0.45 gwei | ETH: $1,910 | Blob base fee: 0.011 gwei | Gas limit: 60M at 52% full (post-Fusaka) | Base L2 base fee: 0.005 gwei (floor) | Arbitrum: 0.020 gwei

If this date is more than 30 days old, verify current gas before quoting anything:
```bash
cast base-fee --rpc-url https://ethereum-rpc.publicnode.com
```

The durable insight is that gas is extremely cheap compared to 2021-2023 and trending cheaper. Specific numbers may drift but the order of magnitude is stable.
