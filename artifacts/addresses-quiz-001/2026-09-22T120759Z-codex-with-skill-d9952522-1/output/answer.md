I would integrate Aerodrome Slipstream on Base and call its dedicated
`SwapRouter`:

`0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`

Reasoning, checked on 2026-09-22:

- For large USDC -> WETH clips, the relevant venue is Aerodrome's
  concentrated-liquidity Slipstream book, not the older Aerodrome vAMM router.
  The classic Aerodrome router address is real, but it will not route through
  Slipstream concentrated-liquidity pools.
- Aerodrome's official Base deployment page lists the Slipstream `SwapRouter`
  at `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`.
- On Base, that address has bytecode, `factory()` returns Aerodrome's
  Slipstream pool factory `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A`, and
  `WETH9()` returns Base WETH `0x4200000000000000000000000000000000000006`.
- Current Base DEX volume also supports this choice: Aerodrome Slipstream was
  the largest Base DEX in the live DefiLlama pull I checked, at about
  $475M 24h / $2.97B 7d, ahead of Uniswap V3 and PancakeSwap V3 on Base.
- A same-size quoter check for a 500,000 USDC exact-input swap into WETH also
  favored Aerodrome Slipstream's best USDC/WETH pool among the venues I checked:
  roughly 182.109 WETH on Aerodrome Slipstream versus roughly 181.741 WETH on
  the best Uniswap V3 quote I checked.

Config recommendation:

```ts
export const BASE_AERODROME_SLIPSTREAM_SWAP_ROUTER =
  "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";
```

Operational note: for real treasury flow, quote immediately before execution
and set tight slippage controls. Liquidity moves, and for six-figure clips the
selected Slipstream tick-spacing/pool matters.
