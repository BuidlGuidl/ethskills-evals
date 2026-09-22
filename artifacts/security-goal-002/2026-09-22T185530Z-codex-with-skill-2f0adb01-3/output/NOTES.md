# WETH / USDC Borrow Market Notes

## Health and Accounting

- Collateral is WETH with 18 decimals. Debt is USDC with 6 decimals.
- The ETH/USD oracle is expected to be a Chainlink-style feed. Prices are rejected if non-positive, incomplete, or older than `maxOracleStaleness`.
- Collateral value is computed in USDC smallest units as:
  `wethAmount * ethUsdPrice / oracleScale * 1e6 / 1e18`.
- A borrower can open or modify a position only if debt is no more than 70% of collateral value.
- Debt accrues simple, non-compounding interest whenever a position is touched:
  `principal * annualRateBps * elapsed / (10_000 * 365 days)`.
- Liquidation health uses the 85% threshold. `healthFactor` is scaled by `1e18`; below `1e18` means liquidatable.

## Liquidation Flow

1. The liquidator checks `isLiquidatable(borrower)` or `healthFactor(borrower)`.
2. The liquidator approves this market to spend the USDC amount they want to repay.
3. The liquidator calls `liquidate(borrower, maxRepayAmount)`.
4. The contract accrues the borrower's debt, pulls the actual repaid USDC, and transfers WETH collateral worth that USDC amount plus a 5% bonus.

Large liquidations can revert if the 5% bonus would require more WETH than the borrower has left. In that case, retry with a smaller `maxRepayAmount`.

## Mainnet Deployment Checklist

- Deploy with canonical mainnet WETH, canonical mainnet USDC, and the Chainlink ETH/USD feed. Verify every address from primary sources immediately before deployment.
- Use a conservative oracle staleness window; one hour is a common starting point, but operators should align it with the feed heartbeat and risk tolerance.
- Choose the immutable annual interest rate before deployment. This implementation has no owner rate switch.
- Transfer ownership to an appropriate multisig. The owner can add and remove USDC liquidity, so a single EOA is not appropriate for production.
- Seed enough USDC liquidity before opening borrowing.
- Make sure frontends and liquidators handle USDC's 6 decimals and WETH's 18 decimals.
- Run `forge build`, Foundry tests/fuzzing, static analysis such as Slither, and an independent review before mainnet deployment.
- Verify the contract source on Etherscan after deployment.

