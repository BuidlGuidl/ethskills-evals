# WETH/USDC Borrow Market Notes

## Position health

Collateral is WETH and debt is USDC. The contract prices WETH with a Chainlink ETH/USD feed and normalizes the result into USDC's 6 decimal units:

```text
collateralValueUsdc = wethAmount * ethUsdPrice / 10^feedDecimals / 1e12
```

A borrower can open or change a position only if:

```text
debtUsdc <= collateralValueUsdc * 70%
```

Debt accrues simple linear interest whenever the position is touched:

```text
newDebt = oldDebt + oldDebt * annualRateBps * elapsedSeconds / 10_000 / 365 days
```

A position is liquidatable once:

```text
debtUsdc > collateralValueUsdc * 85%
```

The 70% borrow limit and 85% liquidation threshold intentionally leave a buffer for normal price movement and accrued interest.

## Liquidator flow

A liquidator should:

1. Check `isLiquidatable(borrower)`.
2. Approve this market to transfer the USDC repayment amount.
3. Call `liquidate(borrower, maxRepayUsdc)`.

The contract repays up to `maxRepayUsdc`, capped by the borrower's current debt and available collateral. The liquidator receives the WETH value matching the repaid USDC plus a 5% liquidation bonus. If the requested repayment would seize more WETH than the borrower has, repayment is reduced to the maximum amount supportable by the remaining collateral.

Liquidations can be partial. A borrower may remain liquidatable after one liquidation if enough debt and collateral remain.

## Mainnet deployment checklist

- Use canonical Ethereum mainnet WETH and USDC addresses. The constructor verifies WETH has 18 decimals and USDC has 6 decimals, but the operator must still pass the correct contracts.
- Use the Chainlink ETH/USD feed for Ethereum mainnet, not a DEX spot price. Pick `maxPriceAge` based on the feed heartbeat and operational tolerance; stale or invalid oracle answers block borrows, withdrawals that require health checks, and liquidations.
- Choose an annual rate in basis points before deployment. The contract is immutable and does not have an admin function to change risk parameters.
- Seed the market with enough USDC liquidity before expecting borrows. Borrowing reverts if the contract's USDC balance is too low.
- Decide whether this simple immutable market is acceptable for production. It has no pause, upgrades, lender accounting, reserve management, or governance controls.
- Run `forge build`, unit/fuzz tests, static analysis such as Slither, and an external audit before deploying real value.
- Verify the deployed source on Etherscan and publish the exact constructor arguments.

