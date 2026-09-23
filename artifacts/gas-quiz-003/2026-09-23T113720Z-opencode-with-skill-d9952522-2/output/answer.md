# Recommendation: Deploy on Base (an OP-stack L2), not Ethereum mainnet

## TL;DR

A social feed for AI agents is a **high-frequency, low-value, latency-sensitive** workload — exactly the profile that belongs on an L2. Measured today, a post costs roughly **$0.04–0.05 on mainnet** vs **under a third of a cent on Base** (~15–60x cheaper), and Base's 2-second blocks give a far better feed experience than mainnet's 12-second blocks. Keep mainnet only for low-frequency, high-value actions (e.g., anchoring an identity/registry contract) if you need it.

## The numbers (all measured live, 2026-09-23)

| Reading | Value | Source |
|---|---|---|
| ETH/USD | $2,718.36 | Coinbase spot API |
| Mainnet gas price | 0.297 gwei (0.363 gwei on second RPC) | `cast gas-price` @ ethereum-rpc.publicnode.com, cross-checked @ eth.drpc.org |
| Base gas price | 0.006 gwei | `cast gas-price` @ mainnet.base.org |
| Base effective gas price (real receipts) | 0.013–0.031 gwei | latest-block receipts |
| Base L1 data fee (per typical tx) | ~3.1e-9 ETH (~$0.000008) | `l1Fee` field on recent Base receipts |

### Workload assumption

A "post" = an onchain action emitting an event with the content:
~21,000 base gas + ~300 bytes calldata (~4,800 gas) + LOG with topics/data (~2,700 gas) + margin ≈ **50,000 gas** (conservative; a pure event post is closer to 30k).

### Cost per post

Formula: `cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd` (plus `l1Fee` on L2)

**Mainnet:**
50,000 × 0.30 gwei = 1.5e-5 ETH × $2,718.36 ≈ **$0.041** (up to ~$0.049 at 0.363 gwei)

**Base (OP-stack, so execution + separate L1 data fee):**
- Execution: 50,000 × 0.006–0.02 gwei = 3e-7 – 1e-6 ETH ≈ $0.0008–0.0027
- L1 data fee: ~3.1e-9 ETH ≈ $0.000008 (negligible post-Dencun for small calldata)
- **Total ≈ $0.001–0.003 per post**

### At scale (1M agent posts)

- Mainnet: **~$41,000–49,000**
- Base: **~$800–2,700**

## Reasoning

1. **Workload fit.** Agents posting, replying, and reacting generate many small transactions where each action has near-zero individual value. Per the measured numbers, mainnet's ~4–5¢/post is survivable but pointless overhead; Base's ~0.1–0.3¢/post makes the economics of a high-volume feed trivial.
2. **Latency.** A feed lives and dies on responsiveness. Base produces blocks every ~2s vs ~12s on mainnet, so posts confirm ~6x faster.
3. **Not just "mainnet is expensive" — it's measured.** Mainnet gas is actually cheap right now (~0.3 gwei). The recommendation isn't based on a stale memory of high gas; it's based on a measured 15–60x cost gap and a 6x latency gap that both matter for this specific workload.
4. **Ecosystem commitment preserved.** Base settles to Ethereum, uses ETH for gas, and keeps you fully inside the Ethereum ecosystem — tooling, wallets, and bridges all carry over.
5. **Fee mechanics note for implementation.** On Base, derive EIP-1559 fee fields from Base's RPC at submission time (base fees there are tiny and spiky in gwei terms; don't port a mainnet priority-fee constant). The L1 data fee is currently a negligible share of cost, but re-measure it (`l1Fee` on receipts or the GasPriceOracle at `0x420000000000000000000000000000000000000F`) if you ever start posting large calldata payloads.
