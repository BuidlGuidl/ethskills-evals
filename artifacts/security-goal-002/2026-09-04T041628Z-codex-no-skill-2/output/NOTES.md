# Borrowing Market Notes

## Position health

This market stores collateral in WETH (18 decimals) and debt in USDC (6 decimals).

- Oracle price: `priceE8` is the WETH price in USDC with 8 decimals.
- Collateral value in USDC units: `collateralValue = collateralAmount * priceE8 / 1e20`
- Loan-to-value: `ltvBps = debtAmount * 10_000 / collateralValue`
- Borrow limit: a user can only borrow while `ltvBps <= 7_000` (70%).
- Withdrawal health check: after a withdrawal, the position must still satisfy `ltvBps <= 8_500` (85%).
- Liquidation threshold: a position is liquidatable once `ltvBps > 8_500`.

Debt accrues as simple interest, not a utilization-based variable rate:

- `interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)`

Interest is realized when the position is touched by `depositCollateral`, `withdrawCollateral`, `borrow`, `repay`, or `liquidate`. `currentDebt()` and the health view functions include pending accrued interest even before it is written back to storage.

## Liquidation flow

To liquidate a position:

1. Check that `loanToValueBps(user) > 8_500`.
2. Approve USDC to the market contract.
3. Call `liquidate(user, requestedRepayAmount)`.

The market caps the repay amount to the smaller of:

- the requested repay amount,
- the borrower’s current debt,
- the amount of debt that the borrower’s remaining WETH can support after giving the liquidator a 5% bonus.

Collateral seized is:

- `seizedWeth = repaidUsdc * 10_500 * 1e20 / (priceE8 * 10_000)`

That gives the liquidator the WETH equivalent of the repaid USDC plus a 5% bonus, priced off the current oracle value.

## Mainnet deployment / operations

The deployable contracts are:

- `ChainlinkWethUsdcOracle`
- `SimpleBorrowingMarket`

An operator deploying this on Ethereum mainnet has to get the following right:

- Use the real mainnet WETH and USDC token addresses. This implementation assumes exactly 18 decimals for WETH and 6 decimals for USDC.
- Point the oracle at robust Chainlink feeds for WETH/USD and USDC/USD. The adapter assumes both feeds use 8 decimals.
- Set a sane `MAX_ORACLE_DELAY`. If the feeds are stale, borrowing, withdrawals, and liquidations will revert.
- Prefund the market with USDC using `depositLiquidity()`. The contract cannot mint debt tokens; it can only lend out USDC that it already holds.
- Choose `annualInterestBps` deliberately. This implementation is intentionally simple flat-rate simple interest, not compound interest and not a utilization model.
- Understand the oracle basis risk. The market values WETH in USDC by dividing ETH/USD by USDC/USD. If USDC depegs, health and liquidation behavior will follow the feed values.
- Monitor solvency. `totalDebtOutstanding` increases when interest is accrued, so operators must ensure the contract has enough USDC liquidity and a clear process for handling bad debt if collateral value gaps down faster than liquidators can act.
- Accept that there is no governance surface beyond the deployer’s ability to deposit or withdraw excess USDC liquidity. There are no pause controls, no rate updates, and no upgrade hooks in this version.

## Scope notes

This is a minimal onchain implementation for the borrowing-market core. It does not include:

- a frontend or keeper,
- permit support,
- partial reserve accounting for third-party LPs,
- bad-debt socialization,
- multiple collateral types,
- production-grade oracle circuit breakers beyond staleness and positive-price checks.
