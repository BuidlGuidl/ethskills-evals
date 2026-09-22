# Base USDC -> WETH swap notes

## Venue and approach

This script swaps native Base USDC to Base WETH through Uniswap V3 on Base mainnet.

Addresses used:

- Base chain ID: `8453`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH9: `0x4200000000000000000000000000000000000006`
- Uniswap V3 `SwapRouter02`: `0x2626664c2603336E57B271c5C0b26F421741e481`
- Uniswap V3 `QuoterV2`: `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`

The script quotes the direct USDC/WETH Uniswap V3 fee tiers in `POOL_FEES` and chooses the tier returning the most WETH for the requested exact USDC input. It then sets `amountOutMinimum` from that fresh quote and `MAX_SLIPPAGE_BPS`, approves the router if needed, simulates the swap, and broadcasts `SwapRouter02.multicall(deadline, [exactInputSingle(...)])`.

The actual router call is:

```solidity
exactInputSingle({
  tokenIn: USDC,
  tokenOut: WETH,
  fee: bestQuotedFeeTier,
  recipient: RECIPIENT || signer,
  amountIn: AMOUNT_USDC,
  amountOutMinimum: quote * (1 - MAX_SLIPPAGE_BPS / 10000),
  sqrtPriceLimitX96: 0
})
```

I chose Uniswap V3 because its Base deployments are canonical, the contracts are verified and documented, and concentrated-liquidity pools give a direct onchain quote and enforceable slippage bound. For treasury-sized trades, this is still only one venue. Base often has meaningful USDC liquidity on other venues too, especially Aerodrome, so an operator should compare this quote against an aggregator/RFQ desk before moving large size.

## Running

Install dependencies:

```bash
npm install
```

Quote without broadcasting. If the account already has enough router allowance,
the script also simulates the exact router call:

```bash
PRIVATE_KEY=0x... \
AMOUNT_USDC=250000 \
npm run swap
```

Broadcast:

```bash
PRIVATE_KEY=0x... \
AMOUNT_USDC=250000 \
MAX_SLIPPAGE_BPS=25 \
EXECUTE=true \
npm run swap
```

Optional environment variables:

- `RPC_URL`: defaults to `https://mainnet.base.org`
- `RECIPIENT`: defaults to the signing account
- `MAX_SLIPPAGE_BPS`: defaults to `50`
- `DEADLINE_SECONDS`: defaults to `180`
- `POOL_FEES`: defaults to `100,500,3000,10000`

## Before using real funds

- Use native Base USDC, not bridged `USDbC`.
- Make sure `RPC_URL` is a reliable Base mainnet RPC. The script checks chain ID `8453`.
- The signer must hold enough USDC and enough Base ETH for gas.
- Keep `MAX_SLIPPAGE_BPS` tight enough for the desk's policy, but not so tight that normal Base block-to-block movement causes failed transactions.
- Compare the printed quote, fee tier, and price impact against another venue or aggregator before large swaps. The script does not split orders across pools or venues.
- Avoid stale approvals. This script approves the exact input amount when allowance is insufficient.
- A dry run with insufficient allowance will quote but skip router simulation. Run with `EXECUTE=true` only after reviewing the quote; the script approves first, then simulates, then broadcasts the swap.
- Run a small live swap first with the same account, RPC, and operational flow.

Sources checked on 2026-09-22: Uniswap's Base deployment docs list `QuoterV2`, `SwapRouter02`, and Base WETH; Circle/USDC docs list native Base USDC; Base docs list chain ID `8453`.
