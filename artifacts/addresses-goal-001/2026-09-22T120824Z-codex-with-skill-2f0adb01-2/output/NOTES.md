# USDC -> WETH Swap Tool on Base

This tool swaps native Base USDC into WETH through Aerodrome Slipstream, Aerodrome's concentrated-liquidity venue on Base.

## Venue

Base mainnet token addresses:

- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH: `0x4200000000000000000000000000000000000006`

Aerodrome Slipstream contracts:

- PoolFactory: `0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A`
- Quoter: `0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0`
- SwapRouter: `0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5`

I chose Aerodrome Slipstream because Aerodrome is the native liquidity hub on Base and Slipstream is its concentrated-liquidity system. For large USDC/WETH trades, the script discovers enabled Slipstream tick spacings, quotes every live direct USDC/WETH pool with `quoteExactInputSingle`, picks the best output, and executes `exactInputSingle` on the selected pool. This keeps the route auditable while avoiding a hard-coded pool choice.

## How to Run

Install dependencies:

```bash
npm install
```

Quote only:

```bash
npm run swap -- --amount-usdc 250000 --slippage-bps 30
```

Execute with a funded Base account:

```bash
BASE_RPC_URL=https://your-base-rpc.example \
PRIVATE_KEY=0x... \
npm run swap -- --amount-usdc 250000 --slippage-bps 30 --execute
```

Optional inputs: `--recipient`, `--from`, `--deadline-seconds`, `--rpc-url`. Environment equivalents are `RECIPIENT`, `ACCOUNT_ADDRESS`, `DEADLINE_SECONDS`, and `BASE_RPC_URL`.

## References

- Aerodrome current contract list: https://aerodrome-finance.app/security/
- Slipstream `IQuoterV2`: https://raw.githubusercontent.com/aerodrome-finance/slipstream/main/contracts/periphery/interfaces/IQuoterV2.sol
- Slipstream `ISwapRouter`: https://raw.githubusercontent.com/aerodrome-finance/slipstream/main/contracts/periphery/interfaces/ISwapRouter.sol
- Slipstream `ICLFactory`: https://raw.githubusercontent.com/aerodrome-finance/slipstream/main/contracts/core/interfaces/ICLFactory.sol

## What Must Be Right Before Real Funds

- Use a reliable private Base RPC. Public RPCs are fine for testing but fragile for desk execution.
- Verify the contract addresses on BaseScan immediately before first production use.
- Set slippage intentionally. The default is 30 bps, but six-figure trades may need tighter or looser limits depending on liquidity and urgency.
- Treat the quote as perishable. The script quotes, optionally approves, simulates, then sends; market movement or MEV can still make the swap revert or fill at `amountOutMinimum`.
- Avoid stale approvals. The script approves exactly the requested USDC amount when needed, not an unlimited allowance.
- For very large or urgent flow, compare this direct Slipstream route with an RFQ/aggregator, split execution over time, or use private transaction infrastructure.
- Keep the signing key out of shell history and logs. Prefer a dedicated treasury execution key with limited funded balance.
