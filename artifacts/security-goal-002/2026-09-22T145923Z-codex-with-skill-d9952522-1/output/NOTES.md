# WETH/USDC Borrowing Market Notes

## Position health

Each borrower has WETH collateral and USDC debt. The contract values WETH with a Chainlink-compatible ETH/USD feed, requires a positive non-stale answer, and normalizes the result into USDC base units (6 decimals).

The borrow limit is 70% loan-to-value:

```text
debtUsdc <= collateralValueUsdc * 70%
```

The liquidation line is 85% loan-to-value:

```text
debtUsdc > collateralValueUsdc * 85%
```

Debt accrues lazily whenever a position is touched. The interest model is simple annual interest:

```text
newDebt = oldDebt + oldDebt * annualRate * elapsedSeconds / 365 days
```

The annual rate is provided as a WAD value in the constructor, so `0.05e18` means 5% APR.

## Liquidator flow

A liquidator calls `liquidate(borrower, maxRepayUsdc)` after approving USDC to the market.

If the position is above the 85% liquidation threshold, the market pulls USDC from the liquidator, reduces the borrower's debt, and sends the liquidator WETH worth the repaid USDC plus a 5% bonus. The contract caps the actual repayment to the borrower's debt and to the amount that can be covered by the borrower's remaining collateral.

Liquidation uses the current validated ETH/USD oracle answer at execution time. Liquidators should check `health`, current oracle data, and expected seized WETH offchain before submitting a transaction.

## Mainnet deployment checklist

- Use the canonical Ethereum mainnet WETH and USDC token addresses.
- Use the correct Chainlink ETH/USD feed for mainnet, and set `ethUsdMaxAge` from that feed's published heartbeat plus a deliberate margin.
- Set `annualInterestRateWad` to the intended flat APR before deployment; it is immutable in this implementation.
- Transfer ownership to the intended multisig or timelock, not an EOA.
- Fund USDC liquidity through `provideLiquidity` before enabling borrowing.
- Confirm token decimals and feed decimals in deployment scripts and monitoring.
- Monitor oracle freshness and market liquidity. If the ETH/USD feed is stale, borrowing, withdrawals that need health checks, and liquidations will revert.
- This is intentionally not a full supplier market: owner-managed USDC liquidity has no share accounting or depositor claims.

