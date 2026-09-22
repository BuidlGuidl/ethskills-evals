# Base USDC -> WETH Swap Tool

This tool swaps native Base USDC into WETH through Aerodrome Slipstream concentrated liquidity.

## Venue

I chose Aerodrome Slipstream because Aerodrome is Base-native and its own docs describe it as the central liquidity hub for Base. For USDC/WETH, the script uses the concentrated-liquidity Slipstream deployment rather than Aerodrome's older v2-style router. That matters for treasury-sized clips: the current direct Slipstream pools have materially different depth by tick spacing, so `swap.ts` quotes every standard USDC/WETH Slipstream tick spacing at the requested size and selects the best live `amountOut`.

On September 22, 2026, live Base RPC checks confirmed:

- Native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, `symbol() == "USDC"`, 6 decimals.
- WETH: `0x4200000000000000000000000000000000000006`, `symbol() == "WETH"`, 18 decimals.
- Aerodrome Slipstream factory: `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A`.
- Aerodrome Slipstream quoter: `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0`.
- Aerodrome Slipstream swap router: `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`.
- Both the quoter and swap router returned the factory address above from `factory()`.

Primary sources:

- Aerodrome security/deployments page: https://aerodrome-finance.app/security/
- Aerodrome Slipstream `ISwapRouter`: https://github.com/aerodrome-finance/slipstream/blob/main/contracts/periphery/interfaces/ISwapRouter.sol
- Aerodrome Slipstream `IQuoterV2`: https://github.com/aerodrome-finance/slipstream/blob/main/contracts/periphery/interfaces/IQuoterV2.sol
- Circle native USDC on Base announcement: https://www.circle.com/blog/usdc-now-available-natively-on-base
- Uniswap Base deployments page for Base WETH address: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments

## Contract Calls

The script calls:

- `ICLFactory.getPool(USDC, WETH, tickSpacing)` to discover each direct Slipstream pool.
- `IQuoterV2.quoteExactInputSingle({ tokenIn, tokenOut, amountIn, tickSpacing, sqrtPriceLimitX96: 0 })` via `eth_call` to quote each pool.
- `USDC.approve(SlipstreamSwapRouter, amount)` if allowance is insufficient and `EXECUTE=true`.
- `ISwapRouter.exactInputSingle({ tokenIn, tokenOut, tickSpacing, recipient, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0 })` to execute the swap.

## Running

Install dependencies:

```bash
npm install
```

Dry run and quote:

```bash
BASE_RPC_URL=https://base-rpc.publicnode.com \
PRIVATE_KEY=0x... \
USDC_AMOUNT=500000 \
npm run swap
```

Broadcast:

```bash
BASE_RPC_URL=https://base-rpc.publicnode.com \
PRIVATE_KEY=0x... \
USDC_AMOUNT=500000 \
SLIPPAGE_BPS=30 \
EXECUTE=true \
npm run swap
```

Optional env vars:

- `RECIPIENT`: defaults to the signing account.
- `SLIPPAGE_BPS`: defaults to `30` bps.
- `DEADLINE_SECONDS`: defaults to `120`.
- `TICK_SPACING`: restricts execution to one pool, for example `100`.
- `APPROVE_MAX=true`: approves max USDC instead of the exact input amount.

## What Must Be Right Before Real Funds Move

Re-check all addresses on Base immediately before production use. The script performs symbol, decimals, code, chain ID, pool, and quote checks, but the operator should still verify the Aerodrome deployment page, Circle's native USDC address, and BaseScan labels.

Use native USDC, not bridged USDbC or another USDC-like asset. The hard-coded input token is Circle's native Base USDC.

Use a reliable private RPC for large clips. The script defaults to `https://base-rpc.publicnode.com` for smoke tests; public RPCs are not ideal for treasury execution, and `https://mainnet.base.org` may rate-limit the full quote pass.

Set slippage deliberately from a fresh quote. The default `30` bps is a placeholder, not a policy. For very large swaps, compare this direct route against aggregators, RFQ/OTC, or a split execution plan before broadcasting.

Keep `EXECUTE` unset until the quote and selected pool look sane. With `EXECUTE=true`, the script can approve USDC and broadcast the swap.
