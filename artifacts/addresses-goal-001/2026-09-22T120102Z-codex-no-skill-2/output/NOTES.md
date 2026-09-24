# USDC -> WETH on Base

This tool swaps native Base USDC into WETH on Base mainnet using viem and the canonical Uniswap V3 deployment on Base.

## Venue and calls

Venue: Uniswap V3 on Base.

I chose Uniswap V3 because the Base deployment is canonical and publicly documented, the USDC/WETH pair is one of the deepest direct markets on Base, and the router lets the script enforce hard minimum output onchain. The script does not use a centralized quote API or an opaque aggregator spender.

Mainnet addresses used:

| Name | Address |
| --- | --- |
| Base chain id | `8453` |
| Native USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| Uniswap V3 QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` |
| Uniswap SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` |

Contract calls:

1. `QuoterV2.quoteExactInputSingle((tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96))`
2. `USDC.approve(SwapRouter02, amount)`
3. `SwapRouter02.exactInputSingle((tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96))`
4. `SwapRouter02.multicall(deadline, bytes[])` when the route is split across more than one V3 fee tier

## Execution approach

The script quotes the direct USDC/WETH pools across configurable V3 fee tiers, defaulting to `100,500,3000`. It breaks the order into chunks, estimates the marginal output of placing each chunk into each fee tier, and builds a split plan from the best marginal quotes. The submitted transaction is still a direct onchain Uniswap V3 swap, but it may be batched through `multicall` when multiple pools improve output.

Each leg receives its own `amountOutMinimum`, derived from the live quote and `SLIPPAGE_BPS`. The script also compares the total quoted output against a small spot-reference quote and refuses to continue if estimated price impact exceeds `MAX_PRICE_IMPACT_BPS`.

By default the script is a dry run. It quotes the route and prints minimum outputs, but does not approve or submit until `EXECUTE=true`. In execute mode it approves if needed, simulates the final router transaction, and only then submits.

## Running

Install dependencies:

```bash
npm install
```

Dry run:

```bash
BASE_RPC_URL="https://your-base-rpc.example" \
PRIVATE_KEY="0x..." \
USDC_AMOUNT="250000" \
npm run swap
```

Execute:

```bash
BASE_RPC_URL="https://your-base-rpc.example" \
PRIVATE_KEY="0x..." \
USDC_AMOUNT="250000" \
SLIPPAGE_BPS="30" \
MAX_PRICE_IMPACT_BPS="100" \
EXECUTE=true \
npm run swap
```

Useful options:

| Env var | Default | Meaning |
| --- | ---: | --- |
| `USDC_AMOUNT` | required | Human USDC amount, e.g. `250000` |
| `SLIPPAGE_BPS` | `30` | Per-leg max slippage from the live quote |
| `MAX_PRICE_IMPACT_BPS` | `100` | Refuse if quote is worse than spot reference by more than this |
| `FEE_TIERS` | `100,500,3000` | Comma-separated Uniswap V3 fee units |
| `SPLIT_CHUNKS` | `24` | Quote granularity for split routing |
| `DEADLINE_SECONDS` | `300` | Router multicall deadline |
| `RECIPIENT` | signer | Address receiving WETH |
| `APPROVE_MAX` | `false` | Approve max USDC instead of exact input |
| `EXECUTE` | `false` | Submit transactions only when set to `true` |

## What must be right before real funds

Use native Base USDC, not bridged USDbC. Circle lists native Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

Use a reliable Base mainnet RPC. Public RPCs can rate-limit or lag; a stale quote is a bad quote for this workflow.

Set slippage and price-impact caps deliberately. For six-figure swaps, a few bps can matter. Do not raise `SLIPPAGE_BPS` just to force execution through a moving market.

Run dry runs first and compare against other execution venues or OTC/RFQ quotes. This script improves over a blind single-pool swap, but it is not a full smart order router across every Base liquidity source.

Hold enough Base ETH for gas, and keep the signing key operationally isolated. The script can approve only the exact input by default; `APPROVE_MAX=true` is convenient but increases allowance risk.

Sources checked: Uniswap Base V3 deployment docs and governance deployment list for router/quoter addresses, Uniswap docs for Base WETH, and Circle's supported-chain documentation for native Base USDC.
