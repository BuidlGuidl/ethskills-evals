# Recommendation

Integrate **Aerodrome Slipstream** for the Base USDC -> WETH swap leg, using the Slipstream `SwapRouter`:

```text
0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5
```

For this route, do **not** use Aerodrome's classic v2-style router (`0xcF77...`). The deeper book for treasury-sized USDC/WETH execution is in Slipstream concentrated liquidity, and the route should target the active USDC/WETH Slipstream pool with `tickSpacing = 100`.

## Why

I checked the decision pair-specifically on Base, not by aggregate DEX TVL. On 2026-09-22, live quoter checks for a `500,000 USDC` exact-input swap into WETH showed:

| Venue / pool | Quote for 500,000 USDC -> WETH |
| --- | ---: |
| Aerodrome Slipstream, `tickSpacing=100` | `182.048993716676412244 WETH` |
| Aerodrome newer Slipstream factory, `tickSpacing=50` | `181.935574191822746722 WETH` |
| Uniswap v3, 0.30% | `181.740662021543158130 WETH` |
| Uniswap v3, 0.05% | `180.166684907163793726 WETH` |

At this clip size, Aerodrome Slipstream's established `tickSpacing=100` USDC/WETH pool gave the best output of the checked on-chain venues. A smaller `100,000 USDC` check showed the same ordering between Aerodrome Slipstream and Uniswap 0.05%:

| Venue / pool | Quote for 100,000 USDC -> WETH |
| --- | ---: |
| Aerodrome Slipstream, `tickSpacing=100` | `36.424852513835030691 WETH` |
| Uniswap v3, 0.05% | `36.375633873035405249 WETH` |

## Address Checks

The recommended router is the Aerodrome Slipstream `SwapRouter` published in Aerodrome's own deployment/security listings:

- Aerodrome Slipstream `SwapRouter`: `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`
- Its `factory()` on Base returns `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A`
- Its `WETH9()` on Base returns `0x4200000000000000000000000000000000000006`
- The `tickSpacing=100` USDC/WETH pool from that factory is `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59`
- Native Base USDC used for the quote: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

Sources checked:

- Aerodrome official contract/security page: https://aerodrome-finance.app/security/
- Aerodrome Slipstream repo deployments: https://github.com/aerodrome-finance/slipstream
- Uniswap Base v3 deployment docs for comparison: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments

Before moving real treasury size, re-run venue quotes at the intended clip and enforce an `amountOutMinimum`; concentrated-liquidity depth and the best venue can move intraday.
