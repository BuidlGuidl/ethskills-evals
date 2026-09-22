# Base USDC -> WETH Swap Notes

## Approach

`swap.ts` is a viem script for Base mainnet. It:

1. Checks the RPC chain id is Base mainnet (`8453`).
2. Verifies token/router identity with live calls: USDC `symbol/decimals`, WETH `symbol`, and Aerodrome Slipstream router `factory/WETH9`.
3. Finds the direct USDC/WETH Aerodrome Slipstream pools for candidate `tickSpacing` values.
4. Uses the Aerodrome Slipstream Quoter to quote the requested USDC size against every live candidate pool.
5. Selects the pool with the highest WETH output, applies `MAX_SLIPPAGE_BPS`, approves only the input USDC amount, simulates `exactInputSingle`, then submits the swap when `EXECUTE=1`.

The real contract calls are:

- `USDC.approve(SLIPSTREAM_SWAP_ROUTER, amountIn)`
- `SlipstreamPoolFactory.getPool(USDC, WETH, tickSpacing)`
- `SlipstreamQuoter.quoteExactInputSingle({ tokenIn, tokenOut, amountIn, tickSpacing, sqrtPriceLimitX96: 0 })`
- `SlipstreamSwapRouter.exactInputSingle({ tokenIn, tokenOut, tickSpacing, recipient, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0 })`

## Venue

I chose Aerodrome Slipstream, Aerodrome's concentrated-liquidity venue on Base, rather than the older v2-style Aerodrome router. The direct reason is execution quality for large Base USDC/WETH clips: the script quotes the actual CL pools at the trade size and chooses from those live quotes, instead of assuming a fee tier or routing through a thin constant-product pool.

During implementation on September 22, 2026, a 500,000 USDC sample quote on Base showed `tickSpacing=100` as the best direct Slipstream pool by a wide margin. That observation is not a permanent guarantee; the script requotes at runtime because liquidity and price move.

An aggregator, RFQ, or split-order solver may still beat any single pool for very large treasury flow. This script is intentionally a direct onchain execution tool with transparent calls, not a best-execution system across every venue.

## Addresses

- Base native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Base WETH: `0x4200000000000000000000000000000000000006`
- Aerodrome Slipstream PoolFactory: `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A`
- Aerodrome Slipstream Quoter: `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0`
- Aerodrome Slipstream SwapRouter: `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`

Sources checked:

- Circle's Base USDC page: https://www.circle.com/multi-chain-usdc/base
- Aerodrome security/contracts page: https://aerodrome-finance.app/security/
- Optimism/Base WETH9 predeploy reference: https://github.com/ethereum-optimism/specs/blob/main/specs/protocol/predeploys.md
- BaseScan labels/ABIs for the Aerodrome Slipstream Quoter and SwapRouter

## Running

Install dependencies:

```bash
npm install
```

Dry run:

```bash
PRIVATE_KEY=0x... \
RPC_URL=https://your-base-mainnet-rpc.example \
AMOUNT_USDC=500000 \
npm run swap
```

Execute:

```bash
PRIVATE_KEY=0x... \
RPC_URL=https://your-base-mainnet-rpc.example \
AMOUNT_USDC=500000 \
MAX_SLIPPAGE_BPS=30 \
EXECUTE=1 \
npm run swap
```

Optional environment variables:

- `RECIPIENT`: WETH receiver, defaults to the signing account.
- `MAX_SLIPPAGE_BPS`: default `30` bps, allowed `1` to `1000`.
- `DEADLINE_SECONDS`: default `120`, allowed `30` to `1800`.
- `TICK_SPACINGS`: comma-separated candidate pool tick spacings, defaults to `1,50,100,200`.

## Before Real Funds

Re-check every address on Base mainnet on the run date. At minimum, verify token identity, router `factory()`, router `WETH9()`, and pool existence against the protocol's current contract page and BaseScan.

Use a reliable paid or dedicated RPC. Public Base endpoints can rate-limit, and stale or failed quotes are unacceptable for large clips.

Treat `MAX_SLIPPAGE_BPS` as a trading decision, not a code default. For hundreds of thousands of USDC, compare the final quoted amount to an independent venue or desk quote before setting `EXECUTE=1`.

Run a small production-sized workflow test first with the exact signer, RPC, recipient, and ops procedure. Confirm Base ETH for gas, USDC balance, allowance behavior, and WETH receipt accounting.

Do not leave broad token allowances behind unless that is an intentional custody policy. This script approves only `amountIn`, but previous allowances from the same account should still be audited.
