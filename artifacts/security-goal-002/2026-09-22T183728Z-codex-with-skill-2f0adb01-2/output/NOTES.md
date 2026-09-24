# WETH / USDC Borrow Market Notes

## Position Health

Collateral is WETH and debt is USDC. The market reads the Chainlink ETH/USD feed, rejects stale or invalid answers, and converts WETH collateral into USDC's 6-decimal units:

`collateralValueUsdc = wethAmount * ethUsdPrice * 1e6 / (1e18 * priceFeedUnit)`

New borrows are limited to 70% LTV:

`debtWithAccruedInterest <= collateralValueUsdc * 70%`

Liquidation health uses the 85% threshold:

`healthy = debtWithAccruedInterest <= collateralValueUsdc * 85%`

Debt accrues simple interest per position at the immutable annual rate:

`interest = storedDebt * annualInterestRateBps * elapsedSeconds / (10_000 * 365 days)`

The contract accrues a borrower's debt before borrow, repay, withdraw, and liquidation actions. Collateral withdrawals are allowed only if the resulting position remains under the 85% liquidation threshold.

## Liquidator Flow

1. Find an account where `liquidatable(borrower)` is true or `quoteLiquidation(borrower, amount)` returns non-zero values.
2. Approve the market to pull USDC for the quoted repay amount.
3. Call `liquidate(borrower, maxRepayAmount, recipient)`.
4. The contract repays up to `maxRepayAmount`, capped by the borrower's debt and available collateral, then transfers WETH worth the repaid USDC plus a 5% liquidation bonus.

The liquidator should use `quoteLiquidation` immediately before sending the transaction and leave room for oracle price movement, interest accrual, and competing liquidations.

## Mainnet Deployment Checklist

- Deploy with the canonical Ethereum mainnet WETH token, USDC token, and Chainlink ETH/USD feed proxy. Verify all addresses against official sources before deployment.
- The constructor requires WETH to report 18 decimals, USDC to report 6 decimals, and the Chainlink feed to report at most 18 decimals.
- Choose an annual interest rate and oracle staleness window before deployment; both are immutable. A common staleness window for major Chainlink feeds is on the order of one hour, but the operator should match Chainlink's current heartbeat and risk tolerance.
- Seed enough USDC liquidity with `supplyLiquidity` before opening borrowing. The owner can withdraw only USDC currently held by the market, so borrowed USDC is naturally unavailable until repaid.
- Transfer ownership to a multisig or timelock-controlled operations account. The owner can supply and withdraw idle USDC liquidity, so this key is economically sensitive.
- Monitor oracle updates, USDC transfer/blocklist risk, market liquidity, and accounts approaching liquidation.
- Run `forge build`, unit/fuzz tests, static analysis, and source verification before production deployment. This implementation intentionally avoids proxies; upgrades require deploying a new market and migrating liquidity/users.

