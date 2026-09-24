# Base USDC -> WETH Swap

This tool swaps native Base USDC into WETH through Aerodrome Slipstream using viem.

## Venue

I chose Aerodrome Slipstream because Base USDC/WETH is a size-sensitive pair and Aerodrome's concentrated-liquidity books are a primary Base liquidity venue. The script does not hard-code a single pool tier: it quotes all standard direct Slipstream tick spacings (`1`, `50`, `100`, `200`, `2000`) at the requested clip size and picks the highest WETH output immediately before execution.

Current addresses used:

- Native Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Base WETH: `0x4200000000000000000000000000000000000006`
- Aerodrome Slipstream PoolFactory: `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A`
- Aerodrome Slipstream Quoter: `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0`
- Aerodrome Slipstream SwapRouter: `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`

The actual execution call is `SwapRouter.exactInputSingle((tokenIn, tokenOut, tickSpacing, recipient, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96))`. Quoting uses `Quoter.quoteExactInputSingle((tokenIn, tokenOut, amountIn, tickSpacing, sqrtPriceLimitX96))`.

## Running

Install dependencies, then run a dry quote:

```bash
npm install
PRIVATE_KEY=0x... AMOUNT_USDC=500000 npm run swap
```

Send transactions only when ready:

```bash
RPC_URL=https://your-base-rpc \
PRIVATE_KEY=0x... \
AMOUNT_USDC=500000 \
SLIPPAGE_BPS=30 \
EXECUTE=true \
npm run swap
```

`EXECUTE` defaults to false. With `EXECUTE=true`, the script approves the exact USDC input amount if needed, simulates the router swap, then sends the swap.

`RPC_URL` defaults to `https://base-rpc.publicnode.com` for convenience, but production should use your own monitored Base RPC.

## Production Checklist

- Re-check every address against Aerodrome's current contract list, BaseScan, and direct Base RPC calls before moving real funds.
- Use native Base USDC, not bridged `USDbC` or any other USDC-like asset.
- Use a paid or otherwise reliable Base RPC. Public RPC rate limits or stale reads are not acceptable for treasury-sized execution.
- Set `AMOUNT_USDC` and `SLIPPAGE_BPS` deliberately for the exact trade. A large clip can move the active tick materially.
- Treat the quoter as a point-in-time estimate. Re-run immediately before execution and monitor pending mempool/market conditions.
- Consider splitting very large swaps, adding an RFQ/aggregator comparison, or routing through multiple venues when the quoted price impact is material.
- Keep the private key in a secure secret manager. This script is intentionally simple and does not replace an HSM, multisig, policy engine, or transaction review flow.
