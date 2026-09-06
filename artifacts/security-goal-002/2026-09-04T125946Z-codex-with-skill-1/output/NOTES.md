# Borrowing Market Notes

## Position health

Each account has one position with:

- `collateralAmount`: WETH with 18 decimals.
- `debtPrincipal`: USDC debt with 6 decimals.
- `lastAccrued`: timestamp used to linearly accrue interest.

Debt grows linearly:

```text
currentDebt = principal + principal * annualInterestBps * elapsed / 10_000 / 365 days
```

The contract reads ETH/USD from the configured oracle, normalizes it to `1e18`, and converts WETH collateral into a USDC-denominated value:

```text
collateralValueInUsdc = collateralAmount * ethPrice / 1e30
```

That produces a 6-decimal USD value, matching USDC units.

Health rules:

- Borrowing and collateral withdrawals require `debt <= 70%` of collateral value.
- A position is liquidatable when `debt / collateralValue > 85%`.
- If collateral value is zero while debt remains, the position is immediately liquidatable.

Important edge behavior:

- Interest is realized whenever a position is touched and is also included in `previewDebt`, `currentLtvBps`, and `isLiquidatable`.
- Oracle reads revert if the answer is non-positive or older than `maxOracleAge`.

## Liquidation flow

To liquidate:

1. Call `isLiquidatable(account)` or compute the LTV off-chain.
2. Approve the market to pull USDC from the liquidator.
3. Call `liquidate(account, requestedRepayAmount)`.

The contract:

- accrues the borrower’s debt,
- checks that the position is above the 85% liquidation threshold,
- repays up to the smallest of:
  - the liquidator’s requested amount,
  - the borrower’s total debt,
  - the amount still backed by remaining collateral after applying the 5% liquidation bonus,
- transfers that USDC from the liquidator to the market, and
- transfers the liquidator the matching WETH plus the 5% bonus.

Seized collateral is:

```text
baseCollateral = repaidUsdc * 1e30 / ethPrice
seizedCollateral = baseCollateral * 10_500 / 10_000
```

If the borrower has too little collateral left to cover the full requested repayment plus bonus, the repayment is automatically capped so the liquidation only consumes available collateral.

## Mainnet deployment and operations

The contract expects:

- mainnet WETH as collateral,
- mainnet USDC as the debt asset, and
- a manipulation-resistant ETH/USD oracle, such as Chainlink’s ETH/USD feed.

An operator deploying this on Ethereum mainnet needs to get these right:

- Set the correct token addresses and the ETH/USD oracle address. A wrong oracle direction or wrong token breaks health checks.
- Set `maxOracleAge` to something aligned with the oracle heartbeat plus a small buffer. Too loose increases stale-price risk; too strict creates unnecessary downtime.
- Set an explicit annual rate in basis points. The contract uses simple linear accrual, not a utilization-based model.
- Transfer ownership to the intended multisig immediately after deployment if an EOA is used to deploy.
- Fund the market with USDC using `addLiquidity` before borrowers can draw loans.
- Keep enough USDC liquidity in the market for expected borrows and normal repayments.
- Monitor oracle freshness and contract balances. Stale oracle data blocks borrows, withdrawals, and liquidations that need a fresh health check.
- Understand there is no depositor accounting layer here. `addLiquidity` and `removeLiquidity` are operator actions for supplying or removing idle USDC from the pool.

Recommended pre-deployment checks:

- Verify USDC really uses 6 decimals on the target network.
- Verify the chosen oracle returns ETH/USD with the expected decimals and update cadence.
- Dry-run liquidation math against extreme prices and long periods of accrued interest.
- Run static analysis and a mainnet-fork test pass before shipping value through it.
