# USDC to WETH Swap Script on Base

This uses Uniswap v3 on Base mainnet through `SwapRouter02`:

- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH: `0x4200000000000000000000000000000000000006`
- Uniswap v3 factory: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`
- Uniswap QuoterV2: `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`
- Uniswap SwapRouter02: `0x2626664c2603336E57B271c5C0b26F421741e481`
- Chainlink ETH/USD guard: `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70`

The script checks live USDC/WETH pools at the standard v3 fee tiers, asks `QuoterV2.quoteExactInputSingle` for executable quotes, and greedily splits the USDC amount across fee tiers. Execution is a single `SwapRouter02.multicall(deadline, calls)` containing one or more `exactInputSingle` calls. Each leg has its own `amountOutMinimum`.

I chose Uniswap v3 because the Base deployment is canonical and documented, the QuoterV2 and router are public contracts, and direct USDC/WETH liquidity is usually the cleanest route for this pair. The splitter is intentionally simple and auditable; it is better than hardcoding one pool, but it is not a full cross-venue smart-order router.

## Running

Install dependencies:

```bash
npm install
```

Dry-run a quote:

```bash
PRIVATE_KEY=0x... USDC_AMOUNT=250000 npm run swap
```

Submit the approval and swap:

```bash
PRIVATE_KEY=0x... USDC_AMOUNT=250000 EXECUTE=true npm run swap
```

Useful controls:

- `BASE_RPC_URL`: Base RPC URL. Defaults to `https://mainnet.base.org`.
- `RECIPIENT`: WETH recipient. Defaults to the signing account.
- `SLIPPAGE_BPS`: per-leg slippage from the fresh quote. Defaults to `30` bps.
- `MAX_ORACLE_SHORTFALL_BPS`: maximum quoted output shortfall versus Chainlink ETH/USD. Defaults to `150` bps.
- `QUOTE_CHUNKS`: split-planner granularity. Defaults to `24`; max is `100`.
- `FEE_TIERS`: comma-separated v3 fees to consider. Defaults to `100,500,3000,10000`.
- `FORCE_FEE`: bypass splitting and use one fee tier.
- `DEADLINE_SECONDS`: router multicall deadline. Defaults to `120`.
- `APPROVE_MAX=true`: approve max USDC instead of exact input. Exact approval is the default.

## Before Using Real Funds

Use a private, reliable Base RPC and simulate immediately before execution. Public RPCs can lag, rate-limit, or leak intent.

For treasury-sized trades, compare the dry-run quote against an independent venue or aggregator before setting `EXECUTE=true`. This script only considers Uniswap v3 USDC/WETH pools; Aerodrome, UniswapX, RFQ/OTC, or an aggregator may beat it for very large clips.

Set `SLIPPAGE_BPS` and `MAX_ORACLE_SHORTFALL_BPS` deliberately. Loose limits can accept a bad fill; tight limits can revert during fast markets.

Keep the signer operationally isolated. It must hold native ETH on Base for gas and enough native USDC, not bridged `USDbC`.

Check allowance policy. Exact approval minimizes standing allowance; `APPROVE_MAX=true` is operationally convenient but increases router allowance exposure.
