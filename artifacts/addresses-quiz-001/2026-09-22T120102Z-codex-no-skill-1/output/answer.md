# Recommendation: Aerodrome Slipstream

Use **Aerodrome Slipstream** for the Base USDC -> WETH swap leg.

Router address to put in config:

```text
0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5
```

This is Aerodrome's **Slipstream SwapRouter** on Base, not the older/basic Aerodrome v2 router.

## Why

For treasury-sized USDC -> WETH swaps, I would optimize for usable in-range liquidity and the actual quote at the trade size, not just headline TVL. Aerodrome Slipstream's WETH/USDC concentrated pool at tick spacing `100` is the route I would use:

- Pool: `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59`
- Factory lookup: Aerodrome Slipstream PoolFactory `getPool(USDC, WETH, 100)`
- Tokens:
  - USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913`
  - WETH: `0x4200000000000000000000000000000000000006`

I checked live Base mainnet quotes via `eth_call` on 2026-09-22 at block `51644642`. For exact-input USDC -> WETH:

| Venue / pool | 100k USDC out | 250k USDC out | 500k USDC out | 1M USDC out |
| --- | ---: | ---: | ---: | ---: |
| Aerodrome Slipstream, tick spacing 100 | 36.435984894 WETH | 91.054679596 WETH | 182.187894698 WETH | 363.656415498 WETH |
| Uniswap v3, 0.30% fee tier | 36.355564375 WETH | 90.881924999 WETH | 181.740569171 WETH | 363.388045645 WETH |
| Uniswap v3, 0.05% fee tier | 36.397931241 WETH | not checked | 180.407461573 WETH | 354.679052201 WETH |

So even though Uniswap's Base WETH/USDC pool shows larger raw TVL, Aerodrome Slipstream gave the better executable quote for the swap sizes that matter here. The difference at 500k USDC was about `0.4473 WETH` in Aerodrome's favor, which is material for a treasury desk.

## Sources / verification

- Aerodrome's official contract table lists the Slipstream `SwapRouter` as `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5` and the Slipstream `UniversalRouter` separately: https://aerodrome-finance.app/security/
- The same Aerodrome page lists the Slipstream PoolFactory as `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A`, which resolves the WETH/USDC tick-spacing-100 pool above.
- Aerodrome docs describe concentrated liquidity pools and note that deeper liquidity reduces slippage: https://github.com/aerodrome-finance/docs/blob/main/content/liquidity.mdx
- Uniswap's official Base deployment page lists the Base `QuoterV2`, `SwapRouter02`, and `UniversalRouter` addresses used for comparison: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments

Implementation note: if the code is currently using a Uniswap-v3-style single-pool swap interface, this Aerodrome Slipstream router uses tick spacing instead of Uniswap fee tier. For this route, use tick spacing `100`.
