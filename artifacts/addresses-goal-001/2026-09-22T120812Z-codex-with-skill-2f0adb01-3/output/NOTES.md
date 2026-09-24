# Base USDC -> WETH swap tool

## Venue

This script uses Uniswap V3 on Base through `SwapRouter02`.

Addresses used:

- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH: `0x4200000000000000000000000000000000000006`
- Uniswap V3 QuoterV2: `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`
- Uniswap SwapRouter02: `0x2626664c2603336E57B271c5C0b26F421741e481`

I chose Uniswap V3 because the USDC/WETH pair on Base has deep, observable onchain liquidity and can be executed with deterministic contract calls, without trusting third-party routing calldata from an API. The script asks `QuoterV2.quoteExactInputSingle` for each common V3 fee tier (`100`, `500`, `3000`, `10000`) and selects the tier with the highest WETH output for the requested USDC input.

The actual swap is submitted to `SwapRouter02.multicall(deadline, [exactInputSingle(...)])`. Wrapping `exactInputSingle` in `multicall` adds a deadline guard, because the `SwapRouter02` V3 exact-input struct itself does not include a deadline field.

## Running

Install dependencies:

```bash
npm install
```

Dry-run quote and simulation:

```bash
PRIVATE_KEY=0x... \
AMOUNT_USDC=250000 \
BASE_RPC_URL=https://mainnet.base.org \
npm run swap
```

Broadcast approval and swap:

```bash
PRIVATE_KEY=0x... \
AMOUNT_USDC=250000 \
SLIPPAGE_BPS=30 \
MAX_PRICE_IMPACT_BPS=100 \
EXECUTE=1 \
npm run swap
```

Optional environment variables:

- `RECIPIENT`: receives WETH; defaults to the signing account.
- `SLIPPAGE_BPS`: default `30` (`0.30%`). Used to derive `amountOutMinimum`.
- `MAX_PRICE_IMPACT_BPS`: default `100` (`1.00%`). Aborts if the selected route is too far from a 1,000 USDC probe quote.
- `DEADLINE_SECONDS`: default `180`. Max `3600`.
- `FEE_TIER`: force one of `100`, `500`, `3000`, `10000` instead of auto-selecting.
- `APPROVE_MAX=1`: approve max USDC instead of approving only this swap amount.
- `BASE_RPC_URL`: defaults to `https://mainnet.base.org`; use a private, reliable RPC for production.

## Production checklist

Confirm all addresses against BaseScan and the current Uniswap deployment docs before sending real funds. The local script hardcodes the known Base mainnet addresses, but address verification should still be part of the release/runbook.

Use a production RPC with low latency and reliable `eth_call`/mempool behavior. Public RPCs are fine for smoke tests, not for treasury execution.

Set slippage and price-impact limits for the specific trade size and market. For hundreds of thousands of USDC, do not rely on a stale quote; dry-run immediately before broadcast and keep the deadline tight.

Consider splitting execution or comparing against an aggregator/RFQ venue before very large swaps. This script gives deterministic Uniswap V3 execution; it does not do TWAPs, RFQs, private orderflow, or multi-venue splitting.

Keep the funded private key out of shell history and logs. Prefer a dedicated execution key, a signer service, or hardware-backed signing flow instead of exporting a long-lived treasury key.

## References checked

- Uniswap Base deployment docs: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments
- Uniswap V3 single-swap guide: https://developers.uniswap.org/docs/protocols/v3/guides/swapping/single-hop-swapping
- Uniswap `IV3SwapRouter` interface: https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol
- Uniswap `QuoterV2` / `IQuoterV2` references: https://github.com/Uniswap/v3-periphery/blob/main/contracts/lens/QuoterV2.sol
