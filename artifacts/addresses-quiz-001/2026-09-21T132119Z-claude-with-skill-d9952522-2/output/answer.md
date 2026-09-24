# Swap venue for large USDC → WETH on Base

## Short answer

**No one pool is best at 500k.** Splitting the order across two pools beats every single pool I tested.

- **Best measured setup:** about 50/50 across **Uniswap v3 USDC/WETH 0.3%** and **Aerodrome Slipstream USDC/WETH tickSpacing 100**. Cost: **−19 bps**.
- **If the config takes exactly one router today:** Uniswap v3 **SwapRouter02** on Base with `fee = 3000`. Cost: **−35 bps**.

| Role | Base address |
|---|---|
| **Primary router: Uniswap v3 SwapRouter02** | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| Second leg: Aerodrome Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` |

Don't make this choice permanent. Pool depth on Base shifts from month to month. Quote every candidate at the real order size before each trade, or at least on a regular schedule (see "Keeping it right" below).

## How I got here (live Base mainnet, block 51,603,857, 2026-09-21 13:24 UTC)

Tokens:
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. This is native Circle USDC, not bridged USDbC. `symbol()` returns `USDC`.
- WETH: `0x4200000000000000000000000000000000000006`. `symbol()` returns `WETH`.

### Checking the contracts
Each contract has code on Base, and each points to the factory I expected:
- Uniswap SwapRouter02 `0x2626…e481`: `factory()` = `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` (Uniswap v3 factory on Base). `WETH9()` = `0x4200…0006`.
- Slipstream SwapRouter `0xBE6D…18a5`: `factory()` = `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` (Slipstream CL factory).
- Quoters used for pricing: Uniswap QuoterV2 `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` (factory `0x3312…FdfD`) and Slipstream QuoterV2 `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` (factory `0x5e7B…809A`).

### Quotes for one 500,000 USDC order
The baseline is the best 1,000 USDC quote (0.365539 WETH per 1k USDC, from the Uni 0.05% pool). That rate scaled to 500k gives 182.770 WETH.

| Route | WETH out | vs baseline |
|---|---|---|
| **50% Slipstream ts100 + 50% Uni v3 0.3%** | 91.332 + 91.086 = **182.418** | **−19 bps** |
| 1/3 each: Slipstream ts100, Uni 0.05%, Uni 0.3% | 182.297 | −26 bps |
| **Uni v3 0.3% pool only** (`0x6c561B44…1372`, ~103M USDC + ~9,346 WETH) | **182.135** | **−35 bps** |
| Slipstream ts100 only (`0xb2cc224c…DC59`, ~6.2M USDC) | 180.777 | −109 bps |
| Uni v3 0.05% only (`0xd0b53D92…F224`, ~5.3M USDC) | 180.191 | −141 bps |
| Aerodrome v2 volatile pool through Router `0xcF77…4E43` | 164.198 | **−1,016 bps** |
| Slipstream ts1 | 48.09 | not viable |

What the numbers show:
- The 0.05% and ts100 pools give the best price on small trades. At 500k, though, they run out of liquidity near the current price, and their low fees stop mattering.
- The Uni 0.3% pool holds by far the most money. It costs more on a small trade but slips least at size.
- **Aerodrome's v2-style `Router` (`0xcF77…4E43`) is a trap for this trade.** The address is real and the call succeeds, but it can only reach the old volatile pools. It cannot reach Slipstream, and it loses about 10%. Do not configure it for this pair.

## Recommendation

1. **Best execution:** split each order across Uni v3 0.3% and Slipstream ts100. Pick the split ratio from live quotes before each trade. Two ways to do this:
   - an aggregator that routes through both pools (check that its route really hits these pools);
   - a small in-house contract or script that runs both legs in one transaction, with a minimum-output limit on each leg.
2. **If config allows only one router:** use `0x2626664c2603336E57B271c5C0b26F421741e481` (Uniswap v3 SwapRouter02) with USDC→WETH at `fee = 3000`. Set `amountOutMinimum` from a quote taken right before the trade, never from a fixed slippage guess.
3. For 500k orders, also consider breaking the trade into several smaller trades over time, and send it through a private transaction relay to reduce the risk of someone trading ahead of you.

## Keeping it right / what to re-check before real funds move

- **Re-check every address above on Base** against Uniswap's and Aerodrome's official deployment lists and on basescan. I checked code, `factory()` and `symbol()` on-chain. I did not cross-check against the docs in this session.
- **Not covered:**
  - Uniswap v4 USDC/WETH pools on Base.
  - Any newer Slipstream factory or router Aerodrome may have launched. The one I used is the original Slipstream deployment.
  - PancakeSwap and other v3-style venues.

  Any of these could change which option is best. Quote them before you lock in the config.
- These results come from one order size in one block. Recompute the ranking at your real order size before trading, because the depth order changes.
