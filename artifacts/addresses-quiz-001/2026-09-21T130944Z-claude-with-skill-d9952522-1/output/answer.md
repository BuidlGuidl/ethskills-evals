# Base USDC → WETH swap leg: which venue

## Pick

**Aerodrome Slipstream (concentrated-liquidity AMM), USDC/WETH pool with tickSpacing 100, called through the Slipstream `SwapRouter`:**

```
Router (Base, chainId 8453): 0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5
```

Related addresses (all checked on Base):

| What | Address |
|---|---|
| Slipstream SwapRouter | `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` |
| Slipstream CLFactory (`router.factory()`) | `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A` |
| Slipstream QuoterV2 (use to set `amountOutMinimum`) | `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0` |
| USDC/WETH pool, tickSpacing 100 | `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` |
| USDC (native Circle USDC, not bridged USDbC) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |

Call `exactInputSingle` with `tickSpacing = 100`. Slipstream pools are identified by `tickSpacing`, not by `fee` like Uniswap v3. So the struct is not the Uniswap v3 one, and you can't reuse Uniswap v3 ABIs as-is.

## Why: measured, not by reputation

I got live on-chain quotes from Base block **51603467** (2026-09-21), for **500,000 USDC → WETH** on each candidate pool. The reference price is the best 1,000 USDC quote (Uniswap v3 0.05% pool): 0.365519 WETH per 1k USDC, so 182.759 WETH for 500k at zero price impact. The bps figures below include pool fees.

| Venue / pool | WETH out for 500k USDC | vs. reference |
|---|---|---|
| **Aerodrome Slipstream, ts=100** | **182.505** | **≈ −14 bps** |
| Uniswap v3, 0.30% | 182.135 | ≈ −34 bps |
| Uniswap v3, 0.05% | 180.128 | ≈ −144 bps |
| Aerodrome v2 vAMM (classic `Router`) | 164.210 | ≈ −1,015 bps |
| Uniswap v3 0.01% / 1%, Slipstream ts=1 / ts=2000 | 38.8 / 31.6 / 48.1 / 2.6 | pool too thin |

The Slipstream ts=100 pool holds about **5.63M USDC + 1,663 WETH** and has the most in-range liquidity. It is about 20 bps better than the next pool at this size, which is about $1k saved per 500k clip. Its fee is 0.0952%.

## Traps I checked for

- **Wrong Aerodrome contract.** Aerodrome runs two separate AMMs with separate routers. The classic v2 `Router` (`0xcF77a3Ba…4E43`) can't reach Slipstream pools, and its vAMM pool fills about 10% worse at this size. Don't put that router in the config.
- **Newer Slipstream factory/router.** A second CL factory (`0xaDe65c38…716a`) and router (`0xcbBb8035…Ce0D`) are live on Base. Their USDC/WETH pool holds only about 6.7k USDC. A router only reaches pools of its own factory, so that router can't use the deep pool. Use `0xBE6D…18a5`, whose `factory()` returns `0x5e7B…809A`, the factory that holds the deep pool.
- **Mainnet addresses reused on Base.** Uniswap v3 on Base uses a different factory (`0x33128a8f…FDfD`) and router from mainnet, so don't copy mainnet addresses over.
- **Bridged USDC.** Use native USDC `0x8335…2913`, not USDbC.

## Execution notes for this size

- This ranking is for **one pair, one block, one clip size**. Liquidity moves between pools week to week. Get a new quote from each candidate pool at the real size before each trade, or at least regularly, and route to the best one.
- **Consider splitting or using an aggregator.** Slipstream ts=100 and Uniswap v3 0.30% are both deep. Splitting a clip across them, or using an aggregator such as 0x, 1inch, Odos or KyberSwap that shows which pools it routes through, may beat −14 bps. It's worth comparing against the single-pool route. Clips above about 500k should also be split over time.
- **Always set `amountOutMinimum`** from a QuoterV2 quote taken right before sending, minus a tight tolerance (for example 20–30 bps). Also set a short `deadline`. Swaps this size are targets for front-running (sandwich attacks), so send through a private or protected transaction path if one is available.

## Re-check before real funds move

These addresses were checked on Base today with `cast` (contract code exists, `factory()` / `WETH9()` / `symbol()` return the expected values, and the pool's factory and tickSpacing match). Before going live, still compare the router, factory and quoter addresses against Aerodrome's official deployment list (docs or the `deployments/` folder in their GitHub repo) and against the Basescan labels. A config file is not proof that an address is correct.
