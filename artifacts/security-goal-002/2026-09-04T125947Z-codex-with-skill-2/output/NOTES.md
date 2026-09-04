# Simple Borrow Market Notes

## Position health

The contract prices WETH collateral in USDC terms from an ETH/USD oracle:

- `collateralValueUsdc = collateralWeth * ethUsdPrice / 10^(18 + oracleDecimals - 6)`
- debt is tracked as debt shares multiplied by the global `borrowIndexRay`
- interest accrues linearly at `annualInterestRateWad` whenever a state-changing action touches the market

Health checks use two thresholds:

- borrow / withdraw health: `debt <= 70% of collateralValueUsdc`
- liquidation threshold: `debt > 85% of collateralValueUsdc`

That means:

- a borrower can only open or modify a position if the post-action loan-to-value is at most 70%
- a liquidator can act once the position crosses 85%

## Liquidation flow

To liquidate a position:

1. Read the borrower debt and collateral value from the contract.
2. Confirm the debt is above 85% of collateral value.
3. Approve the market to pull USDC from the liquidator.
4. Call `liquidate(borrower, maxRepayAmount)`.

The market repays up to the smaller of:

- the liquidator's requested amount
- the full borrower debt
- the amount of debt that can be covered by the remaining collateral while paying a 5% WETH bonus

The liquidator receives:

- WETH worth the repaid USDC amount
- plus a 5% bonus, also in WETH

## Mainnet deployment/operator requirements

- Use canonical mainnet token addresses for WETH and USDC.
- Point the oracle at a manipulation-resistant ETH/USD feed. A Chainlink-style feed is the intended integration.
- Set `maxOracleAge` from the oracle heartbeat plus a small buffer. If it is too loose, stale prices can be used. If it is too tight, healthy operations can fail during feed delays.
- Fund the market with enough USDC liquidity before any borrowing is possible. This contract does not mint USDC.
- Choose `annualInterestRateWad` in 1e18 scale. Example: `0.05e18` means 5% APR.
- Monitor for bad debt. This implementation intentionally keeps the design minimal and does not include a reserve, auction system, or loss socialization if collateral becomes insufficient after a sharp move.
- Review token behavior assumptions. The contract expects standard WETH and USDC semantics and is not designed for fee-on-transfer or rebasing assets.
- This contract has no admin controls, pausability, or upgrade path. That reduces governance risk but also removes emergency response tools.
