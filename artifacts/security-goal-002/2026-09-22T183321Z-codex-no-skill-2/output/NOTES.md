# WETH / USDC Borrow Market Notes

## Health and Accounting

- Collateral is WETH and debt is USDC, both accounted in their token native units: WETH has 18 decimals and USDC has 6 decimals.
- The market prices WETH with the configured Chainlink ETH/USD feed. The feed answer is rejected if it is non-positive, stale, or from an incomplete round.
- Collateral value in USDC units is:

```text
collateralValueUsdc = collateralWeth * ethUsdPrice * 1e6 / 1e18 / 10**feedDecimals
```

- Borrowing and collateral withdrawals must leave the position at or below 70% LTV:

```text
debtUsdc <= collateralValueUsdc * 7000 / 10000
```

- Interest is simple linear interest, accrued when a position is touched:

```text
newDebt = oldDebt + oldDebt * annualInterestRateBps * elapsedSeconds / 10000 / 365 days
```

- A position is liquidatable only once its debt is greater than 85% of collateral value:

```text
debtUsdc > collateralValueUsdc * 8500 / 10000
```

- `positionOf(user)` returns the accrued debt, current collateral value, borrow limit, liquidation threshold debt, and a liquidation health value. A liquidation health value below `10000` means the position is liquidatable.

## Liquidator Flow

1. Find an unhealthy account with `isLiquidatable(borrower)` or by comparing the values returned from `positionOf`.
2. Approve the market to spend the amount of USDC to repay.
3. Call `liquidate(borrower, repayAmount)`.
4. The contract accrues the borrower's interest, pulls the USDC repayment from the liquidator, reduces the borrower's debt, and transfers WETH to the liquidator.

The WETH seized is the WETH value of the repaid USDC plus a 5% bonus:

```text
seizedWeth = wethForUsdc(repaidUsdc) * 10500 / 10000
```

If the requested repayment would seize more WETH than the borrower has, the call reverts. The liquidator should retry with a smaller repayment amount.

## Mainnet Deployment Checklist

- Use the canonical mainnet token addresses:
  - WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
  - USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- Use the intended Chainlink ETH/USD feed and set `maxPriceAge` to a value that matches the feed heartbeat and operating risk. Do not deploy with a placeholder or test feed.
- Choose the immutable flat annual interest rate before deployment. This implementation caps it at 100% APR.
- Fund the contract with enough USDC reserves before users borrow. The owner can withdraw USDC reserves, so the owner key should be a multisig or another controlled governance account.
- Verify the contract source and constructor arguments. Frontends and bots should read the deployed immutable parameters instead of assuming them.
- Monitor oracle freshness, USDC reserves, liquidatable accounts, and positions near the liquidation threshold.
- This is intentionally small and does not include an upgrade path, pause switch, bad-debt auction, close factor, reserve accounting for lenders, governance controls, or multi-oracle circuit breakers. Those are important production considerations before taking meaningful mainnet risk.

