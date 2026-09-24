# Swap venue for large USDC → WETH on Base

## Recommendation

**Uniswap v3 on Base, `SwapRouter02`, using the USDC/WETH 0.30% pool (`fee = 3000`).**

```
router (Uniswap v3 SwapRouter02, Base): 0x2626664c2603336E57B271c5C0b26F421741e481
quoter (Uniswap v3 QuoterV2, Base):     0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a
pool   (USDC/WETH, fee 3000):           0x6c561B446416E1A00E8E93E221854d6eA4171372
USDC   (native, Circle):                0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WETH:                                   0x4200000000000000000000000000000000000006
```

I didn't choose this from reputation. I picked it because it gave the best live quote at the actual trade size (see below). On Base the obvious guess is Aerodrome. At this block, though, both Aerodrome products gave worse fills for this pair and size.

Note: the Base router is **not** the mainnet Uniswap router address. Don't copy addresses across chains.

## Method

- Everything was measured on Base mainnet (`https://mainnet.base.org`) at block **51,604,112** (2026-09-21) with `cast`.
- Trade size: **500,000 USDC → WETH**. Every candidate was quoted with its own on-chain quoter or router `getAmountsOut`.
- Baseline: the rate for a small 1,000 USDC quote, scaled up to 500k. That comes to 182.806 WETH.
- Cost is shown in bps (1 bp = 0.01%) below that baseline. It includes both the pool fee and the price impact.

| Venue / pool | WETH out for 500k USDC | vs baseline |
|---|---|---|
| **Uniswap v3 USDC/WETH 0.30%** | **182.250** | **−30 bps** (almost all of it is the 0.30% fee) |
| Split ⅓ each: Uni 0.30% / Uni 0.05% / Slipstream ts100 | 182.185 | −34 bps |
| Split ½ each: Uni 0.30% / Slipstream ts100 | 182.056 | −41 bps |
| Uniswap v3 USDC/WETH 0.05% | 180.125 | −147 bps |
| Aerodrome Slipstream (CL) tickSpacing 100 (fee 0.0564%) | 179.887 | −160 bps |
| Uniswap v4 ETH/USDC 0.30% (no hooks) | 167.608 | −831 bps |
| Aerodrome v2 Router, volatile pool | 164.409 | −1,006 bps |
| Slipstream ts1, Uni v3 0.01%, v4 0.05%/0.01%/1% | ≪ 100 WETH | too shallow |

Why the 0.30% pool wins: the low-fee pools (Uni 0.05%, Slipstream ts100) have cheaper fees, but not much liquidity near the current price. For amounts over about $100k, their price impact is much larger than the fee they save. Current liquidity in range: the 0.30% pool has `liquidity()` ≈ 2.48e19, compared with ≈ 7.9e17 for Uni 0.05% and ≈ 3.8e18 for Slipstream ts100. The 0.30% pool is also the deepest by reserves (≈ 102M USDC / 9.7k WETH). Splitting the order across pools didn't help at this snapshot.

## How the addresses were checked (Base RPC)

- `SwapRouter02` 0x2626…e481 has code. Its `factory()` returns 0x33128a8f…FDfD, which is the Uniswap v3 factory on Base. Its `WETH9()` returns 0x4200…0006.
- QuoterV2 0x3d4e…B76a has code, and its `factory()` returns the same Uniswap v3 factory.
- Pool 0x6c56…1372 is what `factory.getPool(USDC, WETH, 3000)` returns, and its `fee()` is 3000.
- USDC 0x8335…2913 returns `symbol()` = "USDC". It is Circle's native USDC, **not** the bridged `USDbC`.

## Integration notes

- Call `exactInputSingle` on SwapRouter02 with `{tokenIn: USDC, tokenOut: WETH, fee: 3000, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0}`. SwapRouter02's struct has **no `deadline` field**. If you need one, wrap the call in `multicall(deadline, …)`.
- Don't hardcode the fee tier as permanently "best". Before each trade, quote the candidates with QuoterV2 (fees 500 and 3000) and the Slipstream quoter (`0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0`, tickSpacing 100). Route to whichever is best. Which pool is deepest changes from week to week. Liquidity providers move their ranges, and Aerodrome's Slipstream has led this pair on other days.
- Set `amountOutMinimum` from that fresh quote minus a tight tolerance, for example 30–50 bps. Don't use a fixed number.
- If trades get much bigger than 500k, or you want splitting done for you automatically, an aggregator (0x, 1inch, Odos, KyberSwap) is a reasonable alternative. Check which pools its route actually uses.

## Re-check before real funds move

These quotes are one snapshot on one day. Before going live, the person deploying should:

1. Re-confirm the router, quoter, pool and USDC addresses above against Uniswap's official Base deployment list and Basescan.
2. Re-run the quote comparison at the real trade size.
