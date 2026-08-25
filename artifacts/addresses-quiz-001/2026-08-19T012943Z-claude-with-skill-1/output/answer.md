# Base USDC → WETH swap leg: venue and router

**Route through Aerodrome Slipstream** (Aerodrome's concentrated-liquidity AMM),
not Aerodrome v2 and not Uniswap.

```
# Slipstream SwapRouter (Base, chainId 8453)  ← the address for your config
router  = 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5

# supporting addresses
quoter  = 0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0   # Slipstream QuoterV2
factory = 0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A   # CL PoolFactory the router is bound to
pool    = 0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59   # WETH/USDC, tickSpacing 100
USDC    = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   # native Circle USDC, 6 dp
WETH    = 0x4200000000000000000000000000000000000006   # 18 dp
```

Slipstream is a Uniswap-v3 fork, so the router takes the familiar
`exactInputSingle` — but the pool key is **`tickSpacing` (int24), not `fee`**:

```solidity
ISlipstreamRouter.ExactInputSingleParams({
    tokenIn: USDC, tokenOut: WETH,
    tickSpacing: 100,                 // NOT a fee tier
    recipient: treasury, deadline: ...,
    amountIn: 500_000e6,
    amountOutMinimum: <from quoter, minus your tolerance>,
    sqrtPriceLimitX96: 0
});
```

---

## Why this venue — measured, not assumed

All numbers below are live `eth_call` quotes against Base mainnet, **pinned to
block 50157085**, for a **500,000 USDC → WETH** clip. Slippage is measured
against the Chainlink ETH/USD mid on the same block
(`0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70`, `description() = "ETH / USD"`,
1912.43 USD/ETH → mid-market ideal **261.4474 WETH**).

| Venue / pool | Out (WETH) | vs mid |
|---|---:|---:|
| **Aerodrome Slipstream, tickSpacing 100** | **261.0886** | **−13.7 bps** |
| Aerodrome Slipstream, newer factory, tickSpacing 50 | 260.7965 | −24.9 bps |
| Uniswap v3, 0.30% | 260.1945 | −47.9 bps |
| Uniswap v3, 0.05% | 258.4765 | −113.6 bps |
| PancakeSwap v3, 0.01% | 254.8043 | −254.1 bps |
| Uniswap v4, ETH/USDC 0.30% / ts 60 | 252.3458 | −348.1 bps |
| Uniswap v4, WETH/USDC 0.30% / ts 60 | 64.9876 | −7514.3 bps |
| **Aerodrome v2 vAMM Router** | **230.0620** | **−1200.5 bps** |

Slipstream beats the next-best venue by **34 bps ≈ $1,700 per $500k clip**.

It also stays ahead as size grows — Slipstream vs Uniswap v3 0.30%, same block:

| Clip | Slipstream ts=100 | Uniswap v3 0.30% |
|---|---:|---:|
| $100k | −9.6 bps | −45.0 bps |
| $250k | −11.1 bps | −46.1 bps |
| $500k | −13.7 bps | −47.9 bps |
| $1M | −18.9 bps | −51.5 bps |
| $1.5M | −24.0 bps | −55.1 bps |
| $2M | −29.2 bps | −58.7 bps |

Uniswap's 0.30% pool actually holds *more* TVL (≈27,795 WETH + 59.6M USDC vs
Slipstream's ≈3,247 WETH + 4.93M USDC), which is exactly why aggregate TVL is
the wrong metric: Slipstream's liquidity is tighter around spot and its
dynamic fee was **3.19 bps** at this block against Uniswap's fixed 30 bps.
Depth *at the price you trade* and the fee are what decide the fill.

Volume corroborates the quotes. DefiLlama, Base DEX volume, 24h at time of
writing: Aerodrome Slipstream $354M of $545M chain-wide (**65%**), PancakeSwap
v3 $78M, Uniswap v3 $42M, Uniswap v4 $17M, Aerodrome V1 $5M.

---

## Two traps this pair is specifically prone to

**1. The Aerodrome v2 Router is not the Slipstream router.**
`0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` is Aerodrome's v2 (vAMM/sAMM)
Router. It is a real, verified, live Aerodrome contract, and calling it
succeeds — it just cannot see any Slipstream pool, and routes you into the
constant-product vAMM pool instead. That is the **−1200.5 bps** row above:
**~$23,000 lost on a single $500k clip**, with no revert and nothing in the
logs to tell you. Do not put that address in this config.

**2. There are three Slipstream CL factory generations live on Base.**
Aerodrome's own deploy output (`script/constants/output/` in
`aerodrome-finance/slipstream`) lists three, and each SwapRouter has its
factory baked in as an immutable, so a router can only reach its own
generation's pools:

