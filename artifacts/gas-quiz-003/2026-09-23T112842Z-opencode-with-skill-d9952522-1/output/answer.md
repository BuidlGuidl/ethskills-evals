# Recommendation: Base (an Ethereum L2)

A social feed for AI agents is a **high-frequency, low-value, latency-sensitive write workload**
(posts, likes, follows — thousands of txs/day per agent). That profile belongs on an L2, not
mainnet. Among the L2s measured today, **Base is the cheapest per action** and has the strongest
agent ecosystem. Below are the live numbers used to reach that conclusion.

## Measured inputs (2026-09-23, ~11:35 UTC)

All gas prices measured live via public RPCs (`cast` + JSON-RPC receipt sampling). Wei values
divided by 1e9 for gwei, cross-checked against raw readings.

| Input | Value | Source |
|---|---|---|
| ETH/USD | $2,726 (avg of $2,730.38 and $2,722.62) | Chainlink `0x5f4e...8419` + Coinbase spot |
| Mainnet gas price (base + tip) | 0.31–0.33 gwei (307,961,450 wei; drpc recheck 330,686,795 wei) | `cast gas-price` |
| Mainnet base fee | 0.33 gwei (330,555,896 wei) | `cast base-fee` |
| Mainnet observed median `effectiveGasPrice` | 1.34 gwei (25-receipt sample; min 0.34, max 3.34 — senders overpaying tips) | recent block receipts |
| Base gas price | 0.006 gwei (6,000,000 wei) | `cast gas-price` |
| Base base fee | 0.005 gwei (5,000,000 wei) | `cast base-fee` + block header |
| Base observed median `effectiveGasPrice` | 0.01 gwei (25-receipt sample) | recent block receipts |
| Base L1 data fee | 2.96e-9 ETH median from receipts; 3.0e-9 ETH via `GasPriceOracle.getL1Fee` for 100 B, 400 B, and 1000 B calldata (flat — post-blob compressed model, `l1BaseFee` = 327,079,182 wei) | receipts + `0x4200...000F` |
| Arbitrum gas price | 0.02 gwei (20,000,000 wei) | `cast gas-price` + receipts |
| Arbitrum L1 amortization (`gasUsedForL1`) | ~450–900 gas (e.g. real tx: gasUsed 21,906 + L1 906 = 22,812 × 0.02 gwei = 4.59e-7 ETH ≈ $0.00125) | recent block receipts |

Formulas (gas-price and base-fee readings are what a tx actually pays, so no extra tip added):

```
mainnet / L2-exec:  cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd
Base (OP-stack):    cost_usd = (gas_used × gas_price_gwei × 1e-9 + l1_fee_eth) × eth_usd
```

Gas-used assumption (stated, not measured from a deployed contract): **~50k gas** for a
like/follow (a storage write + event) and **~100k gas** for a post (store content hash + metadata),
roughly ERC-20-transfer scale. Since the same gas figure is applied to every chain, it cancels out
of the chain comparison; only gas *price* drives the ranking.

## Per-action costs (ETH = $2,726)

| Action | Mainnet @0.33 gwei | Mainnet @observed 1.34 gwei | **Base** | Arbitrum |
|---|---|---|---|---|
| Post (~100k gas) | $0.090 | $0.366 | **$0.0027** (1.0e-6 ETH exec + 3e-9 ETH L1) | $0.0055 (2.02e-6 ETH incl. L1 amort.) |
| Like/follow (~50k gas) | $0.045 | $0.183 | **$0.0014** | $0.0028 |

- Base vs mainnet: **~33× cheaper** (at today's unusually cheap mainnet reading) to **~134× cheaper**
  (at what mainnet senders actually paid in the sampled block).
- Base vs Arbitrum: **~2× cheaper** on execution (0.01 vs 0.02 gwei median), with negligible L1
  fees on both — post-Dencun blob pricing has collapsed the L1 data component on both chains
  (Base's L1 fee is ~$0.000008 and measured flat across 100 B–1000 B calldata).

## Scale test: 1,000 agents × 100 actions/day = 100k txs/day

- **Base: ~$200–270/day** — viable; agent operators can pass gas via paymasters/smart wallets
- Arbitrum: ~$400–550/day
- Mainnet: **$9,000/day** (at 0.33 gwei) to **$36,600/day** (at observed 1.34 gwei) — disqualified.
  Note: even at today's unusually low mainnet base fee, a 0.03 ETH ($82) deposit to fund one
  day's mainnet posting covers ~900 posts; the same 0.03 ETH funds ~11,000 posts on Base.

## Why Base specifically

1. **Cheapest per action of the chains measured** (numbers above) — dominant factor for a
   feed whose value per tx is fractions of a cent.
2. **Post-blob L1 economics**: measured `getL1Fee` is flat (~3e-9 ETH) across 100 B–1000 B
   calldata, so on-chain content/post metadata no longer carries a calldata-size penalty.
3. **Ecosystem fit**: Base hosts the densest AI-agent activity in the Ethereum ecosystem —
   agent wallets, the x402 payments standard for autonomous agent commerce, Coinbase smart-wallet
   and paymaster infrastructure for gas abstraction. A social feed lives or dies on where the
   agents already are.
4. **Ethereum-secured**: OP-stack rollup with L1 security and escape hatch; mainnet settlement.

Mainnet still has a role: keep rare, high-value anchoring there (e.g., registering each agent's
identity/ENS once, ~$0.09 at today's fees). The feed itself — the high-frequency writes — goes to
Base. Arbitrum is a close runner-up (same order of magnitude) if its ecosystem matters more to you
later, but measured costs favor Base today.

## Fee-setting notes for implementation

- Derive EIP-1559 fields on Base at submission time; do not hardcode or port mainnet constants.
  Base base fee right now is 0.005 gwei; `cast gas-price` (base + suggested tip) reads 0.006 gwei
  — use that reading, never add a separate mainnet-style tip on top of it. Observed txs pay
  0.015–0.055 gwei when overpaying.
- Re-measure before launch: these readings move. Mainnet at 0.31 gwei is historically cheap
  (typical spikes of 10–30+ gwei would multiply its costs 30–100×, while L2 prices are structurally
  stable at sub-0.01 gwei levels) — one more reason not to build the feed on mainnet even though
  today's reading looks tolerable.

## Reproducing the measurements

```bash
cast gas-price --rpc-url https://ethereum-rpc.publicnode.com   # 307961450
cast gas-price --rpc-url https://mainnet.base.org             # 6000000
cast gas-price --rpc-url https://arb1.arbitrum.io/rpc         # 20000000
cast call 0x420000000000000000000000000000000000000F \
  'getL1Fee(bytes)(uint256)' 0x$(python3 -c "print('cd'*400)") \
  --rpc-url https://mainnet.base.org                          # ~3.0e9 wei
# plus eth_getTransactionReceipt sampling for effectiveGasPrice / l1Fee medians (see table)
```
