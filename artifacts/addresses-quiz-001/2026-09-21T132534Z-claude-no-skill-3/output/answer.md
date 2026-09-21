# Swap venue for large USDC → WETH on Base

## Recommendation

**Aerodrome Slipstream (concentrated-liquidity) — SwapRouter**

```
Base router: 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5
```

Route: `exactInputSingle` on the WETH/USDC pool with **tickSpacing = 100**
(pool `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59`).

## Why — checked on-chain, not from memory

Everything below was read from Base mainnet (`https://mainnet.base.org`) on 2026-09-21 with `cast`.

### 1. Addresses verified
| Contract | Address | Check |
|---|---|---|
| Aerodrome Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` | has code; `factory()` = `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` (Slipstream CL factory) |
| Aerodrome v2 Router (classic pools) | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | has code; `defaultFactory()` = `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Uniswap v3 SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` | has code; `factory()` = `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` (Uniswap v3 factory) |
| Uniswap Universal Router (v4) | `0x6fF5693b99212Da76ad316178A184AB56D299b43` | has code |

Tokens: USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, WETH `0x4200000000000000000000000000000000000006`.

### 2. Live quotes — what you actually get
Pool balances say little for concentrated-liquidity pools (idle out-of-range money counts too), so I compared real quotes from each venue's quoter contract.

Price reference from a 1,000 USDC quote: ~2,734 USDC/WETH. At that price, 500k USDC is worth ~182.86 WETH with zero price impact.

**500,000 USDC → WETH:**

| Venue / pool | WETH out | Cost vs. ideal (fee + price impact) |
|---|---|---|
| **Aerodrome Slipstream, tickSpacing 100** | **182.40** | **~0.25%** |
| Uniswap v3, 0.30% fee | 182.14 | ~0.39% |
| Uniswap v3, 0.05% fee | 180.24 | ~1.4% |
| Uniswap v4, ETH/USDC 0.30% | 167.61 | ~8% |
| Aerodrome v2 classic (volatile) | 164.20 | ~10% |
| Uniswap v4, ETH/USDC 0.05% | 64.72 | not enough liquidity |
| Aerodrome Slipstream, tickSpacing 1 | 48.10 | not enough liquidity |
| Uniswap v3, 0.01% fee | 38.99 | not enough liquidity |

Aerodrome Slipstream's tickSpacing-100 pool gives the best fill of any single pool at this size. Aerodrome is also the largest DEX on Base, and liquidity providers get paid extra in AERO tokens to stay there, so the pool's depth tends to hold up.

## Execution notes (these matter as much as the venue)
1. **Split large orders.** The next-best pool (Uniswap v3 0.30%) is close behind. For fills of $500k or more, splitting across the Slipstream-100 pool and the Uniswap v3 0.30% pool usually beats sending everything to one pool. Alternatively, send the order through an aggregator, which does this split automatically (1inch, 0x, Odos, or CoW Swap, which also shields you from front-running). Use a single router only if you need it to be simple and predictable.
2. **Always set `amountOutMinimum`** from a fresh quote taken just before sending (Slipstream QuoterV2: `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0`), with a tight tolerance such as 0.3–0.5%. Never send 0.
3. **Set a short `deadline`**, and split into smaller pieces over time (TWAP-style) if the size moves the price more than you'll accept.
4. **Liquidity moves.** Re-run the quote comparison before each trade, or periodically. Don't treat the tickSpacing value or the pool as fixed forever.

## Config
```
router:       0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5   # Aerodrome Slipstream SwapRouter (Base)
quoter:       0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0   # Slipstream QuoterV2
tokenIn:      0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   # USDC
tokenOut:     0x4200000000000000000000000000000000000006   # WETH
tickSpacing:  100
```
