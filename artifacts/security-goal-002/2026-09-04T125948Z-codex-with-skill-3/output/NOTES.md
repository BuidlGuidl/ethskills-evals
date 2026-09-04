# Notes

## Health computation

The market tracks each account's position as:

- `collateralAmount` in WETH, scaled to `1e18`
- `debtAmount` in USDC base units, scaled to `1e6`
- `lastAccrued` timestamp for lazy interest accrual

Interest accrues linearly whenever a position is touched or queried:

```text
interest = debtAmount * annualInterestBps * elapsed / (10_000 * 365 days)
accruedDebt = debtAmount + interest
```

Collateral value is computed from the latest Chainlink ETH/USD answer and normalized into USDC base units:

```text
collateralValueUsdc = wethAmount * ethPriceUsd / 1e30
```

There are two thresholds:

- Borrow / withdrawal limit: `accruedDebt <= collateralValueUsdc * 70%`
- Liquidation threshold: `accruedDebt > collateralValueUsdc * 85%`

That means a borrower can only increase leverage or withdraw collateral if the resulting position remains at or below 70% LTV. Liquidation starts once the position moves above 85% LTV.

## Liquidation flow

A liquidator must:

1. Read the borrower's live debt and confirm the position is above the 85% liquidation threshold.
2. Approve USDC to the market contract.
3. Call `liquidate(account, repayAmount, receiver)`.

The contract caps the actual repay amount to the lesser of:

- the requested repay amount
- the borrower's current debt
- the amount that can be covered by the remaining collateral after applying the 5% liquidation bonus

Seized collateral is:

```text
baseCollateral = repayAmount / ethPrice
seizedCollateral = baseCollateral * 1.05
```

The liquidator transfers in USDC and receives WETH directly to `receiver`.

## Mainnet deployment / operations

An operator needs to get these right:

- Use canonical mainnet WETH and USDC addresses, and a manipulation-resistant ETH/USD oracle.
- Set `ORACLE_MAX_AGE` to a value derived from the oracle heartbeat plus a safety margin. If it is too loose, stale prices can drive bad liquidations or bad borrows. If it is too tight, healthy positions may become temporarily unusable.
- Prefund the contract with enough USDC liquidity before allowing borrowing. Borrows are paid from the contract's current USDC balance.
- Pick an `ANNUAL_INTEREST_BPS` that matches the intended product economics, because it is immutable in this version.
- Verify that the chosen oracle decimals and token decimals match the assumptions here: WETH `18`, USDC `6`.
- Run mainnet-fork tests against the exact deployment configuration, especially for staleness handling, rounding around the 70% and 85% thresholds, and liquidation behavior when collateral value has dropped sharply.
- Monitor liquidity. If the contract runs out of idle USDC, new borrows revert even if users still have borrow capacity.

Example deploy command:

```bash
WETH=<weth-address> \
USDC=<usdc-address> \
COLLATERAL_ORACLE=<eth-usd-oracle-address> \
ANNUAL_INTEREST_BPS=500 \
ORACLE_MAX_AGE=5400 \
forge script script/Deploy.s.sol:Deploy --rpc-url $MAINNET_RPC_URL --broadcast
```