| Generation | PoolFactory | SwapRouter | Quoter |
|---|---|---|---|
| legacy (**use this**) | `0x5e7BB104…09A` | `0xBE6D8f0d…8a5` | `0x254cF9E1…5b0` |
| gauge-caps | `0xaDe65c38…16a` | `0xcbBb8035…Ce0D` | `0x3d4C2225…1c6C` |
| min-unstake | `0xf8f2eB49…61Ef` | `0x698Cb2b6…3A92F` | `0x514c8B5f…9259` |

The "legacy" label is about the gauge/fee machinery, not about liquidity — the
deepest WETH/USDC book still sits on the legacy factory. Measured at the same
block: legacy ts=100 **−13.7 bps**, min-unstake ts=50 −24.9 bps, gauge-caps
ts=50 −4132 bps. Picking the newest-sounding factory would cost you here.

**3. Native USDC, not bridged.** Base carries both. Use
`0x8335…2913` (Circle-issued, `symbol() = "USDC"`). `0xd9aA…b6CA` is `USDbC`,
the bridged version — same ticker in most UIs, different address, thinner book.

---

## How each address was verified

Every address below was checked against Base mainnet (`chainId 8453`, confirmed
via `cast chain-id`) — not against mainnet, not against a tutorial:

```bash
RPC=https://base.gateway.tenderly.co

cast code 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5 --rpc-url $RPC   # 19,818 hex chars — code is on Base
cast call 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5 "factory()(address)" --rpc-url $RPC
#   → 0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A   (Slipstream CL PoolFactory)
cast call 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5 "WETH9()(address)"   --rpc-url $RPC
#   → 0x4200000000000000000000000000000000000006

cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)" --rpc-url $RPC   # "USDC"
cast call 0x4200000000000000000000000000000000000006 "symbol()(string)" --rpc-url $RPC   # "WETH"
```

The Slipstream SwapRouter is not listed in the legacy `DeployCL-Base.json`, so
identity was settled a second way: its runtime bytecode is **byte-identical**
to the SwapRouter that Aerodrome's own `DeployCL-Base-MinUnstake.json` names
(`0x698Cb2b6…3A92F`), differing only in the three embedded copies of the
factory address and the pool init-code hash. Same contract, different factory
binding — which is precisely the binding we want.

Pool identity was confirmed by asking the factory rather than trusting the
address: `factory.getPool(WETH, USDC, 100) → 0xb2cc224c…DC59`, and that pool
reports `token0 = WETH`, `token1 = USDC`, `tickSpacing = 100`, `fee = 319`
(3.19 bps).

Sources cross-checked: `aerodrome-finance/slipstream` deploy output on GitHub
(`script/constants/Base.json`, `script/constants/output/DeployCL-Base*.json`),
DefiLlama per-chain DEX volume, and the live chain state above.

---

## What I'd actually wire, given the size

Hardcoding one pool is fine to ship, but for hundreds of thousands per clip
two things are worth doing:

1. **Quote at execution time and set `amountOutMinimum` from it.** Call the
   Slipstream Quoter (`0x254cF9E1…5b0`) in the same block you build the tx and
   derive the min-out from that quote, not from a stored price. The quoter is
   `nonpayable` by ABI — `eth_call` it, never send it.
2. **Split the clip.** At $500k, routing ~70% through legacy ts=100 and ~30%
   through the min-unstake ts=50 pool measured **−11.7 bps vs −13.7 bps**
   single-venue — about **$190 per clip** for one extra call, which Base gas
   costs make free. Worth adding once the single-venue path is live. Splitting
   into Uniswap v3 at this size makes it *worse* (−26.5 bps), because its 30 bps
   fee outweighs the depth you pick up.

⚠️ **Re-verify before real funds move.** These quotes are a snapshot of block
50157085 on 2026-08-19; pool depth and the dynamic fee move continuously, and
Aerodrome has deployed a new CL factory generation more than once. Before the
first live clip, re-run the `cast code` / `cast call "factory()"` checks above
against your production RPC, and re-run the quote ladder to confirm Slipstream
ts=100 is still the best fill at your size.
